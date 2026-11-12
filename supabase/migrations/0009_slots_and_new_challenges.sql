-- ============================================================
-- Slots inside squares, where-to-get-it on books, starting a
-- challenge from a template, HRCYED count fixes, and two new
-- cards (Buzzword 2026, Mystery/Thriller Bingo 2026).
--
-- Runs in the `reading` schema of the shared Supabase project.
-- Additive only: nothing is dropped and no existing row loses data.
-- ============================================================

-- ---------- Slot labels a template suggests (Red, Orange, … / 1 word, 2 words, …) ----------
create table if not exists reading.template_slots (
  template_key text not null references reading.challenge_templates(key) on delete cascade,
  square_key   text not null,
  position     int  not null,          -- 1..need
  label        text not null,
  primary key (template_key, square_key, position)
);
alter table reading.template_slots enable row level security;
drop policy if exists "template slots readable" on reading.template_slots;
create policy "template slots readable" on reading.template_slots for select to authenticated using (true);
grant select on reading.template_slots to authenticated;
grant all on reading.template_slots to service_role;

-- ---------- A user's slots: one row per book a square needs ----------
create table if not exists reading.square_slots (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null references reading.challenges(id) on delete cascade,
  square_id    uuid not null references reading.squares(id) on delete cascade,
  position     int  not null,
  label        text not null default '',
  unique (square_id, position)
);
create index if not exists square_slots_challenge_idx on reading.square_slots(challenge_id);
alter table reading.square_slots enable row level security;
drop policy if exists "own slots" on reading.square_slots;
create policy "own slots" on reading.square_slots for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "member reads slots" on reading.square_slots;
create policy "member reads slots" on reading.square_slots for select to authenticated
  using (reading.is_member(challenge_id));
grant select, insert, update, delete on reading.square_slots to authenticated;
grant all on reading.square_slots to service_role;

-- A pick can name the slot it fills. Losing a slot just un-files the pick.
alter table reading.book_squares add column if not exists slot_id uuid references reading.square_slots(id) on delete set null;
create index if not exists book_squares_slot_idx on reading.book_squares(slot_id);

-- Where to get a book: "Libby: ebook now", "hoopla audio", "CCPL print", "KU", "Owned"…
alter table reading.books add column if not exists availability text;

-- ---------- Slots for a challenge's multi-book squares ----------
create or replace function reading.create_slots(cid uuid)
returns void language sql security definer set search_path to '' as $$
  insert into reading.square_slots (user_id, challenge_id, square_id, position, label)
  select s.user_id, s.challenge_id, s.id, g.pos, coalesce(ts.label, '')
  from reading.squares s
  join reading.challenges c on c.id = s.challenge_id
  cross join lateral generate_series(1, s.need) as g(pos)
  left join reading.template_slots ts
    on ts.template_key = c.template_key and ts.square_key = s.key and ts.position = g.pos
  where s.challenge_id = cid and s.need > 1
  on conflict (square_id, position) do nothing;
$$;
revoke all on function reading.create_slots(uuid) from public, anon, authenticated;

-- ---------- Start a challenge from a template (or return the one you already have) ----------
create or replace function reading.start_challenge(p_template text)
returns uuid language plpgsql security definer set search_path to '' as $$
declare uid uuid := auth.uid(); cid uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select c.id into cid from reading.challenges c
    where c.user_id = uid and c.template_key = p_template order by c.archived, c.created_at limit 1;
  if cid is not null then
    update reading.challenges set archived = false where id = cid;
    return cid;
  end if;

  insert into reading.challenges (user_id, template_key, name, tag, start_date, end_date, max_per_book, unit)
    select uid, t.key, t.name, t.tag, t.start_date, t.end_date, t.max_per_book, t.unit
    from reading.challenge_templates t where t.key = p_template
    returning id into cid;
  if cid is null then raise exception 'unknown_template'; end if;

  insert into reading.squares (user_id, challenge_id, key, name, position, need, rule)
    select uid, cid, ts.key, ts.name, ts.position, ts.need, ts.rule
    from reading.template_squares ts where ts.template_key = p_template;
  perform reading.create_slots(cid);
  return cid;
end;
$$;
revoke all on function reading.start_challenge(text) from public, anon;
grant execute on function reading.start_challenge(text) to authenticated, service_role;

-- New readers get slots too. Same as before, plus the last loop.
create or replace function reading.bootstrap_user()
returns void language plpgsql security definer set search_path to '' as $$
declare uid uuid := auth.uid(); c record;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from reading.profiles where id = uid) then return; end if;

  insert into reading.profiles (id, display_name)
    select u.id, coalesce(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1))
    from auth.users u where u.id = uid;

  insert into reading.challenges (user_id, template_key, name, tag, start_date, end_date, max_per_book, unit)
    select uid, t.key, t.name, t.tag, t.start_date, t.end_date, t.max_per_book, t.unit
    from reading.challenge_templates t;

  insert into reading.squares (user_id, challenge_id, key, name, position, need, rule)
    select uid, c2.id, ts.key, ts.name, ts.position, ts.need, ts.rule
    from reading.challenges c2
    join reading.template_squares ts on ts.template_key = c2.template_key
    where c2.user_id = uid;

  for c in select id from reading.challenges where user_id = uid loop
    perform reading.create_slots(c.id);
  end loop;
