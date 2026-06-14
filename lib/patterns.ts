/** File-level documentation header. */

import type { DailyCheckin, JournalEntry, PatternSnapshot, TrendSeries } from './types';
import { daysAgoISO, movingAverage, percentChange, todayISO } from './utils';

/** Input for pattern calculations — checkins plus optional journals for sentiment. */
export interface PatternInput {
  checkins: DailyCheckin[];
  journals?: JournalEntry[];
  windowDays?: number;
}

/**
 * Compute a snapshot of key pattern changes over the past ~30 days.
 *
 * Splits checkins into two 15-day windows (this month vs previous) and
 * computes percentage changes for sleep, stress, outdoor time, and social
 * connection. Also includes journal sentiment if journals are provided.
 *
 * @param checkins - Recent check-in rows (ideally 30 days).
 * @param journals - Recent journal entries for sentiment analysis.
 * @returns A PatternSnapshot with change percentages and averages.
 */
export function calculatePatternSnapshot({ checkins, journals = [] }: PatternInput): PatternSnapshot {
  const last = checkins.slice(-30);
  const thisMonth = last.slice(-15);
  const prevMonth = last.slice(0, Math.max(0, last.length - 15));

  const avg = (rows: DailyCheckin[], key: keyof DailyCheckin) => {
    if (rows.length === 0) return 0;
    const values = rows.map((r) => Number(r[key] ?? 0));
    return values.reduce((a, b) => a + b, 0) / values.length;
  };

  return {
    last_month_outdoor_average: avg(prevMonth, 'outdoor_minutes'),
    current_month_outdoor_average: avg(thisMonth, 'outdoor_minutes'),
    sleep_change_percentage: round1(percentChange(avg(thisMonth, 'sleep_hours'), avg(prevMonth, 'sleep_hours'))),
    stress_change_percentage: round1(percentChange(avg(thisMonth, 'stress'), avg(prevMonth, 'stress'))),
    journal_sentiment_average: journals.length > 0 ? calculateJournalSentiment(journals) : 0,
    social_change: round1(percentChange(avg(thisMonth, 'social_connection'), avg(prevMonth, 'social_connection'))),
  };
}

/**
 * Build a trend series for a given metric from check-in data.
 *
 * Generates N daily points (default 30), filling gaps with 0 values so
 * charts render continuous lines even on days with no check-in.
 * Computes baseline, moving average, and week-over-week + month-over-month
 * percentage changes.
 *
 * @param checkins - Daily check-in rows, ideally spanning the full window.
 * @param metric  - Which field to extract (sleep, stress, mood, etc.).
 * @param days    - How many days back to include (default 30).
 */
export function calculateSeries(checkins: DailyCheckin[], metric: TrendSeries['metric'], days = 30): TrendSeries {
  const from = daysAgoISO(days - 1);
  const to = todayISO();
  const map = new Map(checkins.filter((c) => c.date >= from && c.date <= to).map((c) => [c.date, c]));

  const points: { date: string; value: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = daysAgoISO(days - 1 - i);
    const c = map.get(d);
    let value = 0;
    switch (metric) {
      case 'sleep':   value = c?.sleep_hours ?? 0; break;
      case 'stress':  value = c?.interpretation_meta?.stress ?? c?.stress ?? 0; break;
      case 'mood':    value = c?.interpretation_meta?.mood ?? c?.mood ?? 0; break;
      case 'outdoor': value = c?.outdoor_minutes ?? 0; break;
      case 'social':  value = c?.interpretation_meta?.connection ?? c?.social_connection ?? 0; break;
      case 'energy':  value = c?.interpretation_meta?.energy ?? c?.energy ?? 0; break;
      case 'focus':   value = c?.interpretation_meta?.purpose ?? c?.focus ?? 0; break;
    }
    points.push({ date: d, value });
  }

  const values = points.map((p) => p.value);
  const baseline = movingAverage(values, Math.max(7, Math.floor(values.length / 2)));
  const ma = movingAverage(values, 7);
  const half = Math.max(1, Math.floor(values.length / 2));
  const last7 = values.slice(-half);
  const prev7 = values.slice(0, half);
  const weeklyChange = percentChange(avgN(last7), avgN(prev7));
  const monthlyChange = percentChange(values.slice(-7).reduce((a, b) => a + b, 0) / 7, baseline);

  return {
    metric,
    points,
    baseline: round1(baseline),
    movingAverage: round1(ma),
    weeklyChange: round1(weeklyChange),
    monthlyChange: round1(monthlyChange),
  };
}

