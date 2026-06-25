-- ============================================================
-- Book cover thumbnails. Stores a cover image URL (from Open Library /
-- Google Books, captured during enrichment). Resetting `enriched` re-runs
-- the backfill so existing libraries pick up covers too.
-- ============================================================
alter table public.books add column if not exists cover_url text;

update public.books set enriched = false;