end;
$$;

-- ============================================================
-- HRCYED 3.0: book counts and wording from the official site + FAQ
-- (150 slots in all). Applied to the template and to readers' copies.
-- ============================================================
update reading.template_squares set need = 2, name = 'Book-ception',
  rule = 'Find a book that mentions another book that exists in the real world, and read them both. (No Harry Potter.)'
  where template_key = 'hrcyed' and key = 'bookception';
update reading.template_squares set need = 4,
  rule = 'Read 4 different books in cover styles you don''t normally choose. Covers using AI are not permitted.'
  where template_key = 'hrcyed' and key = 'covers';
update reading.template_squares set need = 3,
  rule = 'Take a main character''s first name and read a book by an author with the same first name. Chain them, or pick three separate names. Three books.'
  where template_key = 'hrcyed' and key = 'char2auth';
update reading.template_squares set need = 5, name = 'HRCYED Mash-Up',
  rule = 'Take one prompt from HRCYED 1.0 and one from 2.0 and mash them together. Five-book minimum. They can''t be basically the same prompt.'
  where template_key = 'hrcyed' and key = 'mashup';
update reading.squares s set need = ts.need, name = ts.name, rule = ts.rule
  from reading.challenges c, reading.template_squares ts
  where c.id = s.challenge_id and c.template_key = 'hrcyed'
    and ts.template_key = 'hrcyed' and ts.key = s.key
    and s.key in ('bookception', 'covers', 'char2auth', 'mashup');

insert into reading.template_slots (template_key, square_key, position, label)
select 'hrcyed', v.sq, v.pos, v.label from (values
  ('rainbow',1,'Red'),('rainbow',2,'Orange'),('rainbow',3,'Yellow'),('rainbow',4,'Green'),('rainbow',5,'Blue'),
  ('rainbow',6,'Purple'),('rainbow',7,'Pink'),('rainbow',8,'White'),('rainbow',9,'Black'),('rainbow',10,'Silver'),('rainbow',11,'Gold'),
  ('titular',1,'1 word'),('titular',2,'2 words'),('titular',3,'3 words'),('titular',4,'4 words'),('titular',5,'5 words'),
  ('titular',6,'6 words'),('titular',7,'7 words'),('titular',8,'8 words'),('titular',9,'9 words'),('titular',10,'10 words'),
  ('numerical',1,'One'),('numerical',2,'Two'),('numerical',3,'Three'),('numerical',4,'Four'),('numerical',5,'Five'),
  ('numerical',6,'Six'),('numerical',7,'Seven'),('numerical',8,'Eight'),('numerical',9,'Nine'),('numerical',10,'Ten'),('numerical',11,'Any other number'),
  ('birthday',1,'Birthstone'),('birthday',2,'Published in your birth month'),('birthday',3,'Zodiac sign'),('birthday',4,'Chinese zodiac sign'),
  ('birthday',5,'Birth flower'),('birthday',6,'Birth tree'),('birthday',7,'Meaning of your name'),
  ('secret',1,'Read a whole book outside'),('secret',2,'Craft on cover / audiobook while crafting'),('secret',3,'Pun in the title'),
  ('secret',4,'First & last name in the title'),('secret',5,'Missed childhood chapter book'),('secret',6,'I''ll Get Around to It tag'),
  ('secret',7,'Joseph''s Coat: color in title'),('secret',8,'Title same as another book'),('secret',9,'Doomscroll your read'),
  ('secret',10,'Cover features motion'),('secret',11,'Most recent acquisition'),('secret',12,'Last name is a first name'),
  ('bookception',1,'The book that mentions'),('bookception',2,'The book it mentions'),
  ('anthology',1,'The anthology'),('anthology',2,'Author 1'),('anthology',3,'Author 2'),('anthology',4,'Author 3'),
  ('anthology',5,'Author 4'),('anthology',6,'Author 5'),('anthology',7,'Author 6'),
  ('char2auth',1,'Link 1'),('char2auth',2,'Link 2'),('char2auth',3,'Link 3')
) as v(sq, pos, label)
on conflict (template_key, square_key, position) do update set label = excluded.label;

-- ============================================================
-- Buzzword 2026 (booksandlala): one title prompt a month. Catching up later counts.
-- ============================================================
insert into reading.challenge_templates (key, name, tag, start_date, end_date, max_per_book, unit) values
  ('buzzword26', 'Buzzword 2026', 'Buzzword', '2026-01-01', '2026-12-31', 1, 'months')
on conflict (key) do update set name = excluded.name, tag = excluded.tag, start_date = excluded.start_date,
  end_date = excluded.end_date, max_per_book = excluded.max_per_book, unit = excluded.unit;

