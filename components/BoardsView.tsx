"use client";

import { useState } from "react";
import Link from "next/link";
import type { ChallengeWithSquares } from "@/lib/types";

const RULE_TEXT: Record<string, string> = {
  hrcyed:
    "<b>Basic No Nonsense:</b> every book can count toward <b>two</b> squares. Rereads 5+ years old. No DNFs.",
  rfantasy:
    "<b>One square = one book.</b> No book reused on the card · 25 books, 24 authors · only <b>one</b> reread. Each square has an optional Hard Mode.",
};

type SquareBooks = Record<string, { title: string; cover: string | null }>;

export default function BoardsView({
  challenges,
  squareBooks,
  initialId,
}: {
  challenges: ChallengeWithSquares[];
  squareBooks: SquareBooks;
  initialId?: string;
}) {
  const [current, setCurrent] = useState(initialId ?? challenges[0]?.id);
  const ch = challenges.find((c) => c.id === current) ?? challenges[0];
  if (!ch) return <p className="empty">No challenges yet.</p>;

  function pick(c: ChallengeWithSquares) {
    setCurrent(c.id);
    // Persist the open board in the URL so returning from a square keeps it.
    if (typeof window !== "undefined" && c.template_key) {
      window.history.replaceState(null, "", `/boards?c=${c.template_key}`);
    }
  }

  const rule = RULE_TEXT[ch.template_key ?? ""] ?? "";
  const pct = ch.total ? Math.round((ch.done / ch.total) * 100) : 0;

  return (
    <>
      <div className="chswitch">
        {challenges.map((c) => (
          <button key={c.id} className={`chpill${c.id === current ? " on" : ""}`} onClick={() => pick(c)}>
            <span>{c.name}</span>
            <span className="s">{c.done} / {c.total} {c.unit}</span>
          </button>
        ))}
      </div>

      <section className="board-card">
        <div className="board-head">
          <div className="bh-l">
            <span className={`chtag ${ch.template_key ?? ""}`}>{ch.tag}</span>
            <h2>{ch.name}</h2>
          </div>
          <span className="frac"><b>{ch.done}</b> / {ch.total}</span>
        </div>
        <div className="bar"><i style={{ width: `${pct}%` }} /></div>

        <div className="legend">
          <span><i className="sw sw-empty" /> Nothing assigned</span>
          <span><i className="sw sw-options" /> Options picked</span>
          <span><i className="sw sw-progress" /> In progress</span>
          <span><i className="sw sw-done" /> Complete</span>
        </div>

        <div className="bingo">
          {ch.squares.map((s) => {
            const sb = squareBooks[s.id];
            const stateCls =
              s.state === "done" ? " done" : s.state === "progress" ? " progress" : s.state === "options" ? " options" : "";
            return (
              <Link key={s.id} href={`/square/${s.id}`} className={`sq${stateCls}`}>
                <span className="nm">{s.name}</span>
                {s.state !== "empty" && sb ? (
                  <span className="sqbk">
                    {sb.cover ? <img className="sqcover" src={sb.cover} alt="" loading="lazy" /> : null}
                    <span className="bk">{sb.title}</span>
                  </span>
                ) : (
                  <span className="cnt">{Math.min(s.logged, s.need)}/{s.need}</span>
                )}
              </Link>
            );
          })}
        </div>
      </section>

      {rule && <p className="ruleband" dangerouslySetInnerHTML={{ __html: rule }} />}
      <p className="board-tip">Tap any square to search your library and add a book.</p>
    </>
  );
}
