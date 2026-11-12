import { describe, expect, it } from "vitest";
import { bingoLines, everyoneRead, readerColor, sharedGlow, soloGlow, squareLabel } from "./board";
import type { MemberProgress } from "./types";

const jenn = (status: MemberProgress["status"]) => ({ userId: "j", name: "Jenn", status });
const kat = (status: MemberProgress["status"]) => ({ userId: "k", name: "Kat", status });
const JENN_VIEW = { kind: "reader", userId: "j" } as const;
const KAT_VIEW = { kind: "reader", userId: "k" } as const;
const TOGETHER = { kind: "together" } as const;

describe("reader views", () => {
  it("lights a book only for the reader who read it", () => {
    const p = [jenn("done"), kat(null)];
    expect(sharedGlow(p, JENN_VIEW)).toBe("lit");
    expect(sharedGlow(p, KAT_VIEW)).toBe("dim");
  });

  it("shows reading as part way, so it no longer disappears", () => {
    const p = [jenn("reading"), kat("done")];
    expect(sharedGlow(p, JENN_VIEW)).toBe("partial");
    expect(sharedGlow(p, KAT_VIEW)).toBe("lit");
  });

  it("treats a reader with no progress row as not started", () => {
    expect(sharedGlow([kat("done")], JENN_VIEW)).toBe("dim");
  });
});

describe("together view", () => {
  it("is lit only when everyone has read it", () => {
    expect(sharedGlow([jenn("done"), kat("done")], TOGETHER)).toBe("lit");
  });

  it("is part way when anyone has started", () => {
    expect(sharedGlow([jenn("done"), kat(null)], TOGETHER)).toBe("partial");
    expect(sharedGlow([jenn(null), kat("reading")], TOGETHER)).toBe("partial");
  });

  it("is dim when nobody has", () => {
    expect(sharedGlow([jenn(null), kat(null)], TOGETHER)).toBe("dim");
  });
});

describe("everyoneRead", () => {
  it("needs every member, and at least one", () => {
    expect(everyoneRead([jenn("done"), kat("done")])).toBe(true);
    expect(everyoneRead([jenn("done"), kat("reading")])).toBe(false);
    expect(everyoneRead([])).toBe(false);
  });
});

describe("solo boards", () => {
  it("maps square state to glow", () => {
    expect(soloGlow("done")).toBe("lit");
    expect(soloGlow("progress")).toBe("partial");
    expect(soloGlow("options")).toBe("dim");
    expect(soloGlow("empty")).toBe("dim");
  });
});

describe("bingoLines", () => {
  const card = (filled: number[]) => Array.from({ length: 25 }, (_, i) => filled.includes(i));

  it("finds rows, columns and both diagonals", () => {
    expect(bingoLines(card([0, 1, 2, 3, 4]))).toBe(1);
    expect(bingoLines(card([2, 7, 12, 17, 22]))).toBe(1);
    expect(bingoLines(card([0, 6, 12, 18, 24]))).toBe(1);
    expect(bingoLines(card([4, 8, 12, 16, 20]))).toBe(1);
  });

  it("counts crossing lines separately, and a full card as twelve", () => {
    expect(bingoLines(card([0, 1, 2, 3, 4, 5, 10, 15, 20]))).toBe(2);
    expect(bingoLines(Array(25).fill(true))).toBe(12);
  });

  it("doesn't count an incomplete line or a card of another size", () => {
    expect(bingoLines(card([0, 1, 2, 3]))).toBe(0);
    expect(bingoLines(Array(9).fill(true))).toBe(0);
  });
});

describe("labels and colors", () => {
  it("says who read what for screen readers", () => {
    expect(squareLabel("Shift", "One-Word Title", [jenn("done"), kat("reading")])).toBe("Shift. One-Word Title. Jenn read, Kat reading");
    expect(squareLabel(null, "Translated", [jenn(null)])).toBe("No book yet. Translated. Jenn not started");
  });

  it("gives each reader a stable color, capped at four", () => {
    expect(readerColor(0)).toBe("var(--reader-1)");
    expect(readerColor(1)).toBe("var(--reader-2)");
    expect(readerColor(9)).toBe("var(--reader-4)");
    expect(readerColor(-1)).toBe("var(--reader-1)");
  });
});

import { readInWindow } from "./format";

describe("readInWindow", () => {
  it("counts a book finished inside the challenge dates, ends included", () => {
    expect(readInWindow("2026-07-01", "2026-07-01", "2027-06-30")).toBe(true);
    expect(readInWindow("2027-06-30", "2026-07-01", "2027-06-30")).toBe(true);
    expect(readInWindow("2026-11-09", "2026-07-01", "2027-06-30")).toBe(true);
  });
  it("leaves out books finished before or after, and books with no date", () => {
    expect(readInWindow("2026-06-30", "2026-07-01", "2027-06-30")).toBe(false);
    expect(readInWindow("2027-07-01", "2026-07-01", "2027-06-30")).toBe(false);
    expect(readInWindow(null, "2026-07-01", "2027-06-30")).toBe(false);
  });
});
