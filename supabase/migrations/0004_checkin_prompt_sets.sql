-- =====================================================
-- J0RN@L — Daily check-in prompt sets
-- Persist the selected question IDs for each user/day so the
-- same daily prompt set is reused across refreshes and pages.
-- =====================================================

create table if not exists public.checkin_prompt_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  question_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, date)
);

create index if not exists checkin_prompt_sets_user_date_idx
  on public.checkin_prompt_sets (user_id, date desc);

alter table public.checkin_prompt_sets enable row level security;

create policy "checkin_prompt_sets self" on public.checkin_prompt_sets
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);