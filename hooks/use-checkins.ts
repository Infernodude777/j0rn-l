'use client';

import { useCallback, useEffect, useState } from 'react';
import { getCheckin, listCheckins, upsertCheckin } from '@/lib/db/api';
import { cachedFetch, checkinsKey, invalidateCache, peekCachedStale } from '@/lib/data-cache';
import { useUser } from './use-user';
import { todayISO } from '@/lib/utils';
import type { DailyCheckin } from '@/lib/types';

export function useCheckins(fromDate?: string) {
  const { user } = useUser();
  // Stale-while-revalidate: show cached data immediately even after TTL
  // expiry, then refresh in the background. Only show loading when
  // there's truly no data at all (first visit, cold cache).
  const cached = user ? peekCachedStale<DailyCheckin[]>(checkinsKey(user.id, fromDate)) : undefined;
  const [data, setData] = useState<DailyCheckin[]>(cached ?? []);
  const [loading, setLoading] = useState<boolean>(!user || cached === undefined);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (opts: { force?: boolean } = {}) => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const rows = await cachedFetch(
          checkinsKey(user.id, fromDate),
          () => listCheckins(user.id, fromDate),
          { force: opts.force },
        );
        setData(rows);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load check-ins');
      } finally {
        setLoading(false);
      }
    },
    [user, fromDate],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(
    async (input: Omit<DailyCheckin, 'id' | 'user_id' | 'created_at' | 'updated_at'> & { id?: string }) => {
      if (!user) throw new Error('Not signed in');
      const saved = await upsertCheckin({ ...input, user_id: user.id });
      // Invalidate all checkin-list entries for this user so the next read
      // re-fetches (the new/updated row is part of the list).
      invalidateCache(`checkins:`, { prefix: true });
      await refresh({ force: true });
      return saved;
    },
    [user, refresh],
  );

  return { data, loading, error, refresh, save };
}

export function useTodaysCheckin() {
  const { user } = useUser();
  const [checkin, setCheckin] = useState<DailyCheckin | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const c = await getCheckin(user.id, todayISO());
      setCheckin(c);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { checkin, loading, refresh };
}
