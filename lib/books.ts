// Book search and cover rules. Pure functions, so they can be tested without the network.

export type FoundBook = {
  key: string;
  title: string;
  author: string | null;
  year: number | null;
  pages: number | null;
  isbn: string | null;
  cover: string | null;
};

export const openLibraryCover = (id: number) => `https://covers.openlibrary.org/b/id/${id}-M.jpg`;

const IMAGE_HOSTS = [
  "covers.openlibrary.org",
  "books.google.com",
  "books.googleusercontent.com",
  "m.media-amazon.com",
  "images-na.ssl-images-amazon.com",
  "i.gr-assets.com",
];

/** Whether a link is an image rather than a web page, such as an Amazon product page. */
export function isCoverUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (IMAGE_HOSTS.includes(url.hostname)) return true;
  return /\.(jpe?g|png|webp|gif|avif)$/i.test(url.pathname);
}

export const normalizeTitle = (title: string) =>
  title.toLowerCase().replace(/^(the|a|an)\s+/, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export const sameTitle = (a: string, b: string) => normalizeTitle(a) === normalizeTitle(b);

function bestIsbn(list: unknown): string | null {
  if (!Array.isArray(list)) return null;
  const strings = list.filter((x): x is string => typeof x === "string");
  return strings.find((x) => x.length === 13 && x.startsWith("978")) ?? strings[0] ?? null;
}

type OpenLibraryDoc = {
  key?: string; title?: string; author_name?: string[]; first_publish_year?: number;
  number_of_pages_median?: number; isbn?: string[]; cover_i?: number;
};

export function parseOpenLibrary(docs: OpenLibraryDoc[]): FoundBook[] {
  return docs
    .filter((d) => d.title && d.key)
    .map((d) => ({
      key: d.key!,
      title: d.title!,
      author: d.author_name?.[0] ?? null,
      year: d.first_publish_year ?? null,
      pages: d.number_of_pages_median ?? null,
      isbn: bestIsbn(d.isbn),
      cover: d.cover_i && d.cover_i > 0 ? openLibraryCover(d.cover_i) : null,
    }));
}

type GoogleItem = {
  id?: string;
  volumeInfo?: {
    title?: string; authors?: string[]; publishedDate?: string; pageCount?: number;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    industryIdentifiers?: { type?: string; identifier?: string }[];
  };
};

export function parseGoogle(items: GoogleItem[]): FoundBook[] {
  return items
    .filter((i) => i.id && i.volumeInfo?.title)
    .map((i) => {
      const v = i.volumeInfo!;
      const thumb = v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail ?? null;
      const year = Number(v.publishedDate?.slice(0, 4));
      return {
        key: `google:${i.id}`,
        title: v.title!,
        author: v.authors?.[0] ?? null,
        year: Number.isFinite(year) && year > 0 ? year : null,
        pages: v.pageCount || null,
        isbn: bestIsbn((v.industryIdentifiers ?? []).map((x) => x.identifier)),
        cover: thumb ? thumb.replace(/^http:/, "https:") : null,
      };
    });
}

/** Library authors can be a list, as in "Andrzej Sapkowski, Danusia Stok". */
export const firstAuthor = (author: string | null) => (author ?? "").replace(/\(.*?\)/g, "").split(/[,;&]/)[0].trim();

const surname = (name: string) => normalizeTitle(name).split(" ").pop() ?? "";
const COLLECTION = /\b(box(ed)?\s*set|collection|omnibus|\d+\s*books?|series set)\b/i;

/**
 * Which search results are this book, for offering its covers. A translated edition counts when the
 * author matches, since a plain search only returns it for matching the title in some edition.
 * Box sets don't count, because their covers aren't this book's.
 */
export function matchingWorks<T extends { title?: string; author_name?: string[] }>(docs: T[], title: string, author: string | null): T[] {
  const wanted = surname(firstAuthor(author));
  return docs.filter((d) => {
    if (!d.title || COLLECTION.test(d.title)) return false;
    const byAuthor = !!wanted && (d.author_name ?? []).some((a) => surname(a) === wanted);
    return wanted ? byAuthor : sameTitle(d.title, title);
  });
}

/** Results with covers first, without repeating a title and author. */
export function mergeResults(lists: FoundBook[][], limit = 12): FoundBook[] {
  const seen = new Set<string>();
  const merged: FoundBook[] = [];
  for (const b of lists.flat()) {
    const id = `${normalizeTitle(b.title)}|${(b.author ?? "").toLowerCase()}`;
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push(b);
  }
  return merged
    .map((b, i) => ({ b, i }))
    .sort((x, y) => Number(!!y.b.cover) - Number(!!x.b.cover) || x.i - y.i)
    .slice(0, limit)
    .map(({ b }) => b);
}

export type CardPick = { bookId: string; title: string; squareId: string; squareName: string };

/** The warning to show if adding this book would break the card's reuse rule, or null if it's fine. */
export function cardRuleWarning(
  book: { id?: string; title: string },
  picks: CardPick[],
  currentSquareId: string,
  maxPerBook: number,
): string | null {
  const elsewhere = picks.filter((p) => p.squareId !== currentSquareId && (p.bookId === book.id || sameTitle(p.title, book.title)));
  if (elsewhere.length < maxPerBook) return null;
  const names = elsewhere.map((p) => p.squareName).join(", ");
  const rule = maxPerBook === 1 ? "only one square" : `only ${maxPerBook} squares`;
  return `“${book.title}” is already on ${names}. This card allows a book on ${rule}. Add it anyway?`;
}
