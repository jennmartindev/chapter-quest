import { loadEverything } from "@/lib/data";
import BoardsView from "@/components/BoardsView";

export const dynamic = "force-dynamic";

export default async function BoardsPage({ searchParams }: { searchParams: { c?: string } }) {
  const load = await loadEverything();

  // First assigned book per square (prefer a read/logged one for the shown title).
  const bookById = new Map(load.books.map((b) => [b.id, b]));
  const squareBooks: Record<string, { title: string }> = {};
  for (const r of load.bookSquares) {
    const b = bookById.get(r.book_id);
    if (!b) continue;
    if (!squareBooks[r.square_id] || r.status === "logged") {
      squareBooks[r.square_id] = { title: b.title };
    }
  }

  // Which board to open (persisted via ?c=<template_key>).
  const initialId =
    load.challenges.find((c) => c.template_key === searchParams?.c)?.id ?? load.challenges[0]?.id;

  return (
    <>
      <span className="eyebrow">Your boards</span>
      <BoardsView challenges={load.challenges} squareBooks={squareBooks} initialId={initialId} />
    </>
  );
}
