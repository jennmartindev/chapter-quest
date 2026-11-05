"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useShell } from "./Shell";
import CoverEdit from "./CoverEdit";
import { OnlineResults, saveFoundBook, useBookSearch } from "./FindBook";
import { readerColor } from "@/lib/board";
import { cardRuleWarning, type CardPick, type FoundBook } from "@/lib/books";

interface HereBook { id: string; title: string; author: string | null; mine: boolean; readStatus: string | null; g1: string; g2: string; cover: string | null; alsoFills: { name: string; tag: string }[]; }
interface LibBook { id: string; title: string; author: string | null; g1: string; g2: string; cover: string | null; status: string; }
interface MemberProg { userId: string; name: string; status: "reading" | "done" | null; }

const STATUS_LABEL: Record<string, string> = { read: "Read", "currently-reading": "Reading", "to-read": "Want to read", "did-not-finish": "DNF" };
const STATUS_ORDER: Record<string, number> = { "to-read": 0, "currently-reading": 1, read: 2, "did-not-finish": 3 };
const initial = (n: string) => (n || "?").charAt(0).toUpperCase();

function coverStyle(cover: string | null, g1: string, g2: string): React.CSSProperties {
  return cover
    ? { backgroundImage: `url(${cover})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: `linear-gradient(160deg, ${g1}, ${g2})` };
}

export default function SquareDetail(props: {
  squareId: string; squareName: string; rule: string; need: number;
  challengeName: string; challengeTag: string; templateKey: string; maxPerBook: number;
  dipCount: number; shared: boolean; myStatus: "reading" | "done" | null; memberProgress: MemberProg[];
  currentUserId: string; here: HereBook[]; books: LibBook[]; cardPicks: CardPick[];
}) {
  const router = useRouter();
  const { toast } = useShell();
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [replacing, setReplacing] = useState<HereBook | null>(null);
  const searchTop = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = props.books;
    if (query) list = list.filter((b) => `${b.title} ${b.author ?? ""}`.toLowerCase().includes(query));
    return [...list].sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || a.title.localeCompare(b.title));
  }, [q, props.books]);
  const shown = q.trim() ? results.slice(0, 30) : results.slice(0, 12);

  const online = useBookSearch(q);

  async function assign(book_id: string, title: string) {
    setBusy(book_id);
    const res = await fetch("/api/book-squares", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ book_id, square_id: props.squareId }) });
    setBusy(null);
    if (res.ok) { toast(`Added “${title}”`); router.refresh(); } else toast("Couldn't add that");
  }

  // A new book may not be the one you marked read, so ask rather than assume.
  async function confirmProgressAfterSwap(title: string) {
    if (!props.shared || props.myStatus !== "done") return;
    const kept = window.confirm(`You were marked read on this square. Have you read “${title}” too?\n\nOK keeps it marked read. Cancel sets it back to not started.`);
    await fetch("/api/square-progress", kept
      ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ square_id: props.squareId, status: "done" }) }
      : { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ square_id: props.squareId }) });
  }

  async function replace(old: HereBook, book_id: string, title: string) {
    setBusy(book_id);
    const res = await fetch("/api/book-squares", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ old_book_id: old.id, new_book_id: book_id, square_id: props.squareId }) });
    if (res.ok) await confirmProgressAfterSwap(title);
    setBusy(null);
    if (res.ok) { toast(`Replaced with “${title}”`); setReplacing(null); setQ(""); router.refresh(); } else toast("Couldn't replace that");
  }

  /** Adds a book or swaps it in, after checking the card's rule about reusing books. */
  async function place(book_id: string, title: string) {
    const warning = cardRuleWarning({ id: book_id, title }, props.cardPicks, props.squareId, props.maxPerBook);
    if (warning && !window.confirm(warning)) return;
    if (replacing) await replace(replacing, book_id, title);
    else await assign(book_id, title);
  }

  async function placeFound(book: FoundBook) {
    const warning = cardRuleWarning({ title: book.title }, props.cardPicks, props.squareId, props.maxPerBook);
    if (warning && !window.confirm(warning)) return;
    setBusy(book.key);
    const saved = await saveFoundBook(book);
    setBusy(null);
    if (!saved) return toast("Couldn't add that book");
    if (replacing) await replace(replacing, saved.id, book.title);
    else await assign(saved.id, book.title);
  }
  async function remove(book_id: string) {
    setBusy(book_id);
    const res = await fetch("/api/book-squares", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ book_id, square_id: props.squareId }) });
    setBusy(null);
    if (res.ok) { toast("Removed"); router.refresh(); }
  }
  async function setBookStatus(book_id: string, read_status: string) {
    setBusy(book_id);
    const res = await fetch("/api/books", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ book_id, read_status }) });
    setBusy(null);
    if (res.ok) { toast("Updated"); router.refresh(); }
  }
  async function setMyProgress(status: "reading" | "done" | null) {
    setBusy("me");
    const res = status === null
      ? await fetch("/api/square-progress", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ square_id: props.squareId }) })
      : await fetch("/api/square-progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ square_id: props.squareId, status }) });
    setBusy(null);
    if (res.ok) { toast("Progress saved"); router.refresh(); }
  }

  const search = (
    <>
      <div className="section-title" ref={searchTop}><h2 style={{ fontSize: 16 }}>{replacing ? "Replace with" : props.here.length ? "Add another book" : "Pick a book"}</h2></div>
      {replacing && (
        <div className="replacing" role="status">
          <span>Replacing <b>{replacing.title}</b></span>
          <button type="button" className="chbtn" onClick={() => setReplacing(null)}>Cancel</button>
        </div>
      )}
      <div className="searchbar">
        <input type="search" aria-label="Search your library or find a book online" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your library or find any book…" />
      </div>
      {shown.length === 0 ? (
        <p className="muted" style={{ fontSize: 12.5, padding: "8px 2px" }}>
          {props.books.length === 0 ? "Your library is empty. Search above to find a book online." : "No books in your library match that search."}
        </p>
      ) : (
        shown.map((b) => (
          <div className="match" key={b.id}>
            <div className="cover" style={coverStyle(b.cover, b.g1, b.g2)} />
            <div className="mt"><b>{b.title}</b><span>{b.author ?? ""}</span></div>
            <span className={`bstat s-${b.status}`}>{STATUS_LABEL[b.status] ?? b.status}</span>
            <button className="add" disabled={busy === b.id} onClick={() => place(b.id, b.title)}>{replacing ? "Use this" : "Add"}</button>
          </div>
        ))
      )}
      <OnlineResults query={q} status={online.status} results={online.results} busy={busy} actionLabel={replacing ? "Use this" : "Add"} onPick={placeFound} />
    </>
  );

  // Only your own pick can be changed. Someone else's stays theirs, as the database enforces too.
  const pickActions = (h: HereBook) => h.mine ? (
    <div className="pick-actions">
      <button type="button" className="cover-edit" onClick={() => { setReplacing(h); searchTop.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>Replace</button>
      <CoverEdit bookId={h.id} title={h.title} author={h.author} hasCover={!!h.cover} />
    </div>
  ) : null;

  const head = (
    <div className="detail-head">
      <div className="topline">
        <span className={`chtag ${props.templateKey}`}>{props.challengeTag}</span>
        <span className="eyebrow">{props.challengeName}{props.shared ? " · shared" : ""}</span>
      </div>
      <h2>{props.squareName}</h2>
      <p className="rule">{props.rule}</p>
    </div>
  );

  // ---------------- SHARED MODE ----------------
  if (props.shared) {
    const others = props.memberProgress.filter((m) => m.userId !== props.currentUserId);
    return (
      <>
        {head}

        <div className="section-title"><h2 style={{ fontSize: 16 }}>Your progress</h2></div>
        <div className="prog-toggle">
          <button className={props.myStatus === null ? "on" : ""} disabled={busy === "me"} onClick={() => setMyProgress(null)}>Not started</button>
          <button className={props.myStatus === "reading" ? "on" : ""} disabled={busy === "me"} onClick={() => setMyProgress("reading")}>Reading</button>
          <button className={props.myStatus === "done" ? "on" : ""} disabled={busy === "me"} onClick={() => setMyProgress("done")}>Read</button>
        </div>

        {others.length > 0 && (
          <>
            <div className="section-title"><h2 style={{ fontSize: 16 }}>Everyone</h2></div>
            {props.memberProgress.map((m, i) => (
              <div className="memrow" key={m.userId}>
                <i className="md" style={{ background: m.status === "done" ? readerColor(i) : "transparent", borderColor: readerColor(i), borderStyle: m.status === "reading" ? "dashed" : "solid", borderWidth: 2, color: m.status === "done" ? "#10181a" : "var(--text)" }}>{initial(m.name)}</i>
                <b>{m.name}{m.userId === props.currentUserId ? " (you)" : ""}</b>
                <span className="memstat">{m.status === "done" ? "Read" : m.status === "reading" ? "Reading" : "Not started"}</span>
              </div>
            ))}
          </>
        )}

        <div className="section-title"><h2 style={{ fontSize: 16 }}>Books for this square</h2></div>
        {props.here.length === 0 && <p className="muted" style={{ fontSize: 12.5 }}>No books picked yet.</p>}
        {props.here.map((h) => (
          <div className="match" key={h.id}>
            <div className="cover" style={coverStyle(h.cover, h.g1, h.g2)} />
            <div className="mt"><b>{h.title}</b><span>{h.mine ? "your pick" : "shared pick"}</span>{pickActions(h)}</div>
            {h.mine && <button className="add ghost" aria-label={`Remove ${h.title}`} disabled={busy === h.id} onClick={() => remove(h.id)}>✕</button>}
          </div>
        ))}
        {search}
      </>
    );
  }

  // ---------------- SOLO MODE ----------------
  const readN = props.here.filter((h) => h.readStatus === "read").length;
  const readingN = props.here.filter((h) => h.readStatus === "currently-reading").length;
  const stateLabel =
    readN >= props.need ? "Complete"
    : readingN > 0 || readN > 0 ? "In progress"
    : props.here.length > 0 ? `${props.here.length} option${props.here.length > 1 ? "s" : ""} picked`
    : "Nothing assigned yet";

  return (
    <>
      <div className="detail-head">
        <div className="topline">
          <span className={`chtag ${props.templateKey}`}>{props.challengeTag}</span>
          <span className="eyebrow">{props.challengeName}</span>
        </div>
        <h2>{props.squareName}</h2>
        <p className="rule">{props.rule}</p>
        <div className="pcount">{stateLabel}{props.need > 1 ? ` · ${readN}/${props.need} read` : ""}</div>
        <div className="twosq">
          {props.dipCount > 0
            ? `Double-dip: ${props.dipCount} book${props.dipCount > 1 ? "s" : ""} here also fill a square in another challenge.`
            : props.maxPerBook > 1
            ? "Double-dip: in this challenge a book here can also fill one other square."
            : "On this card, one book fills exactly one square."}
        </div>
      </div>

      {props.here.length > 0 && (
        <>
          <div className="section-title"><h2 style={{ fontSize: 16 }}>Your picks</h2></div>
          {props.here.map((h) => (
            <div className="match" key={h.id}>
              <div className="cover" style={coverStyle(h.cover, h.g1, h.g2)} />
              <div className="mt"><b>{h.title}</b><span>{h.alsoFills.length ? "also fills: " + h.alsoFills.map((a) => a.name).join(", ") : "candidate for this square"}</span>{pickActions(h)}</div>
              <select className="bsel" value={h.readStatus ?? "to-read"} disabled={busy === h.id} onChange={(e) => setBookStatus(h.id, e.target.value)}>
                <option value="to-read">Want to read</option>
                <option value="currently-reading">Reading</option>
                <option value="read">Read</option>
                <option value="did-not-finish">DNF</option>
              </select>
              <button className="add ghost" aria-label={`Remove ${h.title}`} disabled={busy === h.id} onClick={() => remove(h.id)}>✕</button>
            </div>
          ))}
        </>
      )}
      {search}
    </>
  );
}
