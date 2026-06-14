-- =====================================================
-- J0RN@L — Daily check-in: free-text responses + LLM interpretation
-- Run after 0001_initial_schema.sql
-- =====================================================

alter table public.daily_checkins
  add column if not exists responses jsonb default '{}'::jsonb,
  add column if not exists interpretation text,
  add column if not exists interpretation_meta jsonb default '{}'::jsonb;
