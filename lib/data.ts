import { createClient } from "@/lib/supabase/server";
import type {
  SquareSlot,
  Book,
  Challenge,
  ChallengeWithSquares,
  MemberProgress,
  Profile,
  Square,
  SquareProgress,
} from "./types";
import type { OptInput, Candidate } from "./optimizer";
import { readInWindow } from "./format";
import { squareProgress, type SquarePick } from "./board";

const norm = (t: string | null) => (t ?? "").toLowerCase().trim();

// For shared boards, reflect the current user's OWN library read-status onto
// their per-person progress (so they don't have to mark it twice, and co-members
// can see it). Only touches auto rows — manual overrides are left alone.
export async function syncSharedProgress(): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const uid = user?.id;
  if (!uid) return;

  const { data: chs } = await supabase.from("challenges").select("id, start_date, end_date").eq("shared", true);
  const sharedIds = (chs ?? []).map((c) => c.id);
  const windowById = new Map((chs ?? []).map((c) => [c.id as string, { start: c.start_date as string, end: c.end_date as string }]));
  if (sharedIds.length === 0) return;

  const [{ data: picks }, { data: myBooks }, { data: myProg }] = await Promise.all([
    supabase.from("book_squares").select("square_id, challenge_id, pick_title").in("challenge_id", sharedIds),
    supabase.from("books").select("title, read_status, date_read"),
    supabase.from("square_progress").select("square_id, status, auto").eq("user_id", uid).in("challenge_id", sharedIds),
  ]);

  // Every copy of a title in your library, so each board can check the read date against its own dates.
  const myBooksByTitle = new Map<string, { read_status: string; date_read: string | null }[]>();
  for (const b of (myBooks ?? []) as { title: string; read_status: string; date_read: string | null }[]) {
    const k = norm(b.title);
    if (!myBooksByTitle.has(k)) myBooksByTitle.set(k, []);
    myBooksByTitle.get(k)!.push(b);
  }
  const myStatusFor = (title: string | null, challengeId: string): "reading" | "done" | null => {
    const w = windowById.get(challengeId);
    let s: "reading" | "done" | null = null;
    for (const b of myBooksByTitle.get(norm(title)) ?? []) {
      if (b.read_status === "read" && w && readInWindow(b.date_read, w.start, w.end)) return "done";
      if (b.read_status === "currently-reading") s = "reading";
    }
    return s;
  };

  const desired = new Map<string, { status: "reading" | "done"; challenge_id: string }>();
  for (const p of (picks ?? []) as { square_id: string; challenge_id: string; pick_title: string | null }[]) {
    const s = myStatusFor(p.pick_title, p.challenge_id);
    if (!s) continue;
    const cur = desired.get(p.square_id);
    if (s === "done" || !cur) desired.set(p.square_id, { status: s, challenge_id: p.challenge_id });
  }

  const progBySquare = new Map((myProg ?? []).map((r) => [r.square_id, r as { status: string; auto: boolean }]));
  const upserts: Record<string, unknown>[] = [];
  const deletes: string[] = [];
  for (const [sid, d] of desired) {
    const ex = progBySquare.get(sid);
    if (ex && ex.auto === false) continue; // manual override wins
    if (!ex || ex.status !== d.status) {
      upserts.push({ user_id: uid, square_id: sid, challenge_id: d.challenge_id, status: d.status, auto: true, updated_at: new Date().toISOString() });
    }
  }
  for (const r of (myProg ?? []) as { square_id: string; auto: boolean }[]) {
    if (r.auto && !desired.has(r.square_id)) deletes.push(r.square_id);
  }
  if (upserts.length) await supabase.from("square_progress").upsert(upserts, { onConflict: "square_id,user_id" });
  if (deletes.length) await supabase.from("square_progress").delete().eq("user_id", uid).in("square_id", deletes);
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const { data } = await supabase.from("profiles").select("*").maybeSingle();
  if (data) return data as Profile;

  // First visit: the database no longer does this on signup, because other apps share its accounts.
  await supabase.rpc("bootstrap_user");
  const { data: created } = await supabase.from("profiles").select("*").maybeSingle();
  return created as Profile | null;
}

interface LoadResult {
  challenges: ChallengeWithSquares[];
  books: Book[];
  bookSquares: {
    id: string;
    user_id: string;
    book_id: string;
    challenge_id: string;
    square_id: string;
    why: string | null;
    status: string;
    pick_title: string | null;
    pick_cover: string | null;
    slot_id: string | null;
  }[];
  slots: SquareSlot[];
  userId: string;
}

