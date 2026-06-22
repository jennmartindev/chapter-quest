import type { Book } from "./types";

// A square a given book is a candidate to fill (a "match"), with the live
// state of that square so we can tell whether it's still open and how close
// to done it is.
export interface Candidate {
  challengeId: string;
  challengeTag: string;
  squareId: string;
  squareKey: string;
  squareName: string;
  need: number;
  logged: number;
  maxPerBook: number;
  why: string | null;
}

export interface OptInput {
  book: Book;
  candidates: Candidate[];
}

export interface OptResult {
  book: Book;
  total: number; // open squares this book would clear (respecting per-card caps)
  chTouched: number; // how many distinct challenges it touches
  urgency: number; // tiebreak: favours finishing nearly-done squares
  open: Candidate[]; // the squares it would actually fill
  all: Candidate[]; // every candidate (for display, incl. already-done)
  rank: "best" | "high" | "med";
}

const isOpen = (c: Candidate) => c.logged < c.need;

// The core scoring. For each challenge the book touches, keep only OPEN squares,
// prefer the ones closest to completion, and cap at that challenge's max-per-book
// (HRCYED = 2, r/Fantasy = 1). One book can therefore legitimately clear squares
// across several challenges at once — that's the cross-challenge double/triple-dip.
export function scoreBook(input: OptInput): OptResult {
  const byChallenge = new Map<string, Candidate[]>();
  for (const c of input.candidates) {
    if (!byChallenge.has(c.challengeId)) byChallenge.set(c.challengeId, []);
    byChallenge.get(c.challengeId)!.push(c);
  }

  const open: Candidate[] = [];
  let urgency = 0;
  let chTouched = 0;

  for (const cands of byChallenge.values()) {
    const cap = cands[0]?.maxPerBook ?? 1;
    const openOnes = cands
      .filter(isOpen)
      .sort((a, b) => a.need - a.logged - (b.need - b.logged))
      .slice(0, cap);
    if (openOnes.length > 0) chTouched++;
    for (const o of openOnes) {
      open.push(o);
      urgency += 1 / Math.max(1, o.need - o.logged);
    }
  }

  const total = open.length;
  const rank: OptResult["rank"] = total >= 3 ? "best" : total >= 1 ? "high" : "med";

  return { book: input.book, total, chTouched, urgency, open, all: input.candidates, rank };
}

export function rankBooks(inputs: OptInput[]): OptResult[] {
  return inputs
    .map(scoreBook)
    .sort(
      (a, b) =>
        b.total - a.total || b.chTouched - a.chTouched || b.urgency - a.urgency
    );
}
