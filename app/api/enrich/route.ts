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

interface OLData { number_of_pages?: number; publish_date?: string; cover?: { small?: string; medium?: string; large?: string } }

function yearFrom(publish_date?: string): number | null {
  if (!publish_date) return null;
  const m = publish_date.match(/\b(1[89]\d\d|20\d\d)\b/);
  return m ? parseInt(m[1], 10) : null;
}

// Fallback for the ~30% of ISBNs Open Library lacks page counts for
// (newer 979-8 / KDP / self-pub editions). One ISBN per request.
async function googleBooksLookup(isbn: string): Promise<{ pages: number | null; year: number | null; cover: string | null } | null> {
  try {
    const key = process.env.GOOGLE_BOOKS_API_KEY ? `&key=${process.env.GOOGLE_BOOKS_API_KEY}` : "";
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&country=US${key}`, {
      headers: { "User-Agent": "ChapterQuest/0.1" },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const info = json?.items?.[0]?.volumeInfo;
    if (!info) return null;
    const cover = (info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || "").replace(/^http:/, "https:") || null;
    return { pages: typeof info.pageCount === "number" ? info.pageCount : null, year: yearFrom(info.publishedDate), cover };
  } catch {
    return null;
  }
}

const firstAuthor = (a: string | null) => (a ?? "").split(/[,;]/)[0].trim();

// Cover fallbacks by title/author — catch audiobooks (ASIN) and odd editions
// that ISBN lookups miss.
async function olSearchCover(title: string, author: string | null): Promise<string | null> {
  try {
    const q = new URLSearchParams({ title, limit: "1", fields: "cover_i,cover_edition_key" });
    if (author) q.set("author", firstAuthor(author));
    const res = await fetch(`https://openlibrary.org/search.json?${q}`, { headers: { "User-Agent": "DogEarsDunes/0.1" } });
    if (!res.ok) return null;
    const d = (await res.json())?.docs?.[0];
    if (d?.cover_i) return `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`;
    if (d?.cover_edition_key) return `https://covers.openlibrary.org/b/olid/${d.cover_edition_key}-M.jpg`;
    return null;
  } catch {
    return null;
  }
}
async function googleSearchCover(title: string, author: string | null): Promise<string | null> {
  try {
    const q = `intitle:${title}` + (author ? ` inauthor:${firstAuthor(author)}` : "");
    const key = process.env.GOOGLE_BOOKS_API_KEY ? `&key=${process.env.GOOGLE_BOOKS_API_KEY}` : "";
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&country=US&maxResults=1${key}`, {
      headers: { "User-Agent": "DogEarsDunes/0.1" },
    });
    if (!res.ok) return null;
    const info = (await res.json())?.items?.[0]?.volumeInfo;
    return (info?.imageLinks?.thumbnail || info?.imageLinks?.smallThumbnail || "").replace(/^http:/, "https:") || null;
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
    .select("id, isbn, title, author")
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
    let pages: number | null = null;
    let year: number | null = null;
    let cover: string | null = null;

    if (isRealIsbn(b.isbn)) {
      const d = olData[`ISBN:${cleanIsbn(b.isbn)}`];
      pages = d?.number_of_pages ?? null;
      year = yearFrom(d?.publish_date);
      cover = d?.cover?.medium ?? d?.cover?.large ?? d?.cover?.small ?? null;
      if (!pages || !year || !cover) {
        const g = await googleBooksLookup(cleanIsbn(b.isbn)!);
        if (g) { if (!pages) pages = g.pages; if (!year) year = g.year; if (!cover) cover = g.cover; }
      }
    }
    // Cover fallback by title/author (works even without an ISBN).
    if (!cover) cover = await olSearchCover(b.title, b.author);
    if (!cover) cover = await googleSearchCover(b.title, b.author);

    if (pages) patch.pages = pages;
    if (year) patch.publish_year = year;
    if (cover) patch.cover_url = cover;
    if (pages || year || cover) updated++;

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
