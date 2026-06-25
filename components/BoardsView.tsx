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

type SquareBooks = Record<string, { title: string; g1: string; g2: string }>;

export default function BoardsView({
  challenges,
  dipSquareIds,
  squareBooks,
}: {
  challenges: ChallengeWithSquares[];
  dipSquareIds: string[];
  squareBooks: SquareBooks;
}) {
  const [current, setCurrent] = useState(challenges[0]?.id);
  const ch = challenges.find((c) => c.id === current) ?? challenges[0];
  const dips = new Set(dipSquareIds);
  if (!ch) return <p className="empty">No challenges yet.</p>;

  const rule = RULE_TEXT[ch.template_key ?? ""] ?? "";
  const pct = ch.total ? Math.round((ch.done / ch.total) * 100) : 0;

  return (
    <>
      <div className="chswitch">
        {challenges.map((c) => (
          <button key={c.id} className={`chpill${c.id === current ? " on" : ""}`} onClick={() => setCurrent(c.id)}>
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
          <span><i className="dot empty" /> Not started</span>
          <span><i className="dot partial" /> In progress</span>
          <span><i className="dot done" /> Complete</span>
          <span><i className="dot dip" /> fills 2 challenges</span>
        </div>

        <div className="bingo">
          {ch.squares.map((s) => {
            const done = s.logged >= s.need;
            const partial = s.logged > 0 && !done;
            const book = squareBooks[s.id];
            const cls = `sq${done ? " done" : partial ? " partial" : ""}${dips.has(s.id) ? " dip" : ""}`;
            return (
              <Link key={s.id} href={`/square/${s.id}`} className={cls}>
                <span className="nm">{s.name}</span>
                {done && book ? (
                  <span className="bk">{book.title}</span>
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
