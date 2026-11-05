"use client";

import { useEffect, useState } from "react";
import type { FoundBook } from "@/lib/books";

/** Online results for a search. Waits for a pause in typing, and ignores answers to older searches. */
export function useBookSearch(query: string) {
  const [results, setResults] = useState<FoundBook[]>([]);
  const [status, setStatus] = useState<"idle" | "searching" | "done" | "error">("idle");

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setStatus("idle");
      return;
    }
    setStatus("searching");
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/book-search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const body = await res.json();
        setResults(body.results ?? []);
        setStatus(res.ok ? "done" : "error");
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setResults([]);
          setStatus("error");
        }
      }
    }, 400);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return { results, status };
}

/** Adds to the library, or returns the book you already have. */
export async function saveFoundBook(book: FoundBook): Promise<{ id: string; existed: boolean } | null> {
  const res = await fetch("/api/books", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: book.title, author: book.author, isbn: book.isbn, pages: book.pages, publish_year: book.year, cover_url: book.cover }),
  });
  return res.ok ? res.json() : null;
}

export function OnlineResults({ query, status, results, busy, actionLabel, onPick }: {
  query: string;
  status: "idle" | "searching" | "done" | "error";
  results: FoundBook[];
  busy: string | null;
  actionLabel: string;
  onPick: (book: FoundBook) => void;
}) {
  if (query.trim().length < 3) return null;
  return (
    <>
      <div className="section-title"><h2 style={{ fontSize: 14 }}>Find online</h2></div>
      {status === "searching" && <p className="muted" style={{ fontSize: 12.5, padding: "4px 2px" }} role="status">Searching…</p>}
      {status === "error" && <p className="muted" style={{ fontSize: 12.5, padding: "4px 2px" }} role="alert">Online search isn't available right now. Your library still works.</p>}
      {status === "done" && results.length === 0 && <p className="muted" style={{ fontSize: 12.5, padding: "4px 2px" }}>Nothing found. Try the author's name too.</p>}
      {status === "done" && results.map((b) => (
        <div className="match" key={b.key}>
          <div className="cover found-cover" style={b.cover ? { backgroundImage: `url(${b.cover})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
          <div className="mt">
            <b>{b.title}</b>
            <span>{[b.author, b.year, b.pages ? `${b.pages} pp` : null].filter(Boolean).join(" · ")}</span>
          </div>
          <button className="add" disabled={busy === b.key} onClick={() => onPick(b)}>{actionLabel}</button>
        </div>
      ))}
    </>
  );
}

/** Library page: search online and add a book without putting it on a board. */
export function AddBookPanel({ onAdded, toast }: { onAdded: () => void; toast: (message: string) => void }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const { results, status } = useBookSearch(q);

  async function add(book: FoundBook) {
    setBusy(book.key);
    const saved = await saveFoundBook(book);
    setBusy(null);
    if (!saved) return toast("Couldn't add that book");
    toast(saved.existed ? `“${book.title}” is already in your library` : `Added “${book.title}”`);
    if (!saved.existed) onAdded();
  }

  return (
    <div className="add-book">
      <label className="add-book-label" htmlFor="add-book-search">Add a book</label>
      <div className="searchbar">
        <input id="add-book-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title, author or ISBN…" />
      </div>
      <OnlineResults query={q} status={status} results={results} busy={busy} actionLabel="Add" onPick={add} />
    </div>
  );
}
