"use client";

import { useState } from "react";
import { useShell } from "./Shell";

export default function ShareButton({ challengeId }: { challengeId: string }) {
  const { toast } = useShell();
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function share() {
    setBusy(true);
    const res = await fetch("/api/challenges/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challenge_id: challengeId }),
    });
    setBusy(false);
    const d = await res.json();
    if (res.ok) setLink(`${window.location.origin}/join/${d.code}`);
    else toast(d.error ?? "Couldn't create a link");
  }

  if (link) {
    return (
      <div className="share-box">
        <span>Send this link to invite someone — they’ll see your picks and track their own progress:</span>
        <div className="share-row">
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
          <button onClick={() => { navigator.clipboard?.writeText(link); toast("Link copied"); }}>Copy</button>
        </div>
      </div>
    );
  }
  return (
    <button className="open" style={{ background: "var(--card-2)", color: "var(--accent-deep)", border: "1px solid var(--line)" }} onClick={share} disabled={busy}>
      {busy ? "…" : "Share / invite"}
    </button>
  );
}
