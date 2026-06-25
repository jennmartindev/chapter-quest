import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Per-member progress on a shared square: 'reading' | 'done'. DELETE clears it.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { square_id, status } = await request.json().catch(() => ({}));
  if (!square_id || !["reading", "done"].includes(status)) {
    return NextResponse.json({ error: "square_id and valid status required" }, { status: 400 });
  }

  const { data: sq } = await supabase.from("squares").select("challenge_id").eq("id", square_id).single();
  if (!sq) return NextResponse.json({ error: "square not found" }, { status: 404 });

  const { error } = await supabase.from("square_progress").upsert(
    { user_id: user.id, square_id, challenge_id: sq.challenge_id, status, auto: false, updated_at: new Date().toISOString() },
    { onConflict: "square_id,user_id" }
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

  const { square_id } = await request.json().catch(() => ({}));
  if (!square_id) return NextResponse.json({ error: "square_id required" }, { status: 400 });

  const { error } = await supabase.from("square_progress").delete().eq("square_id", square_id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
