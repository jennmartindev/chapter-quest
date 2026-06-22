import { loadEverything, buildOptimizerInputs } from "@/lib/data";
import { rankBooks } from "@/lib/optimizer";
import OptimizerView, { type OptItem } from "@/components/OptimizerView";

export const dynamic = "force-dynamic";

const cls = (tag: string) => tag.toLowerCase().replace(/[^a-z0-9]/g, "");

export default async function OptimizerPage() {
  const load = await loadEverything();
  const ranked = rankBooks(buildOptimizerInputs(load));

  const items: OptItem[] = ranked.map((r) => ({
    id: r.book.id,
    title: r.book.title,
    author: r.book.author,
    g1: r.book.cover_g1,
    g2: r.book.cover_g2,
    total: r.total,
    chTouched: r.chTouched,
    rank: r.rank,
    matches: r.all.map((c) => ({
      squareId: c.squareId,
      tag: c.challengeTag,
      cls: cls(c.challengeTag),
      name: c.squareName,
      why: c.why,
      done: c.logged >= c.need,
    })),
  }));

  const tbrCount = load.books.filter(
    (b) => b.read_status === "to-read" || b.read_status === "currently-reading"
  ).length;
  const dips = ranked.filter((r) => r.chTouched > 1).length;

  return <OptimizerView items={items} tbrCount={tbrCount} dips={dips} />;
}
