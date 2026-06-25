-- ============================================================
-- Co-reading: share a board with others. The owner picks the books
-- (shared as a title/cover snapshot); each member tracks their OWN
-- progress; everyone sees everyone's.
-- ============================================================

alter table public.challenges add column if not exists shared boolean not null default false;
alter table public.challenges add column if not exists invite_code text unique;

-- Denormalized pick snapshot so members can see a pick without read access
-- to the picker's private library.
alter table public.book_squares add column if not exists pick_title text;
alter table public.book_squares add column if not exists pick_cover text;

-- Members of a (shared) challenge.
create table if not exists public.challenge_members (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  display_name text,
  role         text not null default 'member',
  joined_at    timestamptz not null default now(),
  primary key (challenge_id, user_id)
);
create index if not exists challenge_members_user_idx on public.challenge_members(user_id);

-- Per-member progress on a square ('reading' | 'done'; no row = not started).
create table if not exists public.square_progress (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  square_id    uuid not null references public.squares(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  status       text not null default 'done',
  updated_at   timestamptz not null default now(),
  unique (square_id, user_id)
);
create index if not exists square_progress_square_idx on public.square_progress(square_id);

-- ---- denormalize pick title/cover on insert, and backfill existing ----
create or replace function public.fill_pick_meta()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.pick_title is null then
    select title, cover_url into new.pick_title, new.pick_cover from public.books where id = new.book_id;
  end if;
  return new;
end;
$$;
drop trigger if exists book_squares_pick_meta on public.book_squares;
create trigger book_squares_pick_meta before insert on public.book_squares
  for each row execute function public.fill_pick_meta();

update public.book_squares bs
  set pick_title = b.title, pick_cover = b.cover_url
  from public.books b where b.id = bs.book_id and bs.pick_title is null;

-- ---- membership check (security definer avoids RLS recursion) ----
create or replace function public.is_member(cid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.challenge_members m where m.challenge_id = cid and m.user_id = auth.uid());
$$;

-- ---- RLS ----
alter table public.challenge_members enable row level security;
alter table public.square_progress  enable row level security;

-- Members can read shared challenge data (in addition to their own rows).
create policy "member reads challenge"     on public.challenges
  for select to authenticated using (user_id = auth.uid() or public.is_member(id));
create policy "member reads squares"        on public.squares
  for select to authenticated using (user_id = auth.uid() or public.is_member(challenge_id));
create policy "member reads book_squares"   on public.book_squares
  for select to authenticated using (user_id = auth.uid() or public.is_member(challenge_id));
create policy "member adds book_squares"    on public.book_squares
  for insert to authenticated with check (user_id = auth.uid() and (true));

create policy "read members"   on public.challenge_members
  for select to authenticated using (public.is_member(challenge_id));
create policy "join self"      on public.challenge_members
  for insert to authenticated with check (user_id = auth.uid());
create policy "leave self"     on public.challenge_members
  for delete to authenticated using (user_id = auth.uid());

create policy "read progress"  on public.square_progress
  for select to authenticated using (public.is_member(challenge_id) or user_id = auth.uid());
create policy "write own progress" on public.square_progress
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---- join by invite code (security definer to look up by code) ----
create or replace function public.join_challenge(invite text)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  select id into cid from public.challenges where invite_code = invite;
  if cid is null then raise exception 'invalid invite code'; end if;
  update public.challenges set shared = true where id = cid;
  insert into public.challenge_members (challenge_id, user_id, display_name)
    values (cid, auth.uid(), (select display_name from public.profiles where id = auth.uid()))
    on conflict do nothing;
  return cid;
end;
$$;
