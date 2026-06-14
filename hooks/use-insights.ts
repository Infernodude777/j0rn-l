'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiInsightsKey, cachedFetch, invalidateCache, peekCachedStale } from '@/lib/data-cache';
import { useUser } from './use-user';
import type { WeeklyInsight } from '@/lib/types';

interface InsightsResponse {
  insights: WeeklyInsight[];
  ai_powered: boolean;
  ai_reason?: string | null;
}

interface UseInsights {
  data: WeeklyInsight[];
  loading: boolean;
  generating: boolean;
  error: string | null;
  ai_powered: boolean;
  ai_reason: string | null;
  refresh: () => Promise<void>;
  generate: () => Promise<WeeklyInsight | null>;
}

const INSIGHTS_TTL_MS = 60_000; // 1 min — server route is expensive

export function useInsights(): UseInsights {
  const { user } = useUser();
  const cached = user ? peekCachedStale<InsightsResponse>(apiInsightsKey(user.id)) : undefined;
  const [data, setData] = useState<WeeklyInsight[]>(cached?.insights ?? []);
  const [loading, setLoading] = useState<boolean>(!user || cached === undefined);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiPowered, setAiPowered] = useState<boolean>(cached?.ai_powered ?? false);
  const [aiReason, setAiReason] = useState<string | null>(cached?.ai_reason ?? null);

  const refresh = useCallback(
    async (opts: { force?: boolean } = {}) => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const json = await cachedFetch<InsightsResponse>(
          apiInsightsKey(user.id),
          async () => {
            const res = await fetch('/api/insights', { cache: 'no-store' });
            if (!res.ok) throw new Error('Failed to load insights');
            return (await res.json()) as InsightsResponse;
          },
          { ttlMs: INSIGHTS_TTL_MS, force: opts.force },
        );
        setData(json.insights ?? []);
        setAiPowered(Boolean(json.ai_powered));
        setAiReason(json.ai_reason ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load insights');
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const generate = useCallback(async () => {
    if (!user) return null;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/insights', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to generate insight');
      const json = await res.json();
      setAiPowered(Boolean(json.ai_powered));
      setAiReason(json.ai_reason ?? null);
      // The server returned fresh data — bust the cache so the next refresh
      // sees the new insight instead of the stale TTL window.
      invalidateCache(apiInsightsKey(user.id));
      await refresh({ force: true });
      return json.insight as WeeklyInsight;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate insight');
      return null;
    } finally {
      setGenerating(false);
    }
  }, [user, refresh]);

  return { data, loading, generating, error, ai_powered: aiPowered, ai_reason: aiReason, refresh, generate };
}
