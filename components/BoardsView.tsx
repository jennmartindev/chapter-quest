"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useShell } from "./Shell";
import { bingoLines, everyoneRead, readerColor, sharedGlow, soloGlow, squareLabel, type BoardView, type Glow } from "@/lib/board";
import type { ChallengeWithSquares } from "@/lib/types";

const RULE_TEXT: Record<string, string> = {
  hrcyed:
    "<b>Basic No Nonsense:</b> every book can count toward <b>two</b> squares. Rereads 5+ years old. No DNFs.",
  rfantasy:
    "<b>One square = one book.</b> No book reused on the card · 25 books, 24 authors · only <b>one</b> reread. Each square has an optional Hard Mode.",
};

type SquareBooks = Record<string, { title: string; cover: string | null; g1?: string; g2?: string }>;
type Square = ChallengeWithSquares["squares"][number];

function stored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // Private browsing and blocked storage are fine: it just won't remember.
  }
}
function store(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // See above.
  }
}

function Cover({ book }: { book: SquareBooks[string] }) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // An image can fail before this code runs, and then its error event never reaches us.
  useEffect(() => {
    if (img.current?.complete && !img.current.naturalWidth) setFailed(true);
  }, []);
  if (book.cover && !failed) {
    return <img ref={img} src={book.cover} alt="" loading="lazy" draggable={false} onError={() => setFailed(true)} />;
  }
  return (
    <span className="qt-type" style={{ background: `linear-gradient(160deg, ${book.g1 ?? "#6F8765"}, ${book.g2 ?? "#3f5238"})` }}>
      <span>{book.title}</span>
    </span>
  );
}

function Bars({ square, shared, members }: { square: Square; shared: boolean; members: ChallengeWithSquares["members"] }) {
  if (!shared) {
    const pct = Math.round((Math.min(square.logged, square.need) / Math.max(square.need, 1)) * 100);
    return (
      <span className="qt-bars" aria-hidden>
        <i className="qt-track"><i className="qt-fill" style={{ width: `${pct}%`, background: "var(--reader-1)" }} /></i>
      </span>
    );
  }
  return (
    <span className="qt-bars" aria-hidden>
      {members.map((m, i) => {
        const status = square.memberProgress?.find((p) => p.userId === m.userId)?.status ?? null;
        return <i key={m.userId} className={`qt-seg${status ? ` is-${status}` : ""}`} style={{ ["--c" as string]: readerColor(i) }} />;
      })}
    </span>
  );
}

