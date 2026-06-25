import { createClient } from "@/lib/supabase/server";
import type {
  Book,
  Challenge,
  ChallengeWithSquares,
  Profile,
  Square,
  SquareProgress,
} from "./types";
import type { OptInput, Candidate } from "./optimizer";

// All of these run on the server and rely on RLS to scope rows to the user.

export async function getProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const { data } = await supabase.from("profiles").select("*").single();
  return data as Profile | null;
}

interface LoadResult {
  challenges: ChallengeWithSquares[];
  books: Book[];
  // book_id -> array of {challengeId, squareId, status}
  bookSquares: {
    id: string;
    book_id: string;
    challenge_id: string;
    square_id: string;
    why: string | null;
    status: string;
  }[];
}

export async function loadEverything(): Promise<LoadResult> {
  const supabase = createClient();

  const [{ data: challenges }, { data: squares }, { data: books }, { data: bookSquares }] =
    await Promise.all([
      supabase.from("challenges").select("*").eq("archived", false).order("template_key"),
      supabase.from("squares").select("*").order("position"),
      supabase.from("books").select("*").order("title"),
      supabase.from("book_squares").select("*"),
    ]);

  const bs = (bookSquares ?? []) as LoadResult["bookSquares"];
  const bookList = (books ?? []) as Book[];

  // A square's state is derived from the read status of the books assigned to it.
  const statusByBook = new Map(bookList.map((b) => [b.id, b.read_status]));
  const assignedBySquare = new Map<string, string[]>();
  for (const r of bs) {
    const rs = statusByBook.get(r.book_id);
    if (!rs) continue;
    if (!assignedBySquare.has(r.square_id)) assignedBySquare.set(r.square_id, []);
    assignedBySquare.get(r.square_id)!.push(rs);
  }

  const squaresByChallenge = new Map<string, SquareProgress[]>();
  for (const s of (squares ?? []) as Square[]) {
    const statuses = assignedBySquare.get(s.id) ?? [];
    const readCount = statuses.filter((x) => x === "read").length;
    const readingCount = statuses.filter((x) => x === "currently-reading").length;
    const done = readCount >= s.need;
    const state: SquareProgress["state"] = done
      ? "done"
      : readingCount > 0 || readCount > 0
      ? "progress"
      : statuses.length > 0
      ? "options"
      : "empty";
    const sp: SquareProgress = { ...s, logged: readCount, state };
    if (!squaresByChallenge.has(s.challenge_id)) squaresByChallenge.set(s.challenge_id, []);
    squaresByChallenge.get(s.challenge_id)!.push(sp);
  }

  const enriched: ChallengeWithSquares[] = ((challenges ?? []) as Challenge[]).map((c) => {
    const sq = squaresByChallenge.get(c.id) ?? [];
    const done = sq.filter((s) => s.state === "done").length;
    return { ...c, squares: sq, done, total: sq.length };
  });

  return { challenges: enriched, books: bookList, bookSquares: bs };
}

// Build the optimizer inputs: every to-read book, with its candidate squares
// (the book_squares rows tagged to it) enriched with each square's live state.
export function buildOptimizerInputs(load: LoadResult): OptInput[] {
  const squareById = new Map<string, SquareProgress>();
  const challengeById = new Map<string, ChallengeWithSquares>();
  for (const c of load.challenges) {
    challengeById.set(c.id, c);
    for (const s of c.squares) squareById.set(s.id, s);
  }

  const candidatesByBook = new Map<string, Candidate[]>();
  for (const r of load.bookSquares) {
    const sq = squareById.get(r.square_id);
    const ch = challengeById.get(r.challenge_id);
    if (!sq || !ch) continue;
    const cand: Candidate = {
      challengeId: ch.id,
      challengeTag: ch.tag,
      squareId: sq.id,
      squareKey: sq.key,
      squareName: sq.name,
      need: sq.need,
      logged: sq.logged,
      maxPerBook: ch.max_per_book,
      why: r.why,
    };
    if (!candidatesByBook.has(r.book_id)) candidatesByBook.set(r.book_id, []);
    candidatesByBook.get(r.book_id)!.push(cand);
  }

  // Only books still on the TBR are "what to read next" candidates.
  return load.books
    .filter((b) => b.read_status === "to-read" || b.read_status === "currently-reading")
    .map((b) => ({ book: b, candidates: candidatesByBook.get(b.id) ?? [] }))
    .filter((i) => i.candidates.length > 0);
}
