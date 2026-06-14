/**
 * Nudge generation engine — produces contextual, data-grounded suggestions
 * based on the last 1-2 weeks of check-ins and journal activity.
 *
 * Each nudge is keyed to a specific metric threshold (e.g. sleep < 6.5h,
 * stress >= 6/10) and deduplicated by title+body so repeated scans don't
 * flood the notification bell with the same message.
 */

import type { DailyCheckin, JournalEntry, Notification } from './types';
import { todayISO, uid } from './utils';

/** A candidate nudge before it's persisted as a Notification row. */
export interface NudgeCandidate {
  kind: Notification['kind'];
  title: string;
  body: string;
  /** A stable key so we don't insert the same nudge twice on repeat loads. */
  dedupeKey: string;
}

/**
 * Look at the last few days of check-ins and journal entries and return a
 * small set of actionable, non-diagnostic nudges. The output is bounded
 * (max ~5) so the bell never becomes a wall of text.
 */
/**
 * Scan check-in and journal data for actionable patterns and return up to
 * 5 deduplicated nudge candidates.
 *
 * Checks: sleep short/good, stress high, mood low/high, energy low,
 * outdoor low, social low, work pressure high, journal gap, sleep trend.
 * Each nudge includes a short title and a 1-2 sentence body with specific
 * numbers from the user's data.
 */
export function generateNudges(
  checkins: DailyCheckin[],
  journals: JournalEntry[],
  existing: Notification[],
): NudgeCandidate[] {
  const out: NudgeCandidate[] = [];
  const existingKeys = new Set(existing.map((n) => `${n.title}|${n.body}`));

  const last7 = checkins.slice(-7);
  const last14 = checkins.slice(-14);
  const lastJournal = journals[0]?.created_at ?? null;

  const avg = (xs: number[]) =>
    xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

  const sleepAvg = avg(last7.map((c) => c.sleep_hours));
  const stressAvg = avg(last7.map((c) => c.stress));
  const moodAvg = avg(last7.map((c) => c.mood));
  const energyAvg = avg(last7.map((c) => c.energy));
  const outdoorAvg = avg(last7.map((c) => c.outdoor_minutes));
  const socialAvg = avg(last7.map((c) => c.social_connection));
  const workAvg = avg(last7.map((c) => c.work_pressure));

  const push = (n: NudgeCandidate) => {
    if (existingKeys.has(`${n.title}|${n.body}`)) return;
    out.push(n);
  };

  // Sleep
  if (last7.length >= 3 && sleepAvg > 0 && sleepAvg < 6.5) {
    push({
      kind: 'system',
      title: 'Sleep has been short',
      body: `You averaged ${sleepAvg.toFixed(1)}h this week. Try a 30-minute wind-down — dim lights, no phone, a slow exhale.`,
      dedupeKey: 'sleep-low',
    });
  } else if (last7.length >= 3 && sleepAvg >= 7.5) {
    push({
      kind: 'system',
      title: 'Sleep is holding steady',
      body: `${sleepAvg.toFixed(1)}h on average. Whatever your bedtime routine is, keep it.`,
      dedupeKey: 'sleep-good',
    });
  }

  // Stress
  if (last7.length >= 3 && stressAvg >= 6) {
    push({
      kind: 'system',
      title: 'Stress is running high',
      body: 'A 4-7-8 breathing cycle (inhale 4, hold 7, exhale 8) for two minutes can drop your heart rate visibly.',
      dedupeKey: 'stress-high',
    });
  }

  // Mood
  if (last7.length >= 3 && moodAvg > 0 && moodAvg < 4) {
    push({
      kind: 'system',
      title: 'A heavier week',
      body: 'Name one small thing that went right today. Naming it counts more than it sounds.',
      dedupeKey: 'mood-low',
    });
  } else if (last7.length >= 3 && moodAvg >= 7) {
    push({
      kind: 'system',
      title: 'Bright week so far',
      body: 'Capture the feeling in a short journal — future-you will be grateful for the timestamp.',
      dedupeKey: 'mood-high',
    });
  }

  // Energy
  if (last7.length >= 3 && energyAvg > 0 && energyAvg < 4) {
    push({
      kind: 'system',
      title: 'Energy is low',
      body: 'A 10-minute walk outside beats another coffee. Light + movement is the shortest reset.',
      dedupeKey: 'energy-low',
    });
  }

  // Outdoor
  if (last7.length >= 3 && outdoorAvg < 20) {
    push({
      kind: 'system',
      title: 'Get outside today',
      body: 'Your outdoor time averaged under 20 minutes this week. Even 15 minutes in daylight shifts your evening.',
      dedupeKey: 'outdoor-low',
    });
  }

  // Social
  if (last7.length >= 3 && socialAvg > 0 && socialAvg < 4) {
    push({
      kind: 'system',
      title: 'Reach out to one person',
      body: 'A short text to someone you trust is enough. Connection doesn\u2019t need to be a whole event.',
      dedupeKey: 'social-low',
    });
  }

  // Work pressure
  if (last7.length >= 3 && workAvg >= 7) {
    push({
      kind: 'system',
      title: 'Work pressure is heavy',
      body: 'Block a 15-minute break between meetings today. A pause protects the work, not the other way around.',
      dedupeKey: 'work-high',
    });
  }

  // Journal cadence
  if (lastJournal) {
    const daysSince = Math.floor(
      (new Date(todayISO()).getTime() - new Date(lastJournal).getTime()) / 86_400_000,
    );
    if (daysSince >= 3) {
      push({
        kind: 'system',
        title: 'The pages miss you',
        body: `It\u2019s been ${daysSince} days since your last entry. A 5-minute rant counts.`,
        dedupeKey: 'journal-gap',
      });
    }
  } else if (last7.length >= 2) {
    push({
      kind: 'system',
      title: 'Try a 5-minute rant',
      body: 'You\u2019ve checked in a few times. Try a quick journal entry — even a paragraph is enough.',
      dedupeKey: 'journal-first',
    });
  }

  // Sleep trend (week over week)
  if (last14.length >= 10) {
    const prev7 = last14.slice(0, Math.max(0, last14.length - 7));
    const cur7 = last14.slice(-7);
    const prevSleep = avg(prev7.map((c) => c.sleep_hours));
    const curSleep = avg(cur7.map((c) => c.sleep_hours));
    const delta = curSleep - prevSleep;
    if (delta <= -0.8) {
      push({
        kind: 'system',
        title: 'Sleep slipped this week',
        body: `Down ${Math.abs(delta).toFixed(1)}h vs last week. Tonight is a good night to be in bed 20 min earlier.`,
        dedupeKey: 'sleep-decline',
      });
    }
  }

  // Cap to 5 nudges
  return out.slice(0, 5);
}

/** Persist a batch of nudge candidates as Notification rows. */
export function nudgesToNotifications(cands: NudgeCandidate[], userId: string): Notification[] {
  const now = new Date().toISOString();
  return cands.map((c) => ({
    id: uid(),
    user_id: userId,
    kind: c.kind,
    title: c.title,
    body: c.body,
    read: false,
    scheduled_for: null,
    created_at: now,
  }));
}

/** Convenience for ad-hoc inline messages (e.g. "rant saved" toasts). */
export function makeSystemNotification(userId: string, title: string, body: string): Notification {
  return {
    id: uid(),
    user_id: userId,
    kind: 'system',
    title,
    body,
    read: false,
    scheduled_for: null,
    created_at: new Date().toISOString(),
  };
}
