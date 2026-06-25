import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

// Turn a challenge into a shared board: ensure an invite code, mark it shared,
// and add the owner as a member. Returns the invite code.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { challenge_id } = await request.json().catch(() => ({}));
  if (!challenge_id) return NextResponse.json({ error: "challenge_id required" }, { status: 400 });

  const { data: ch, error: chErr } = await supabase
    .from("challenges")
    .select("id, user_id, invite_code, template_key")
    .eq("id", challenge_id)
    .single();
  if (chErr || !ch) return NextResponse.json({ error: "challenge not found" }, { status: 404 });
  if (ch.user_id !== user.id) return NextResponse.json({ error: "only the owner can share" }, { status: 403 });

  let code = ch.invite_code as string | null;
  if (!code) {
    code = randomUUID().replace(/-/g, "").slice(0, 10);
    const { error } = await supabase.from("challenges").update({ invite_code: code, shared: true }).eq("id", challenge_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    await supabase.from("challenges").update({ shared: true }).eq("id", challenge_id);
  }

  // Owner joins as a member so they appear alongside invitees.
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).single();
  await supabase
    .from("challenge_members")
    .upsert({ challenge_id, user_id: user.id, display_name: profile?.display_name ?? "Reader", role: "owner" }, { onConflict: "challenge_id,user_id" });

  return NextResponse.json({ ok: true, code });
}
