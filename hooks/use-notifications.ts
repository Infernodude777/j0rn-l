'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { listNotifications, upsertNotification } from '@/lib/db/api';
import { generateNudges, nudgesToNotifications } from '@/lib/nudges';
import { listCheckins, listJournal } from '@/lib/db/api';
import { cachedFetch, checkinsKey, invalidateCache, journalKey, notificationsKey, peekCachedStale } from '@/lib/data-cache';
import { useUser } from './use-user';
import type { Notification } from '@/lib/types';

export function useNotifications() {
  const { user } = useUser();
  // Synchronous cache peek so the bell shows the right unread count on
  // the very first render after navigation.
  const cached = user ? peekCachedStale<Notification[]>(notificationsKey(user.id)) : undefined;
  const [items, setItems] = useState<Notification[]>(cached ?? []);
  const [loading, setLoading] = useState<boolean>(!user || cached === undefined);
  const [generating, setGenerating] = useState(false);

  const refresh = useCallback(
    async (opts: { force?: boolean } = {}) => {
      if (!user) return;
      setLoading(true);
      try {
        const rows = await cachedFetch(
          notificationsKey(user.id),
          () => listNotifications(user.id),
          { force: opts.force },
        );
        // Newest first
        rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
        setItems(rows);
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const unreadCount = useMemo(
    () => items.filter((n) => !n.read).length,
    [items],
  );

  const markRead = useCallback(
    async (id: string) => {
      if (!user) return;
      const target = items.find((n) => n.id === id);
      if (!target || target.read) return;
      await upsertNotification({ ...target, read: true });
      invalidateCache(notificationsKey(user.id));
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
    },
    [user, items],
  );

  const markAllRead = useCallback(async () => {
    if (!user) return;
    const unread = items.filter((n) => !n.read);
    // allSettled so one failed update doesn't abort the rest and leave the
    // UI in an inconsistent "some read, some not" state.
    await Promise.allSettled(
      unread.map((n) => upsertNotification({ ...n, read: true })),
    );
    invalidateCache(notificationsKey(user.id));
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [user, items]);

  /**
   * Re-scan the last week of check-ins and journal entries, generate
   * contextual nudges, and persist any that don't already exist. Safe to
   * call on every dashboard mount \u2014 it dedupes by title+body.
   *
   * Performance: each of the three reads goes through the data cache, so
   * if another component on the page already loaded checkins / journals /
   * notifications we get a synchronous cache hit instead of a second
   * localStorage read + JSON parse.
   */
  const generateAndStore = useCallback(async () => {
    if (!user || generating) return 0;
    setGenerating(true);
    try {
      const [checkins, journals, existing] = await Promise.all([
        cachedFetch(checkinsKey(user.id), () => listCheckins(user.id)),
        cachedFetch(journalKey(user.id), () => listJournal(user.id)),
        cachedFetch(notificationsKey(user.id), () => listNotifications(user.id)),
      ]);
      const cands = generateNudges(checkins, journals, existing);
      if (cands.length === 0) return 0;
      const rows = nudgesToNotifications(cands, user.id);
      await Promise.allSettled(rows.map((r) => upsertNotification(r)));
      await refresh({ force: true });
      return cands.length;
    } finally {
      setGenerating(false);
    }
  }, [user, generating, refresh]);

  return { items, loading, unreadCount, refresh, markRead, markAllRead, generateAndStore, generating };
}
