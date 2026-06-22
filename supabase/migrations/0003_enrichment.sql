-- ============================================================
-- Add an enrichment flag so we can backfill page counts / publish
-- years from Open Library in the background and know what's left.
--   enriched = false  → still needs (or is eligible for) a lookup
--   enriched = true   → looked up, or skipped (no usable ISBN)
-- ============================================================
alter table public.books
  add column if not exists enriched boolean not null default false;

create index if not exists books_user_enriched_idx on public.books(user_id, enriched);
