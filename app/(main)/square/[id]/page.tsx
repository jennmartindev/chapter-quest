import Link from "next/link";
import { notFound } from "next/navigation";
import { loadEverything, syncSharedProgress } from "@/lib/data";
import SquareDetail from "@/components/SquareDetail";
import { readInWindow } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SquarePage({ params }: { params: { id: string } }) {
  await syncSharedProgress();
  const load = await loadEverything();

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

  // Picks on this square (denormalized so it works across shared members).
  const here = load.bookSquares
    .filter((r) => r.square_id === square!.id)
    .map((r) => {
      const own = bookById.get(r.book_id);
      const alsoFills = load.bookSquares
        .filter((o) => o.book_id === r.book_id && o.square_id !== square!.id)
        .map((o) => ({ name: squareName.get(o.square_id) ?? "", tag: squareTag.get(o.square_id) ?? "" }));
      return {
        id: r.book_id,
        title: own?.title ?? r.pick_title ?? "Book",
        author: own?.author ?? null,
        mine: r.user_id === load.userId,
        readStatus: own?.read_status ?? null,
        // Read during this challenge, so it counts toward the square (a book read earlier doesn't).
        countsHere: own?.read_status === "read" && readInWindow(own.date_read, challenge!.start_date, challenge!.end_date),
        g1: own?.cover_g1 ?? "#617E74",
        g2: own?.cover_g2 ?? "#3f5238",
        cover: own?.cover_url ?? r.pick_cover ?? null,
        alsoFills,
      };
    });

  const hereIds = new Set(here.map((h) => h.id));
  const books = load.books.filter((b) => !hereIds.has(b.id));
  const dipCount = here.filter((h) => h.alsoFills.some((a) => a.tag !== challenge!.tag)).length;

  const cardPicks = load.bookSquares
    .filter((r) => r.challenge_id === challenge!.id)
    .map((r) => ({
      bookId: r.book_id,
      title: bookById.get(r.book_id)?.title ?? r.pick_title ?? "",
      squareId: r.square_id,
      squareName: squareName.get(r.square_id) ?? "another square",
    }));

  const myStatus = square.memberProgress?.find((m) => m.userId === load.userId)?.status ?? null;

  return (
    <>
      <Link href={`/boards?id=${challenge.id}`} className="back">← Back to board</Link>
      <SquareDetail
        squareId={square.id}
        squareName={square.name}
        rule={square.rule}
        need={square.need}
        challengeName={challenge.name}
        challengeTag={challenge.tag}
        templateKey={challenge.template_key ?? ""}
        maxPerBook={challenge.max_per_book}
        dipCount={dipCount}
        shared={challenge.shared}
        myStatus={myStatus}
        memberProgress={square.memberProgress ?? []}
        currentUserId={load.userId}
        here={here}
        cardPicks={cardPicks}
        books={books.map((b) => ({ id: b.id, title: b.title, author: b.author, g1: b.cover_g1, g2: b.cover_g2, cover: b.cover_url, status: b.read_status }))}
      />
    </>
  );
}
