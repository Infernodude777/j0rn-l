'use client';

import { useCallback, useEffect, useState } from 'react';
import { deleteJournal, listJournal, upsertJournal, uploadJournalPhoto } from '@/lib/db/api';
import { cachedFetch, invalidateCache, journalKey, peekCachedStale } from '@/lib/data-cache';
import { useUser } from './use-user';
import type { JournalEntry } from '@/lib/types';

export function useJournal() {
  const { user } = useUser();
  // Stale-while-revalidate: show cached data immediately even after TTL
  // expiry, then refresh in the background. Only show loading when
  // there's truly no data at all (first visit, cold cache).
  const cached = user ? peekCachedStale<JournalEntry[]>(journalKey(user.id)) : undefined;
  const [data, setData] = useState<JournalEntry[]>(cached ?? []);
  const [loading, setLoading] = useState<boolean>(!user || cached === undefined);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (opts: { force?: boolean } = {}) => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const rows = await cachedFetch(
          journalKey(user.id),
          () => listJournal(user.id),
          { force: opts.force },
        );
        setData(rows);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load journal');
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
    async (input: Omit<JournalEntry, 'id' | 'user_id' | 'created_at' | 'updated_at'> & { id?: string }) => {
      if (!user) throw new Error('Not signed in');
      const saved = await upsertJournal({ ...input, user_id: user.id });
      invalidateCache(journalKey(user.id));
      await refresh({ force: true });
      return saved;
    },
    [user, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!user) return;
      await deleteJournal(id);
      invalidateCache(journalKey(user.id));
      await refresh({ force: true });
    },
    [user, refresh],
  );

  const uploadPhoto = useCallback(
    async (file: File) => {
      if (!user) throw new Error('Not signed in');
      return uploadJournalPhoto(user.id, file);
    },
    [user],
  );

  return { data, loading, error, refresh, save, remove, uploadPhoto };
}
