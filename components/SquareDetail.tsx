"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useShell } from "./Shell";

interface HereBook { id: string; title: string; status: string; g1: string; g2: string; alsoFills: { name: string; tag: string }[]; }
interface TbrBook { id: string; title: string; author: string | null; g1: string; g2: string; }

export default function SquareDetail(props: {
  squareId: string; squareName: string; rule: string; need: number; logged: number;
  challengeName: string; challengeTag: string; templateKey: string; maxPerBook: number;
  dipCount: number; here: HereBook[]; tbr: TbrBook[];
}) {
  const router = useRouter();
  const { toast } = useShell();
  const [busy, setBusy] = useState<string | null>(null);

  const done = props.logged >= props.need;

  async function assign(book_id: string, title: string) {
    setBusy(book_id);
    const res = await fetch("/api/book-squares", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ book_id, square_id: props.squareId }),
    });
    setBusy(null);
    if (res.ok) { toast(`Logged “${title}”`); router.refresh(); }
    else toast("Couldn't log that — try again");
  }

  async function remove(book_id: string) {
    setBusy(book_id);
    const res = await fetch("/api/book-squares", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ book_id, square_id: props.squareId }),
    });
    setBusy(null);
    if (res.ok) { toast("Removed"); router.refresh(); }
  }

  const pips = Array.from({ length: props.need }, (_, i) => i < props.logged);

  const dipHint =
    props.dipCount > 0
      ? `🤹 Double-dip: ${props.dipCount} book${props.dipCount > 1 ? "s" : ""} here also fill a square in another challenge.`
      : props.maxPerBook > 1
      ? "💡 Double-dip: in this challenge a book here can also fill one other square."
      : "ℹ️ On this card, one book fills exactly one square.";

  return (
    <>
      <div className="detail-head">
        <div className="topline">
          <span className={`chtag ${props.templateKey}`}>{props.challengeTag}</span>
          <span className="eyebrow">{props.challengeName}</span>
        </div>
        <h2>{props.squareName}</h2>
        <p className="rule">{props.rule}</p>
        <div className="pips">{pips.map((on, i) => <span key={i} className={`pip${on ? " on" : ""}`} />)}</div>
        <div className="pcount">
          {Math.min(props.logged, props.need)} of {props.need} {props.need === 1 ? "book" : "books"} logged{done ? " · complete ✓" : ""}
        </div>
        <div className="twosq">{dipHint}</div>
      </div>

      {props.here.length > 0 && (
        <>
          <div className="section-title"><h2 style={{ fontSize: 16 }}>Logged here</h2></div>
          {props.here.map((b) => (
            <div className="match" key={b.id}>
              <div className="cover" style={{ background: `linear-gradient(160deg, ${b.g1}, ${b.g2})` }} />
              <div className="mt">
                <b>{b.title}</b>
                <span>{b.alsoFills.length ? "also fills: " + b.alsoFills.map((a) => `${a.name} (${a.tag})`).join(" · ") : "fills this square"}</span>
              </div>
              <button className="add" disabled={busy === b.id} onClick={() => remove(b.id)}>Remove</button>
            </div>
          ))}
        </>
      )}

      <div className="section-title"><h2 style={{ fontSize: 16 }}>Add from your TBR</h2></div>
      {props.tbr.length === 0 ? (
        <p className="muted" style={{ fontSize: 12.5 }}>No to-read books yet. Import your StoryGraph CSV to fill your TBR.</p>
      ) : (
        props.tbr.slice(0, 12).map((b) => (
          <div className="match" key={b.id}>
            <div className="cover" style={{ background: `linear-gradient(160deg, ${b.g1}, ${b.g2})` }} />
            <div className="mt"><b>{b.title}</b><span>{b.author ?? ""}</span></div>
            <button className="add" disabled={busy === b.id} onClick={() => assign(b.id, b.title)}>Log here</button>
          </div>
        ))
      )}
    </>
  );
}
