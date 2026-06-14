'use client';

import { createClient } from '@/lib/supabase/client';
import {
  ADMIN_EMAIL,
  ADMIN_USER_ID,
  isAdminCredentials,
  localDB,
  localSession,
  seedAdminData,
  seedLocalData,
} from '@/lib/db/local';
import type {
  ConnectedAccount,
  DailyCheckin,
  DailyCheckinPromptSet,
  JournalEntry,
  Notification,
  Profile,
  TrustedContact,
  UserSettings,
  WeeklyInsight,
  WellnessScore,
} from '@/lib/types';
import { todayISO, uid } from '@/lib/utils';
import { localInterpret } from '@/lib/ai/blackbox';
import { pickDailyQuestions } from '@/lib/checkin-questions';

const isBrowser = typeof window !== 'undefined';

/** Wraps a thenable (native Promise or Supabase PostgrestBuilder) with a
 *  configurable timeout. On timeout, rejects with a descriptive error so
 *  callers can catch and fall back instead of hanging forever. */
async function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  if (ms <= 0) return promise;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Default timeout for Supabase network calls (8s — generous enough for
 *  cold starts but short enough that the UI never feels frozen). */
const DB_TIMEOUT_MS = 8_000;

/* ------------------------------ Auth ------------------------------ */

export interface AuthUser { id: string; email: string; }

export async function signInWithEmail(email: string, password: string): Promise<AuthUser> {
  // Admin shortcut: always available, bypasses the email/password format
  // requirements. Uses a fixed userId so the seeded 30-day data persists
  // across sign-outs.
  if (isAdminCredentials(email, password)) {
    localSession.set(ADMIN_USER_ID, ADMIN_EMAIL);
    seedAdminData();
    return { id: ADMIN_USER_ID, email: ADMIN_EMAIL };
  }
  const sb = createClient();
  if (sb) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error || !data.user) throw new Error(error?.message ?? 'Sign-in failed');
    return { id: data.user.id, email: data.user.email ?? email };
  }
  // local fallback
  if (!email || !password) throw new Error('Email and password are required');
  const userId = uid();
  localSession.set(userId, email);
  seedLocalData(userId, email.split('@')[0] ?? 'You', email);
  return { id: userId, email };
}

export async function signUpWithEmail(email: string, password: string, name: string): Promise<AuthUser> {
  const sb = createClient();
  if (sb) {
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error || !data.user) throw new Error(error?.message ?? 'Sign-up failed');
    return { id: data.user.id, email: data.user.email ?? email };
  }
  if (!email || !password) throw new Error('Email and password are required');
  const userId = uid();
  localSession.set(userId, email);
  seedLocalData(userId, name || email.split('@')[0] || 'You', email);
  return { id: userId, email };
}

export async function signInWithOAuth(provider: 'google' | 'apple'): Promise<void> {
  const sb = createClient();
  if (sb) {
    const { error } = await sb.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw new Error(error.message);
    return;
  }
  // local fallback — pretend OAuth succeeded
  const userId = uid();
  const email = `${provider}.user@local.test`;
  localSession.set(userId, email);
  seedLocalData(userId, provider === 'google' ? 'Google User' : 'Apple User', email);
}

export async function signOut(): Promise<void> {
  // Clear the module-level auth/profile cache so a subsequent sign-in in
  // the same tab doesn't briefly show the previous session's user.
  try {
    const { invalidateUser, invalidateProfile } = await import('@/lib/auth-cache');
    invalidateUser();
    invalidateProfile();
  } catch {
    // ignore — cache module might not exist in some test contexts
  }
  // Capture the current user before clearing so we can invalidate
  // their data-cache entries (not just hardcoded 'admin').
  const currentUser = localSession.get();
  // Always clear the local session — Supabase signOut only clears
  // HTTP-only cookies, leaving the j0rn@l.local.session cookie intact.
  // Without this, the middleware sees a stale local user and redirects
  // back to /dashboard instead of /login.
  localSession.clear();
  // Invalidate the in-memory data cache so the next sign-in doesn't
  // briefly show the previous user's check-ins / journals.
  if (currentUser) {
    try {
      const { invalidateUserCache } = await import('@/lib/data-cache');
      invalidateUserCache(currentUser.userId);
    } catch {
      // ignore
    }
  }
  const sb = createClient();
  if (sb) {
    try {
      await sb.auth.signOut();
    } catch {
      // Admin accounts don't have a Supabase session, so signOut may throw.
      // The local session is already cleared above — this is just cleanup.
    }
  }
}

