"use client";

import { useShell } from "@/components/Shell";

const THEMES = [
  { id: "sage", n: "Sage & Stories", d: "A quiet reading nook on a rainy afternoon.", sw: ["#6F8765", "#F4EFE3", "#C2993E"] },
  { id: "pride", n: "Pride & Prose 🌈", d: "Celebrate stories from every voice.", sw: ["#7C5BD6", "#D14D8B", "#E08A2B"] },
  { id: "academia", n: "Dark Academia 🕯️", d: "Candles, libraries, and mysteries.", sw: ["#211B15", "#B08A4E", "#ECE0CC"] },
  { id: "enchanted", n: "Enchanted Library ✨", d: "Spellbooks glowing on the top shelf.", sw: ["#191E33", "#9A86D8", "#E0CB7C"] },
  { id: "autumn", n: "Cozy Autumn 🍂", d: "Pumpkin spice and oversized sweaters.", sw: ["#C0612C", "#F3E5D2", "#D39435"] },
  { id: "pink", n: "Pink Paperbacks 🌸", d: "Soft, sweet, and a little romantic.", sw: ["#DB7AA0", "#FBEEF2", "#D9A24B"] },
  { id: "midnight", n: "Midnight Reader 🌙", d: "Just one more chapter.", sw: ["#13182B", "#5E6FC4", "#C9B26A"] },
];

export default function ThemesPage() {
  const { theme, setTheme, toast } = useShell();
  return (
    <>
      <span className="eyebrow">Make it yours</span>
      <h1 className="greet" style={{ fontSize: 22 }}>Theme picker</h1>
      <p className="muted" style={{ fontSize: 12.5, margin: "4px 0 16px" }}>Tap a theme to apply it instantly. Your choice is saved to your account.</p>
      {THEMES.map((t) => (
        <button
          key={t.id}
          className={`theme-card${theme === t.id ? " on" : ""}`}
          style={{ width: "100%", textAlign: "left" }}
          onClick={() => { setTheme(t.id); toast(`Theme: ${t.n}`); }}
        >
          <span className="swatch">{t.sw.map((c, i) => <i key={i} style={{ background: c }} />)}</span>
          <span className="info"><b>{t.n}</b><span>{t.d}</span></span>
          <span className="pick-dot" />
        </button>
      ))}
    </>
  );
}
