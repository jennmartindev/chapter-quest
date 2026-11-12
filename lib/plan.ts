// Importing a reading plan (rows from the reading-plan sheet) onto a challenge.
// Pure helpers, so the matching can be tested without a database.

export interface PlanRow {
  square: string; // the square's key in its template ("rainbow", "jan", "bipoc")
  slot?: string | null; // the slot's label ("Red", "3 words"); also renames the slot
  title?: string | null; // empty = just label the slot
  author?: string | null;
  note?: string | null;
  where?: string | null; // where to get it ("Libby: ebook now")
}

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
const surname = (author: string | null | undefined) => {
  const first = (author ?? "").split(",")[0].replace(/\(.*?\)/g, "").trim().split(/\s+/);
  return norm(first[first.length - 1]);
};

/**
 * Finds the library book a plan row means. Exact title first; then a title that differs only by a
 * subtitle or series tag ("Marple" vs "Marple: Twelve New Mysteries"), as long as the author agrees.
 */
export function findBook<B extends { title: string; author: string | null }>(books: B[], title: string, author?: string | null): B | null {
  const t = norm(title);
  if (!t) return null;
  const sameAuthor = (b: B) => !author || !b.author || surname(b.author) === surname(author);
  const exact = books.filter((b) => norm(b.title) === t);
  if (exact.length) return exact.find(sameAuthor) ?? exact[0];
  if (t.length < 6) return null;
  return books.find((b) => {
    const bt = norm(b.title);
    return (bt.startsWith(t) || t.startsWith(bt)) && bt.length >= 6 && sameAuthor(b);
  }) ?? null;
}

/** Slot positions in sheet order: the first row for a square is slot 1, the next slot 2, and so on. */
export function slotPositions(rows: PlanRow[]): number[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const n = (seen.get(r.square) ?? 0) + 1;
    seen.set(r.square, n);
    return n;
  });
}
