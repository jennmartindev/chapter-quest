"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface ShellCtx {
  theme: string;
  setTheme: (t: string) => void;
  toast: (msg: string) => void;
}
const Ctx = createContext<ShellCtx | null>(null);
export function useShell() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useShell must be used inside <Shell>");
  return c;
}

const NAV = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/optimizer", label: "Read Next", icon: "✨" },
  { href: "/boards", label: "Boards", icon: "▦", center: true },
  { href: "/library", label: "Library", icon: "📚" },
  { href: "/profile", label: "Profile", icon: "👤" },
];

export default function Shell({
  initialTheme,
  children,
}: {
  initialTheme: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setThemeState] = useState(initialTheme);
  const [drawer, setDrawer] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("cq-theme") : null;
    if (saved && saved !== theme) setThemeState(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setTheme(t: string) {
    setThemeState(t);
    if (typeof window !== "undefined") window.localStorage.setItem("cq-theme", t);
    fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: t }),
    }).catch(() => {});
  }

  function toast(msg: string) {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg(null), 2200);
  }

  async function signOut() {
    await fetch("/auth/signout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <Ctx.Provider value={{ theme, setTheme, toast }}>
      <div className="app" data-theme={theme}>
        <header className="topbar">
          <div className="logo">
            <span className="seal">📖</span>
            <span className="lt">
              <b>Chapter Quest</b>
              <span>your reading challenges</span>
            </span>
          </div>
          <span className="spacer" />
          <Link href="/themes" className="icon-btn" aria-label="Themes">🎨</Link>
          <button className="icon-btn" aria-label="Menu" onClick={() => setDrawer(true)}>☰</button>
        </header>

        <main className="viewport">{children}</main>

        <nav className="bottomnav">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`nav-btn${n.center ? " center" : ""}${isActive(n.href) ? " active" : ""}`}>
              <span className="gi">{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </nav>

        {drawer && (
          <>
            <div className="scrim" onClick={() => setDrawer(false)} />
            <aside className="drawer" onClick={() => setDrawer(false)}>
              <div className="logo">
                <span className="seal">📖</span>
                <span className="lt"><b>Chapter Quest</b><span>your reading challenges</span></span>
              </div>
              <div className="tag">Manage your reading life from a magical little bookstore.</div>
              <Link href="/optimizer"><span className="gi">✨</span> Cross-Challenge Optimizer</Link>
              <Link href="/boards"><span className="gi">▦</span> Boards</Link>
              <Link href="/library"><span className="gi">📚</span> Shared library</Link>
              <Link href="/import"><span className="gi">📥</span> Import StoryGraph CSV</Link>
              <Link href="/challenges"><span className="gi">🎯</span> My challenges</Link>
              <div className="grp">Settings</div>
              <Link href="/themes"><span className="gi">🎨</span> Theme settings</Link>
              <Link href="/achievements"><span className="gi">🏅</span> Achievements</Link>
              <button onClick={signOut} style={{ textAlign: "left" }}><span className="gi">⏏️</span> Sign out</button>
            </aside>
          </>
        )}

        {toastMsg && (
          <div className="toast-host">
            <div className="toast">{toastMsg}</div>
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}
