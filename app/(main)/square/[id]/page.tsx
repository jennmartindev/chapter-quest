import Link from "next/link";
import { notFound } from "next/navigation";
import { loadEverything } from "@/lib/data";
import SquareDetail from "@/components/SquareDetail";

export const dynamic = "force-dynamic";

export default async function SquarePage({ params }: { params: { id: string } }) {
  const load = await loadEverything();

  // locate the square + its challenge
  let square = null as null | (typeof load.challenges)[number]["squares"][number];
  let challenge = null as null | (typeof load.challenges)[number];
  for (const c of load.challenges) {
    const s = c.squares.find((x) => x.id === params.id);
    if (s) { square = s; challenge = c; break; }
  }
  if (!square || !challenge) notFound();

  const squareName = new Map<string, string>();
  const squareTag = new Map<string, string>();
  for (const c of load.challenges) for (const s of c.squares) { squareName.set(s.id, s.name); squareTag.set(s.id, c.tag); }
  const bookById = new Map(load.books.map((b) => [b.id, b]));

  // books already credited to THIS square
  const here = load.bookSquares
    .filter((r) => r.square_id === square!.id)
    .map((r) => {
      const book = bookById.get(r.book_id);
      const alsoFills = load.bookSquares
        .filter((o) => o.book_id === r.book_id && o.square_id !== square!.id)
        .map((o) => ({ name: squareName.get(o.square_id) ?? "", tag: squareTag.get(o.square_id) ?? "" }));
      return book ? { book, status: r.status, alsoFills } : null;
    })
    .filter(Boolean) as { book: typeof load.books[number]; status: string; alsoFills: { name: string; tag: string }[] }[];

  const hereIds = new Set(here.map((h) => h.book.id));
  // The whole library is searchable (read books included) — minus what's already here.
  const books = load.books.filter((b) => !hereIds.has(b.id));

  // double-dip count: books tagged here that also touch another challenge
  const dipCount = here.filter((h) => h.alsoFills.some((a) => a.tag !== challenge!.tag)).length;

  return (
    <>
      <Link href="/boards" className="back">← Back to board</Link>
      <SquareDetail
        squareId={square.id}
        squareName={square.name}
        rule={square.rule}
        need={square.need}
        logged={square.logged}
        challengeName={challenge.name}
        challengeTag={challenge.tag}
        templateKey={challenge.template_key ?? ""}
        maxPerBook={challenge.max_per_book}
        dipCount={dipCount}
        here={here.map((h) => ({ id: h.book.id, title: h.book.title, status: h.status, g1: h.book.cover_g1, g2: h.book.cover_g2, alsoFills: h.alsoFills }))}
        books={books.map((b) => ({ id: b.id, title: b.title, author: b.author, g1: b.cover_g1, g2: b.cover_g2, status: b.read_status }))}
      />
    </>
  );
}