export function getCurrentUser(): AuthUser | null {
  if (!isBrowser) return null;
  // In local mode the session lives in localStorage. Supabase sessions are
  // stored in HTTP-only cookies and must be read via the useUser hook
  // (or a server action). Callers should prefer useUser.
  const local = localSession.get();
  if (!local) return null;
  return { id: local.userId, email: local.email };
}

/* ------------------------------ Profile ------------------------------ */

export async function getProfile(userId: string): Promise<Profile | null> {
  const sb = userId !== ADMIN_USER_ID ? createClient() : null;
  if (sb) {
    try {
      const { data } = await withTimeout(
        sb.from('profiles').select('*').eq('id', userId).maybeSingle(),
        DB_TIMEOUT_MS,
        'getProfile',
      );
      return (data as Profile | null) ?? null;
    } catch {
      console.warn('[api] getProfile timed out — falling back to local');
      return localDB.getProfile(userId);
    }
  }
  return localDB.getProfile(userId);
}

export async function upsertProfile(profile: Profile): Promise<void> {
  const sb = profile.id !== ADMIN_USER_ID ? createClient() : null;
  if (sb) {
    const { error } = await sb.from('profiles').upsert(profile);
    if (error) throw new Error(error.message);
    return;
  }
  localDB.upsertProfile(profile);
}

/* ------------------------------ Settings ------------------------------ */

export async function getSettings(userId: string): Promise<UserSettings> {
  const sb = userId !== ADMIN_USER_ID ? createClient() : null;
  if (sb) {
    const { data } = await sb.from('user_settings').select('*').eq('user_id', userId).maybeSingle();
    if (data) return data as UserSettings;
  }
  return localDB.getSettings(userId);
}

export async function saveSettings(s: UserSettings): Promise<void> {
  const sb = s.user_id !== ADMIN_USER_ID ? createClient() : null;
  if (sb) {
    const { error } = await sb.from('user_settings').upsert(s);
    if (error) throw new Error(error.message);
    return;
  }
  localDB.saveSettings(s);
}

/* ------------------------------ Check-ins ------------------------------ */

export interface CheckinInterpretClientResult {
  interpretation: string;
  scores: {
    mood: number;
    energy: number;
    stress: number;
    connection: number;
    rest: number;
    purpose: number;
  };
  themes: string[];
}

export interface CheckinSubmission {
  id?: string;
  user_id: string;
  date: string;
  /** Free-text answers keyed by question id. */
  responses: Record<string, string>;
  /** Optional: the user's display name (used by the LLM interpreter). */
  userName?: string;
  /** Pre-existing numeric fields (only used for the seed/dev path).
   *  All fields are optional — pass only what you have; the LLM
   *  interpreter fills in any gaps via `??`. */
  legacy?: Partial<{
    mood: number;
    stress: number;
    energy: number;
    focus: number;
    social_connection: number;
    work_pressure: number;
    sleep_hours: number;
    outdoor_minutes: number;
    rest_hours: number;
    notes: string;
  }>;
}

/**
 * Ask the LLM (server-side) to interpret a set of free-text check-in answers.
 * Safe to call from the client \u2014 the BLACKBOX_API_KEY never leaves the
 * server. If the network call fails, the local interpreter is invoked so the
 * user always gets a useful reflection.
 */
export async function interpretCheckinRemote(
  name: string,
  responses: Record<string, string>,
): Promise<CheckinInterpretClientResult> {
  try {
    const res = await fetch('/api/checkin/interpret', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, responses }),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        interpretation: String(data.interpretation ?? ''),
        scores: {
          mood:       Number(data.scores?.mood)       || 5,
          energy:     Number(data.scores?.energy)     || 5,
          stress:     Number(data.scores?.stress)     || 5,
          connection: Number(data.scores?.connection) || 5,
          rest:       Number(data.scores?.rest)       || 5,
          purpose:    Number(data.scores?.purpose)    || 5,
        },
        themes: Array.isArray(data.themes) ? data.themes.map(String) : [],
      };
    }
  } catch {
    // fall through to local
  }
  // Local fallback (pure client-side lexicon \u2014 no network, no key).
  return localInterpret({ name, responses });
}

