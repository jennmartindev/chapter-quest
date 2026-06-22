import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// TEMPORARY diagnostic. Visit /api/debug while signed in. Reveals which
// Supabase project the app is talking to and whether the session reaches the
// database (RLS). No secrets are returned. Remove once the data issue is fixed.
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const projectRef = url.replace(/^https?:\/\//, "").split(".")[0] || "(unset)";

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ projectRef, authenticated: false });
  }

  const { count: challenges, error: chErr } = await supabase
    .from("challenges")
    .select("id", { count: "exact", head: true });
  const { count: squares } = await supabase
    .from("squares")
    .select("id", { count: "exact", head: true });
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json({
    projectRef,
    authenticated: true,
    userId: user.id,
    email: user.email,
    profileName: profile?.display_name ?? null,
    profileError: pErr?.message ?? null,
    challenges: challenges ?? 0,
    squares: squares ?? 0,
    challengesError: chErr?.message ?? null,
  });
}
