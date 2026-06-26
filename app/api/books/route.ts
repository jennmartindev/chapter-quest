import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
  if (typeof cover_url === "string") patch.cover_url = cover_url.trim() || null;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "nothing to update" }, { status: 400 });

  const { error } = await supabase.from("books").update(patch).eq("id", book_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