/**
 * Save a daily check-in. The interpretation is fetched first (server-side),
 * then the row is upserted. The LLM-inferred scores are written to the
 * top-level columns (mood / stress / energy / etc.) so the dashboard charts
 * and trend rollups work without any extra mapping.
 */
export async function submitCheckin(input: CheckinSubmission): Promise<DailyCheckin> {
  const interpreted = await interpretCheckinRemote(input.userName ?? '', input.responses);

  const meta = {
    mood:       interpreted.scores.mood,
    energy:     interpreted.scores.energy,
    stress:     interpreted.scores.stress,
    connection: interpreted.scores.connection,
    rest:       interpreted.scores.rest,
    purpose:    interpreted.scores.purpose,
    themes:     interpreted.themes,
    generated_at: new Date().toISOString(),
  };

  const baseRow: Omit<DailyCheckin, 'id' | 'created_at' | 'updated_at'> & { id?: string } = {
    id: input.id,
    user_id: input.user_id,
    date: input.date,
    // Prefer the user's own numeric values if they provided them; otherwise
    // mirror the LLM-inferred scores so charts and trends see real numbers.
    mood:            input.legacy?.mood         ?? interpreted.scores.mood,
    stress:          input.legacy?.stress       ?? interpreted.scores.stress,
    energy:          input.legacy?.energy       ?? interpreted.scores.energy,
    focus:           input.legacy?.focus        ?? interpreted.scores.purpose,
    outdoor_minutes: input.legacy?.outdoor_minutes ?? 0,
    social_connection: input.legacy?.social_connection ?? interpreted.scores.connection,
    rest_hours:      input.legacy?.rest_hours   ?? 0,
    work_pressure:   input.legacy?.work_pressure ?? Math.max(1, 10 - interpreted.scores.purpose),
    sleep_hours:     input.legacy?.sleep_hours  ?? 0,
    notes:           input.legacy?.notes        ?? null,
    responses: input.responses,
    interpretation: interpreted.interpretation,
    interpretation_meta: meta,
  };

  return upsertCheckin(baseRow);
}

export async function listCheckins(userId: string, fromDate?: string): Promise<DailyCheckin[]> {
  const sb = userId !== ADMIN_USER_ID ? createClient() : null;
  if (sb) {
    try {
      let q = sb.from('daily_checkins').select('*').eq('user_id', userId).order('date', { ascending: true });
      if (fromDate) q = q.gte('date', fromDate);
      const { data } = await withTimeout(q, DB_TIMEOUT_MS, 'listCheckins');
      return (data as DailyCheckin[]) ?? [];
    } catch {
      console.warn('[api] listCheckins timed out — falling back to local');
      return localDB.listCheckins(userId, fromDate);
    }
  }
  return localDB.listCheckins(userId, fromDate);
}

export async function getCheckin(userId: string, date: string): Promise<DailyCheckin | null> {
  const sb = userId !== ADMIN_USER_ID ? createClient() : null;
  if (sb) {
    const { data } = await sb
      .from('daily_checkins')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle();
    return (data as DailyCheckin | null) ?? null;
  }
  return localDB.getCheckin(userId, date);
}

