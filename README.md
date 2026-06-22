# Chapter Quest

A cozy companion for juggling **multiple reading challenges at once** (HRCYED 3.0, r/Fantasy Bingo, and more). Import your StoryGraph data, and the cross-challenge optimizer tells you *what to read next to finish the most squares* — because one book can count toward several challenges at the same time.

**Stack:** Next.js 14 (App Router, TypeScript) · Supabase (Postgres + Auth, row-level security) · deployed on Heroku.

---

## 1. Create the Supabase project

1. Make a project at [supabase.com](https://supabase.com).
2. In the dashboard, open **SQL Editor → New query** and run, in order:
   - `supabase/migrations/0001_init.sql` (tables, RLS, new-user trigger)
   - `supabase/migrations/0002_seed_templates.sql` (the two challenge cards)
   - `supabase/migrations/0003_enrichment.sql` (page-count / publish-year backfill flag)
3. **Auth:** Authentication → Providers → **Email** is on by default.
   - For fast local testing, turn **off** "Confirm email" (Authentication → Sign In / Providers → Email). Then sign-up logs you straight in.
   - Leaving it on is fine too — you'll get a confirmation email that returns to `/auth/callback`.
4. **Redirect URLs:** Authentication → URL Configuration → add your site URLs to *Redirect URLs*:
   - `http://localhost:3000/**`
   - `https://YOUR-HEROKU-APP.herokuapp.com/**` (after deploy)

> Every new user automatically gets their own copy of both challenge boards (via the `handle_new_user` trigger).

## 2. Run locally

```bash
cp .env.example .env.local        # then fill in the two NEXT_PUBLIC_ values
npm install
npm run dev                       # http://localhost:3000
```

Find `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Supabase → **Project Settings → API**.

Create an account on the login screen, then **Import** your StoryGraph CSV (Profile → Import, or the drawer).

### Get your StoryGraph export
StoryGraph → **Manage Account → Export StoryGraph Data** → you'll receive a `.csv`. Upload it on the Import screen.

## 3. Deploy to Heroku

```bash
heroku create your-app-name
heroku config:set NEXT_PUBLIC_SUPABASE_URL=https://YOUR-ref.supabase.co
heroku config:set NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
heroku config:set NEXT_PUBLIC_SITE_URL=https://your-app-name.herokuapp.com
git push heroku main
```

Heroku uses the Node buildpack: it runs `npm run build`, then `npm start` (see `Procfile`). `next start` reads Heroku's `$PORT` automatically. Finish by adding the Heroku URL to Supabase's Redirect URLs (step 1.4).

**Auto-deploy from GitHub (optional):** push this repo to GitHub, then in the Heroku dashboard → Deploy → connect the repo and enable automatic deploys from `main`.

---

## How it works

| Piece | Where |
|---|---|
| Schema + RLS + seed | `supabase/migrations/` |
| Auth (clients, middleware, login) | `lib/supabase/`, `middleware.ts`, `components/LoginForm.tsx` |
| Data loading | `lib/data.ts` |
| Cross-challenge optimizer | `lib/optimizer.ts` |
| StoryGraph parsing + auto-match | `lib/storygraph.ts`, `app/api/import/` |
| Screens | `app/(main)/` |
| Design system (7 themes) | `app/globals.css` |

**The core idea:** a book lives once in your `books` library. `book_squares` rows credit that book to squares — and one book can have many rows across many challenges. Each challenge's `max_per_book` (HRCYED = 2, r/Fantasy = 1) caps reuse *within* a card, but never across cards. The optimizer ranks your to-read books by how many *open* squares they'd clear across everything.

### Auto-matching
Two passes:
1. **At import (instant):** title-based guesses — color words, number words, element names, one-word titles, word counts.
2. **Background enrichment (Option B):** after import, the app looks up each book's ISBN against the free **Open Library** API (`/api/enrich`, batched + resumable) to backfill **page count** and **publish year**, which auto-matches squares like *Cat Squasher (500+)*, *Published in the 70s*, and *Published in 2026*. ~89% of a typical export has a real ISBN; audiobooks (Amazon ASIN) and blanks are skipped and stay manual.

All matches are saved as `planned` suggestions — they show in the optimizer but don't mark a square complete until you log a real read (tap a square → "Log here"). Page-count/genre coverage can be pushed further later with a Google Books fallback.

## Roadmap ideas
- Custom challenge builder + more templates (import any bingo card)
- Smarter matching (enrich books with page count / year / genre via an ISBN lookup)
- "Reset progress" and per-challenge archiving
- Reading stats dashboard
