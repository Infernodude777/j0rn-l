'use client';

import { useCallback, useEffect, useState } from 'react';
import { getProfile } from '@/lib/db/api';
import { useUser } from './use-user';
import {
  getCachedProfile,
  invalidateProfile,
  onProfileChange,
  peekCachedProfile,
} from '@/lib/auth-cache';
import type { Profile } from '@/lib/types';

/**
 * Resolves the current user's profile. Backed by a module-level singleton
 * cache (see lib/auth-cache.ts) so navigating between pages doesn't
 * re-fetch the profile from Supabase/local every time.
 */
export function useProfile() {
  const { user } = useUser();
  // Synchronous read from the cache so the first render after navigation
  // can show the page UI instead of a blocking loader. If cached is defined
  // (even null — i.e. we already know there's no profile), trust it; the
  // cache's TTL still handles staleness on the next mount.
  const cached = peekCachedProfile();
  const [profile, setProfile] = useState<Profile | null>(cached ?? null);
  const [loading, setLoading] = useState<boolean>(!user || cached === undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getCachedProfile(user.id, () => getProfile(user.id))
      .then((p) => {
        if (!cancelled) {
          setProfile(p);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load profile');
          setLoading(false);
        }
      });

    // Cross-component updates: if another component invalidates the
    // profile (e.g. after `upsertProfile`), this hook picks it up.
    const off = onProfileChange((p) => {
      if (!cancelled) setProfile(p);
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [user?.id]);

  const refetch = useCallback(
    async (opts: { force?: boolean } = {}) => {
      if (!user) return null;
      const next = await getCachedProfile(user.id, () => getProfile(user.id), opts);
      setProfile(next);
      return next;
    },
    [user?.id],
  );

  return { profile, loading, error, refetch, invalidate: invalidateProfile };
}
