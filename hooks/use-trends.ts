'use client';

import { useMemo } from 'react';
import { useCheckins } from './use-checkins';
import { useJournal } from './use-journal';
import { calculatePatternSnapshot, calculateSeries, calculateWellnessScore } from '@/lib/patterns';
import { daysAgoISO, movingAverage, percentChange } from '@/lib/utils';
import type { DailyCheckin, JournalEntry, PatternSnapshot, TrendSeries } from '@/lib/types';

export function useTrends() {
  // Stable date keys (string-anchored) so we don't refetch on every render.
  const yearAgo = useMemo(() => daysAgoISO(365), []);
  const { data: checkins, loading, error } = useCheckins(yearAgo);

  const weekSeries = useMemo<TrendSeries[]>(
    () => [
      calculateSeries(checkins, 'mood', 7),
      calculateSeries(checkins, 'sleep', 7),
      calculateSeries(checkins, 'stress', 7),
      calculateSeries(checkins, 'energy', 7),
      calculateSeries(checkins, 'focus', 7),
      calculateSeries(checkins, 'outdoor', 7),
      calculateSeries(checkins, 'social', 7),
    ],
    [checkins],
  );
  const monthSeries = useMemo<TrendSeries[]>(
    () => [
      calculateSeries(checkins, 'mood', 30),
      calculateSeries(checkins, 'sleep', 30),
      calculateSeries(checkins, 'stress', 30),
      calculateSeries(checkins, 'energy', 30),
      calculateSeries(checkins, 'focus', 30),
      calculateSeries(checkins, 'outdoor', 30),
      calculateSeries(checkins, 'social', 30),
    ],
    [checkins],
  );
  const yearSeries = useMemo<TrendSeries[]>(
    () => [
      calculateSeries(checkins, 'mood', 365),
      calculateSeries(checkins, 'sleep', 365),
      calculateSeries(checkins, 'stress', 365),
      calculateSeries(checkins, 'energy', 365),
      calculateSeries(checkins, 'focus', 365),
      calculateSeries(checkins, 'outdoor', 365),
      calculateSeries(checkins, 'social', 365),
    ],
    [checkins],
  );

  const { data: journals } = useJournal();

  const pattern: PatternSnapshot = useMemo(
    () => calculatePatternSnapshot({ checkins, journals }),
    [checkins, journals],
  );
  const wellness = useMemo(() => calculateWellnessScore(checkins), [checkins]);

  return { checkins, loading, error, weekSeries, monthSeries, yearSeries, pattern, wellness };
}

export interface DashboardMetrics {
  loading: boolean;
  error: string | null;
  wellness: ReturnType<typeof calculateWellnessScore>;
  sleepAvg: number;
  stressAvg: number;
  moodAvg: number;
  energyAvg: number;
  focusAvg: number;
  socialAvg: number;
  outdoorAvg: number;
  workAvg: number;
  journalCompletion: number;
  sleepChange: number;
  stressChange: number;
  sleepSpark: number[];
  stressSpark: number[];
  energySpark: number[];
  outdoorSpark: number[];
  weeklyMoodSeries: { date: string; value: number }[];
  lastCheckin: DailyCheckin | null;
  lastJournal: JournalEntry | null;
}

export function useDashboardMetrics(): DashboardMetrics {
  const last7 = useMemo(() => daysAgoISO(7), []);
  const { data: checkins, loading, error } = useCheckins(last7);
  const { data: journals } = useJournal();
  const wellness = useMemo(() => calculateWellnessScore(checkins), [checkins]);
  const recent = useMemo(() => checkins.slice(-7), [checkins]);

  // Use interpretation_meta as primary source for every dimension that the
  // AI reflection computes — this guarantees the dashboard tiles, the wellness
  // compass, and the action plan all read from the same inferred values.
  const metaMood    = (c: DailyCheckin) => c.interpretation_meta?.mood ?? c.mood;
  const metaStress  = (c: DailyCheckin) => c.interpretation_meta?.stress ?? c.stress;
  const metaEnergy  = (c: DailyCheckin) => c.interpretation_meta?.energy ?? c.energy;
  const metaSocial  = (c: DailyCheckin) => c.interpretation_meta?.connection ?? c.social_connection;
  const metaFocus   = (c: DailyCheckin) => c.interpretation_meta?.purpose ?? c.focus;
  const metaRest    = (c: DailyCheckin) => c.interpretation_meta?.rest ?? c.sleep_hours;

  const sleepAvg  = avg(recent.map(metaRest));
  const stressAvg = avg(recent.map(metaStress));
  const moodAvg   = avg(recent.map(metaMood));
  const energyAvg = avg(recent.map(metaEnergy));
  const focusAvg  = avg(recent.map(metaFocus));
  const socialAvg = avg(recent.map(metaSocial));
  const outdoorAvg = avg(recent.map((c) => c.outdoor_minutes));
  const workAvg   = avg(recent.map((c) => c.work_pressure));
  const journalCompletion = recent.length > 0
    ? Math.round((recent.filter((c) => (c.notes?.length ?? 0) > 0).length / recent.length) * 100)
    : 0;

  const last14 = checkins;
  // Sleep/stress change: use interpretation_meta-aware sources so the
  // trend direction matches the wellness compass, not raw legacy fields.
  const sleepChange = percentChange(
    avg(last14.slice(-7).map(metaRest)),
    avg(last14.slice(-14, -7).map(metaRest)),
  );
  const stressChange = percentChange(
    avg(last14.slice(-7).map(metaStress)),
    avg(last14.slice(-14, -7).map(metaStress)),
  );

  const weeklyMoodSeries = useMemo(
    () => recent.map((c) => ({ date: c.date, value: metaMood(c) })),
    [recent],
  );

  const lastCheckin = useMemo<DailyCheckin | null>(
    () => (checkins.length > 0 ? checkins[checkins.length - 1]! : null),
    [checkins],
  );
  const lastJournal = useMemo<JournalEntry | null>(
    () => (journals && journals.length > 0 ? journals[0]! : null),
    [journals],
  );

  // Build sparkline values from the same interpretation_meta-aware sources
  // so the tiny curve in each metric tile exactly matches the tile's average.
  const sleepSpark   = useMemo(() => last14.slice(-7).map(metaRest),   [last14]);
  const stressSpark  = useMemo(() => last14.slice(-7).map(metaStress), [last14]);
  const energySpark  = useMemo(() => last14.slice(-7).map(metaEnergy), [last14]);
  const outdoorSpark = useMemo(() => last14.slice(-7).map((c) => c.outdoor_minutes), [last14]);

  // Wrap the return in useMemo so the object reference is stable across
  // renders. Without this, useMemo([m]) in the dashboard's metrics
  // array would still see a new `m` every render and recompute,
  // defeating the React.memo on MetricTile.
  return useMemo(
    () => ({
      loading,
      error,
      wellness,
      sleepAvg,
      stressAvg,
      moodAvg,
      energyAvg,
      focusAvg,
      socialAvg,
      outdoorAvg,
      workAvg,
      journalCompletion,
      sleepChange,
      stressChange,
      sleepSpark,
      stressSpark,
      energySpark,
      outdoorSpark,
      weeklyMoodSeries,
      lastCheckin,
      lastJournal,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      loading, error, wellness, sleepAvg, stressAvg, moodAvg, energyAvg,
      focusAvg, socialAvg, outdoorAvg, workAvg, journalCompletion,
      sleepChange, stressChange, sleepSpark, stressSpark, energySpark,
      outdoorSpark, weeklyMoodSeries, lastCheckin, lastJournal,
    ],
  );
}

function avg(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export { movingAverage };
