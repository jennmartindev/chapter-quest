"use client";

import { useState } from "react";
import Link from "next/link";

export interface OptItem {
  id: string;
  title: string;
  author: string | null;
  g1: string;
  g2: string;
  total: number;
  chTouched: number;
  rank: "best" | "high" | "med";
  matches: { squareId: string; tag: string; cls: string; name: string; why: string | null; done: boolean }[];
}

const RANK_LABEL: Record<string, string> = { best: "Best value", high: "High", med: "Low" };

export default function OptimizerView({ items, tbrCount, dips }: { items: OptItem[]; tbrCount: number; dips: number }) {
  const [filt, setFilt] = useState<"all" | "multi" | "hrcyed" | "rfantasy">("all");

  const shown = items.filter((it) => {
    if (filt === "all") return true;
    if (filt === "multi") return it.chTouched > 1;
    return it.matches.some((m) => m.cls === filt && !m.done);
  });

  return (
    <>
      <span className="eyebrow">The killer feature</span>
      <div className="tbr-hero">
        <span className="eyebrow">Cross-Challenge TBR Optimizer</span>
        <h2>What should I read next to finish the most squares?</h2>
        <div className="big">
          <div><b>{tbrCount}</b><span>books on your TBR</span></div>
          <div><b>{dips}</b><span>could clear 2+ challenges</span></div>
          <div><b>{items[0]?.total ?? 0}×</b><span>best squares from one book</span></div>
        </div>
        <Link href="/import" className="import">Import / update StoryGraph TBR</Link>
      </div>

      <div className="filters">
        {(["all", "multi", "hrcyed", "rfantasy"] as const).map((f) => (
          <button key={f} className={`fchip${filt === f ? " on" : ""}`} onClick={() => setFilt(f)}>
            {f === "all" ? "All" : f === "multi" ? "Multi-challenge" : f === "hrcyed" ? "HRCYED" : "r/Fantasy"}
          </button>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 11, margin: "0 2px 12px" }}>
        Ranked by total <i>open</i> squares each book clears across all your challenges. Books that finish a nearly-done square rank highest.
      </p>

      {shown.length === 0 ? (
        <div className="empty"><div className="big">📚</div>No matching books yet. Import your TBR and tag a few squares to see picks here.</div>
      ) : (
        shown.map((it) => (
          <div className="tbr-card" key={it.id}>
            <div className="cover" style={{ background: `linear-gradient(160deg, ${it.g1}, ${it.g2})` }} />
            <div className="body">
              <span className={`rank ${it.rank}`}>{RANK_LABEL[it.rank]}</span>
              <h3>{it.title}</h3>
              <div className="author">{it.author ?? ""}</div>
              <ul className="mlist">
                {it.matches.map((m, i) => (
                  <li key={i} className={m.done ? "dn" : ""}>
                    <span className={`chtag ${m.cls}`}>{m.tag}</span>
                    <Link href={`/square/${m.squareId}`} className="lbl">
                      {m.name} <i>· {m.why ?? "match"}{m.done ? " (done)" : ""}</i>
                    </Link>
                  </li>
                ))}
              </ul>
              <span className="summary">
                {it.chTouched > 1
                  ? `Clears ${it.total} squares across ${it.chTouched} challenges`
                  : it.total > 0
                  ? `Clears ${it.total} open square${it.total > 1 ? "s" : ""}`
                  : "Squares already filled"}
              </span>
            </div>
          </div>
        ))
      )}
    </>
  );
}
