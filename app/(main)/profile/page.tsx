import Link from "next/link";
import { getProfile, loadEverything } from "@/lib/data";
import { IconUpload, IconCompass, IconBooks, IconTarget, IconPalette, IconAward, IconChevron } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const [profile, load] = await Promise.all([getProfile(), loadEverything()]);
  const name = profile?.display_name ?? "Reader";
  const initial = name.charAt(0).toUpperCase();
  const challengeCount = load.challenges.length;

  return (
    <>
      <div className="profile-head">
        <div className="avatar">{initial}</div>
        <h2 style={{ fontSize: 20 }}>{name}</h2>
        <p className="serif-sub" style={{ margin: "3px 0 0" }}>
          Juggling {challengeCount} challenge{challengeCount === 1 ? "" : "s"} · {load.books.length} books in your library
        </p>
      </div>

      <div className="section-title"><h2 style={{ fontSize: 16 }}>Tools</h2></div>
      <Link href="/import" className="feat"><div className="ic"><IconUpload size={18} /></div><div className="t"><b>Import StoryGraph CSV</b><span>Read history &amp; TBR</span></div><span className="chev"><IconChevron size={16} /></span></Link>
      <Link href="/optimizer" className="feat"><div className="ic"><IconCompass size={18} /></div><div className="t"><b>Cross-Challenge Optimizer</b><span>Best next reads across all cards</span></div><span className="chev"><IconChevron size={16} /></span></Link>
      <Link href="/library" className="feat"><div className="ic"><IconBooks size={18} /></div><div className="t"><b>Shared library</b><span>Books credited across challenges</span></div><span className="chev"><IconChevron size={16} /></span></Link>
      <Link href="/challenges" className="feat"><div className="ic"><IconTarget size={18} /></div><div className="t"><b>My challenges</b><span>HRCYED 3.0 · r/Fantasy 2026</span></div><span className="chev"><IconChevron size={16} /></span></Link>
      <Link href="/themes" className="feat"><div className="ic"><IconPalette size={18} /></div><div className="t"><b>Theme customization</b><span>7 cozy looks</span></div><span className="chev"><IconChevron size={16} /></span></Link>
      <Link href="/achievements" className="feat"><div className="ic"><IconAward size={18} /></div><div className="t"><b>Achievements</b><span>Cozy milestones</span></div><span className="chev"><IconChevron size={16} /></span></Link>

      <form action="/auth/signout" method="post" style={{ marginTop: 18 }}>
        <button type="submit" className="continue" style={{ width: "100%", background: "var(--card-2)", color: "var(--accent-deep)", boxShadow: "none", border: "1px solid var(--line)" }}>
          Sign out
        </button>
      </form>
    </>
  );
}
