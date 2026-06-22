-- ============================================================
-- Chapter Quest — initial schema
-- Multi-user, row-level-security on everything user-owned.
-- ============================================================

-- ---------- TEMPLATES (global, read-only to users) ----------
-- A challenge template = a published card (HRCYED, r/Fantasy, etc.)
create table if not exists public.challenge_templates (
  key          text primary key,
  name         text not null,
  tag          text not null,
  start_date   date not null,
  end_date     date not null,
  max_per_book int  not null default 1,   -- how many squares one book may fill WITHIN this card
  unit         text not null default 'squares',
  created_at   timestamptz not null default now()
);

create table if not exists public.template_squares (
  id           uuid primary key default gen_random_uuid(),
  template_key text not null references public.challenge_templates(key) on delete cascade,
  key          text not null,             -- stable square key, unique within a template
  name         text not null,
  position     int  not null,             -- 0..24 board order
  need         int  not null default 1,   -- books required to complete the square
  rule         text not null default '',
  unique (template_key, key)
);

-- ---------- PER-USER DATA ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  theme        text not null default 'sage',
  streak       int  not null default 0,
  created_at   timestamptz not null default now()
);

-- A user's instance of a challenge (copied from a template, or hand-made)
create table if not exists public.challenges (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  template_key text references public.challenge_templates(key),
  name         text not null,
  tag          text not null,
  start_date   date not null,
  end_date     date not null,
  max_per_book int  not null default 1,
  unit         text not null default 'squares',
  archived     boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists challenges_user_idx on public.challenges(user_id);

create table if not exists public.squares (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  key          text not null,
  name         text not null,
  position     int  not null,
  need         int  not null default 1,
  rule         text not null default '',
  unique (challenge_id, key)
);
create index if not exists squares_challenge_idx on public.squares(challenge_id);

-- The user's library: every book they've read or want to read
create table if not exists public.books (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null,
  author        text,
  isbn          text,
  format        text,
  pages         int,
  star_rating   numeric,
  read_status   text not null default 'to-read',  -- to-read | currently-reading | read | did-not-finish
  date_read     date,
  publish_year  int,
  cover_g1      text not null default '#6F8765',   -- gradient cover colors (no external images)
  cover_g2      text not null default '#3f5238',
  source        text not null default 'manual',    -- manual | storygraph
  storygraph_id text,
  tags          text,
  created_at    timestamptz not null default now()
);
create index if not exists books_user_idx on public.books(user_id);
create index if not exists books_user_status_idx on public.books(user_id, read_status);

-- The heart of the app: a book credited to a square. One book can have
-- many rows (across squares AND across challenges) — that's the double-dip.
create table if not exists public.book_squares (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  book_id      uuid not null references public.books(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  square_id    uuid not null references public.squares(id) on delete cascade,
  why          text,
  status       text not null default 'logged',  -- planned | logged
  created_at   timestamptz not null default now(),
  unique (book_id, square_id)
);
create index if not exists book_squares_user_idx on public.book_squares(user_id);
create index if not exists book_squares_square_idx on public.book_squares(square_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.challenge_templates enable row level security;
alter table public.template_squares    enable row level security;
alter table public.profiles    enable row level security;
alter table public.challenges  enable row level security;
alter table public.squares     enable row level security;
alter table public.books       enable row level security;
alter table public.book_squares enable row level security;

-- Templates: any authenticated user may read; nobody writes via the API.
create policy "templates readable" on public.challenge_templates
  for select to authenticated using (true);
create policy "template squares readable" on public.template_squares
  for select to authenticated using (true);

-- Helper: a single owner policy per user table (select/insert/update/delete).
create policy "own profile"  on public.profiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "own challenges" on public.challenges
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own squares" on public.squares
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own books" on public.books
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own book_squares" on public.book_squares
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
-- NEW USER BOOTSTRAP
-- Creates a profile and copies every template card into the new
-- user's account (challenges + squares) so they land on full boards.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));

  insert into public.challenges (user_id, template_key, name, tag, start_date, end_date, max_per_book, unit)
  select new.id, t.key, t.name, t.tag, t.start_date, t.end_date, t.max_per_book, t.unit
  from public.challenge_templates t;

  insert into public.squares (user_id, challenge_id, key, name, position, need, rule)
  select new.id, c.id, ts.key, ts.name, ts.position, ts.need, ts.rule
  from public.challenges c
  join public.template_squares ts on ts.template_key = c.template_key
  where c.user_id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
