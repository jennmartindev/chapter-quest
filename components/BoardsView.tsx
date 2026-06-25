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
const initial = (n: string) => (n || "?").charAt(0).toUpperCase();

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
    if (typeof window !== "undefined" && c.template_key) {
      window.history.replaceState(null, "", `/boards?c=${c.template_key}`);
    }
  }

  const rule = RULE_TEXT[ch.template_key ?? ""] ?? "";
  const pct = ch.total ? Math.round((ch.done / ch.total) * 100) : 0;
  const shared = ch.shared && ch.members.length > 0;

  return (
    <>
      <div className="chswitch">
        {challenges.map((c) => (
          <button key={c.id} className={`chpill${c.id === current ? " on" : ""}`} onClick={() => pick(c)}>
            <span>{c.name}{c.shared ? " ·" : ""}{c.shared ? <span className="shared-tag"> shared</span> : ""}</span>
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

        {shared && (
          <div className="members-bar">
            <span className="ml">Reading together</span>
            {ch.members.map((m) => (
              <span key={m.userId} className="mchip"><i className="md md-none">{initial(m.name)}</i>{m.name}</span>
            ))}
          </div>
        )}

        <div className="legend">
          {shared ? (
            <>
              <span><i className="md md-none" /> Not started</span>
              <span><i className="md md-reading" /> Reading</span>
              <span><i className="md md-done" /> Read</span>
            </>
          ) : (
            <>
              <span><i className="sw sw-empty" /> Nothing assigned</span>
              <span><i className="sw sw-options" /> Options picked</span>
              <span><i className="sw sw-progress" /> In progress</span>
              <span><i className="sw sw-done" /> Complete</span>
            </>
          )}
        </div>

        <div className="bingo">
          {ch.squares.map((s) => {
            const sb = squareBooks[s.id];
            const stateCls =
              s.state === "done" ? " done" : s.state === "progress" ? " progress" : s.state === "options" ? " options" : "";
            return (
              <Link key={s.id} href={`/square/${s.id}`} className={`sq${stateCls}`}>
                <span className="nm">{s.name}</span>
                <span className="sqfoot">
                  {sb ? (
                    <span className="sqbk">
                      {!shared && sb.cover ? <img className="sqcover" src={sb.cover} alt="" loading="lazy" /> : null}
                      <span className="bk">{sb.title}</span>
                    </span>
                  ) : (
                    <span className="cnt">{Math.min(s.logged, s.need)}/{s.need}</span>
                  )}
                  {shared && s.memberProgress ? (
                    <span className="mdots">
                      {s.memberProgress.map((m) => (
                        <i key={m.userId} className={`md ${m.status ? "md-" + m.status : "md-none"}`} title={`${m.name}: ${m.status ?? "not started"}`}>
                          {initial(m.name)}
                        </i>
                      ))}
                    </span>
                  ) : null}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {rule && <p className="ruleband" dangerouslySetInnerHTML={{ __html: rule }} />}
      <p className="board-tip">Tap any square to {shared ? "see picks and mark your progress" : "search your library and add a book"}.</p>
    </>
  );
}
