import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendToAll } from "@/lib/push";

async function signedIn() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

// Turn alerts on for this device.
export async function POST(request: Request) {
  const { supabase, user } = await signedIn();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { endpoint, p256dh, auth } = await request.json().catch(() => ({}));
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || typeof p256dh !== "string" || typeof auth !== "string") {
    return NextResponse.json({ error: "invalid subscription" }, { status: 400 });
  }
  const { error } = await supabase.rpc("save_push_subscription", { p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Turn alerts off for this device.
export async function DELETE(request: Request) {
  const { supabase, user } = await signedIn();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { endpoint } = await request.json().catch(() => ({}));
  if (typeof endpoint !== "string") return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  const { error } = await supabase.rpc("remove_push_subscription", { p_endpoint: endpoint });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// The test button: only ever sends to your own devices.
export async function PUT() {
  const { supabase, user } = await signedIn();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data } = await supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", user.id);
  const targets = data ?? [];
  if (!targets.length) return NextResponse.json({ error: "no_device" }, { status: 409 });
  const result = await sendToAll(targets, {
    kind: "test",
    title: "📚 Notifications are working",
    body: "You'll hear from this app when someone on your board finishes a book.",
    url: "/boards",
  });
  return NextResponse.json({ sent: result.sent }, { status: result.sent > 0 ? 200 : 502 });
}
