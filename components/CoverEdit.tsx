"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useShell } from "./Shell";
import { isCoverUrl } from "@/lib/books";

/** Confirms the link really loads as a picture before it's saved. */
function loadsAsImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = window.setTimeout(() => resolve(false), 8000);
    img.onload = () => { window.clearTimeout(timer); resolve(img.naturalWidth > 1); };
    img.onerror = () => { window.clearTimeout(timer); resolve(false); };
    img.src = url;
  });
}

export default function CoverEdit({ bookId, title, author, hasCover }: { bookId: string; title: string; author?: string | null; hasCover: boolean }) {
  const router = useRouter();
  const { toast } = useShell();
  const [open, setOpen] = useState(false);
  const [covers, setCovers] = useState<string[] | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let live = true;
    setCovers(null);
    setHidden([]);
    const params = new URLSearchParams({ title });
    if (author) params.set("author", author);
    fetch(`/api/book-covers?${params}`)
      .then((r) => (r.ok ? r.json() : { covers: [] }))
      .then((body) => { if (live) setCovers(body.covers ?? []); })
      .catch(() => { if (live) setCovers([]); });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { live = false; window.removeEventListener("keydown", onKey); };
  }, [open, title, author]);

  async function save(url: string) {
    setBusy(true);
    setError("");
    const res = await fetch("/api/books", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ book_id: bookId, cover_url: url }),
    });
    setBusy(false);
    if (!res.ok) return setError("Couldn't save that cover. Please try again.");
    toast(url ? "Cover updated" : "Cover removed");
    setOpen(false);
    setPasted("");
    router.refresh();
  }

  async function savePasted(e: React.FormEvent) {
    e.preventDefault();
    const url = pasted.trim();
    if (!isCoverUrl(url)) {
      return setError("That link is a web page, not an image. Long-press or right-click the picture and copy the image address.");
    }
    setBusy(true);
    setError("");
    const works = await loadsAsImage(url);
    setBusy(false);
    if (!works) return setError("That image wouldn't load. It may be blocked, so try another link.");
    await save(url);
  }

  const options = covers?.filter((c) => !hidden.includes(c));

  return (
    <>
      <button type="button" className="cover-edit" onClick={() => setOpen(true)}>{hasCover ? "Change cover" : "Set cover"}</button>
      {open && (
        <div className="sheet-back" onClick={() => setOpen(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label={`Choose a cover for ${title}`} onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <h2>Choose a cover</h2>
              <button type="button" className="chbtn" onClick={() => setOpen(false)}>Close</button>
            </div>
            <p className="muted sheet-title">{title}</p>

            {options === undefined && <p className="muted" role="status" style={{ fontSize: 12.5 }}>Looking for covers…</p>}
            {options?.length === 0 && <p className="muted" style={{ fontSize: 12.5 }}>No covers found. You can paste an image link below.</p>}
            {options && options.length > 0 && (
              <div className="cover-grid">
                {options.map((url) => (
                  <button type="button" key={url} className="cover-opt" disabled={busy} aria-label="Use this cover" onClick={() => save(url)}>
                    <img src={url} alt="" loading="lazy" onError={() => setHidden((h) => [...h, url])} />
                  </button>
                ))}
              </div>
            )}

            <form className="cover-paste" onSubmit={savePasted}>
              <label htmlFor={`cover-url-${bookId}`}>Or paste an image link</label>
              <div className="cover-paste-row">
                <input id={`cover-url-${bookId}`} type="url" inputMode="url" value={pasted} onChange={(e) => { setPasted(e.target.value); setError(""); }} placeholder="https://…" />
                <button className="chbtn" disabled={busy || !pasted.trim()}>{busy ? "Checking…" : "Use"}</button>
              </div>
            </form>
            {error && <p role="alert" className="cover-error">{error}</p>}

            {hasCover && <button type="button" className="chbtn cover-remove" disabled={busy} onClick={() => save("")}>Remove cover</button>}
          </div>
        </div>
      )}
    </>
  );
}
