import { loadEverything } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AchievementsPage() {
  const load = await loadEverything();

  const anyBook = load.books.length > 0;
  const anyLogged = load.bookSquares.some((r) => r.status === "logged");
  const anyDoneSquare = load.challenges.some((c) => c.done > 0);
  const twoCards = load.challenges.length >= 2;

  // a book tagged to >1 challenge = a double-dip
  const chByBook = new Map<string, Set<string>>();
  for (const r of load.bookSquares) {
    if (!chByBook.has(r.book_id)) chByBook.set(r.book_id, new Set());
    chByBook.get(r.book_id)!.add(r.challenge_id);
  }
  const anyDip = Array.from(chByBook.values()).some((s) => s.size > 1);
  const totalLogged = load.bookSquares.filter((r) => r.status === "logged").length;

  const list = [
    { i: "📖", t: "First Book Logged", d: "Log your first read", unlocked: anyLogged || anyBook },
    { i: "✅", t: "First Full Square", d: "Complete a whole square", unlocked: anyDoneSquare },
    { i: "🤹", t: "Double Dipper", d: "One book, two challenges", unlocked: anyDip },
    { i: "🧭", t: "Two-Card Reader", d: "Active in 2 challenges", unlocked: twoCards },
    { i: "💎", t: "Triple Threat", d: "One book clears 3 squares", unlocked: false },
    { i: "🔟", t: "Ten Down", d: "Log 10 books", unlocked: totalLogged >= 10 },
    { i: "🐉", t: "Book Dragon", d: "Read 50 books in a year", unlocked: false },
    { i: "🏆", t: "Grand Slam", d: "Complete every active challenge", unlocked: false },
  ];

  return (
    <>
      <span className="eyebrow">Your shelf of honors</span>
      <h1 className="greet" style={{ fontSize: 22 }}>Achievements</h1>
      <p className="muted" style={{ fontSize: 12.5, margin: "4px 0 14px" }}>These unlock automatically as you read and log books.</p>
      <div className="ach-grid">
        {list.map((a) => (
          <div className={`ach${a.unlocked ? "" : " locked"}`} key={a.t}>
            <div className="medal">{a.i}</div>
            <h3>{a.t}</h3>
            <p>{a.d}</p>
          </div>
        ))}
      </div>
    </>
  );
}
