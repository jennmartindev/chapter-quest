import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Log a book to a square (creates the credit). One book can be logged to many
// squares across many challenges — that's the double-dip.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { book_id, square_id, why, status } = await request.json().catch(() => ({}));
  if (!book_id || !square_id) {
    return NextResponse.json({ error: "book_id and square_id required" }, { status: 400 });
  }
  // "planned" = assigned/in-progress; "logged" = read & counts as complete.
  const st = status === "logged" ? "logged" : "planned";

  // Derive the challenge from the square (and confirm the user owns it via RLS).
  const { data: sq, error: sqErr } = await supabase
    .from("squares")
    .select("challenge_id")
    .eq("id", square_id)
    .single();
  if (sqErr || !sq) return NextResponse.json({ error: "square not found" }, { status: 404 });

  const { error } = await supabase.from("book_squares").upsert(
    {
      user_id: user.id,
      book_id,
      square_id,
      challenge_id: sq.challenge_id,
      why: why ?? null,
      status: st,
    },
    { onConflict: "book_id,square_id" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { book_id, square_id } = await request.json().catch(() => ({}));
  if (!book_id || !square_id) {
    return NextResponse.json({ error: "book_id and square_id required" }, { status: 400 });
  }
  const { error } = await supabase
    .from("book_squares")
    .delete()
    .eq("book_id", book_id)
    .eq("square_id", square_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
