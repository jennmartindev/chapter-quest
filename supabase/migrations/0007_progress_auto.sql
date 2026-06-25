-- Mark whether a square_progress row was auto-derived from the member's own
-- library (read status) vs. set manually. Sync only touches auto rows, so a
-- manual override is never overwritten.
alter table public.square_progress add column if not exists auto boolean not null default false;
