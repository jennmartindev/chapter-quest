import { describe, expect, it } from "vitest";
import { cardRuleWarning, firstAuthor, isCoverUrl, matchingWorks, mergeResults, parseGoogle, parseOpenLibrary, sameTitle, type CardPick, type FoundBook } from "./books";

describe("isCoverUrl", () => {
  it("rejects the Amazon product page that broke The Last Wish", () => {
    expect(isCoverUrl("https://www.amazon.com/dp/0316029181?lv=shuf&channelId=500#immersive-view_1")).toBe(false);
  });

  it("accepts direct images from known cover hosts, with or without an extension", () => {
    expect(isCoverUrl("https://m.media-amazon.com/images/S/compressed.photo.goodreads.com/books/1/40864030.jpg")).toBe(true);
    expect(isCoverUrl("https://covers.openlibrary.org/b/id/8091016-M.jpg")).toBe(true);
    expect(isCoverUrl("https://books.google.com/books/content?id=abc&printsec=frontcover&img=1")).toBe(true);
  });

  it("accepts an image file from anywhere else, and rejects other pages", () => {
    expect(isCoverUrl("https://example.com/my/cover.PNG")).toBe(true);
    expect(isCoverUrl("https://example.com/my/cover.webp?size=large")).toBe(true);
    expect(isCoverUrl("https://example.com/book/the-last-wish")).toBe(false);
  });

  it("rejects non-https and things that aren't links", () => {
    expect(isCoverUrl("http://covers.openlibrary.org/b/id/1-M.jpg")).toBe(false);
    expect(isCoverUrl("javascript:alert(1)")).toBe(false);
    expect(isCoverUrl("data:image/png;base64,AAAA")).toBe(false);
    expect(isCoverUrl("not a link")).toBe(false);
    expect(isCoverUrl("")).toBe(false);
  });
});

describe("parseOpenLibrary", () => {
  it("maps a result and prefers a 978 ISBN", () => {
    const [b] = parseOpenLibrary([{ key: "/works/OL1W", title: "The Last Wish", author_name: ["Andrzej Sapkowski"], first_publish_year: 1993, number_of_pages_median: 342, isbn: ["0316029181", "9780316029186"], cover_i: 42 }]);
    expect(b).toEqual({ key: "/works/OL1W", title: "The Last Wish", author: "Andrzej Sapkowski", year: 1993, pages: 342, isbn: "9780316029186", cover: "https://covers.openlibrary.org/b/id/42-M.jpg" });
  });

  it("copes with missing fields and Open Library's -1 for no cover", () => {
    expect(parseOpenLibrary([{ key: "/works/OL2W", title: "Bare", cover_i: -1 }])[0]).toEqual({ key: "/works/OL2W", title: "Bare", author: null, year: null, pages: null, isbn: null, cover: null });
    expect(parseOpenLibrary([{ key: "/works/OL3W" }, { title: "No key" }])).toEqual([]);
  });
});

describe("parseGoogle", () => {
  it("maps a result and upgrades the thumbnail to https", () => {
    const [b] = parseGoogle([{ id: "abc", volumeInfo: { title: "Shift", authors: ["Hugh Howey"], publishedDate: "2013-05-01", pageCount: 500, imageLinks: { thumbnail: "http://books.google.com/x" }, industryIdentifiers: [{ identifier: "9781" }] } }]);
    expect(b).toMatchObject({ key: "google:abc", title: "Shift", author: "Hugh Howey", year: 2013, pages: 500, cover: "https://books.google.com/x", isbn: "9781" });
  });

  it("treats zero pages and a bad date as unknown", () => {
    const [b] = parseGoogle([{ id: "x", volumeInfo: { title: "T", publishedDate: "soon", pageCount: 0 } }]);
    expect(b).toMatchObject({ year: null, pages: null, cover: null, isbn: null });
  });
});

