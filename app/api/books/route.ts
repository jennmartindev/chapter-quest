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

  const { book_id, read_status } = await request.json().catch(() => ({}));
  if (!book_id || !STATUSES.includes(read_status)) {
    return NextResponse.json({ error: "book_id and a valid read_status required" }, { status: 400 });
  }

  const { error } = await supabase.from("books").update({ read_status }).eq("id", book_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
