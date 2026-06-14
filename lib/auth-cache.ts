/**
 * Module-level singleton cache for auth + profile state.
 *
 * The app shell's `useUser` + `useProfile` hooks used to re-fetch from
 * scratch on every navigation. That meant every page mount showed a
 * blocking full-screen loader for ~10s while the network round-trip
 * resolved. This cache resolves synchronously on the client when the
 * user is already known, so navigation feels instant.
 *
 * - On the client, the first `useUser()` call resolves from localStorage
 *   synchronously and triggers a background refresh.
 * - Subsequent mounts return the cached value immediately, then patch
 *   in any fresh data from the network.
 * - The cache is invalidated on sign-out.
 */

import type { AuthUser } from './db/api';
import type { Profile } from './types';

interface CacheEntry<T> {
  value: T;
  /** Epoch ms of the last successful fetch. */
  fetchedAt: number;
  /** In-flight refresh promise so concurrent callers share one request. */
  refreshing: Promise<T> | null;
}

const PROFILE_TTL_MS = 60_000; // 1 min — profile rarely changes mid-session

let userEntry: CacheEntry<AuthUser | null> | null = null;
let profileEntry: CacheEntry<Profile | null> | null = null;
const userListeners = new Set<(u: AuthUser | null) => void>();
const profileListeners = new Set<(p: Profile | null) => void>();

/* -------------------------------------------------------------------------- */
/*  Module-level Supabase subscription                                          */
/* -------------------------------------------------------------------------- */

/**
 * The Supabase auth subscription used to be set up inside `useUser`'s effect,
 * which meant every page mount did a `getUser()` round-trip and a new
 * `onAuthStateChange` subscription. With a single-tab app, that's wasteful
 * — sign-in / sign-out happen at most a few times per session.
 *
 * We now set up the subscription exactly once (when the first `useUser` hook
 * mounts and Supabase is configured), store the user in `userEntry`, and
 * push updates to every active `useUser` subscriber. Subsequent page mounts
 * return the cached user synchronously without touching Supabase.
 */
type SupabaseAuthClient = ReturnType<typeof import('@/lib/supabase/client')['createClient']>;
let supabaseSubStarted = false;
function startSupabaseSubscription(sb: NonNullable<SupabaseAuthClient>) {
  if (supabaseSubStarted) return;
  supabaseSubStarted = true;
  sb.auth.onAuthStateChange((_event, session) => {
    const next: AuthUser | null = session?.user
      ? { id: session.user.id, email: session.user.email ?? '' }
      : null;
    userEntry = { value: next, fetchedAt: nowMs(), refreshing: null };
    userListeners.forEach((l) => {
      try { l(next); } catch { /* ignore listener errors */ }
    });
  });
}

function nowMs() {
  return Date.now();
}

function isFresh<T>(entry: CacheEntry<T> | null, ttl: number): boolean {
  if (!entry) return false;
  // Treat Infinity TTL as "never expires" — avoids the TS `never` narrow
  // that `nowMs() - entry.fetchedAt < Infinity` would produce.
  if (ttl === Infinity) return true;
  return nowMs() - entry.fetchedAt < ttl;
}

/* ------------------------------ user ------------------------------ */

export async function getCachedUser(
  loader: () => Promise<AuthUser | null>,
): Promise<AuthUser | null> {
  if (userEntry?.refreshing) return userEntry.refreshing;
  // user cache never expires mid-session
  if (userEntry && isFresh(userEntry, Infinity)) return userEntry.value;
  const p = loader()
    .then((u) => {
      userEntry = { value: u, fetchedAt: nowMs(), refreshing: null };
      userListeners.forEach((l) => {
        try { l(u); } catch { /* ignore listener errors */ }
      });
      return u;
    })
    .catch((e) => {
      userEntry = { value: null, fetchedAt: nowMs(), refreshing: null };
      throw e;
    });
  userEntry = { value: userEntry?.value ?? null, fetchedAt: userEntry?.fetchedAt ?? 0, refreshing: p };
  return p;
}

/** Try to start the Supabase auth subscription (idempotent). Returns the
 *  client if started, null otherwise. Callers should pass the same client
 *  they used for `getCachedUser` so the subscription is bound to it. */
export function ensureSupabaseSubscription(sb: NonNullable<SupabaseAuthClient>) {
  startSupabaseSubscription(sb);
}

export function onUserChange(listener: (u: AuthUser | null) => void): () => void {
  userListeners.add(listener);
  return () => userListeners.delete(listener);
}

export function peekCachedUser(): AuthUser | null | undefined {
  // undefined = not loaded yet; null = loaded, no user; AuthUser = loaded
  return userEntry?.value;
}

/** Directly set the module-level user cache (useful for local-mode sessions
 *  where Supabase is not involved). */
export function setCachedUser(u: AuthUser | null): void {
  userEntry = { value: u, fetchedAt: nowMs(), refreshing: null };
  userListeners.forEach((l) => {
    try { l(u); } catch { /* ignore listener errors */ }
  });
}

export function invalidateUser() {
  userEntry = null;
}

/* ------------------------------ profile ------------------------------ */

export async function getCachedProfile(
  userId: string,
  loader: () => Promise<Profile | null>,
  opts: { force?: boolean } = {},
): Promise<Profile | null> {
  if (!opts.force && isFresh(profileEntry, PROFILE_TTL_MS) && profileEntry) {
    return profileEntry.value;
  }
  if (profileEntry?.refreshing) return profileEntry.refreshing;
  const p = loader()
    .then((prof) => {
      profileEntry = { value: prof, fetchedAt: nowMs(), refreshing: null };
      profileListeners.forEach((l) => l(prof));
      return prof;
    })
    .catch((e) => {
      profileEntry = { value: null, fetchedAt: nowMs(), refreshing: null };
      throw e;
    });
  profileEntry = { value: profileEntry?.value ?? null, fetchedAt: profileEntry?.fetchedAt ?? 0, refreshing: p };
  return p;
}

export function peekCachedProfile(): Profile | null | undefined {
  return profileEntry?.value;
}

export function onProfileChange(listener: (p: Profile | null) => void): () => void {
  profileListeners.add(listener);
  return () => profileListeners.delete(listener);
}

export function invalidateProfile() {
  profileEntry = null;
  profileListeners.forEach((l) => l(null));
}
