"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useShell } from "./Shell";

export default function ChallengeActions({
  challengeId,
  isOwner,
  archived,
  name,
}: {
  challengeId: string;
  isOwner: boolean;
  archived: boolean;
  name: string;
}) {
  const router = useRouter();
  const { toast } = useShell();
  const [busy, setBusy] = useState(false);

  async function setArchived(value: boolean) {
    setBusy(true);
    const res = await fetch("/api/challenges", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: challengeId, archived: value }),
    });
    setBusy(false);
    if (res.ok) { toast(value ? "Archived" : "Restored"); router.refresh(); }
  }

  async function destroy(leave: boolean) {
    const msg = leave
      ? `Leave “${name}”? You'll stop seeing this shared board.`
      : `Delete “${name}” for good? This removes its squares, picks and progress and can't be undone.`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    const res = await fetch("/api/challenges", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: challengeId, leave }),
    });
    setBusy(false);
    if (res.ok) { toast(leave ? "Left board" : "Deleted"); router.refresh(); }
    else toast("Couldn't do that");
  }

  if (!isOwner) {
    return <button className="chbtn" disabled={busy} onClick={() => destroy(true)}>Leave</button>;
  }
  return (
    <>
      {archived ? (
        <button className="chbtn" disabled={busy} onClick={() => setArchived(false)}>Restore</button>
      ) : (
        <button className="chbtn" disabled={busy} onClick={() => setArchived(true)}>Archive</button>
      )}
      <button className="chbtn danger" disabled={busy} onClick={() => destroy(false)}>Delete</button>
    </>
  );
}
