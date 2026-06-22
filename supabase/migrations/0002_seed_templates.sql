-- ============================================================
-- Chapter Quest — seed the two published challenge templates.
-- Idempotent: safe to re-run (upserts).
-- ============================================================

insert into public.challenge_templates (key, name, tag, start_date, end_date, max_per_book, unit) values
  ('hrcyed',   'HRCYED 3.0',            'HRCYED',    '2026-07-01', '2027-06-30', 2, 'prompts'),
  ('rfantasy', 'r/Fantasy Bingo 2026',  'r/Fantasy', '2026-04-01', '2027-03-31', 1, 'squares')
on conflict (key) do update set
  name = excluded.name, tag = excluded.tag, start_date = excluded.start_date,
  end_date = excluded.end_date, max_per_book = excluded.max_per_book, unit = excluded.unit;

-- ---------- HRCYED 3.0 squares (25 prompts, 150 book-slots) ----------
insert into public.template_squares (template_key, key, name, position, need, rule) values
  ('hrcyed','party',         'Choose Your Party',            0, 5,  'Five DIFFERENT protagonist roles — interpret DnD classes literally or loosely (a bard = musician; a cleric = doctor).'),
  ('hrcyed','periodic',      'Periodic Table',               1, 5,  'Five DIFFERENT element names, each in the title (Iron, Gold, Neon…).'),
  ('hrcyed','familial',      'Familial Terms',               2, 5,  'Five DIFFERENT family words in titles. Other languages count once each.'),
  ('hrcyed','regions',       'Traipsing Through Regions',    3, 5,  'Five books from five different world regions (SWANA, Mediterranean, South Asia…).'),
  ('hrcyed','curriculum',    'Choose Your Curriculum',       4, 5,  'Five books matching five school subjects (theme counts, not just nonfiction).'),
  ('hrcyed','roadtrip',      'Road Trip',                    5, 5,  'Five books set in five US states — not New York or California.'),
  ('hrcyed','bookception',   'Bookception',                  6, 1,  'One book that mentions another real book inside it. (No Harry Potter.)'),
  ('hrcyed','secret',        'Not-So-Secret Prompts',        7, 12, 'All 12 monthly ''secret'' prompts (Pun in the Title, Color in the Title…).'),
  ('hrcyed','covers',        'Cover Styles',                 8, 5,  'Five different cover-art styles (Illustrated, Typographic, Minimalist…). No AI covers.'),
  ('hrcyed','titular',       'Titular Counting',             9, 10, 'Ten books whose titles have 1, 2, 3 … up to 10 words.'),
  ('hrcyed','char2auth',     'Characters to Authors',       10, 6,  'MC''s first name → author with the same first name. Build a chain — three times.'),
  ('hrcyed','shiritori',     'Title Shiritori',             11, 5,  'Five-book chain: each title starts with the last letter/word of the previous.'),
  ('hrcyed','mashup',        'HRCYED Mashup',               12, 2,  'Mash one prompt from HRCYED 1.0 with one from 2.0.'),
  ('hrcyed','numerical',     'Numerical Titles',            13, 11, 'Numbers 1–10 written in titles, plus one more of any number.'),
  ('hrcyed','rainbow',       'A Rainbow of Words',          14, 11, 'A color word in the title for each: Red, Orange, Yellow, Green, Blue, Purple, Pink, White, Black, Silver, Gold.'),
  ('hrcyed','animals',       'Animal Families',             15, 6,  'Six VERY different animals on covers (a whale, a bird, a lizard…).'),
  ('hrcyed','biomes',        'Biomes & Landscapes',         16, 6,  'Six different biomes/landscapes — cover or setting (desert, tundra, reef…).'),
  ('hrcyed','remix',         'Re-Re-Re-Remix',              17, 5,  'Five retellings/remixes — genderbent, villain POV, alternate universe…'),
  ('hrcyed','food',          'Food Pyramid',                18, 5,  'Five different food groups on covers (protein, fruit, grain…). Food for humans.'),
  ('hrcyed','weather',       'Mother Nature',               19, 6,  'Six different weather events on covers (storm, fog, blizzard, sun…).'),
  ('hrcyed','birthday',      'It''s Your Birthday',         20, 7,  'Seven birthday-themed prompts — birthstone, zodiac, birth flower…'),
  ('hrcyed','backlist',      'Backlist Author',             21, 5,  'Five unread books by authors you already love. No rereads.'),
  ('hrcyed','pocket',        'Acquire These Creatures',     22, 5,  'Five books personifying five ''pocket monster'' types — cover, title, or vibe.'),
  ('hrcyed','anthology',     'An Anthology of Authors',     23, 7,  'Read an anthology, then one book each from six of its authors.'),
  ('hrcyed','secondchances', 'Second Chances & Hidden Gems',24, 5,  'Five second-chance reads — soft-DNFs, ugly covers, low ratings, hidden gems.')
