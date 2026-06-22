import { loadEverything } from "@/lib/data";
import BoardsView from "@/components/BoardsView";

export const dynamic = "force-dynamic";

export default async function BoardsPage() {
  const load = await loadEverything();

  // A square "double-dips" if a book tagged to it is also tagged to a square in
  // a different challenge.
  const challengesByBook = new Map<string, Set<string>>();
  const squaresByBook = new Map<string, string[]>();
  for (const r of load.bookSquares) {
    if (!challengesByBook.has(r.book_id)) challengesByBook.set(r.book_id, new Set());
    challengesByBook.get(r.book_id)!.add(r.challenge_id);
    if (!squaresByBook.has(r.book_id)) squaresByBook.set(r.book_id, []);
    squaresByBook.get(r.book_id)!.push(r.square_id);
  }
  const dipSquareIds = new Set<string>();
  for (const [bookId, chSet] of challengesByBook) {
    if (chSet.size > 1) for (const sqId of squaresByBook.get(bookId) ?? []) dipSquareIds.add(sqId);
  }

  return (
    <>
      <span className="eyebrow">Your boards</span>
      <BoardsView challenges={load.challenges} dipSquareIds={Array.from(dipSquareIds)} />
    </>
  );
}
