import { loadEverything, syncSharedProgress } from "@/lib/data";
import BoardsView from "@/components/BoardsView";

export const dynamic = "force-dynamic";

export default async function BoardsPage({ searchParams }: { searchParams: { c?: string } }) {
  await syncSharedProgress();
  const load = await loadEverything();

  // First assigned book per square (prefer a read/logged one for the shown title).
  const bookById = new Map(load.books.map((b) => [b.id, b]));
  const squareBooks: Record<string, { title: string; cover: string | null; g1?: string; g2?: string }> = {};
  for (const r of load.bookSquares) {
    // Prefer the denormalized pick snapshot (works across shared members).
    // Your own book wins when you can see it, so a corrected cover shows up straight away.
    const book = bookById.get(r.book_id);
    const title = book?.title ?? r.pick_title ?? "";
    const cover = book?.cover_url ?? r.pick_cover ?? null;
    if (title && !squareBooks[r.square_id]) squareBooks[r.square_id] = { title, cover, g1: book?.cover_g1, g2: book?.cover_g2 };
  }

  // Which board to open (persisted via ?c=<template_key>).
  const initialId =
    load.challenges.find((c) => c.template_key === searchParams?.c)?.id ?? load.challenges[0]?.id;

  return (
    <>
      <span className="eyebrow">Your boards</span>
      <BoardsView challenges={load.challenges} squareBooks={squareBooks} initialId={initialId} currentUserId={load.userId} />
    </>
  );
}
