"use client";

import { useState } from "react";
import Link from "next/link";
import type { ChallengeWithSquares } from "@/lib/types";

const RULE_TEXT: Record<string, string> = {
  hrcyed:
    "<b>Basic No Nonsense:</b> every book can count toward <b>two</b> squares. Rereads 5+ years old. No DNFs. Squares show <b>books logged / needed</b>.",
  rfantasy:
    "<b>One square = one book.</b> No book reused on the card · 25 books, 24 authors · only <b>one</b> reread. Each square has an optional Hard Mode.",
};

export default function BoardsView({
  challenges,
  dipSquareIds,
}: {
  challenges: ChallengeWithSquares[];
  dipSquareIds: string[];
}) {
  const [current, setCurrent] = useState(challenges[0]?.id);
  const ch = challenges.find((c) => c.id === current) ?? challenges[0];
  const dips = new Set(dipSquareIds);

  if (!ch) return <p className="empty">No challenges yet.</p>;

  const rule = RULE_TEXT[ch.template_key ?? ""] ?? `One book per square. ${ch.total} squares.`;
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

      <div className="board-meta">
        <h2>{ch.name}</h2>
        <span className="frac"><b>{ch.done}</b> / {ch.total} {ch.unit}</span>
      </div>
      <div className="bar" style={{ marginTop: 10 }}><i style={{ width: `${pct}%` }} /></div>
      <div className="ruleband" dangerouslySetInnerHTML={{ __html: rule }} />

      <div className="legend">
        <span><i className="dot empty" /> Not started</span>
        <span><i className="dot partial" /> In progress</span>
        <span><i className="dot done" /> Complete</span>
        <span>🟡 fills 2 challenges</span>
      </div>

      <div className="bingo">
        {ch.squares.map((s) => {
          const done = s.logged >= s.need;
          const partial = s.logged > 0 && !done;
          const cls = `sq${done ? " done" : partial ? " partial" : ""}${dips.has(s.id) ? " dip" : ""}`;
          return (
            <Link key={s.id} href={`/square/${s.id}`} className={cls}>
              <span className="nm">{s.name}</span>
              <span className="cnt">{Math.min(s.logged, s.need)}/{s.need}</span>
            </Link>
          );
        })}
      </div>
      <p className="board-tip">Tap a square for what counts, your progress, and TBR matches.</p>
    </>
  );
}
