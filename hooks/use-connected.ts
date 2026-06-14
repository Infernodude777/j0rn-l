'use client';

import { useCallback, useEffect, useState } from 'react';
import { listConnected, upsertConnected } from '@/lib/db/api';
import { cachedFetch, connectedKey, invalidateCache, peekCachedStale } from '@/lib/data-cache';
import { useUser } from './use-user';
import type { ConnectedAccount } from '@/lib/types';

/**
 * Resolves the user's connected-provider list. Backed by the module-level
 * data cache so both the dashboard's `YourDayCard` and the connect-apps
 * page share a single read, even when they're both mounted.
 */
export function useConnected() {
  const { user } = useUser();
  const cached = user ? peekCachedStale<ConnectedAccount[]>(connectedKey(user.id)) : undefined;
  const [data, setData] = useState<ConnectedAccount[]>(cached ?? []);
  const [loading, setLoading] = useState<boolean>(!user || cached === undefined);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (opts: { force?: boolean } = {}) => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const rows = await cachedFetch(
          connectedKey(user.id),
          () => listConnected(user.id),
          { force: opts.force },
        );
        setData(rows);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load connections');
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(
    async (next: ConnectedAccount) => {
      if (!user) throw new Error('Not signed in');
      await upsertConnected(next);
      invalidateCache(connectedKey(user.id));
      await refresh({ force: true });
    },
    [user, refresh],
  );

  return { data, loading, error, refresh, save };
}
