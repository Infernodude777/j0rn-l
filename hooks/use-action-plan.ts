'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCheckins } from './use-checkins';
import { useJournal } from './use-journal';
import { useProfile } from './use-profile';
import { useUser } from './use-user';
import { daysAgoISO } from '@/lib/utils';
import type { ActionPlan } from '@/lib/ai/blackbox';

interface ActionPlanResponse {
  plan: ActionPlan | null;
  ai_powered: boolean;
  ai_reason?: string | null;
}

interface UseActionPlan {
  plan: ActionPlan | null;
  loading: boolean;
  generating: boolean;
  error: string | null;
  ai_powered: boolean;
  ai_reason: string | null;
  generate: () => Promise<ActionPlan | null>;
}

export function useActionPlan(): UseActionPlan {
  const { user } = useUser();
  const { profile } = useProfile();
  const { data: checkins } = useCheckins(daysAgoISO(31));
  const { data: journals } = useJournal();
  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiPowered, setAiPowered] = useState(false);
  const [aiReason, setAiReason] = useState<string | null>(null);

  const requestContext = useMemo(() => ({
    profile: profile ? {
      id: profile.id,
      name: profile.name,
      sleep_goal_hours: profile.sleep_goal_hours,
    } : null,
    checkins,
    journals,
  }), [profile, checkins, journals]);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/action-plan', {
        cache: 'no-store',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: requestContext }),
      });
      if (res.ok) {
        const json = (await res.json()) as ActionPlanResponse;
        setPlan(json.plan);
        setAiPowered(Boolean(json.ai_powered));
        setAiReason(json.ai_reason ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load action plan');
    } finally {
      setLoading(false);
    }
  }, [user, requestContext]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const generate = useCallback(async () => {
    if (!user) return null;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/action-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: requestContext }),
      });
      if (!res.ok) throw new Error('Failed to generate action plan');
      const json = (await res.json()) as ActionPlanResponse;
      setPlan(json.plan);
      setAiPowered(Boolean(json.ai_powered));
      setAiReason(json.ai_reason ?? null);
      return json.plan;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate action plan');
      return null;
    } finally {
      setGenerating(false);
    }
  }, [user, requestContext]);

  return { plan, loading, generating, error, ai_powered: aiPowered, ai_reason: aiReason, generate };
}
