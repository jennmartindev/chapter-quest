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

  const { book_id, square_id, why, status, slot_id } = await request.json().catch(() => ({}));
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
      ...(typeof slot_id === "string" || slot_id === null ? { slot_id } : {}),
    },
    { onConflict: "book_id,square_id" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// File a pick under one of the square's slots (or take it out with slot_id: null).
export async function PATCH(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { book_id, square_id, slot_id } = await request.json().catch(() => ({}));
  if (!book_id || !square_id || (slot_id !== null && typeof slot_id !== "string")) {
    return NextResponse.json({ error: "book_id, square_id and slot_id required" }, { status: 400 });
  }
  if (slot_id) {
    // The slot has to belong to this square (RLS already limits it to your own slots).
    const { data: slot } = await supabase.from("square_slots").select("square_id").eq("id", slot_id).maybeSingle();
    if (!slot || slot.square_id !== square_id) return NextResponse.json({ error: "slot not on this square" }, { status: 400 });
  }
  const { error } = await supabase
    .from("book_squares")
    .update({ slot_id })
    .eq("book_id", book_id)
    .eq("square_id", square_id)
    .eq("user_id", user.id);
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

export async function PUT(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { old_book_id, new_book_id, square_id } = await request.json().catch(() => ({}));
  if (!old_book_id || !new_book_id || !square_id) {
    return NextResponse.json({ error: "old_book_id, new_book_id and square_id required" }, { status: 400 });
  }
  if (old_book_id === new_book_id) return NextResponse.json({ ok: true });

  const { data: old } = await supabase
    .from("book_squares")
    .select("challenge_id, status, why")
    .eq("book_id", old_book_id)
    .eq("square_id", square_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!old) return NextResponse.json({ error: "pick not found" }, { status: 404 });

  const { data: book } = await supabase.from("books").select("id").eq("id", new_book_id).eq("user_id", user.id).maybeSingle();
  if (!book) return NextResponse.json({ error: "book not found" }, { status: 404 });

  // New pick first: if the second step fails, the square still has a book rather than none.
  const { error: addError } = await supabase.from("book_squares").upsert(
    { user_id: user.id, book_id: new_book_id, square_id, challenge_id: old.challenge_id, why: old.why, status: old.status },
    { onConflict: "book_id,square_id" }
  );
  if (addError) return NextResponse.json({ error: addError.message }, { status: 500 });

  const { error: removeError } = await supabase
    .from("book_squares")
    .delete()
    .eq("book_id", old_book_id)
    .eq("square_id", square_id)
    .eq("user_id", user.id);
  if (removeError) return NextResponse.json({ error: removeError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
