"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useShell } from "./Shell";

// One published card you haven't started yet, with a button that copies it onto your account.
export default function StartChallenge({ template, name, dates }: { template: string; name: string; dates: string }) {
  const router = useRouter();
  const { toast } = useShell();
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    const res = await fetch("/api/challenges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ template }) });
    setBusy(false);
    if (!res.ok) return toast("Couldn't start that challenge");
    const { id } = await res.json();
    toast(`Started ${name}`);
    router.push(`/boards?id=${id}`);
  }

  return (
    <div className="arch-row">
      <b>{name}</b>
      <span className="muted" style={{ fontSize: 12 }}>{dates}</span>
      <span className="arch-actions">
        <button type="button" className="chbtn" disabled={busy} onClick={start}>{busy ? "Starting…" : "Start"}</button>
      </span>
    </div>
  );
}