on conflict (template_key, key) do update set
  name = excluded.name, position = excluded.position, need = excluded.need, rule = excluded.rule;

-- ---------- r/Fantasy Bingo 2026 squares (25, one book each) ----------
insert into public.template_squares (template_key, key, name, position, need, rule) values
  ('rfantasy','trans',        'Trans or Nonbinary Protagonist', 0, 1, 'Trans/nonbinary lead (not alien or robot). Hard: pre-modern setting.'),
  ('rfantasy','title',        'Judge a Book by Its Title',      1, 1, 'Pick it on the title alone. Hard: don''t read the blurb first.'),
  ('rfantasy','translated',   'Translated',                     2, 1, 'Originally written in another language. Hard: translated in the last 5 years.'),
  ('rfantasy','smallpress',   'Small Press or Self-Published',  3, 1, 'Not from a Big 5 publisher. Hard: under 100 ratings, or a marginalized author.'),
  ('rfantasy','transport',    'Unusual Transportation',         4, 1, 'A surprising way to get around. Hard: not combustion- or steam-powered.'),
  ('rfantasy','afterlife',    'The Afterlife',                  5, 1, 'Realms of the dead or spirits. Hard: no clear good-vs-evil framing.'),
  ('rfantasy','gamechanger',  'Game Changer',                   6, 1, 'A game or competition is central. Hard: the protagonist bends or breaks the rules.'),
  ('rfantasy','vacation',     'Vacation Spot',                  7, 1, 'Set somewhere you''d love to visit. No hard mode.'),
  ('rfantasy','shorts',       'Five Short Stories',             8, 1, 'Read five short stories. Hard: a whole anthology.'),
  ('rfantasy','older',        'Older Protagonist (50+)',        9, 1, 'Lead is at least 50. Hard: no exceptional longevity/immortality.'),
  ('rfantasy','duo1',         'Duology, Part One',             10, 1, 'First book of a duology. Hard: an author new to you.'),
  ('rfantasy','bookclub',     'Book Club or Readalong',        11, 1, 'Featured in an r/Fantasy book club. Hard: join a current one.'),
  ('rfantasy','pub2026',      'Published in 2026',             12, 1, 'First published in 2026. Hard: the author''s debut novel.'),
  ('rfantasy','explorers',    'Explorers & Rangers',           13, 1, 'An explorer or wilderness warrior. Hard: has an animal companion.'),
  ('rfantasy','duo2',         'Duology, Part Two',             14, 1, 'Second book of a duology. Hard: a different duology than Part One.'),
  ('rfantasy','oneword',      'One-Word Title',                15, 1, 'A single-word title. Hard: not a proper noun.'),
  ('rfantasy','nonhuman',     'Non-Human Protagonist',         16, 1, 'Lead isn''t human. Hard: no human POVs at all.'),
  ('rfantasy','middlegrade',  'Middle Grade',                  17, 1, 'Aimed at readers 8–12. Hard: a new-to-you author.'),
  ('rfantasy','firstcontact', 'First Contact',                 18, 1, 'An interspecies meeting is central. Hard: non-violent.'),
  ('rfantasy','murder',       'Murder Mystery',                19, 1, 'The plot turns on solving a murder. Hard: the MC isn''t a detective/PI.'),
  ('rfantasy','catsquasher',  'Cat Squasher (500+ pp)',        20, 1, 'Over 500 pages. Hard: over 900.'),
  ('rfantasy','feast',        'Feast Your Eyes on This',       21, 1, 'Food/a meal matters to the plot. Hard: cook a dish from the story.'),
  ('rfantasy','pub70s',       'Published in the 1970s',        22, 1, 'From the 1970s. Hard: written by a woman.'),
  ('rfantasy','politics',     'Politics & Court Intrigue',     23, 1, 'Politics is central. Hard: city-level or lower.'),
  ('rfantasy','aoc',          'Author of Color',               24, 1, 'Written by a person of color. Hard: author lives outside US/UK/CAN/AUS/NZ.')
on conflict (template_key, key) do update set
  name = excluded.name, position = excluded.position, need = excluded.need, rule = excluded.rule;
