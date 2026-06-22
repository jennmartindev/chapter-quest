"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  IconHome, IconCompass, IconGrid, IconBooks, IconUser, IconPalette,
  IconTarget, IconAward, IconUpload, IconMenu, IconClose, IconLogout,
} from "./icons";

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
  { href: "/", label: "Home", Icon: IconHome },
  { href: "/optimizer", label: "Read Next", Icon: IconCompass },
  { href: "/boards", label: "Boards", Icon: IconGrid },
  { href: "/library", label: "Library", Icon: IconBooks },
  { href: "/challenges", label: "Challenges", Icon: IconTarget },
  { href: "/import", label: "Import", Icon: IconUpload },
  { href: "/achievements", label: "Achievements", Icon: IconAward },
  { href: "/themes", label: "Themes", Icon: IconPalette },
  { href: "/profile", label: "Profile", Icon: IconUser },
];

export default function Shell({ initialTheme, children }: { initialTheme: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setThemeState] = useState(initialTheme);
  const [open, setOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("cq-theme") : null;
    if (saved && saved !== theme) setThemeState(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setOpen(false); }, [pathname]);

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
        <aside className={`sidebar${open ? " open" : ""}`}>
          <div className="brand">
            <span className="wm"><span className="de">Dog Ears</span><span className="dn"><i>&amp;</i> Dunes</span></span>
            <button className="icon-btn close-nav" aria-label="Close menu" onClick={() => setOpen(false)}><IconClose size={18} /></button>
          </div>
          <nav className="nav">
            {NAV.map(({ href, label, Icon }) => (
              <Link key={href} href={href} className={`nav-link${isActive(href) ? " active" : ""}`}>
                <span className="ni"><Icon size={19} /></span>{label}
              </Link>
            ))}
          </nav>
          <button className="nav-link signout" onClick={signOut}>
            <span className="ni"><IconLogout size={19} /></span>Sign out
          </button>
        </aside>

        {open && <div className="scrim" onClick={() => setOpen(false)} />}

        <div className="main">
          <header className="mtop">
            <button className="icon-btn" aria-label="Open menu" onClick={() => setOpen(true)}><IconMenu size={20} /></button>
            <span className="mlogo"><span className="wm sm"><span className="de">Dog Ears</span><span className="dn"><i>&amp;</i> Dunes</span></span></span>
          </header>
          <main className="viewport">{children}</main>
        </div>

        {toastMsg && <div className="toast-host"><div className="toast">{toastMsg}</div></div>}
      </div>
    </Ctx.Provider>
  );
}
