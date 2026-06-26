import Link from "next/link";
import { loadEverything } from "@/lib/data";
import CoverEdit from "@/components/CoverEdit";

export const dynamic = "force-dynamic";

const cls = (tag: string) => tag.toLowerCase().replace(/[^a-z0-9]/g, "");
const STATUS_LABEL: Record<string, string> = {
  read: "Read",
  "currently-reading": "Reading",
  "to-read": "TBR",
  "did-not-finish": "DNF",
};

export default async function LibraryPage() {
  const load = await loadEverything();

  const squareName = new Map<string, string>();
  const squareTag = new Map<string, string>();
  for (const c of load.challenges) for (const s of c.squares) { squareName.set(s.id, s.name); squareTag.set(s.id, c.tag); }

  const creditsByBook = new Map<string, { name: string; tag: string }[]>();
  for (const r of load.bookSquares) {
    if (!creditsByBook.has(r.book_id)) creditsByBook.set(r.book_id, []);
    creditsByBook.get(r.book_id)!.push({ name: squareName.get(r.square_id) ?? "", tag: squareTag.get(r.square_id) ?? "" });
  }

  return (
    <>
      <span className="eyebrow">Read once · counts everywhere</span>
      <h1 className="greet" style={{ fontSize: 22 }}>Shared library</h1>
      <p className="muted" style={{ fontSize: 12, margin: "4px 0 14px" }}>
        Every book lives here once and lights up squares on every challenge it qualifies for.
      </p>

      {load.books.length === 0 ? (
        <div className="empty">
          Your library is empty.
          <div style={{ marginTop: 12 }}><Link href="/import" className="continue" style={{ display: "inline-block", padding: "10px 18px" }}>Import StoryGraph CSV</Link></div>
        </div>
      ) : (
        load.books.map((b) => {
          const credits = creditsByBook.get(b.id) ?? [];
          return (
            <div className="lib-item" key={b.id}>
              <div
                className="cover"
                style={
                  b.cover_url
                    ? { backgroundImage: `url(${b.cover_url})`, backgroundSize: "cover", backgroundPosition: "center" }
                    : { background: `linear-gradient(160deg, ${b.cover_g1}, ${b.cover_g2})` }
                }
              />
              <div className="li">
                <b>{b.title}</b>
                <div className="au">{b.author ?? ""} · <span className="lib-status">{STATUS_LABEL[b.read_status] ?? b.read_status}</span></div>
                <div className="credits">
                  {credits.length === 0 ? (
                    <span className="muted" style={{ fontSize: 10.5 }}>Not tagged to any square yet</span>
                  ) : (
                    credits.map((cr, i) => (
                      <span className="cr" key={i}><span className={`chtag ${cls(cr.tag)}`}>{cr.tag}</span>{cr.name}</span>
                    ))
                  )}
                </div>
              </div>
              <CoverEdit bookId={b.id} hasCover={!!b.cover_url} />
            </div>
          );
        })
      )}
    </>
  );
}
