import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Archive / unarchive a challenge you own.
export async function PATCH(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id, archived } = await request.json().catch(() => ({}));
  if (!id || typeof archived !== "boolean") {
    return NextResponse.json({ error: "id and archived required" }, { status: 400 });
  }
  // RLS limits this to the owner's own challenge.
  const { error } = await supabase.from("challenges").update({ archived }).eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Delete a challenge you own, OR leave a shared board you joined.
export async function DELETE(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id, leave } = await request.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  if (leave) {
    const { error } = await supabase.from("challenge_members").delete().eq("challenge_id", id).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, left: true });
  }

  // Owner delete — cascades to squares, picks, progress, members.
  const { error } = await supabase.from("challenges").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
