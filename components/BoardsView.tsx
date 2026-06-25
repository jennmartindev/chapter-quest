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

// Per-person colors: owner first (yellow), then peach-pink, then more.
const MEMBER_COLORS = ["#fff9c2", "#ffd5b3", "#cfe0d6", "#e6d3ec"];
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
  const colorOf = (uid: string) => MEMBER_COLORS[Math.max(0, ch.members.findIndex((m) => m.userId === uid)) % MEMBER_COLORS.length];

  const leaderboard = shared
    ? ch.members
        .map((m) => ({ ...m, done: ch.squares.filter((s) => s.memberProgress?.find((p) => p.userId === m.userId)?.status === "done").length }))
        .sort((a, b) => b.done - a.done)
    : [];
  const topDone = leaderboard[0]?.done ?? 0;

  return (
    <>
      <div className="chswitch">
        {challenges.map((c) => (
          <button key={c.id} className={`chpill${c.id === current ? " on" : ""}`} onClick={() => pick(c)}>
            <span>{c.name}{c.shared ? <span className="shared-tag"> · shared</span> : ""}</span>
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
            <span className="ml">Leaderboard</span>
            {leaderboard.map((m) => (
              <span key={m.userId} className={`lb-chip${m.done === topDone && topDone > 0 ? " lead" : ""}`}>
                <i className="stamp sm" style={{ background: colorOf(m.userId), color: "#5a4a2a" }}>{initial(m.name)}</i>
                {m.name}<b>{m.done}</b>
              </span>
            ))}
          </div>
        )}

        <div className="legend">
          {shared ? (
            <>
              <span><i className="sw sw-empty" /> Not started</span>
              {ch.members.map((m) => (
                <span key={m.userId}><i className="sw" style={{ background: colorOf(m.userId) }} /> {m.name} read</span>
              ))}
              <span><i className="sw sw-done" /> {ch.members.length > 2 ? "All read" : "Both read"}</span>
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
            let cls = "sq";
            let style: React.CSSProperties | undefined;
            if (shared) {
              const doneM = (s.memberProgress ?? []).filter((m) => m.status === "done");
              if (ch.members.length > 0 && doneM.length === ch.members.length) {
                cls += " done"; // everyone read it → teal
              } else if (doneM.length > 0) {
                cls += " colored";
                style = { ["--ucolor" as unknown as string]: colorOf(doneM[0].userId) };
              }
            } else {
              cls += s.state === "done" ? " done" : s.state === "progress" ? " progress" : s.state === "options" ? " options" : "";
            }
            if (sb) cls += " has-book";
            if (sb?.cover) cls += " has-cover";
            return (
              <Link key={s.id} href={`/square/${s.id}`} className={cls} style={style}>
                {sb ? (
                  <>
                    <span className="sqtitle">{sb.title}</span>
                    {sb.cover ? <img className="sqcover-lg" src={sb.cover} alt="" loading="lazy" /> : <span className="sqcover-lg ph" />}
                    <span className="sqbottom"><span className="sqprompt">{s.name}</span></span>
                  </>
                ) : (
                  <>
                    <span className="nm">{s.name}</span>
                    {!shared && <span className="sqbottom"><span className="cnt">{Math.min(s.logged, s.need)}/{s.need}</span></span>}
                  </>
                )}
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
