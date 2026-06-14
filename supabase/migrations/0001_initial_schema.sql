-- =====================================================
-- J0RN@L — Initial database schema
-- Run via: supabase db push  OR  paste into SQL editor
-- =====================================================

-- PROFILES ===========================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  age int,
  height_cm numeric,
  weight_kg numeric,
  region text,
  timezone text,
  occupation text,
  sleep_goal_hours numeric,
  resting_hr int,
  exercise_freq text check (exercise_freq in ('0-1','2-3','4-5','6+')),
  work_schedule text check (work_schedule in ('standard','shift','night','flexible')),
  typical_stress text check (typical_stress in ('low','moderate','high')),
  outdoor_hours numeric,
  onboarding_complete boolean default false,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- DAILY CHECK-INS =====================================
create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  mood int check (mood between 1 and 10),
  stress int check (stress between 1 and 10),
  energy int check (energy between 1 and 10),
  focus int check (focus between 1 and 10),
  outdoor_minutes int default 0,
  social_connection int check (social_connection between 1 and 10),
  rest_hours numeric default 0,
  work_pressure int check (work_pressure between 1 and 10),
  sleep_hours numeric default 0,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, date)
);
create index if not exists daily_checkins_user_date_idx on public.daily_checkins (user_id, date desc);

-- JOURNAL ENTRIES =====================================
create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text,
  body text not null,
  mood int check (mood between 1 and 10),
  tags text[] default '{}',
  photo_urls text[] default '{}',
  voice_note_url text,
  sentiment numeric,
  source text check (source in ('web','discord','instagram','ios_shortcut','api')) default 'web',
  external_id text,
  external_meta jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists journal_entries_user_created_idx on public.journal_entries (user_id, created_at desc);
create index if not exists journal_entries_tags_idx on public.journal_entries using gin (tags);
create index if not exists journal_entries_source_idx on public.journal_entries (user_id, source);

-- WEEKLY INSIGHTS =====================================
create table if not exists public.weekly_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  week_start date not null,
  week_end date not null,
  summary text not null,
  patterns text[] default '{}',
  contributing_factors text[] default '{}',
  reflection_questions text[] default '{}',
  suggestions text[] default '{}',
  metrics_snapshot jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  unique (user_id, week_start)
);

-- CONNECTED ACCOUNTS ==================================
create table if not exists public.connected_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  provider text check (provider in ('apple_health','google_fit','fitbit','oura','garmin','strava','manual')) not null,
  status text check (status in ('connected','disconnected','pending','error')) default 'disconnected',
  connected_at timestamptz,
  last_sync_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, provider)
);

-- NOTIFICATIONS =======================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  kind text check (kind in ('checkin_reminder','insight_ready','system','trusted_alert')) not null,
  title text not null,
  body text not null,
  read boolean default false,
  scheduled_for timestamptz,
  created_at timestamptz default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- USER SETTINGS =======================================
create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  checkin_reminder_time time,
  checkin_reminder_enabled boolean default true,
  notifications_enabled boolean default true,
  theme text check (theme in ('light','dark','system')) default 'light',
  units text check (units in ('metric','imperial')) default 'metric',
  ai_insights_enabled boolean default true,
  private_mode boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- TRUSTED CONTACTS ====================================
create table if not exists public.trusted_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  email text,
  phone text,
  relationship text,
  notes text,
  created_at timestamptz default now()
);

-- WELLNESS SCORES =====================================
create table if not exists public.wellness_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  score int check (score between 0 and 100) not null,
  components jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  unique (user_id, date)
);

-- RLS POLICIES ========================================
alter table public.profiles enable row level security;
alter table public.daily_checkins enable row level security;
alter table public.journal_entries enable row level security;
alter table public.weekly_insights enable row level security;
alter table public.connected_accounts enable row level security;
alter table public.notifications enable row level security;
alter table public.user_settings enable row level security;
alter table public.trusted_contacts enable row level security;
alter table public.wellness_scores enable row level security;

-- Drop existing policies (idempotent)
do $$ declare r record; begin
  for r in (select policyname, tablename from pg_policies where schemaname = 'public') loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Standard: user can read/insert/update/delete their own rows
create policy "profiles self" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "daily_checkins self" on public.daily_checkins for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "journal_entries self" on public.journal_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "weekly_insights self" on public.weekly_insights for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "connected_accounts self" on public.connected_accounts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notifications self" on public.notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_settings self" on public.user_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "trusted_contacts self" on public.trusted_contacts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "wellness_scores self" on public.wellness_scores for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- TRIGGERS ============================================
-- Auto-create profile row on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''), new.email)
  on conflict (id) do nothing;
  insert into public.user_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Storage bucket for journal images
insert into storage.buckets (id, name, public)
values ('journal', 'journal', true)
on conflict (id) do nothing;

-- Storage policy: user can manage their own folder (folder name = user_id)
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='journal self'
  ) then
    create policy "journal self" on storage.objects for all
      using (bucket_id = 'journal' and auth.uid()::text = (storage.foldername(name))[1])
      with check (bucket_id = 'journal' and auth.uid()::text = (storage.foldername(name))[1]);
  end if;
end $$;
