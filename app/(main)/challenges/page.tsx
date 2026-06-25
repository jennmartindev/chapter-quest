import Link from "next/link";
import { loadEverything } from "@/lib/data";
import { challengeStatus, fmtDate } from "@/lib/format";
import ShareButton from "@/components/ShareButton";

const initial = (n: string) => (n || "?").charAt(0).toUpperCase();

export const dynamic = "force-dynamic";

export default async function ChallengesPage() {
  const load = await loadEverything();

  return (
    <>
      <span className="eyebrow">Your challenges</span>
      <h1 className="greet" style={{ fontSize: 22 }}>My challenges</h1>

      <div style={{ marginTop: 16 }}>
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
                <div className="win">{fmtDate(c.start_date)} → {fmtDate(c.end_date)} · {c.max_per_book} square{c.max_per_book > 1 ? "s" : ""}/book</div>
                <div className="barline">
                  <div className="bar"><i style={{ width: `${pct}%` }} /></div>
                  <span className="frac">{c.done}/{c.total}</span>
                </div>
                {c.shared && c.members.length > 0 && (
                  <div className="members-bar" style={{ margin: "10px 0 0" }}>
                    <span className="ml">Together</span>
                    {c.members.map((m) => (
                      <span key={m.userId} className="mchip"><i className="md md-none">{initial(m.name)}</i>{m.name}</span>
                    ))}
                  </div>
                )}
                <div className="cc-actions">
                  <Link href={`/boards?c=${c.template_key ?? ""}`} className="open">Open board →</Link>
                  {c.user_id === load.userId && <ShareButton challengeId={c.id} />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Link href="/import" className="continue" style={{ display: "block", textAlign: "center", background: "var(--card-2)", color: "var(--accent-deep)", boxShadow: "none", border: "1px dashed var(--line)" }}>
        ＋ Import books for these challenges
      </Link>
      <p className="board-tip">Custom card builder &amp; more challenge templates are coming next.</p>
    </>
  );
}