describe("mergeResults", () => {
  const book = (key: string, title: string, cover: string | null, author = "A"): FoundBook => ({ key, title, author, year: null, pages: null, isbn: null, cover });

  it("removes repeats across sources, keeping the first", () => {
    expect(mergeResults([[book("1", "The Last Wish", "c")], [book("2", "Last Wish", "d")]]).map((b) => b.key)).toEqual(["1"]);
  });

  it("puts results with covers first, otherwise keeping order, up to the limit", () => {
    const list = [book("1", "One", null), book("2", "Two", "c"), book("3", "Three", "c")];
    expect(mergeResults([list]).map((b) => b.key)).toEqual(["2", "3", "1"]);
    expect(mergeResults([list], 1)).toHaveLength(1);
  });

  it("keeps the same title by different authors", () => {
    expect(mergeResults([[book("1", "Shift", "c", "Howey"), book("2", "Shift", "c", "Other")]])).toHaveLength(2);
  });
});

describe("firstAuthor", () => {
  it("takes the first of a list and drops notes", () => {
    expect(firstAuthor("Andrzej Sapkowski, Danusia Stok")).toBe("Andrzej Sapkowski");
    expect(firstAuthor("Kim M. Watt (Author); Someone")).toBe("Kim M. Watt");
    expect(firstAuthor(null)).toBe("");
  });
});

describe("matchingWorks", () => {
  const titles = (docs: { title?: string }[]) => docs.map((d) => d.title);

  it("keeps a translated edition by the author, and drops box sets", () => {
    const docs = [
      { title: "Ostatnie Życzenie", author_name: ["Andrzej Sapkowski"] },
      { title: "Witcher Stories Boxed Set", author_name: ["Andrzej Sapkowski"] },
      { title: "Witcher Saga,8 Books Collection Set,the Last Wish", author_name: ["Andrzej Sapkowski"] },
      { title: "The Last Wish", author_name: ["Someone Else"] },
    ];
    expect(titles(matchingWorks(docs, "The Last Wish", "Andrzej Sapkowski, Danusia Stok"))).toEqual(["Ostatnie Życzenie"]);
  });

  it("falls back to the exact title when the author is unknown", () => {
    const docs = [{ title: "The last wish" }, { title: "Wishes" }];
    expect(titles(matchingWorks(docs, "The Last Wish", null))).toEqual(["The last wish"]);
  });

  it("copes with results missing a title", () => {
    expect(matchingWorks([{ author_name: ["A B"] }], "T", "A B")).toEqual([]);
  });
});

describe("sameTitle", () => {
  it("ignores case, punctuation and a leading article", () => {
    expect(sameTitle("The Last Wish", "last wish!")).toBe(true);
    expect(sameTitle("A Prayer for the Crown-Shy", "prayer for the crown shy")).toBe(true);
    expect(sameTitle("Shift", "Dust")).toBe(false);
  });
});

describe("cardRuleWarning", () => {
  const picks: CardPick[] = [
    { bookId: "b1", title: "Shift", squareId: "s1", squareName: "One-Word Title" },
    { bookId: "b2", title: "Dust", squareId: "s2", squareName: "Translated" },
  ];

  it("warns when a one-square card already has the book, by id or by title", () => {
    expect(cardRuleWarning({ id: "b1", title: "Shift" }, picks, "s9", 1)).toContain("already on One-Word Title");
    expect(cardRuleWarning({ title: "shift" }, picks, "s9", 1)).toContain("only one square");
  });

  it("is fine for a new book, or the square the book is already on", () => {
    expect(cardRuleWarning({ title: "Wool" }, picks, "s9", 1)).toBeNull();
    expect(cardRuleWarning({ id: "b1", title: "Shift" }, picks, "s1", 1)).toBeNull();
  });

  it("respects a card that allows two squares", () => {
    expect(cardRuleWarning({ id: "b1", title: "Shift" }, picks, "s9", 2)).toBeNull();
    const twice = [...picks, { bookId: "b1", title: "Shift", squareId: "s3", squareName: "Food" }];
    expect(cardRuleWarning({ id: "b1", title: "Shift" }, twice, "s9", 2)).toContain("only 2 squares");
  });
});