export async function loadEverything(): Promise<LoadResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user?.id ?? "";

  const [{ data: challenges }, { data: squares }, { data: books }, { data: bookSquares }, { data: members }, { data: progress }, { data: slotRows }] =
    await Promise.all([
      supabase.from("challenges").select("*").eq("archived", false).order("template_key"),
      supabase.from("squares").select("*").order("position"),
      supabase.from("books").select("*").order("title"),
      supabase.from("book_squares").select("*"),
      supabase.from("challenge_members").select("*"),
      supabase.from("square_progress").select("*"),
      supabase.from("square_slots").select("id, square_id, position, label").order("position"),
    ]);
  const slots = (slotRows ?? []) as SquareSlot[];
  const slotIdsBySquare = new Map<string, string[]>();
  for (const sl of slots) {
    if (!slotIdsBySquare.has(sl.square_id)) slotIdsBySquare.set(sl.square_id, []);
    slotIdsBySquare.get(sl.square_id)!.push(sl.id);
  }

  const bs = (bookSquares ?? []) as LoadResult["bookSquares"];
  const bookList = (books ?? []) as Book[];

  // ---- lookups ----
  const bookById = new Map(bookList.map((b) => [b.id, b]));
  const windowByChallenge = new Map(
    ((challenges ?? []) as Challenge[]).map((c) => [c.id, { start: c.start_date, end: c.end_date }])
  );
  // A read book only counts if it was finished during that challenge; read before it, it's just a pick.
  const statusFor = (bookId: string, challengeId: string): string | undefined => {
    const b = bookById.get(bookId);
    if (!b) return undefined;
    if (b.read_status !== "read") return b.read_status;
    const w = windowByChallenge.get(challengeId);
    return w && readInWindow(b.date_read, w.start, w.end) ? "read" : "to-read";
  };
  const ownPicksBySquare = new Map<string, SquarePick[]>(); // solo: assigned books' status + slot
  const picksBySquare = new Map<string, number>(); // any challenge: # of picks
  for (const r of bs) {
    picksBySquare.set(r.square_id, (picksBySquare.get(r.square_id) ?? 0) + 1);
    const rs = statusFor(r.book_id, r.challenge_id);
    if (rs) {
      if (!ownPicksBySquare.has(r.square_id)) ownPicksBySquare.set(r.square_id, []);
      ownPicksBySquare.get(r.square_id)!.push({ status: rs, slotId: r.slot_id ?? null });
    }
  }

  const membersByChallenge = new Map<string, { userId: string; name: string; role: string }[]>();
  for (const m of (members ?? []) as { challenge_id: string; user_id: string; display_name: string | null; role: string }[]) {
    if (!membersByChallenge.has(m.challenge_id)) membersByChallenge.set(m.challenge_id, []);
    membersByChallenge.get(m.challenge_id)!.push({ userId: m.user_id, name: m.display_name ?? "Reader", role: m.role });
  }
  // owner first, so color assignment is stable (owner = first colour)
  for (const list of membersByChallenge.values()) {
    list.sort((a, b) => Number(b.role === "owner") - Number(a.role === "owner"));
  }

  const progressBySquare = new Map<string, { userId: string; status: "reading" | "done" }[]>();
  for (const p of (progress ?? []) as { square_id: string; user_id: string; status: "reading" | "done" }[]) {
    if (!progressBySquare.has(p.square_id)) progressBySquare.set(p.square_id, []);
    progressBySquare.get(p.square_id)!.push({ userId: p.user_id, status: p.status });
  }

  const squaresByChallenge = new Map<string, SquareProgress[]>();
  for (const s of (squares ?? []) as Square[]) {
    squaresByChallenge.has(s.challenge_id) || squaresByChallenge.set(s.challenge_id, []);
    squaresByChallenge.get(s.challenge_id)!.push(s as SquareProgress);
  }

  const enriched: ChallengeWithSquares[] = ((challenges ?? []) as (Challenge & { shared?: boolean })[]).map((c) => {
    const memberList = membersByChallenge.get(c.id) ?? [];
    const sq = (squaresByChallenge.get(c.id) ?? []).map((base): SquareProgress => {
      const s = base as Square;
      const hasPicks = (picksBySquare.get(s.id) ?? 0) > 0;

      if (c.shared) {
        const progs = progressBySquare.get(s.id) ?? [];
        const mine = progs.find((p) => p.userId === uid);
        const state: SquareProgress["state"] =
          mine?.status === "done" ? "done" : mine?.status === "reading" ? "progress" : hasPicks ? "options" : "empty";
        const memberProgress: MemberProgress[] = memberList.map((m) => ({
          userId: m.userId,
          name: m.name,
          status: progs.find((p) => p.userId === m.userId)?.status ?? null,
        }));
        return { ...s, logged: state === "done" ? s.need : 0, state, memberProgress };
      }

      // solo: derive from the user's own books' read status, one book per slot where the square has slots
      const { logged, state } = squareProgress(s.need, ownPicksBySquare.get(s.id) ?? [], slotIdsBySquare.get(s.id) ?? []);
      return { ...s, logged, state };
    });

    return {
      ...c,
      squares: sq,
      done: sq.filter((s) => s.state === "done").length,
      total: sq.length,
      shared: !!c.shared,
      members: memberList,
    };
  });

  return { challenges: enriched, books: bookList, bookSquares: bs, slots, userId: uid };
}

// Optimizer inputs: each to-read book + the candidate squares it could fill.
export function buildOptimizerInputs(load: LoadResult): OptInput[] {
  const squareById = new Map<string, SquareProgress>();
  const challengeById = new Map<string, ChallengeWithSquares>();
  for (const c of load.challenges) {
    challengeById.set(c.id, c);
    for (const s of c.squares) squareById.set(s.id, s);
  }

  const candidatesByBook = new Map<string, Candidate[]>();
  for (const r of load.bookSquares) {
    const sq = squareById.get(r.square_id);
    const ch = challengeById.get(r.challenge_id);
    if (!sq || !ch) continue;
    const cand: Candidate = {
      challengeId: ch.id,
      challengeTag: ch.tag,
      squareId: sq.id,
      squareKey: sq.key,
      squareName: sq.name,
      need: sq.need,
      logged: sq.logged,
      maxPerBook: ch.max_per_book,
      why: r.why,
    };
    if (!candidatesByBook.has(r.book_id)) candidatesByBook.set(r.book_id, []);
    candidatesByBook.get(r.book_id)!.push(cand);
  }

  return load.books
    .filter((b) => b.read_status === "to-read" || b.read_status === "currently-reading" || b.read_status === "paused")
    .map((b) => ({ book: b, candidates: candidatesByBook.get(b.id) ?? [] }))
    .filter((i) => i.candidates.length > 0);
}
