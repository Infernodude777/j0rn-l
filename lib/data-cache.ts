/**
 * Module-level data cache for the heavy per-page hooks.
 *
 * Why this exists: every page mount re-creates `useCheckins` / `useJournal`
 * / `useNotifications` instances, which in turn re-fetch the full list from
 * the DB. With multiple hooks (e.g. dashboard + bell + narrate card) and
 * frequent navigation, the same list is fetched many times. This cache:
 *
 *  1. Returns the cached list synchronously on subsequent reads within
 *     the TTL window.
 *  2. Dedupes in-flight requests: if 5 components ask for the same
 *     journal list at the same time, only one network call goes out and
 *     all 5 subscribers get the same result.
 *  3. Lets us manually invalidate (e.g. after a write) so the next read
 *     is fresh.
 *
 * Keys are `userId + query-suffix` (e.g. `journal:admin`, `checkins:7:admin`).
 */

type Loader<T> = () => Promise<T>;

interface Entry<T> {
  value: T;
  fetchedAt: number;
  /** In-flight promise shared by concurrent subscribers. */
  inflight: Promise<T> | null;
}

const store = new Map<string, Entry<unknown>>();

const DEFAULT_TTL_MS = 30_000; // 30s — short enough to stay fresh, long
                               // enough to absorb rapid navigation

function isFresh<T>(entry: Entry<T> | undefined, ttl: number): boolean {
  if (!entry) return false;
  return Date.now() - entry.fetchedAt < ttl;
}

/**
 * Read a cached value. If a fresh entry exists, return it. Otherwise call
 * the loader, dedupe concurrent calls, cache the result, and return it.
 *
 * If `opts.force` is true, the TTL is ignored (still deduped with any
 * in-flight call).
 */
export async function cachedFetch<T>(
  key: string,
  loader: Loader<T>,
  opts: { ttlMs?: number; force?: boolean } = {},
): Promise<T> {
  const ttl = opts.ttlMs ?? DEFAULT_TTL_MS;
  const existing = store.get(key) as Entry<T> | undefined;

  // Fresh cache hit — return immediately
  if (!opts.force && existing && isFresh(existing, ttl)) {
    return existing.value;
  }

  // Dedupe in-flight
  if (existing?.inflight) {
    return existing.inflight;
  }

  // Start a new fetch
  const inflight = loader()
    .then((value) => {
      store.set(key, { value, fetchedAt: Date.now(), inflight: null });
      return value;
    })
    .catch((err) => {
      // Clear the in-flight marker so the next caller can retry, but
      // don't poison the cache with a stale error.
      if (existing) {
        existing.inflight = null;
      } else {
        store.delete(key);
      }
      throw err;
    });

  // Seed the entry so concurrent callers see the in-flight promise
  if (existing) {
    existing.inflight = inflight;
  } else {
    store.set(key, {
      value: undefined as unknown as T, // overwritten on resolve
      fetchedAt: 0,
      inflight,
    });
  }

  return inflight;
}

/** Peek the cached value without triggering a fetch. Returns undefined
 *  if the entry doesn't exist or has expired. */
export function peekCached<T>(key: string, opts: { ttlMs?: number } = {}): T | undefined {
  const ttl = opts.ttlMs ?? DEFAULT_TTL_MS;
  const entry = store.get(key) as Entry<T> | undefined;
  if (!entry) return undefined;
  if (!isFresh(entry, ttl)) return undefined;
  return entry.value;
}

/** Like peekCached but returns the value even if the TTL has expired.
 *  Only returns undefined if the entry was never cached at all.
 *  Used by hooks to show stale data immediately while a background
 *  refresh runs (stale-while-revalidate pattern). */
export function peekCachedStale<T>(key: string): T | undefined {
  const entry = store.get(key) as Entry<T> | undefined;
  if (!entry) return undefined;
  // Return the value if it exists at all (even if stale).
  // If value is undefined (never resolved), return undefined.
  return entry.value;
}

/** Invalidate one entry (or all entries with a given prefix). */
export function invalidateCache(keyOrPrefix: string, opts: { prefix?: boolean } = {}): void {
  if (opts.prefix) {
    for (const k of store.keys()) {
      if (k.startsWith(keyOrPrefix)) store.delete(k);
    }
    return;
  }
  store.delete(keyOrPrefix);
}

/** Invalidate everything for a given user (e.g. on sign-out). */
export function invalidateUserCache(userId: string): void {
  // Key builders all append `:${userId}` as a suffix — use endsWith so we
  // don't accidentally match a user whose id is a substring of another
  // (e.g. invalidating "admin" would otherwise also wipe "admin1").
  const suffix = `:${userId}`;
  for (const k of store.keys()) {
    if (k.endsWith(suffix)) store.delete(k);
  }
}

/** A typed helper that returns a cached value or fetches+stores it. Skips
 *  the `peek` dance for callers that just want fire-and-forget read-through
 *  semantics. Used by the new useSettings / useTrustedContacts / etc. hooks
 *  to keep their bodies tiny. */
export async function getOrFetch<T>(key: string, loader: () => Promise<T>, opts: { ttlMs?: number } = {}): Promise<T> {
  return cachedFetch(key, loader, opts);
}

/* -------------------------------------------------------------------------- */
/*  Convenience builders for the common hooks                                  */
/* -------------------------------------------------------------------------- */

/** Cache key for `listJournal(userId)`. */
export const journalKey = (userId: string) => `journal:${userId}`;

/** Cache key for `listCheckins(userId, fromDate)`. */
export const checkinsKey = (userId: string, fromDate?: string) =>
  `checkins:${fromDate ?? 'all'}:${userId}`;

/** Cache key for `listNotifications(userId)`. */
export const notificationsKey = (userId: string) => `notifications:${userId}`;

/** Cache key for `listConnected(userId)`. */
export const connectedKey = (userId: string) => `connected:${userId}`;

/** Cache key for `listInsights(userId)`. */
export const insightsKey = (userId: string) => `insights:${userId}`;

/** Cache key for `getSettings(userId)`. */
export const settingsKey = (userId: string) => `settings:${userId}`;

/** Cache key for `listTrustedContacts(userId)`. */
export const trustedContactsKey = (userId: string) => `trustedContacts:${userId}`;

/** Cache key for the `GET /api/insights` response. */
export const apiInsightsKey = (userId: string) => `apiInsights:${userId}`;
