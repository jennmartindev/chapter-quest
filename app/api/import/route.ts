import { NextResponse } from "next/server";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/server";
import { bestRowPerBook, importChanges, parseStoryGraphRow, suggestSquares, isRealIsbn } from "@/lib/storygraph";

export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { csv } = await request.json().catch(() => ({ csv: "" }));
  if (!csv || typeof csv !== "string") {
    return NextResponse.json({ error: "No CSV provided." }, { status: 400 });
  }

  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  if (parsed.errors.length && !parsed.data.length) {
    return NextResponse.json({ error: "Couldn't parse that CSV. Is it a StoryGraph export?" }, { status: 400 });
  }

  const rows = bestRowPerBook(parsed.data.map(parseStoryGraphRow).filter(Boolean) as NonNullable<
    ReturnType<typeof parseStoryGraphRow>
  >[]);
  if (rows.length === 0) {
    return NextResponse.json({ error: "No books found in that file." }, { status: 400 });
  }

  // Match against the existing library (case-insensitive title + author). A book already here gets
  // the export's newer status, date and rating, so finishing a book and re-importing fills its squares.
  const { data: existing } = await supabase.from("books").select("id, title, author, read_status, date_read, star_rating");
  type Existing = { id: string; title: string; author: string | null; read_status: string; date_read: string | null; star_rating: number | null };
  const keyOf = (title: string, author: string | null) => `${title.toLowerCase()}|${(author ?? "").toLowerCase()}`;
  const byKey = new Map(((existing ?? []) as Existing[]).map((b) => [keyOf(b.title, b.author), b]));
  const seen = new Set<string>();

  const updates: { id: string; patch: Record<string, unknown> }[] = [];
  const toInsert: Record<string, unknown>[] = [];
  for (const r of rows) {
    const key = keyOf(r.title, r.author);
    if (seen.has(key)) continue;
    seen.add(key);
    const have = byKey.get(key);
    if (have) {
      const patch = importChanges(have, r);
      if (patch) updates.push({ id: have.id, patch });
      continue;
    }
    // Books with a real ISBN queue for Open Library enrichment; others (audio
    // ASINs, blanks) are marked enriched so the backfill loop terminates.
    toInsert.push({ ...r, user_id: user.id, enriched: !isRealIsbn(r.isbn) });
  }

  let updated = 0;
  for (let i = 0; i < updates.length; i += 20) {
    const results = await Promise.all(
      updates.slice(i, i + 20).map((u) => supabase.from("books").update(u.patch).eq("id", u.id))
    );
    updated += results.filter((res) => !res.error).length;
  }

  let inserted: { id: string; title: string }[] = [];
  if (toInsert.length) {
    const { data, error } = await supabase.from("books").insert(toInsert).select("id, title");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    inserted = data ?? [];
  }

  // Map (template_key, square_key) -> square_id and square_id -> challenge_id for THIS user.
  const { data: challenges } = await supabase.from("challenges").select("id, template_key");
  const { data: squares } = await supabase.from("squares").select("id, key, challenge_id");
  const tmplByChallenge = new Map((challenges ?? []).map((c) => [c.id, c.template_key as string | null]));
  const squareIdByTmplKey = new Map<string, string>();
  const challengeBySquare = new Map<string, string>();
  for (const s of squares ?? []) {
    challengeBySquare.set(s.id, s.challenge_id);
    const tmpl = tmplByChallenge.get(s.challenge_id);
    if (tmpl) squareIdByTmplKey.set(`${tmpl}/${s.key}`, s.id);
  }

  // Auto-suggest square matches from titles (status: planned).
  const suggestionRows: Record<string, unknown>[] = [];
  for (const b of inserted) {
    for (const sug of suggestSquares(b.title)) {
      const squareId = squareIdByTmplKey.get(`${sug.templateKey}/${sug.squareKey}`);
      if (!squareId) continue;
      suggestionRows.push({
        user_id: user.id,
        book_id: b.id,
        square_id: squareId,
        challenge_id: challengeBySquare.get(squareId),
        why: sug.why,
        status: "planned",
      });
    }
  }
  let suggested = 0;
  if (suggestionRows.length) {
    const { error, count } = await supabase
      .from("book_squares")
      .upsert(suggestionRows, { onConflict: "book_id,square_id", count: "exact", ignoreDuplicates: true });
    if (!error) suggested = count ?? suggestionRows.length;
  }

  return NextResponse.json({
    ok: true,
    parsed: rows.length,
    imported: inserted.length,
    updated,
    skipped: rows.length - inserted.length - updated,
    suggested,
  });
}
