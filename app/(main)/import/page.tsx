"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Result { parsed: number; imported: number; skipped: number; suggested: number; }
interface EnrichProg { done: number; total: number; updated: number; suggested: number; }

export default function ImportPage() {
  const router = useRouter();
  const [fileName, setFileName] = useState<string | null>(null);
  const [csv, setCsv] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const [pending, setPending] = useState<number | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [prog, setProg] = useState<EnrichProg | null>(null);

  const refreshPending = useCallback(async () => {
    try {
      const r = await fetch("/api/enrich");
      const d = await r.json();
      setPending(d.remaining ?? 0);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { refreshPending(); }, [refreshPending]);

  const runEnrich = useCallback(async () => {
    setEnriching(true);
    let total = 0;
    try {
      const g = await fetch("/api/enrich");
      total = (await g.json()).remaining ?? 0;
    } catch { /* ignore */ }
    if (total === 0) { setEnriching(false); setPending(0); return; }

    let updated = 0, suggested = 0, remaining = total;
    setProg({ done: 0, total, updated, suggested });
    // Process batches until the queue drains (Option B: snappy import, then this).
    for (let guard = 0; guard < 200; guard++) {
      const res = await fetch("/api/enrich", { method: "POST" });
      if (!res.ok) break;
      const d = await res.json();
      updated += d.updated; suggested += d.suggested; remaining = d.remaining;
      setProg({ done: total - remaining, total, updated, suggested });
      setPending(remaining);
      if (d.processed === 0 || remaining === 0) break;
    }
    setEnriching(false);
    router.refresh();
  }, [router]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setResult(null);
    setError(null);
    setCsv(await f.text());
  }

  async function run() {
    if (!csv) { setError("Choose your StoryGraph CSV first."); return; }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv }),
    });
    setBusy(false);
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Import failed."); return; }
    setResult(data);
    router.refresh();
    runEnrich(); // Option B: import is done; enrich in the background now.
  }

  return (
    <>
      <span className="eyebrow">Bring in your books</span>
      <h1 className="greet" style={{ fontSize: 22 }}>Import from StoryGraph</h1>
      <p className="muted" style={{ fontSize: 12.5, margin: "4px 0 16px", lineHeight: 1.5 }}>
        In StoryGraph: <b>Manage Account → Export StoryGraph Data</b>. Drop the CSV here — we add your reads &amp; TBR instantly, then fetch page counts and publish years in the background.
      </p>

      <div className="card" style={{ padding: 18 }}>
        <label className="btn ghost" style={{ display: "block", cursor: "pointer", marginBottom: 12 }}>
          {fileName ? fileName : "Choose CSV file…"}
          <input type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: "none" }} />
        </label>
        <button className="btn primary" style={{ width: "100%" }} onClick={run} disabled={busy || !csv}>
          {busy ? "Importing…" : "Import books"}
        </button>
        {error && <div className="auth-msg err" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      {result && (
        <div className="card" style={{ padding: 18, marginTop: 14 }}>
          <h2 style={{ fontSize: 17, marginBottom: 10 }}>Imported</h2>
          <div className="stat-row" style={{ marginTop: 0 }}>
            <div className="stat"><div className="n">{result.imported}</div><div className="l">Books added</div></div>
            <div className="stat"><div className="n">{result.suggested}</div><div className="l">Squares suggested</div></div>
            <div className="stat"><div className="n">{result.skipped}</div><div className="l">Already had</div></div>
          </div>
        </div>
      )}

      {/* Enrichment status (Option B) */}
      {(enriching || prog || (pending ?? 0) > 0) && (
        <div className="card" style={{ padding: 18, marginTop: 14 }}>
          <h2 style={{ fontSize: 16, marginBottom: 6 }}>Page counts &amp; publish years</h2>
          {enriching && prog ? (
            <>
              <p className="muted" style={{ fontSize: 12, margin: "0 0 10px" }}>
                Looking up Open Library… {prog.done}/{prog.total} · {prog.updated} filled, {prog.suggested} new square matches
              </p>
              <div className="bar"><i style={{ width: `${prog.total ? Math.round((prog.done / prog.total) * 100) : 0}%` }} /></div>
            </>
          ) : (pending ?? 0) > 0 ? (
            <>
              <p className="muted" style={{ fontSize: 12, margin: "0 0 10px" }}>
                {pending} book{pending === 1 ? "" : "s"} can still get a page count &amp; year from their ISBN.
              </p>
              <button className="btn primary" style={{ width: "100%" }} onClick={runEnrich} disabled={enriching}>
                Backfill now
              </button>
            </>
          ) : (
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>All caught up — every ISBN has been looked up.</p>
          )}
        </div>
      )}

      {result && !enriching && (
        <Link href="/optimizer" className="continue" style={{ display: "block", textAlign: "center" }}>See what to read next →</Link>
      )}

      <div className="overlap" style={{ marginTop: 18 }}>
        Your CSV becomes your own private library (row-level security). ~89% of a typical export has a real ISBN, so most books get page counts &amp; years automatically (audiobooks use an ASIN, so those stay manual). Title-based guesses and metadata matches are saved as <i>suggestions</i> you confirm on each square.
      </div>
    </>
  );
}
