import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mergeResults, parseGoogle, parseOpenLibrary, type FoundBook } from "@/lib/books";

const UA = { "User-Agent": "ChapterQuest/1.0 (personal reading app)" };

async function openLibrary(q: string): Promise<FoundBook[]> {
  const params = new URLSearchParams({
    q,
    lang: "en",
    limit: "15",
    fields: "key,title,author_name,first_publish_year,number_of_pages_median,isbn,cover_i",
  });
  const res = await fetch(`https://openlibrary.org/search.json?${params}`, { headers: UA, signal: AbortSignal.timeout(8000), next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`open library ${res.status}`);
  return parseOpenLibrary((await res.json())?.docs ?? []);
}

async function google(q: string): Promise<FoundBook[]> {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  if (!key) return [];
  const params = new URLSearchParams({ q, country: "US", maxResults: "8", key });
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`, { headers: UA, signal: AbortSignal.timeout(8000), next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`google books ${res.status}`);
  return parseGoogle((await res.json())?.items ?? []);
}

// Runs here rather than in the browser, so the Google key stays private. Sign-in required.
export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 120) return NextResponse.json({ results: [] });

  // Google only tops up, so a slow or exhausted quota never holds back Open Library's results.
  const [ol, gb] = await Promise.allSettled([openLibrary(q), google(q)]);
  const lists = [ol, gb].map((r) => (r.status === "fulfilled" ? r.value : []));
  if (ol.status === "rejected" && gb.status === "rejected") {
    console.error("book search failed on both sources");
    return NextResponse.json({ error: "search_unavailable", results: [] }, { status: 502 });
  }
  return NextResponse.json({ results: mergeResults(lists) });
}
