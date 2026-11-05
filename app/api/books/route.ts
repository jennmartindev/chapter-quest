import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isCoverUrl, sameTitle } from "@/lib/books";

const STATUSES = ["to-read", "currently-reading", "read", "did-not-finish"];

// Update a book's reading status (drives square completion: 'read' = complete,
// 'currently-reading' = in progress).
export async function PATCH(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { book_id, read_status, cover_url } = await request.json().catch(() => ({}));
  if (!book_id) return NextResponse.json({ error: "book_id required" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (read_status !== undefined) {
    if (!STATUSES.includes(read_status)) return NextResponse.json({ error: "invalid read_status" }, { status: 400 });
    patch.read_status = read_status;
  }
  if (typeof cover_url === "string") {
    const url = cover_url.trim();
    if (url && !isCoverUrl(url)) return NextResponse.json({ error: "invalid_cover" }, { status: 400 });
    patch.cover_url = url || null;
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "nothing to update" }, { status: 400 });

  const { error } = await supabase.from("books").update(patch).eq("id", book_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Other members see your pick through this saved copy, so a new cover has to reach it too.
  if ("cover_url" in patch) {
    await supabase.from("book_squares").update({ pick_cover: patch.cover_url }).eq("book_id", book_id).eq("user_id", user.id);
  }
  return NextResponse.json({ ok: true });
}

const whole = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null);

// Adds a found book to your library, or returns the one you already have.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 300) : "";
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
  const author = typeof body.author === "string" ? body.author.trim().slice(0, 200) || null : null;
  const isbn = typeof body.isbn === "string" ? body.isbn.trim().slice(0, 20) || null : null;
  const cover = typeof body.cover_url === "string" && isCoverUrl(body.cover_url) ? body.cover_url.trim() : null;

  const { data: mine, error: readError } = await supabase.from("books").select("id, title, author, isbn, cover_url").eq("user_id", user.id);
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  const lower = (s: string | null) => (s ?? "").toLowerCase();
  const existing = (mine ?? []).find((b) =>
    (isbn && b.isbn === isbn) || (sameTitle(b.title, title) && (!b.author || !author || lower(b.author) === lower(author))));
  if (existing) {
    if (!existing.cover_url && cover) await supabase.from("books").update({ cover_url: cover }).eq("id", existing.id);
    return NextResponse.json({ id: existing.id, existed: true });
  }

  const { data, error } = await supabase.from("books").insert({
    user_id: user.id, title, author, isbn, pages: whole(body.pages), publish_year: whole(body.publish_year),
    cover_url: cover, source: "search", read_status: "to-read", enriched: true,
  }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id, existed: false });
}
