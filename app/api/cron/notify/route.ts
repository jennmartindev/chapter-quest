import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_SCHEMA, SUPABASE_URL } from "@/lib/supabase/env";
import { sendToAll, type PushMessage, type PushTarget } from "@/lib/push";

export const dynamic = "force-dynamic";

type Outgoing = PushMessage & { subscriptions: PushTarget[] };
const headers = { "Cache-Control": "private, no-store" };

// Called by the database's scheduled job, only when an alert is ready. The database checks the secret,
// so this app only needs the public key and never holds the secret itself.
export async function POST(request: Request) {
  const secret = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? "";
  const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: SUPABASE_SCHEMA },
  });

  const collected = await db.rpc("cron_collect_alerts", { p_secret: secret });
  if (collected.error) {
    const refused = collected.error.message === "invalid_token";
    if (!refused) console.error(`cron_collect_alerts failed: ${collected.error.message}`);
    return NextResponse.json({ error: refused ? "invalid_token" : "server_error" }, { status: refused ? 401 : 500, headers });
  }

  let sent = 0;
  let failed = 0;
  const gone: string[] = [];
  const messages = collected.data as Outgoing[];
  for (const m of messages) {
    const result = await sendToAll(m.subscriptions, m);
    sent += result.sent;
    failed += result.failed;
    gone.push(...result.gone);
  }
  if (gone.length) await db.rpc("cron_remove_subscriptions", { p_secret: secret, p_ids: gone });

  return NextResponse.json({ messages: messages.length, sent, failed }, { headers });
}
