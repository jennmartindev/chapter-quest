import Link from "next/link";
import { loadEverything } from "@/lib/data";
import { challengeStatus, fmtDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import ShareButton from "@/components/ShareButton";
import ChallengeActions from "@/components/ChallengeActions";

const initial = (n: string) => (n || "?").charAt(0).toUpperCase();

export const dynamic = "force-dynamic";

export default async function ChallengesPage() {
  const load = await loadEverything();
  const supabase = createClient();
  const { data: archivedRows } = await supabase
    .from("challenges")
    .select("id, name, tag, template_key, user_id")
    .eq("archived", true)
    .order("template_key");
  const archived = archivedRows ?? [];

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
                  <span className="cc-actions-end">
                    <ChallengeActions challengeId={c.id} isOwner={c.user_id === load.userId} archived={false} name={c.name} />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {archived.length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: 28 }}><h2 style={{ fontSize: 16 }}>Archived</h2></div>
          {archived.map((a) => (
            <div className="arch-row" key={a.id}>
              <span className={`chtag ${a.template_key ?? ""}`}>{a.tag}</span>
              <b>{a.name}</b>
              <span className="arch-actions">
                <ChallengeActions challengeId={a.id} isOwner={a.user_id === load.userId} archived={true} name={a.name} />
              </span>
            </div>
          ))}
        </>
      )}

      <Link href="/import" className="continue" style={{ display: "block", textAlign: "center", marginTop: 24, background: "var(--card-2)", color: "var(--accent-deep)", boxShadow: "none", border: "1px dashed var(--line)" }}>
        ＋ Import books for these challenges
      </Link>
      <p className="board-tip">Custom card builder &amp; more challenge templates are coming next.</p>
    </>
  );
}
