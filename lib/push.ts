import webpush from "web-push";

export type PushTarget = { id?: string; endpoint: string; p256dh: string; auth: string };
export type PushMessage = { title: string; body: string; url: string; kind: string };

function configure() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "https://chapter-quest-1ae23d49141f.herokuapp.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

/** Sends to each device. Returns how many arrived, and which subscriptions are gone for good. */
export async function sendToAll(targets: PushTarget[], message: PushMessage) {
  configure();
  // A distinct tag per message, so a second alert doesn't silently replace the first.
  const payload = JSON.stringify({ title: message.title, body: message.body, url: message.url, tag: `${message.kind}-${message.url}` });
  let sent = 0;
  let failed = 0;
  const gone: string[] = [];
  await Promise.all(targets.map(async (t) => {
    try {
      await webpush.sendNotification(
        { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
        payload,
        { TTL: 24 * 60 * 60, timeout: 10_000 },
      );
      sent++;
    } catch (error) {
      failed++;
      const status = (error as { statusCode?: number }).statusCode;
      if ((status === 404 || status === 410) && t.id) gone.push(t.id);
      else console.error(`push failed with status ${status ?? "none"}`);
    }
  }));
  return { sent, failed, gone };
}
