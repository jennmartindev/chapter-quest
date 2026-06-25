import { createClient } from "@/lib/supabase/server";
import type {
  Book,
  Challenge,
  ChallengeWithSquares,
  MemberProgress,
  Profile,
  Square,
  SquareProgress,
} from "./types";
import type { OptInput, Candidate } from "./optimizer";

const norm = (t: string | null) => (t ?? "").toLowerCase().trim();

// For shared boards, reflect the current user's OWN library read-status onto
// their per-person progress (so they don't have to mark it twice, and co-members
// can see it). Only touches auto rows — manual overrides are left alone.
export async function syncSharedProgress(): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const uid = user?.id;
  if (!uid) return;

  const { data: chs } = await supabase.from("challenges").select("id").eq("shared", true);
  const sharedIds = (chs ?? []).map((c) => c.id);
  if (sharedIds.length === 0) return;

  const [{ data: picks }, { data: myBooks }, { data: myProg }] = await Promise.all([
    supabase.from("book_squares").select("square_id, challenge_id, pick_title").in("challenge_id", sharedIds),
    supabase.from("books").select("title, read_status"),
    supabase.from("square_progress").select("square_id, status, auto").eq("user_id", uid).in("challenge_id", sharedIds),
  ]);

  const myStatusByTitle = new Map<string, "reading" | "done">();
  for (const b of (myBooks ?? []) as { title: string; read_status: string }[]) {
    const s = b.read_status === "read" ? "done" : b.read_status === "currently-reading" ? "reading" : null;
    if (!s) continue;
    const k = norm(b.title);
    if (s === "done" || !myStatusByTitle.has(k)) myStatusByTitle.set(k, s);
  }

  const desired = new Map<string, { status: "reading" | "done"; challenge_id: string }>();
  for (const p of (picks ?? []) as { square_id: string; challenge_id: string; pick_title: string | null }[]) {
    const s = myStatusByTitle.get(norm(p.pick_title));
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
  const { data } = await supabase.from("profiles").select("*").single();
  return data as Profile | null;
}

interface LoadResult {
  challenges: ChallengeWithSquares[];
  books: Book[];
  bookSquares: {
    id: string;
    book_id: string;
    challenge_id: string;
    square_id: string;
    why: string | null;
    status: string;
    pick_title: string | null;
    pick_cover: string | null;
  }[];
  userId: string;
}

export async function loadEverything(): Promise<LoadResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user?.id ?? "";

  const [{ data: challenges }, { data: squares }, { data: books }, { data: bookSquares }, { data: members }, { data: progress }] =
    await Promise.all([
      supabase.from("challenges").select("*").eq("archived", false).order("template_key"),
      supabase.from("squares").select("*").order("position"),
      supabase.from("books").select("*").order("title"),
      supabase.from("book_squares").select("*"),
      supabase.from("challenge_members").select("*"),
      supabase.from("square_progress").select("*"),
    ]);

  const bs = (bookSquares ?? []) as LoadResult["bookSquares"];
  const bookList = (books ?? []) as Book[];

  // ---- lookups ----
  const statusByBook = new Map(bookList.map((b) => [b.id, b.read_status]));
  const ownStatusesBySquare = new Map<string, string[]>(); // solo: assigned books' read status
  const picksBySquare = new Map<string, number>(); // any challenge: # of picks
  for (const r of bs) {
    picksBySquare.set(r.square_id, (picksBySquare.get(r.square_id) ?? 0) + 1);
    const rs = statusByBook.get(r.book_id);
    if (rs) {
      if (!ownStatusesBySquare.has(r.square_id)) ownStatusesBySquare.set(r.square_id, []);
      ownStatusesBySquare.get(r.square_id)!.push(rs);
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

      // solo: derive from the user's own books' read status
      const statuses = ownStatusesBySquare.get(s.id) ?? [];
      const readCount = statuses.filter((x) => x === "read").length;
      const readingCount = statuses.filter((x) => x === "currently-reading").length;
      const done = readCount >= s.need;
      const state: SquareProgress["state"] = done
        ? "done"
        : readingCount > 0 || readCount > 0
        ? "progress"
        : statuses.length > 0
        ? "options"
        : "empty";
      return { ...s, logged: readCount, state };
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

  return { challenges: enriched, books: bookList, bookSquares: bs, userId: uid };
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
    .filter((b) => b.read_status === "to-read" || b.read_status === "currently-reading")
    .map((b) => ({ book: b, candidates: candidatesByBook.get(b.id) ?? [] }))
    .filter((i) => i.candidates.length > 0);
}
