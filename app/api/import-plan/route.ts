import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findBook, slotPositions, type PlanRow } from "@/lib/plan";

export const maxDuration = 60;

// Load a reading plan onto one of your challenges: each row puts a book in a square's slot.
// Books you don't have yet are added as want-to-read. Re-running replaces what each slot held.
//
// Body: { template: "hrcyed", rows: PlanRow[], clearSuggestions?: boolean }
// clearSuggestions removes the title matcher's guesses on that challenge (picks it made that
// were never filed under a slot), which the plan replaces.
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { template, rows, clearSuggestions } = (await request.json().catch(() => ({}))) as {
    template?: string; rows?: PlanRow[]; clearSuggestions?: boolean;
  };
  if (!template || !Array.isArray(rows)) return NextResponse.json({ error: "template and rows required" }, { status: 400 });

  const { data: challenge } = await supabase
    .from("challenges").select("id").eq("user_id", user.id).eq("template_key", template).eq("archived", false)
    .order("created_at").limit(1).maybeSingle();
  if (!challenge) return NextResponse.json({ error: `start the ${template} challenge first` }, { status: 404 });

  const [{ data: squares }, { data: slots }, { data: books }] = await Promise.all([
    supabase.from("squares").select("id, key, need").eq("challenge_id", challenge.id),
    supabase.from("square_slots").select("id, square_id, position, label").eq("challenge_id", challenge.id),
    supabase.from("books").select("id, title, author, availability"),
  ]);
  const squareByKey = new Map((squares ?? []).map((s) => [s.key as string, s as { id: string; key: string; need: number }]));
  const slotAt = new Map((slots ?? []).map((s) => [`${s.square_id}/${s.position}`, s as { id: string; label: string }]));
  const library = (books ?? []) as { id: string; title: string; author: string | null; availability: string | null }[];

  let removedSuggestions = 0;
  if (clearSuggestions) {
    const { count } = await supabase.from("book_squares")
      .delete({ count: "exact" })
      .eq("challenge_id", challenge.id).eq("user_id", user.id).eq("status", "planned").is("slot_id", null).not("why", "is", null);
    removedSuggestions = count ?? 0;
  }

  const positions = slotPositions(rows);
  const missing: string[] = [];
  let placed = 0, added = 0, labelled = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const square = squareByKey.get(row.square);
    if (!square) { missing.push(`square ${row.square}`); continue; }
    const slot = slotAt.get(`${square.id}/${positions[i]}`) ?? null;

    if (slot && row.slot && row.slot !== slot.label) {
      await supabase.from("square_slots").update({ label: row.slot }).eq("id", slot.id);
      labelled++;
    }
    if (!row.title) continue;

    let book = findBook(library, row.title, row.author);
    if (!book) {
      const { data: created, error } = await supabase.from("books").insert({
        user_id: user.id, title: row.title, author: row.author ?? null, read_status: "to-read",
        source: "plan", availability: row.where ?? null, enriched: true,
      }).select("id, title, author, availability").single();
      if (error || !created) { missing.push(row.title); continue; }
      book = created as (typeof library)[number];
      library.push(book);
      added++;
    } else if (row.where && row.where !== book.availability) {
      await supabase.from("books").update({ availability: row.where }).eq("id", book.id);
      book.availability = row.where;
    }

    // The slot holds this book now; anything else filed there goes back to being an option.
    if (slot) await supabase.from("book_squares").update({ slot_id: null }).eq("slot_id", slot.id).neq("book_id", book.id);
    const { error } = await supabase.from("book_squares").upsert({
      user_id: user.id, book_id: book.id, square_id: square.id, challenge_id: challenge.id,
      slot_id: slot?.id ?? null, why: row.note ?? null, status: "planned",
    }, { onConflict: "book_id,square_id" });
    if (error) missing.push(row.title); else placed++;
  }

  return NextResponse.json({ ok: true, placed, added, labelled, removedSuggestions, missing });
}
