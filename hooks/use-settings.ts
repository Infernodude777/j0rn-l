'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSettings, saveSettings, listTrustedContacts, upsertTrustedContact, deleteTrustedContact } from '@/lib/db/api';
import { cachedFetch, invalidateCache, peekCachedStale, settingsKey, trustedContactsKey } from '@/lib/data-cache';
import { useUser } from './use-user';
import type { TrustedContact, UserSettings } from '@/lib/types';

/**
 * Cached read-through for the user's settings row. Used by the settings
 * page and (read-only) by the connect-apps page when it needs to check
 * the AI-insights toggle.
 */
export function useSettings() {
  const { user } = useUser();
  const cached = user ? peekCachedStale<UserSettings>(settingsKey(user.id)) : undefined;
  const [data, setData] = useState<UserSettings | null>(cached ?? null);
  const [loading, setLoading] = useState<boolean>(!user || cached === undefined);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (opts: { force?: boolean } = {}) => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const row = await cachedFetch(
          settingsKey(user.id),
          () => getSettings(user.id),
          { force: opts.force },
        );
        setData(row);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const persist = useCallback(
    async (next: UserSettings) => {
      if (!user) return;
      await saveSettings(next);
      invalidateCache(settingsKey(user.id));
      setData(next);
    },
    [user],
  );

  return { data, loading, error, refresh, persist };
}

/**
 * Cached read-through for the trusted contacts list.
 */
export function useTrustedContacts() {
  const { user } = useUser();
  const cached = user ? peekCachedStale<TrustedContact[]>(trustedContactsKey(user.id)) : undefined;
  const [data, setData] = useState<TrustedContact[]>(cached ?? []);
  const [loading, setLoading] = useState<boolean>(!user || cached === undefined);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (opts: { force?: boolean } = {}) => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const rows = await cachedFetch(
          trustedContactsKey(user.id),
          () => listTrustedContacts(user.id),
          { force: opts.force },
        );
        setData(rows);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load contacts');
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(
    async (c: TrustedContact) => {
      if (!user) return;
      await upsertTrustedContact(c);
      invalidateCache(trustedContactsKey(user.id));
      await refresh({ force: true });
    },
    [user, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!user) return;
      await deleteTrustedContact(id);
      invalidateCache(trustedContactsKey(user.id));
      await refresh({ force: true });
    },
    [user, refresh],
  );

  return { data, loading, error, refresh, add, remove };
}