/**
 * Compute a wellness score (0-100) from the last 7 days of check-ins.
 *
 * Weighted formula: sleep/rest (20%), mood (18%), stress inverted (18%),
 * energy (5%), social (14%), outdoor (15%), journal presence (10%).
 * Returns both the composite score and per-component breakdowns.
 *
 * Every component that has a corresponding AI-inferred score in
 * `interpretation_meta` uses it as the primary source, falling back to
 * the raw numeric field. This guarantees that the reflection, the wellness
 * compass, and the dashboard tiles all read from the same set of values.
 */
export function calculateWellnessScore(checkins: DailyCheckin[]): {
  score: number;
  components: { sleep: number; stress: number; mood: number; energy: number; social: number; outdoor: number; journal: number };
} {
  if (checkins.length === 0) {
    return { score: 0, components: { sleep: 0, stress: 0, mood: 0, energy: 0, social: 0, outdoor: 0, journal: 0 } };
  }
  const last = checkins.slice(-7);

  const avgOf = (accessor: (c: DailyCheckin) => number): number => {
    if (last.length === 0) return 0;
    return last.reduce((sum, c) => sum + accessor(c), 0) / last.length;
  };

  // Sleep/rest: prefer the AI-inferred rest score (1-10), fall back to raw sleep_hours (0-12)
  const sleep = clamp01(avgOf((c) => c.interpretation_meta?.rest ?? c.sleep_hours ?? 0) / 10);
  // Mood, social, stress, energy: all prefer interpretation_meta, fall back to raw fields
  const mood   = clamp01(avgOf((c) => c.interpretation_meta?.mood ?? c.mood ?? 0) / 10);
  const social = clamp01(avgOf((c) => c.interpretation_meta?.connection ?? c.social_connection ?? 0) / 10);
  const stress = clamp01(1 - avgOf((c) => c.interpretation_meta?.stress ?? c.stress ?? 0) / 10);
  const energy = clamp01(avgOf((c) => c.interpretation_meta?.energy ?? c.energy ?? 0) / 10);
  // Outdoor is always a raw number (not AI-inferred)
  const outdoor = clamp01(avgOf((c) => c.outdoor_minutes) / 60);
  // Journal component — enriched server-side from real journal activity.
  const journal = clamp01(last.some((c) => (c.notes?.length ?? 0) > 0) ? 0.8 : 0.4);

  const score = Math.round(100 * (
    0.20 * sleep + 0.18 * mood + 0.18 * stress + 0.05 * energy +
    0.14 * social + 0.15 * outdoor + 0.10 * journal
  ));
  return {
    score,
    components: {
      sleep: Math.round(sleep * 100),
      stress: Math.round(stress * 100),
      mood: Math.round(mood * 100),
      energy: Math.round(energy * 100),
      social: Math.round(social * 100),
      outdoor: Math.round(outdoor * 100),
      journal: Math.round(journal * 100),
    },
  };
}

/**
 * Rough sentiment analysis for journal entries using a small positive/negative
 * word lexicon. Returns -1 (very negative) through +1 (very positive).
 *
 * Scans the last 14 entries' title + body for keyword matches. If no
 * sentiment-carrying words are found, returns 0 (neutral).
 */
export function calculateJournalSentiment(journals: JournalEntry[]): number {
  if (journals.length === 0) return 0;
  const recent = journals.slice(0, 14);
  const positive = ['good', 'great', 'happy', 'calm', 'rest', 'energized', 'focused', 'grateful', 'walk', 'reset', 'peaceful', 'steady', 'sharp'];
  const negative = ['tired', 'stressed', 'anxious', 'overwhelm', 'drained', 'guilt', 'hard', 'wall', 'nerves', 'rough', 'difficult'];
  let pos = 0;
  let neg = 0;
  for (const j of recent) {
    const text = `${j.title ?? ''} ${j.body}`.toLowerCase();
    positive.forEach((w) => { if (text.includes(w)) pos += 1; });
    negative.forEach((w) => { if (text.includes(w)) neg += 1; });
  }
  const total = pos + neg;
  if (total === 0) return 0;
  return round1((pos - neg) / total);
}

function avgN(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function round1(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 10) / 10;
}
