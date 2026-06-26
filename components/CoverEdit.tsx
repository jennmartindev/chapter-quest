"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useShell } from "./Shell";

// Manual cover override — paste an image URL for books auto-match missed (or to
// swap a wrong cover). Tip: right-click a cover on Google/Amazon → Copy image address.
export default function CoverEdit({ bookId, hasCover }: { bookId: string; hasCover: boolean }) {
  const router = useRouter();
  const { toast } = useShell();
  const [busy, setBusy] = useState(false);

  async function edit() {
    const url = window.prompt("Paste a cover image URL (or leave blank to clear):", "");
    if (url === null) return;
    setBusy(true);
    const res = await fetch("/api/books", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ book_id: bookId, cover_url: url }),
    });
    setBusy(false);
    if (res.ok) { toast(url.trim() ? "Cover updated" : "Cover cleared"); router.refresh(); }
    else toast("Couldn't update the cover");
  }

  return (
    <button className="cover-edit" disabled={busy} onClick={edit}>
      {hasCover ? "Change cover" : "Set cover"}
    </button>
  );
}
