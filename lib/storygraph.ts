import type { ReadStatus } from "./types";

// ---- Parsing a StoryGraph CSV export row into our Book shape ----
// StoryGraph's export headers (as of 2025/26):
//   Title, Authors, Contributors, ISBN/UID, Format, Read Status, Date Added,
//   Last Date Read, Dates Read, Read Count, Moods, Pace, ... , Star Rating,
//   Review, Content Warnings, Content Warning Description, Tags, Owned?

export interface ParsedBook {
  title: string;
  author: string | null;
  isbn: string | null;
  format: string | null;
  read_status: ReadStatus;
  star_rating: number | null;
  date_read: string | null;
  tags: string | null;
  cover_g1: string;
  cover_g2: string;
  source: "storygraph";
}

const STATUS_MAP: Record<string, ReadStatus> = {
  "to-read": "to-read",
  "to read": "to-read",
  "currently-reading": "currently-reading",
  "currently reading": "currently-reading",
  read: "read",
  "did-not-finish": "did-not-finish",
  "did not finish": "did-not-finish",
  dnf: "did-not-finish",
  paused: "currently-reading",
};

function pick(row: Record<string, string>, ...names: string[]): string {
  for (const n of names) {
    for (const key of Object.keys(row)) {
      if (key.trim().toLowerCase() === n.toLowerCase() && row[key]) {
        return row[key].trim();
      }
    }
  }
  return "";
}

function toIsoDate(raw: string): string | null {
  if (!raw) return null;
  // StoryGraph uses YYYY/MM/DD or YYYY-MM-DD; sometimes a date range.
  const first = raw.split(/[-–]/)[0].trim().replace(/\//g, "-");
  const m = first.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

// Deterministic cozy gradient cover from the title, so we never need external images.
const COVER_PAIRS: [string, string][] = [
  ["#5d76a8", "#2f3f63"], ["#8a2f2f", "#4a1414"], ["#6F8765", "#3f5238"],
  ["#a9794a", "#6b4a26"], ["#7c5bd6", "#3f2d77"], ["#4f7a8a", "#27414a"],
  ["#c98b3a", "#7c5118"], ["#8d5d8c", "#523151"], ["#4f7a5a", "#274030"],
  ["#3a3f4a", "#16181e"], ["#9a8a4a", "#5f5526"], ["#6a7a8c", "#33414f"],
];
function coverFor(title: string): [string, string] {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return COVER_PAIRS[h % COVER_PAIRS.length];
}

export function parseStoryGraphRow(row: Record<string, string>): ParsedBook | null {
  const title = pick(row, "Title");
  if (!title) return null;

  const author = pick(row, "Authors", "Author") || null;
  const statusRaw = pick(row, "Read Status").toLowerCase();
  const read_status = STATUS_MAP[statusRaw] ?? "to-read";
  const ratingRaw = pick(row, "Star Rating");
  const star_rating = ratingRaw ? parseFloat(ratingRaw) || null : null;
  const [g1, g2] = coverFor(title);

  return {
    title,
    author,
    isbn: pick(row, "ISBN/UID", "ISBN") || null,
    format: pick(row, "Format") || null,
    read_status,
    star_rating,
    date_read: toIsoDate(pick(row, "Last Date Read", "Dates Read")),
    tags: pick(row, "Tags") || null,
    cover_g1: g1,
    cover_g2: g2,
    source: "storygraph",
  };
}

// ---- ISBN helpers (for Open Library enrichment) ----
export function cleanIsbn(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.replace(/[-\s]/g, "");
  return v || null;
}
// StoryGraph's ISBN/UID is sometimes an Amazon ASIN (audiobooks) or blank.
// Only real ISBN-10/13 can be looked up by ISBN.
export function isRealIsbn(raw: string | null | undefined): boolean {
  const v = cleanIsbn(raw);
  return !!v && (/^\d{13}$/.test(v) || /^\d{9}[\dXx]$/.test(v));
}

// ---- Best-effort auto-matcher ----
// Title-only heuristics (a CSV export has no reliable page count / genre / year),
// so these are *suggestions* the user can confirm. Returns (templateKey, squareKey, why).
export interface SquareSuggestion {
  templateKey: string;
  squareKey: string;
  why: string;
}

const COLORS = ["red", "orange", "yellow", "green", "blue", "purple", "pink", "white", "black", "silver", "gold"];
const NUMBER_WORDS = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const ELEMENTS = ["hydrogen", "helium", "lithium", "boron", "carbon", "nitrogen", "oxygen", "neon", "sodium", "silicon", "sulfur", "iron", "cobalt", "copper", "silver", "tin", "gold", "mercury", "lead", "radon", "radium", "uranium", "argon", "xenon"];
const FAMILY = ["mother", "father", "sister", "brother", "daughter", "son", "aunt", "uncle", "cousin", "grandmother", "grandfather", "niece", "nephew", "sibling", "wife", "husband", "widow"];

export function suggestSquares(title: string): SquareSuggestion[] {
  const out: SquareSuggestion[] = [];
  const lower = title.toLowerCase();
  const words = lower.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const wordSet = new Set(words);

  // r/Fantasy: one-word title
  const realWords = title.trim().split(/\s+/).filter(Boolean);
  if (realWords.length === 1) {
    out.push({ templateKey: "rfantasy", squareKey: "oneword", why: "single-word title" });
  }

  // HRCYED: titular counting (1–10 words)
  if (realWords.length >= 1 && realWords.length <= 10) {
    out.push({ templateKey: "hrcyed", squareKey: "titular", why: `${realWords.length}-word title` });
  }

  for (const c of COLORS) {
    if (wordSet.has(c)) { out.push({ templateKey: "hrcyed", squareKey: "rainbow", why: `“${c}” in title` }); break; }
  }
  for (const n of NUMBER_WORDS) {
    if (wordSet.has(n)) { out.push({ templateKey: "hrcyed", squareKey: "numerical", why: `“${n}” in title` }); break; }
  }
  for (const e of ELEMENTS) {
    if (wordSet.has(e)) { out.push({ templateKey: "hrcyed", squareKey: "periodic", why: `“${e}” in title` }); break; }
  }
  for (const f of FAMILY) {
    if (wordSet.has(f)) { out.push({ templateKey: "hrcyed", squareKey: "familial", why: `“${f}” in title` }); break; }
  }

  return out;
}

// Suggestions that need metadata we only get from an ISBN lookup (page count,
// publication year). Run after enrichment.
export function suggestFromMeta(pages: number | null, year: number | null): SquareSuggestion[] {
  const out: SquareSuggestion[] = [];
  if (pages && pages >= 500) {
    out.push({ templateKey: "rfantasy", squareKey: "catsquasher", why: `${pages} pages${pages >= 900 ? " — hard mode!" : ""}` });
  }
  if (year && year >= 1970 && year <= 1979) {
    out.push({ templateKey: "rfantasy", squareKey: "pub70s", why: `published ${year}` });
  }
  if (year === 2026) {
    out.push({ templateKey: "rfantasy", squareKey: "pub2026", why: "published 2026" });
  }
  return out;
}
