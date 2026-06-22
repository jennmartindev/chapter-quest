const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${MONTHS[+m - 1]} ${+d}, ${y}`;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
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
