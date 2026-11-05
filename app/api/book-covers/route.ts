import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { firstAuthor, matchingWorks, openLibraryCover, parseGoogle } from "@/lib/books";

const UA = { "User-Agent": "ChapterQuest/1.0 (personal reading app)" };
const MAX = 12;

async function json(url: string) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(8000), next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

// Different covers for the same book: its editions on Open Library, then Google if there's a key.
async function openLibraryCovers(title: string, author: string | null): Promise<string[]> {
  // A plain search: the strict title and author fields can miss a book entirely.
  const params = new URLSearchParams({ q: `${title} ${firstAuthor(author)}`.trim(), limit: "8", fields: "key,title,author_name,cover_i" });
  const { docs = [] } = await json(`https://openlibrary.org/search.json?${params}`);
  const matches = matchingWorks(docs as { key?: string; title?: string; author_name?: string[]; cover_i?: number }[], title, author);

  const ids = new Set<number>();
  for (const d of matches) if (d.cover_i && d.cover_i > 0) ids.add(d.cover_i);
  // The closest match's other editions give the most choice.
  const key = matches.find((d) => d.key)?.key;
  if (key && /^\/works\/OL\d+W$/.test(key)) {
    const work = await json(`https://openlibrary.org${key}.json`).catch(() => null);
    for (const id of (work?.covers ?? []) as number[]) if (id > 0) ids.add(id);
  }
  return [...ids].map(openLibraryCover);
}

async function googleCovers(title: string, author: string | null): Promise<string[]> {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  if (!key) return [];
  const params = new URLSearchParams({ q: `intitle:${title}${author ? ` inauthor:${firstAuthor(author)}` : ""}`, maxResults: "6", key });
  const { items = [] } = await json(`https://www.googleapis.com/books/v1/volumes?${params}`);
  return parseGoogle(items).flatMap((b) => b.cover ?? []);
}

export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const title = params.get("title")?.trim().slice(0, 200) ?? "";
  const author = params.get("author")?.trim().slice(0, 120) || null;
  if (!title) return NextResponse.json({ covers: [] });

  const [ol, gb] = await Promise.allSettled([openLibraryCovers(title, author), googleCovers(title, author)]);
  const covers = [ol, gb].flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  return NextResponse.json({ covers: [...new Set(covers)].slice(0, MAX) });
}
