// What the bingo board shows. Pure functions, so the rules can be tested without a browser.
import type { MemberProgress } from "./types";

export type ReaderStatus = "reading" | "done" | null;

/** Every view of a shared board: one reader's collection, everyone at once, or the prompts. */
export type BoardView = { kind: "reader"; userId: string } | { kind: "together" } | { kind: "prompts" };

/** "lit" is full color, "partial" is part way there, and "dim" is not yet collected. */
export type Glow = "lit" | "partial" | "dim";

/** Fixed per reader, not per theme, so a person's color means the same thing on every screen. */
export const readerColor = (memberIndex: number) => `var(--reader-${Math.min(4, Math.max(0, memberIndex) + 1)})`;

const statusOf = (progress: MemberProgress[], userId: string): ReaderStatus =>
  progress.find((p) => p.userId === userId)?.status ?? null;

export function everyoneRead(progress: MemberProgress[]): boolean {
  return progress.length > 0 && progress.every((p) => p.status === "done");
}

export function sharedGlow(progress: MemberProgress[], view: BoardView): Glow {
  if (view.kind === "reader") {
    const status = statusOf(progress, view.userId);
    return status === "done" ? "lit" : status === "reading" ? "partial" : "dim";
  }
  if (everyoneRead(progress)) return "lit";
  return progress.some((p) => p.status) ? "partial" : "dim";
}

/** Boards you do alone can need several books per square, so progress is a fraction. */
export function soloGlow(state: "empty" | "options" | "progress" | "done"): Glow {
  return state === "done" ? "lit" : state === "progress" ? "partial" : "dim";
}

const LINES: number[][] = [
  ...[0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4].map((c) => r * 5 + c)),
  ...[0, 1, 2, 3, 4].map((c) => [0, 1, 2, 3, 4].map((r) => r * 5 + c)),
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20],
];

/** Completed rows, columns and diagonals on a 5x5 card, with squares given in board order. */
export function bingoLines(done: boolean[]): number {
  if (done.length !== 25) return 0;
  return LINES.filter((line) => line.every((i) => done[i])).length;
}

export function statusWord(status: ReaderStatus): string {
  return status === "done" ? "read" : status === "reading" ? "reading" : "not started";
}

/** What a screen reader hears for a square, since color alone doesn't tell you anything. */
export function squareLabel(title: string | null, prompt: string, progress: MemberProgress[]): string {
  const who = progress.map((p) => `${p.name} ${statusWord(p.status)}`).join(", ");
  return [title ?? "No book yet", prompt, who].filter(Boolean).join(". ");
}

/** One pick on a square: its book's status for this challenge, and the slot it's filed under. */
export interface SquarePick { status: string; slotId: string | null }

/**
 * How far along a solo square is. A square with slots (Rainbow: Red, Orange, …) counts each slot
 * once, so two red titles fill one slot, and a pick not filed under a slot is still just an option.
 * A square without slots counts its read books. "read" here already means read during the challenge.
 */
export function squareProgress(
  need: number,
  picks: SquarePick[],
  slotIds: string[]
): { logged: number; state: "empty" | "options" | "progress" | "done" } {
  let logged: number;
  if (slotIds.length > 0) {
    const slots = new Set(slotIds);
    logged = new Set(picks.filter((p) => p.status === "read" && p.slotId && slots.has(p.slotId)).map((p) => p.slotId)).size;
  } else {
    logged = picks.filter((p) => p.status === "read").length;
  }
  const reading = picks.some((p) => p.status === "currently-reading");
  const state = logged >= need ? "done" : logged > 0 || reading ? "progress" : picks.length > 0 ? "options" : "empty";
  return { logged, state };
}