insert into reading.template_squares (template_key, key, name, position, need, rule) values
  ('buzzword26','jan','January: "before" / "after"', 0, 1, 'A title with "before" or "after" in it.'),
  ('buzzword26','feb','February: keyboard keys',      1, 1, 'A title with a keyboard key in it (Shift, Escape, Home, Enter…).'),
  ('buzzword26','mar','March: "this" / "that"',       2, 1, 'A title with "this" or "that" (or "these" / "those").'),
  ('buzzword26','apr','April: ordinal numbers',       3, 1, 'A title with an ordinal number (first, second, fifth…).'),
  ('buzzword26','may','May: "make"',                  4, 1, 'A title with "make" (make, making, maker…).'),
  ('buzzword26','jun','June: one-word title',         5, 1, 'A one-word title.'),
  ('buzzword26','jul','July: occupations',            6, 1, 'A title with an occupation in it.'),
  ('buzzword26','aug','August: groups & clubs',       7, 1, 'A title with a group or club in it.'),
  ('buzzword26','sep','September: "me" / "my"',       8, 1, 'A title with "me" or "my".'),
  ('buzzword26','oct','October: parts of a house',    9, 1, 'A title with a part of a house (door, attic, hearth…).'),
  ('buzzword26','nov','November: instructional title',10, 1, 'A title that gives instructions ("How to…").'),
  ('buzzword26','dec','December: superlatives',       11, 1, 'A title with a superlative (last, best, greatest…).')
on conflict (template_key, key) do update set name = excluded.name, position = excluded.position, need = excluded.need, rule = excluded.rule;

-- ============================================================
-- Mystery/Thriller Bingo 2026 (alexisfullybooked). The center square is free.
-- ============================================================
insert into reading.challenge_templates (key, name, tag, start_date, end_date, max_per_book, unit) values
  ('mystery26', 'Mystery/Thriller Bingo 2026', 'Mystery', '2026-01-01', '2026-12-31', 1, 'squares')
on conflict (key) do update set name = excluded.name, tag = excluded.tag, start_date = excluded.start_date,
  end_date = excluded.end_date, max_per_book = excluded.max_per_book, unit = excluded.unit;

insert into reading.template_squares (template_key, key, name, position, need, rule) values
  ('mystery26','bipoc',     'BIPOC author',                 0, 1, 'Written by a BIPOC author.'),
  ('mystery26','house',     'House on the cover',           1, 1, 'A house on the cover.'),
  ('mystery26','identity',  'Hidden identity or past',      2, 1, 'A character hiding who they are or where they came from.'),
  ('mystery26','revenge',   'Revenge',                      3, 1, 'Revenge drives the plot.'),
  ('mystery26','povs',      '2+ POVs',                      4, 1, 'Two or more points of view.'),
  ('mystery26','smalltown', 'Small town',                   5, 1, 'Set in a small town.'),
  ('mystery26','pub2026',   '2026 release',                 6, 1, 'Published in 2026.'),
  ('mystery26','dual',      'Dual timelines',               7, 1, 'Told across two timelines.'),
  ('mystery26','eatrich',   'Eat the rich',                 8, 1, 'The wealthy get what''s coming.'),
  ('mystery26','bigevent',  'Big event',                    9, 1, 'Set around a big event (a wedding, a festival, a reunion…).'),
  ('mystery26','newauthor', 'New to you author',           10, 1, 'An author you haven''t read before.'),
  ('mystery26','missing',   'Missing person',              11, 1, 'Someone has gone missing.'),
  ('mystery26','free',      'You predicted the ending (FREE)', 12, 0, 'Free space.'),
  ('mystery26','detective', 'Detective character',         13, 1, 'A detective is a main character.'),
  ('mystery26','friendrec', 'Friend rec',                  14, 1, 'Recommended by a friend.'),
  ('mystery26','isolated',  'Isolated setting',            15, 1, 'An isolated setting (an island, a train, a snowed-in lodge…).'),
  ('mystery26','girlwoman', '"Girl" or "Woman" in the title', 16, 1, '"Girl" or "Woman" in the title.'),
  ('mystery26','coldcase',  'Cold case',                   17, 1, 'An old, unsolved case is reopened.'),
  ('mystery26','lgbtq',     'LGBTQ+',                      18, 1, 'LGBTQ+ main character or author.'),
  ('mystery26','killerback','The killer is back',          19, 1, 'A past killer returns, or seems to.'),
  ('mystery26','amateur',   'Amateur sleuth MC',           20, 1, 'The main character is an amateur sleuth.'),
  ('mystery26','serialpov', 'Serial killer POV',           21, 1, 'Part of the story is told by a serial killer.'),
  ('mystery26','podcast',   'Podcast',                     22, 1, 'A podcast is part of the story.'),
  ('mystery26','husband',   '"The husband did it"',        23, 1, 'The husband did it.'),
  ('mystery26','unreliable','Unreliable narrator',         24, 1, 'The narrator can''t be trusted.')
on conflict (template_key, key) do update set name = excluded.name, position = excluded.position, need = excluded.need, rule = excluded.rule;

-- Slots for every existing challenge's multi-book squares (HRCYED today).
do $$ declare c record; begin
  for c in select id from reading.challenges loop perform reading.create_slots(c.id); end loop;
end $$;
