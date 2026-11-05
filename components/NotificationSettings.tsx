"use client";

import { useEffect, useState } from "react";
import { useShell } from "./Shell";

type Status = "checking" | "unsupported" | "needs-install" | "blocked" | "off" | "on";

function toKey(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

const json = { "Content-Type": "application/json" };

export default function NotificationSettings({ initialFinished }: { initialFinished: boolean }) {
  const { toast } = useShell();
  const [status, setStatus] = useState<Status>("checking");
  const [finished, setFinished] = useState(initialFinished);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const iphone = /iPhone|iPad/.test(navigator.userAgent);
      const installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
      if (iphone && !installed) return setStatus("needs-install");
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setStatus("unsupported");
      if (Notification.permission === "denied") return setStatus("blocked");
      const registration = await navigator.serviceWorker.getRegistration();
      const existing = await registration?.pushManager.getSubscription();
      setStatus(existing ? "on" : "off");
    })().catch(() => setStatus("unsupported"));
  }, []);

  async function turnOn() {
    setBusy(true);
    setError("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "blocked" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toKey(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });
      const keys = sub.toJSON();
      const res = await fetch("/api/push", { method: "POST", headers: json, body: JSON.stringify({ endpoint: keys.endpoint, p256dh: keys.keys?.p256dh, auth: keys.keys?.auth }) });
      if (!res.ok) throw new Error("save failed");
      setStatus("on");
    } catch {
      setError("That didn't work on this device. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setError("");
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const sub = await registration?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push", { method: "DELETE", headers: json, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setStatus("off");
    } catch {
      setError("That didn't work. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    const res = await fetch("/api/push", { method: "PUT" });
    setBusy(false);
    toast(res.ok ? "Test sent. It should arrive in a few seconds." : "That test didn't reach your device. Try turning alerts off and on.");
  }

  async function toggleFinished(next: boolean) {
    setFinished(next);
    const res = await fetch("/api/profile", { method: "PATCH", headers: json, body: JSON.stringify({ notify_finished: next }) });
    if (!res.ok) {
      setFinished(!next);
      toast("Couldn't save that");
    }
  }

  return (
    <div className="notify-card">
      {status === "checking" && <p className="muted notify-note">Checking this device…</p>}
      {status === "needs-install" && <p className="notify-note">On iPhone, add this app to your Home Screen first (Share, then Add to Home Screen), and open it from there.</p>}
      {status === "unsupported" && <p className="muted notify-note">This browser doesn't support notifications.</p>}
      {status === "blocked" && <p className="notify-note">Notifications are blocked for this app. You can allow them in your device's settings.</p>}
      {status === "off" && <button type="button" className="chbtn notify-on" disabled={busy} onClick={turnOn}>{busy ? "Turning on…" : "Turn on for this device"}</button>}
      {status === "on" && (
        <div className="notify-row">
          <b>✓ On for this device</b>
          <span className="notify-actions">
            <button type="button" className="chbtn" disabled={busy} onClick={sendTest}>Send a test</button>
            <button type="button" className="chbtn" disabled={busy} onClick={turnOff}>Turn off</button>
          </span>
        </div>
      )}
      {error && <p role="alert" className="cover-error">{error}</p>}

      <label className="notify-check">
        <input type="checkbox" checked={finished} onChange={(e) => toggleFinished(e.target.checked)} />
        <span>When someone on my shared board finishes a book</span>
      </label>
      <p className="muted notify-note">Alerts wait a minute in case of an undo, and hold overnight until 8am Eastern.</p>
    </div>
  );
}
