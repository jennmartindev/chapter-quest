import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cleanIsbn, isRealIsbn, suggestFromMeta } from "@/lib/storygraph";

export const maxDuration = 60;
const BATCH = 20;

// How many books still need enrichment.
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { count } = await supabase
    .from("books")
    .select("id", { count: "exact", head: true })
    .eq("enriched", false);
  return NextResponse.json({ remaining: count ?? 0 });
}

interface OLData { number_of_pages?: number; publish_date?: string }

function yearFrom(publish_date?: string): number | null {
  if (!publish_date) return null;
  const m = publish_date.match(/\b(1[89]\d\d|20\d\d)\b/);
  return m ? parseInt(m[1], 10) : null;
}

// Fallback for the ~30% of ISBNs Open Library lacks page counts for
// (newer 979-8 / KDP / self-pub editions). One ISBN per request.
async function googleBooksLookup(isbn: string): Promise<{ pages: number | null; year: number | null } | null> {
  try {
    const key = process.env.GOOGLE_BOOKS_API_KEY ? `&key=${process.env.GOOGLE_BOOKS_API_KEY}` : "";
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&country=US${key}`, {
      headers: { "User-Agent": "ChapterQuest/0.1" },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const info = json?.items?.[0]?.volumeInfo;
    if (!info) return null;
    return { pages: typeof info.pageCount === "number" ? info.pageCount : null, year: yearFrom(info.publishedDate) };
  } catch {
    return null;
  }
}

// Process one batch of un-enriched books against Open Library.
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: books } = await supabase
    .from("books")
    .select("id, isbn, title")
    .eq("enriched", false)
    .limit(BATCH);

  if (!books || books.length === 0) {
    return NextResponse.json({ processed: 0, updated: 0, suggested: 0, remaining: 0 });
  }

  // Square-key → square_id mapping for this user (for page/year suggestions).
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

  const lookupable = books.filter((b) => isRealIsbn(b.isbn));
  const byIsbn = new Map<string, { id: string; title: string }>();
  for (const b of lookupable) byIsbn.set(cleanIsbn(b.isbn)!, { id: b.id, title: b.title });

  let olData: Record<string, OLData> = {};
  if (byIsbn.size > 0) {
    const keys = Array.from(byIsbn.keys()).map((i) => `ISBN:${i}`).join(",");
    try {
      const res = await fetch(
        `https://openlibrary.org/api/books?bibkeys=${encodeURIComponent(keys)}&format=json&jscmd=data`,
        { headers: { "User-Agent": "ChapterQuest/0.1 (reading challenge app)" } }
      );
      if (!res.ok) throw new Error(`Open Library ${res.status}`);
      olData = (await res.json()) as Record<string, OLData>;
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "lookup failed" },
        { status: 502 }
      );
    }
  }

  let updated = 0;
  const suggestionRows: Record<string, unknown>[] = [];

  for (const b of books) {
    const patch: Record<string, unknown> = { enriched: true };
    if (isRealIsbn(b.isbn)) {
      const d = olData[`ISBN:${cleanIsbn(b.isbn)}`];
      let pages = d?.number_of_pages ?? null;
      let year = yearFrom(d?.publish_date);
      // Open Library miss → try Google Books for whatever's still missing.
      if (!pages || !year) {
        const g = await googleBooksLookup(cleanIsbn(b.isbn)!);
        if (g) { if (!pages) pages = g.pages; if (!year) year = g.year; }
      }
      if (pages) patch.pages = pages;
      if (year) patch.publish_year = year;
      if (pages || year) updated++;
      for (const sug of suggestFromMeta(pages, year)) {
        const squareId = squareIdByTmplKey.get(`${sug.templateKey}/${sug.squareKey}`);
        if (squareId) {
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
    }
    await supabase.from("books").update(patch).eq("id", b.id);
  }

  let suggested = 0;
  if (suggestionRows.length) {
    const { count } = await supabase
      .from("book_squares")
      .upsert(suggestionRows, { onConflict: "book_id,square_id", count: "exact", ignoreDuplicates: true });
    suggested = count ?? 0;
  }

  const { count: remaining } = await supabase
    .from("books")
    .select("id", { count: "exact", head: true })
    .eq("enriched", false);

  return NextResponse.json({ processed: books.length, updated, suggested, remaining: remaining ?? 0 });
}
