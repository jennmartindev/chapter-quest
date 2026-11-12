const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${MONTHS[+m - 1]} ${+d}, ${y}`;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// A book counts toward a challenge only if it was finished inside the challenge's dates.
// Books with no read date can't be placed, so they don't count.
export function readInWindow(dateRead: string | null | undefined, start: string, end: string): boolean {
  if (!dateRead) return false;
  const d = dateRead.slice(0, 10);
  return d >= start && d <= end;
}

// Today's date where the reader is, not on the server's UTC clock, so a book finished
// in the evening isn't dated the next day.
export function readerToday(timeZone = "America/New_York"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function challengeStatus(start: string, end: string): { label: string; cls: "live" | "soon" } {
  const t = today();
  if (t < start) return { label: `Opens ${fmtDate(start)}`, cls: "soon" };
  if (t > end) return { label: "Ended", cls: "soon" };
  return { label: "Live now", cls: "live" };
}

// Do the two challenges' date windows overlap? Returns the overlap span or null.
export function overlapWindow(a: { start_date: string; end_date: string }, b: { start_date: string; end_date: string }) {
  const start = a.start_date > b.start_date ? a.start_date : b.start_date;
  const end = a.end_date < b.end_date ? a.end_date : b.end_date;
  return start <= end ? { start, end } : null;
}