export async function upsertCheckin(c: Omit<DailyCheckin, 'id' | 'created_at' | 'updated_at'> & { id?: string }): Promise<DailyCheckin> {
  const sb = c.user_id !== ADMIN_USER_ID ? createClient() : null;
  if (sb) {
    const { data, error } = await sb.from('daily_checkins').upsert(c).select().single();
    if (error) throw new Error(error.message);
    return data as DailyCheckin;
  }
  const full: DailyCheckin = {
    id: c.id ?? uid(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...c,
  };
  localDB.upsertCheckin(full);
  return full;
}

/* ------------------------------ Check-in Prompt Sets ------------------------------ */

export async function getCheckinPromptSet(userId: string, date: string): Promise<DailyCheckinPromptSet | null> {
  const sb = userId !== ADMIN_USER_ID ? createClient() : null;
  if (sb) {
    try {
      const { data } = await sb
        .from('checkin_prompt_sets')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle();
      return (data as DailyCheckinPromptSet | null) ?? null;
    } catch {
      console.warn('[api] checkin_prompt_sets table not found — falling back to local');
      return localDB.getCheckinPromptSet(userId, date);
    }
  }
  return localDB.getCheckinPromptSet(userId, date);
}

export async function upsertCheckinPromptSet(
  set: Omit<DailyCheckinPromptSet, 'created_at' | 'updated_at'> & Partial<Pick<DailyCheckinPromptSet, 'created_at' | 'updated_at'>>,
): Promise<DailyCheckinPromptSet> {
  const sb = set.user_id !== ADMIN_USER_ID ? createClient() : null;
  const existing = await getCheckinPromptSet(set.user_id, set.date);
  const created_at = existing?.created_at ?? set.created_at ?? new Date().toISOString();
  const updated_at = new Date().toISOString();
  if (sb) {
    const { data, error } = await sb
      .from('checkin_prompt_sets')
      .upsert({ ...set, created_at, updated_at }, { onConflict: 'user_id,date' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as DailyCheckinPromptSet;
  }
  const full: DailyCheckinPromptSet = {
    id: set.id ?? uid(),
    created_at,
    updated_at,
    ...set,
  };
  localDB.upsertCheckinPromptSet(full);
  return full;
}

export async function getOrCreateDailyCheckinPromptSet(
  userId: string,
  date: string,
  count = 12,
): Promise<DailyCheckinPromptSet> {
  const existing = await getCheckinPromptSet(userId, date);
  if (existing && Array.isArray(existing.question_ids) && existing.question_ids.length > 0) {
    return existing;
  }
  const question_ids = pickDailyQuestions(`${userId}-${date}`, count).map((q) => q.id);
  return upsertCheckinPromptSet({
    id: existing?.id,
    user_id: userId,
    date,
    question_ids,
    created_at: existing?.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

/* ------------------------------ Journal ------------------------------ */

export async function listJournal(userId: string): Promise<JournalEntry[]> {
  const sb = userId !== ADMIN_USER_ID ? createClient() : null;
  if (sb) {
    try {
      const { data } = await withTimeout(
        sb.from('journal_entries').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        DB_TIMEOUT_MS,
        'listJournal',
      );
      return (data as JournalEntry[]) ?? [];
    } catch {
      console.warn('[api] listJournal timed out — falling back to local');
      return localDB.listJournal(userId);
    }
  }
  return localDB.listJournal(userId);
}

export async function getJournal(id: string): Promise<JournalEntry | null> {
  const sb = createClient();
  if (sb) {
    const { data } = await sb.from('journal_entries').select('*').eq('id', id).maybeSingle();
    return (data as JournalEntry | null) ?? null;
  }
  return localDB.getJournal(id);
}

export async function upsertJournal(entry: Omit<JournalEntry, 'id' | 'created_at' | 'updated_at'> & { id?: string }): Promise<JournalEntry> {
  const sb = entry.user_id !== ADMIN_USER_ID ? createClient() : null;
  if (sb) {
    const { data, error } = await sb.from('journal_entries').upsert(entry).select().single();
    if (error) throw new Error(error.message);
    return data as JournalEntry;
  }
  const full: JournalEntry = {
    id: entry.id ?? uid(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...entry,
  };
  localDB.upsertJournal(full);
  return full;
}

export async function deleteJournal(id: string): Promise<void> {
  const sb = createClient();
  if (sb) {
    const { error } = await sb.from('journal_entries').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return;
  }
  localDB.deleteJournal(id);
}

export async function uploadJournalPhoto(userId: string, file: File): Promise<string> {
  const sb = userId !== ADMIN_USER_ID ? createClient() : null;
  if (sb) {
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error } = await sb.storage.from('journal').upload(path, file, { upsert: true });
    if (error) throw new Error(error.message);
    const { data } = sb.storage.from('journal').getPublicUrl(path);
    return data.publicUrl;
  }
  // Local fallback: object URL
  return URL.createObjectURL(file);
}

/* ------------------------------ Insights ------------------------------ */

export async function listInsights(userId: string): Promise<WeeklyInsight[]> {
  const sb = userId !== ADMIN_USER_ID ? createClient() : null;
  if (sb) {
    const { data } = await sb
      .from('weekly_insights')
      .select('*')
      .eq('user_id', userId)
      .order('week_start', { ascending: false });
    return (data as WeeklyInsight[]) ?? [];
  }
  return localDB.listInsights(userId);
}

export async function saveInsight(i: WeeklyInsight): Promise<void> {
  const sb = i.user_id !== ADMIN_USER_ID ? createClient() : null;
  if (sb) {
    const { error } = await sb.from('weekly_insights').upsert(i);
    if (error) throw new Error(error.message);
    return;
  }
  localDB.saveInsight(i);
}

/* ------------------------------ Connected accounts ------------------------------ */

export async function listConnected(userId: string): Promise<ConnectedAccount[]> {
  const sb = userId !== ADMIN_USER_ID ? createClient() : null;
  if (sb) {
    try {
      const { data } = await sb.from('connected_accounts').select('*').eq('user_id', userId);
      return (data as ConnectedAccount[]) ?? [];
    } catch {
      // Table may not exist yet (migration not applied). Fall back to empty.
      console.warn('[api] connected_accounts table not found — falling back to local');
      return localDB.listConnected(userId);
    }
  }
  return localDB.listConnected(userId);
}

export async function upsertConnected(a: ConnectedAccount): Promise<void> {
  const sb = a.user_id !== ADMIN_USER_ID ? createClient() : null;
  if (sb) {
    try {
      const { error } = await sb.from('connected_accounts').upsert(a);
      if (error) throw new Error(error.message);
      return;
    } catch {
      // Table may not exist yet (migration not applied). Fall back to local.
      console.warn('[api] connected_accounts table not found — falling back to local');
      localDB.upsertConnected(a);
      return;
    }
  }
  localDB.upsertConnected(a);
}

/* ------------------------------ Notifications ------------------------------ */

export async function listNotifications(userId: string): Promise<Notification[]> {
  const sb = userId !== ADMIN_USER_ID ? createClient() : null;
  if (sb) {
    const { data } = await sb
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return (data as Notification[]) ?? [];
  }
  return localDB.listNotifications(userId);
}

export async function upsertNotification(n: Notification): Promise<void> {
  const sb = n.user_id !== ADMIN_USER_ID ? createClient() : null;
  if (sb) {
    const { error } = await sb.from('notifications').upsert(n);
    if (error) throw new Error(error.message);
    return;
  }
  localDB.upsertNotification(n);
}

/* ------------------------------ Wellness scores ------------------------------ */

export async function listWellnessScores(userId: string, fromDate?: string): Promise<WellnessScore[]> {
  const sb = userId !== ADMIN_USER_ID ? createClient() : null;
  if (sb) {
    let q = sb.from('wellness_scores').select('*').eq('user_id', userId).order('date', { ascending: true });
    if (fromDate) q = q.gte('date', fromDate);
    const { data } = await q;
    return (data as WellnessScore[]) ?? [];
  }
  return localDB.listWellnessScores(userId, fromDate);
}

export async function upsertWellnessScore(s: WellnessScore): Promise<void> {
  const sb = s.user_id !== ADMIN_USER_ID ? createClient() : null;
  if (sb) {
    const { error } = await sb.from('wellness_scores').upsert(s);
    if (error) throw new Error(error.message);
    return;
  }
  localDB.upsertWellnessScore(s);
}

/* ------------------------------ Trusted contacts ------------------------------ */

export async function listTrustedContacts(userId: string): Promise<TrustedContact[]> {
  const sb = userId !== ADMIN_USER_ID ? createClient() : null;
  if (sb) {
    const { data } = await sb.from('trusted_contacts').select('*').eq('user_id', userId);
    return (data as TrustedContact[]) ?? [];
  }
  return localDB.listTrustedContacts(userId);
}

export async function upsertTrustedContact(c: TrustedContact): Promise<void> {
  const sb = c.user_id !== ADMIN_USER_ID ? createClient() : null;
  if (sb) {
    const { error } = await sb.from('trusted_contacts').upsert(c);
    if (error) throw new Error(error.message);
    return;
  }
  localDB.upsertTrustedContact(c);
}

export async function deleteTrustedContact(id: string): Promise<void> {
  const sb = createClient();
  if (sb) {
    const { error } = await sb.from('trusted_contacts').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return;
  }
  localDB.deleteTrustedContact(id);
}

/* ------------------------------ Helpers ------------------------------ */

export function ensureDateISO(date?: string): string {
  return date ?? todayISO();
}
