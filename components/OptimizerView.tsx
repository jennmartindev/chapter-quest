"use client";

import { useState } from "react";
import Link from "next/link";

export interface OptItem {
  id: string;
  title: string;
  author: string | null;
  g1: string;
  g2: string;
  cover: string | null;
  where: string | null;
  total: number;
  chTouched: number;
  rank: "best" | "high" | "med";
  matches: { squareId: string; tag: string; cls: string; name: string; why: string | null; done: boolean }[];
}

const RANK_LABEL: Record<string, string> = { best: "Best value", high: "High", med: "Low" };

// Borrowable or owned today: a Libby copy with no wait, hoopla (no holds), a print copy, or yours.
export const freeNow = (where: string | null) =>
  !!where && /\bnow\b|hoopla|ccpl print|owned|\bku\b/i.test(where);

export default function OptimizerView({ items, tbrCount, dips, filters }: { items: OptItem[]; tbrCount: number; dips: number; filters: { key: string; label: string }[] }) {
  const [filt, setFilt] = useState<string>("all");

  const shown = items.filter((it) => {
    if (filt === "all") return true;
    if (filt === "multi") return it.chTouched > 1;
    if (filt === "free") return freeNow(it.where);
    return it.matches.some((m) => m.cls === filt && !m.done);
  });
  const chips = [{ key: "all", label: "All" }, { key: "free", label: "Free right now" }, { key: "multi", label: "Multi-challenge" }, ...filters];

  return (
    <>
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
        {chips.map((f) => (
          <button key={f.key} className={`fchip${filt === f.key ? " on" : ""}`} onClick={() => setFilt(f.key)}>
            {f.label}
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
            <div className="cover" style={it.cover ? { backgroundImage: `url(${it.cover})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: `linear-gradient(160deg, ${it.g1}, ${it.g2})` }} />
            <div className="body">
              <span className={`rank ${it.rank}`}>{RANK_LABEL[it.rank]}</span>
              <h3>{it.title}</h3>
              <div className="author">{it.author ?? ""}{it.where ? <span className="where"> · {it.where}</span> : null}</div>
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
