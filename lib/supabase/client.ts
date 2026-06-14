'use client';

import { createBrowserClient } from '@supabase/ssr';
import { hasSupabaseConfig, SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

export function createClient() {
  if (!hasSupabaseConfig()) {
    return null;
  }
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
