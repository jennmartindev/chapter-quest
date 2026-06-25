import Link from "next/link";
import { loadEverything, buildOptimizerInputs, getProfile } from "@/lib/data";
import { rankBooks } from "@/lib/optimizer";
import { challengeStatus, fmtDate, overlapWindow } from "@/lib/format";
import { IconFlame, IconGrid, IconLayers } from "@/components/icons";
import { DuneWave, BookStack, PawStub } from "@/components/illustrations";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [load, profile] = await Promise.all([loadEverything(), getProfile()]);
  const ranked = rankBooks(buildOptimizerInputs(load));
  const top = ranked[0];

  const squaresDone = load.challenges.reduce((s, c) => s + c.done, 0);
  const squaresTotal = load.challenges.reduce((s, c) => s + c.total, 0);
  const dips = ranked.filter((r) => r.chTouched > 1).length;

  // closest open squares across every challenge
  const closest = load.challenges
    .flatMap((c) => c.squares.filter((s) => s.logged < s.need).map((s) => ({ c, s, left: s.need - s.logged })))
    .sort((a, b) => a.left - b.left || b.s.logged - a.s.logged)
    .slice(0, 4);

  const overlap =
    load.challenges.length >= 2 ? overlapWindow(load.challenges[0], load.challenges[1]) : null;

  const firstName = (profile?.display_name ?? "reader").split(" ")[0];

  return (
    <div className="home">
      <header className="home-mast">
        <div className="mast-l">
          <span className="eyebrow">Welcome back</span>
          <h1 className="greet">Good evening, <em>{firstName}</em>.</h1>
        </div>
        <div className="dogblob"><PawStub size={34} /></div>
      </header>
      <DuneWave className="dune" />

      <div className="stat-row">
        <div className="stat stat--streak"><div className="e"><IconFlame size={22} /></div><div className="n">{profile?.streak ?? 0}</div><div className="l">Day streak</div></div>
        <div className="stat stat--squares"><div className="e"><IconGrid size={22} /></div><div className="n">{squaresDone}<small>/{squaresTotal}</small></div><div className="l">Squares done</div></div>
        <div className="stat stat--multi"><div className="e"><IconLayers size={22} /></div><div className="n">{dips}</div><div className="l">Multi-challenge picks</div></div>
      </div>

      {top ? (
        <div className="hero">
          <div className="kicker">Read this next · best across all challenges</div>
          <h2>One book, {top.total} square{top.total > 1 ? "s" : ""}{top.chTouched > 1 ? ` — across ${top.chTouched} challenges` : ""}</h2>
          <p>Top pick from your TBR right now.</p>
          <div className="pick">
            <div className="cover" style={{ background: `linear-gradient(160deg, ${top.book.cover_g1}, ${top.book.cover_g2})` }} />
            <div className="meta">
              <b>{top.book.title}</b>
              <div className="tags">
                {top.open.map((m, i) => (
                  <span key={i} style={{ whiteSpace: "nowrap" }}>
                    ✓ {m.squareName} <i style={{ opacity: 0.8 }}>({m.challengeTag})</i>
                    {i < top.open.length - 1 ? "  ·  " : ""}
                  </span>
                ))}
              </div>
            </div>
            <span className="badge">+{top.total}</span>
          </div>
          <Link href="/optimizer" className="cta">Open the TBR Optimizer →</Link>
        </div>
      ) : (
        <div className="hero hero-empty">
          <div className="hero-illo"><BookStack size={96} /></div>
          <div className="hero-body">
            <div className="kicker">Read this next</div>
            <h2>Import your TBR to get picks</h2>
            <p>Once your to-read list is in, this card tells you the single book that clears the most squares across all your challenges.</p>
            <Link href="/import" className="cta">Import StoryGraph CSV →</Link>
          </div>
        </div>
      )}

      {overlap && (
        <div className="overlap">
          <b>Your challenges overlap {fmtDate(overlap.start)} – {fmtDate(overlap.end)}.</b> A book read inside the overlap can count for both — that&apos;s where the optimizer earns its keep.
        </div>
      )}

      <div className="section-title"><h2>Your challenges</h2><Link href="/challenges">Manage</Link></div>
      {load.challenges.map((c) => {
        const st = challengeStatus(c.start_date, c.end_date);
        const pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
        return (
          <div className="cc" key={c.id}>
            <div className="head">
              <span className={`chtag ${c.template_key ?? ""}`}>{c.tag}</span>
              <h3>{c.name}</h3>
              <span className={`status ${st.cls}`}>{st.label}</span>
            </div>
            <div className="body">
              <div className="win">{fmtDate(c.start_date)} → {fmtDate(c.end_date)}</div>
              <div className="barline">
                <div className="bar"><i style={{ width: `${pct}%` }} /></div>
                <span className="frac">{c.done}/{c.total}</span>
              </div>
              <Link href="/boards" className="open">Open board →</Link>
            </div>
          </div>
        );
      })}

      {closest.length > 0 && (
        <>
          <div className="section-title"><h2>Closest to finishing</h2></div>
          <div className="card prog">
            {closest.map(({ c, s, left }) => {
              const pct = Math.round((s.logged / s.need) * 100);
              return (
                <Link href={`/square/${s.id}`} className="prog-item" key={s.id}>
                  <div className="top">
                    <span className="name"><span className={`chtag ${c.template_key ?? ""}`}>{c.tag}</span>{s.name}</span>
                    <span className="count"><b>{left}</b> left</span>
                  </div>
                  <div className="bar"><i style={{ width: `${pct}%` }} /></div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      <Link href="/optimizer" className="continue" style={{ display: "block", textAlign: "center" }}>What should I read next? →</Link>
      <p className="board-tip">Tip: import your StoryGraph export to fill this with your real books.</p>
    </div>
  );
}
