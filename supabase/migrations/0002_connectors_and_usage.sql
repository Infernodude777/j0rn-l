-- =====================================================
-- J0RN@L — Connectors, social usage, journal sources
-- Adds: linked_accounts, social_usage_events, social_usage_daily,
--       journal_messages, bot_state, share_tokens
-- Run after 0001_initial_schema.sql
-- =====================================================

-- LINKED ACCOUNTS (Discord, Instagram, browser extension) =============
create table if not exists public.linked_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  provider text check (provider in ('discord','instagram','chrome_extension','ios_shortcut','android_tasker')) not null,
  external_id text not null,           -- Discord user id, Instagram handle, extension install id
  external_username text,              -- @username, "Jane Doe", etc.
  metadata jsonb default '{}'::jsonb,  -- provider-specific opaque blob
  scopes text[] default '{}',
  linked_at timestamptz default now(),
  revoked_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, provider, external_id)
);
create index if not exists linked_accounts_provider_idx on public.linked_accounts (provider, external_id);
create index if not exists linked_accounts_user_idx on public.linked_accounts (user_id);

-- SOCIAL USAGE — raw events from browser extension / iOS Shortcut / Tasker
create table if not exists public.social_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  source text check (source in ('chrome_extension','ios_shortcut','android_tasker','manual','discord')) not null,
  app text check (app in ('instagram','tiktok','twitter','youtube','reddit','facebook','snapchat','discord','other')) not null,
  event text check (event in ('open','close','foreground','background')) not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create index if not exists social_usage_events_user_time_idx
  on public.social_usage_events (user_id, occurred_at desc);
create index if not exists social_usage_events_user_app_time_idx
  on public.social_usage_events (user_id, app, occurred_at desc);

-- SOCIAL USAGE — daily rollup (computed on read; this table is the cache)
create table if not exists public.social_usage_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  app text not null,
  seconds int not null default 0,
  sessions int not null default 0,
  source_breakdown jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, date, app)
);
create index if not exists social_usage_daily_user_date_idx
  on public.social_usage_daily (user_id, date desc);

-- JOURNAL ENTRIES — add source column if it doesn't exist
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'journal_entries' and column_name = 'source'
  ) then
    alter table public.journal_entries
      add column source text check (source in ('web','discord','instagram','ios_shortcut','api')) default 'web';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'journal_entries' and column_name = 'external_id'
  ) then
    alter table public.journal_entries
      add column external_id text;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'journal_entries' and column_name = 'external_meta'
  ) then
    alter table public.journal_entries
      add column external_meta jsonb default '{}'::jsonb;
  end if;
end $$;

create unique index if not exists journal_entries_user_source_ext_idx
  on public.journal_entries (user_id, source, external_id)
  where external_id is not null;

-- BOT STATE — per-user, per-provider conversational context
create table if not exists public.bot_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  provider text not null,
  state jsonb not null default '{}'::jsonb,
  last_message_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, provider)
);

-- SHARE TOKENS — short-lived tokens for linking flows (Discord OAuth, extension pairing)
create table if not exists public.share_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  purpose text check (purpose in ('discord_link','extension_pair','ios_shortcut_pair')) not null,
  token text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create index if not exists share_tokens_user_idx on public.share_tokens (user_id, created_at desc);

-- RLS =================================================================
alter table public.linked_accounts      enable row level security;
alter table public.social_usage_events  enable row level security;
alter table public.social_usage_daily   enable row level security;
alter table public.bot_state            enable row level security;
alter table public.share_tokens         enable row level security;

do $$ declare r record; begin
  for r in (select policyname, tablename from pg_policies where schemaname = 'public') loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Re-apply all "self" policies for the original tables
create policy "profiles self" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "daily_checkins self" on public.daily_checkins for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "journal_entries self" on public.journal_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "weekly_insights self" on public.weekly_insights for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "connected_accounts self" on public.connected_accounts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notifications self" on public.notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_settings self" on public.user_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "trusted_contacts self" on public.trusted_contacts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "wellness_scores self" on public.wellness_scores for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- New tables
create policy "linked_accounts self"     on public.linked_accounts     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "social_usage_events self" on public.social_usage_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "social_usage_daily self"  on public.social_usage_daily  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "bot_state self"           on public.bot_state           for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "share_tokens self"         on public.share_tokens         for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