export default function BoardsView({
  challenges,
  squareBooks,
  initialId,
  currentUserId,
}: {
  challenges: ChallengeWithSquares[];
  squareBooks: SquareBooks;
  initialId?: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const { toast } = useShell();
  const [current, setCurrent] = useState(initialId ?? challenges[0]?.id);
  const [viewKey, setViewKey] = useState<string>(currentUserId);
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const ch = challenges.find((c) => c.id === current) ?? challenges[0];
  const shared = !!ch && ch.shared && ch.members.length > 0;

  // Remember the chosen view per board. Read after mount so the server and browser render the same.
  useEffect(() => {
    if (!ch) return;
    setViewKey(stored(`cq-view-${ch.id}`) ?? currentUserId);
  }, [ch?.id, currentUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  const memberIds = ch?.members.map((m) => m.userId) ?? [];
  const view: BoardView =
    viewKey === "prompts" ? { kind: "prompts" }
    : viewKey === "together" && shared ? { kind: "together" }
    : memberIds.includes(viewKey) ? { kind: "reader", userId: viewKey }
    : { kind: "reader", userId: currentUserId };

  const doneFlags = (ch?.squares ?? []).map((s) => {
    if (!shared) return s.state === "done";
    return view.kind === "reader"
      ? s.memberProgress?.find((p) => p.userId === view.userId)?.status === "done"
      : everyoneRead(s.memberProgress ?? []);
  });
  const lines = bingoLines(doneFlags);

  // Celebrate only a line you've just completed, and only in your own view.
  useEffect(() => {
    if (!ch || (shared && !(view.kind === "reader" && view.userId === currentUserId))) return;
    const key = `cq-lines-${ch.id}`;
    const before = stored(key);
    if (before !== null && lines > Number(before)) toast(`🎉 Bingo! ${lines} ${lines === 1 ? "line" : "lines"} complete`);
    store(key, String(lines));
  }, [ch?.id, lines, view.kind]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ch) return <p className="empty">No challenges yet.</p>;

  // Press-and-hold a shared square to toggle your own "read" without opening it.
  async function quickMark(square: Square) {
    const mine = square.memberProgress?.find((m) => m.userId === currentUserId);
    const makeDone = mine?.status !== "done";
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(25);
    const res = await fetch("/api/square-progress", makeDone
      ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ square_id: square.id, status: "done" }) }
      : { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ square_id: square.id }) });
    if (res.ok) { toast(makeDone ? "Marked read ✓" : "Marked unread"); router.refresh(); }
  }
  function pressStart(square: Square) {
    longPressed.current = false;
    pressTimer.current = window.setTimeout(() => { longPressed.current = true; quickMark(square); }, 480);
  }
  function pressEnd() { if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; } }
  function clickCapture(e: React.MouseEvent) { if (longPressed.current) { e.preventDefault(); e.stopPropagation(); longPressed.current = false; } }

  function pick(c: ChallengeWithSquares) {
    setCurrent(c.id);
    if (typeof window !== "undefined" && c.template_key) {
      window.history.replaceState(null, "", `/boards?c=${c.template_key}`);
    }
  }
  function chooseView(key: string) {
    setViewKey(key);
    store(`cq-view-${ch.id}`, key);
  }

  const rule = RULE_TEXT[ch.template_key ?? ""] ?? "";
  const pct = ch.total ? Math.round((ch.done / ch.total) * 100) : 0;
  const countFor = (uid: string) => ch.squares.filter((s) => s.memberProgress?.find((p) => p.userId === uid)?.status === "done").length;
  const bothCount = ch.squares.filter((s) => everyoneRead(s.memberProgress ?? [])).length;
  const everyoneWord = ch.members.length > 2 ? "All" : "Both";
  const tabs = shared
    ? [...ch.members.map((m) => ({ key: m.userId, label: m.name })), { key: "together", label: "Together" }, { key: "prompts", label: "Prompts" }]
    : [{ key: currentUserId, label: "Books" }, { key: "prompts", label: "Prompts" }];
  const activeTab = view.kind === "reader" ? view.userId : view.kind;

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
        {shared ? (
          <div className="score" aria-label="Squares read">
            {ch.members.map((m, i) => (
              <div key={m.userId} className="score-cell">
                <span className="score-name"><i aria-hidden style={{ color: readerColor(i) }}>●</i> {m.name}</span>
                <b>{countFor(m.userId)}</b>
              </div>
            ))}
            <div className="score-cell">
              <span className="score-name"><i aria-hidden style={{ color: "var(--all-read)" }}>★</i> {everyoneWord}</span>
              <b>{bothCount}</b>
            </div>
          </div>
        ) : (
          <>
            <div className="board-head">
              <div className="bh-l"><h2>{ch.name}</h2></div>
              <span className="frac"><b>{ch.done}</b> / {ch.total}</span>
            </div>
            <div className="bar"><i style={{ width: `${pct}%` }} /></div>
          </>
        )}

        <div className="view-tabs" role="group" aria-label="Choose a view">
          {tabs.map((t) => (
            <button key={t.key} type="button" className={activeTab === t.key ? "on" : ""} aria-pressed={activeTab === t.key} onClick={() => chooseView(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {lines > 0 && view.kind !== "prompts" && (
          <p className="lines-note">🎉 <b>{lines} bingo {lines === 1 ? "line" : "lines"}</b> complete</p>
        )}

        <div className="qgrid">
          {ch.squares.map((s) => {
            const sb = squareBooks[s.id];
            const progress = s.memberProgress ?? [];
            const allRead = shared && everyoneRead(progress);
            const glow: Glow = view.kind === "prompts" ? "lit" : shared ? sharedGlow(progress, view) : soloGlow(s.state);
            return (
              <Link
                key={s.id}
                href={`/square/${s.id}`}
                className="qt"
                aria-label={squareLabel(sb?.title ?? null, s.name, progress)}
                {...(shared
                  ? {
                      onPointerDown: () => pressStart(s),
                      onPointerUp: pressEnd,
                      onPointerLeave: pressEnd,
                      onClickCapture: clickCapture,
                      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
                    }
                  : {})}
              >
                <span className={`qt-face glow-${glow}${allRead ? " all-read" : ""}${view.kind === "prompts" || !sb ? " is-text" : ""}`}>
                  {view.kind === "prompts" || !sb ? (
                    <span className="qt-prompt">{s.name}</span>
                  ) : (
                    <Cover book={sb} />
                  )}
                  {allRead && <span className="qt-star" aria-hidden>⭐</span>}
                </span>
                <Bars square={s} shared={shared} members={ch.members} />
                {view.kind !== "prompts" && <span className="qt-cap">{s.name}</span>}
              </Link>
            );
          })}
        </div>

        <div className="qkey">
          {shared ? (
            <>
              {ch.members.map((m, i) => (
                <span key={m.userId}><i className="qkey-bar" style={{ background: readerColor(i) }} /> {m.name} read</span>
              ))}
              <span><i className="qkey-bar is-reading" /> Reading</span>
              <span>⭐ {everyoneWord} read</span>
            </>
          ) : (
            <>
              <span><i className="qkey-bar" style={{ background: "var(--reader-1)" }} /> Books read for this square</span>
              <span>Full color when complete</span>
            </>
          )}
        </div>
      </section>

      {rule && <p className="ruleband" dangerouslySetInnerHTML={{ __html: rule }} />}
      <p className="board-tip">
        {shared ? "Tap a square to open it · press & hold to mark it read" : "Tap any square to search your library and add a book"}.
      </p>
    </>
  );
}
