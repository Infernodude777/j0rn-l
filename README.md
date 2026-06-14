# J0rn@l

A personal "check engine light" for mental wellness. J0rn@l helps users notice
long-term changes in sleep, mood, stress, journaling, social interaction,
outdoor activity, and work/school pressure. The app **does not diagnose** —
it reflects patterns from the user's own baseline.

## Stack

- **Next.js 15** (App Router) with TypeScript
- **Tailwind CSS** with the design tokens from `tailwind.config.ts`
- **Supabase** (Postgres, Auth, Storage) — schema in `supabase/migrations/`
- **Blackbox AI** for weekly reflection summaries (with a local fallback)

## Quick start

```bash
# 1. Install
npm install

# 2. Copy env template and fill in your credentials
cp .env.local.example .env.local

# 3. (Supabase only) Apply the schema — see "Database setup" below
#    Skip this step if you're running the local-only demo mode.

# 4. Run the app (works without Supabase in a local-only demo mode)
npm run dev
```

## Deploy to GitHub Pages

The app can be deployed as a **static site** to GitHub Pages. In this mode
it runs entirely in the browser — all data is persisted to `localStorage`
and no server is needed.

### What works on Pages

- Full UI: dashboard, check-in, journal, trends, insights, action plan
- Local authentication (sign in with `admin`/`admin` for the demo account)
- Check-in reflection (local lexicon fallback)
- Web Speech API dictation (Chrome / Edge / Safari — no server needed)
- Weekly insights and action plan generation (local deterministic fallback)

### What doesn't work on Pages

- **Supabase auth & storage** — No server runtime, so OAuth login and
  persistent database storage aren't available. Sign in locally instead.
- **AI-powered reflections** — The Blackbox API call requires a server
  proxy (the key is server-side only). A deterministic local fallback
  still produces useful output.
- **Server-side speech-to-text** — The `/api/transcribe` endpoint won't
  run. The Web Speech API dictation path (Chrome/Edge/Safari) works
  independently.
- **Discord bot**, **Instagram / iOS integrations** — These require
  server webhooks and aren't available in static mode.
- **Middleware** — Route protection is handled client-side while on Pages.

### One-time setup

1. Push the repo to GitHub:
   ```bash
   git remote add origin https://github.com/Infernodude777/j0rn-l.git
   git branch -M main
   git push -u origin main
   ```

2. Go to **Settings → Pages** in your GitHub repo.

3. Under **Build and deployment → Source**, select **GitHub Actions**.
   (The workflow is already configured at `.github/workflows/deploy.yml`.)

4. Push to `main` — the action builds and deploys automatically.
   The site will be live at:
   👉 **https://infernodude777.github.io/j0rn-l/**

### Build locally to test

```bash
npm run build
npx serve out   # preview the static export locally
```

The `out/` directory is what gets uploaded to Pages.

## Database setup

The app's data layer is a thin façade in `lib/db/api.ts` that hits Supabase
when configured and falls back to an in-memory + `localStorage` store otherwise.
You only need to run the SQL below if you want real persisted data on a
Supabase project.

**One-time, on a fresh Supabase project:**

1. Open the Supabase dashboard → SQL editor → New query.
2. Paste the contents of `supabase/INIT.sql` and run it.
   This creates all 14 tables (`profiles`, `daily_checkins`, `journal_entries`,
   `weekly_insights`, `connected_accounts`, `notifications`, `user_settings`,
   `trusted_contacts`, `wellness_scores`, `linked_accounts`,
   `social_usage_events`, `social_usage_daily`, `bot_state`, `share_tokens`),
   the `journal` storage bucket, RLS policies on every table, and the
   `handle_new_user` trigger that auto-creates a profile + settings row on
   signup.
3. The file is idempotent — safe to re-run after pulling new changes.

**Using the Supabase CLI:**

```bash
supabase link --project-ref <ref>
supabase db push   # picks up supabase/migrations/0000_all_migrations.sql
```

**Got "Could not find the table 'public.X' in the schema cache"?** That
means the SQL hasn't been run against the project. Run `supabase/INIT.sql`
once and the error goes away.

The app runs **without Supabase credentials** in a local demo mode (data is
persisted to `localStorage`). Add your `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` to switch to the real backend.

## Environment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `BLACKBOX_API_KEY` | Blackbox AI API key (do not commit) |
| `BLACKBOX_API_URL` | Defaults to `https://api.blackbox.ai` |
| `BLACKBOX_MODEL` | Defaults to `blackboxai/minimax/minimax-free` |
| `NVIDIA_NIM_API_KEY` | NVIDIA NIM API key for speech-to-text |
| `NVIDIA_NIM_API_URL` | Defaults to `https://integrate.api.nvidia.com/v1` |
| `NVIDIA_NIM_STT_MODEL` | Defaults to `nvidia/whisper-large-v3` |

## Routes

| Path | Description |
| --- | --- |
| `/login`, `/signup` | Authentication (email, Google, Apple) |
| `/about-me` | Onboarding baseline |
| `/dashboard` | Daily snapshot, wellness score, trends |
| `/checkin` | Daily check-in editor |
| `/journal`, `/journal/new`, `/journal/[id]` | Journal entries |
| `/trends` | Week / month / year charts, pattern detection |
| `/insights` | AI-generated weekly reflections |
| `/profile` | Editable profile |
| `/settings` | Reminders, units, trusted contacts |
| `/connect-apps` | Modular provider integrations |

## Data model

See `supabase/INIT.sql` (one file, easy to paste) or the equivalent migration
`supabase/migrations/0000_all_migrations.sql` (for `supabase db push`).
Tables: `profiles`, `daily_checkins`, `journal_entries`, `weekly_insights`,
`connected_accounts`, `notifications`, `user_settings`, `trusted_contacts`,
`wellness_scores`, plus the connector layer (`linked_accounts`,
`social_usage_events`, `social_usage_daily`, `bot_state`, `share_tokens`).
All tables are scoped to the authenticated user via Row Level Security.

## Local data layer

`lib/db/api.ts` is a thin façade that uses Supabase when configured, or a
local in-memory + `localStorage` store (`lib/db/local.ts`) when it is not.
This lets the UI be exercised end-to-end during development.

## AI insights

`lib/ai/blackbox.ts` calls the Blackbox Chat Completions endpoint with a
supportive, non-diagnostic system prompt. The request always includes the
user's recent check-ins, journal entries, and a locally-computed pattern
snapshot. If the API call fails (or no key is set), a deterministic local
generator produces a similar result so the UI never breaks.

`app/api/transcribe/route.ts` forwards recorded audio to NVIDIA NIM's
OpenAI-compatible transcription endpoint so users can dictate check-in
answers directly in the browser.

## Scripts

```bash
npm run dev          # start dev server
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm run lint         # next lint
```
