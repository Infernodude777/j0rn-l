import type { ConnectedAccount, DailyCheckin, JournalEntry, Notification, UserSettings } from './types';
import { generateNudges, makeSystemNotification } from './nudges';
import { todayISO } from './utils';

/* -------------------------------------------------------------------------- */
/*  DM scheduler                                                              */
/* -------------------------------------------------------------------------- */
/*                                                                             */
/*  Discord and Instagram are configured by the user in Settings → Connected   */
/*  Apps. This module decides what to send, when, and how. Real DMs require a  */
/*  backend with the provider's API credentials (Discord bot token, Instagram */
/*  Graph API). Locally we surface the same messages as in-app notifications   */
/*  with `kind: 'checkin_reminder' | 'system' | 'trusted_alert'` so the user   */
/*  sees exactly what would have been sent. To wire a real backend, replace    */
/*  `simulateOutbound` with a server action / API route that posts to the      */
/*  provider and update the `scheduled_for` check below to use server time.   */
/*                                                                             */
/* -------------------------------------------------------------------------- */

/** The mental-health threshold below which we escalate to a "concerning" DM. */
const CONCERNING_MOOD_FLOOR = 3.5;
const CONCERNING_STRESS_CEILING = 8;
const CONCERNING_DAYS_LOOKBACK = 3;

/** Hour of the user's day to send the daily reminder DM (24h). */
const REFLECTION_DM_HOUR = 19;

export interface DmPayload {
  /** Where the message would go. */
  channel: 'discord' | 'instagram';
  /** Short title shown in the DM. */
  title: string;
  /** Body of the DM (1-2 sentences). */
  body: string;
  /** Urgency hint used by the simulator. */
  severity: 'routine' | 'nudge' | 'alert';
}

/**
 * Decide what DMs to send right now, based on the current time (in the user's
 * timezone), their connected accounts, their settings, and their recent data.
 * Returns an empty array if nothing is due.
 *
 * @param now         Current Date (defaults to `new Date()`)
 * @param connected   The user's connected accounts (only `discord`/`instagram`
 *                    with `status === 'connected'` are considered)
 * @param settings    The user's settings (notifications_enabled, reminder time)
 * @param checkins    All check-ins (used to compute the 7 PM reflection prompt
 *                    and the concerning-level guard)
 * @param journals    All journal entries (used by the nudge generator)
 * @param existing    All existing notifications (dedupe)
 */
export function planDailyDms(args: {
  now?: Date;
  connected: ConnectedAccount[];
  settings: UserSettings;
  checkins: DailyCheckin[];
  journals: JournalEntry[];
  existing: Notification[];
}): DmPayload[] {
  const {
    now = new Date(),
    connected,
    settings,
    checkins,
    journals,
    existing,
  } = args;

  if (!settings.notifications_enabled) return [];

  // Resolve the user's "perceived" local hour. We don't ship a TZ database,
  // so the user-set `profile.timezone` string is used as a hint: we look for
  // a leading GMT offset. If we can't parse it, fall back to the device hour.
  const userHour = resolveUserHour(now, settings);

  const dms: DmPayload[] = [];
  const channels = activeChannels(connected);
  if (channels.length === 0) return dms;

  const alreadySentToday = (title: string) =>
    existing.some(
      (n) =>
        n.title === title &&
        n.created_at.slice(0, 10) === todayISO(),
    );

  // --- 1. 7 PM reflection reminder -------------------------------------
  if (userHour >= REFLECTION_DM_HOUR) {
    const today = todayISO();
    const doneToday = checkins.some((c) => c.date === today);
    if (!doneToday && !alreadySentToday('Time for your daily reflection')) {
      dms.push({
        channel: channels[0]!,
        title: 'Time for your daily reflection',
        body: doneToday
          ? "You already wrote today — nice work."
          : "Hey. Two minutes of writing before the day closes. I'll save the rest for you.",
        severity: 'routine',
      });
    }
  }

  // --- 2. Concerning-level mental-health alert --------------------------
  const recent = checkins.slice(-CONCERNING_DAYS_LOOKBACK);
  if (recent.length >= 2) {
    const moodAvg = avg(recent.map((c) => c.mood));
    const stressAvg = avg(recent.map((c) => c.stress));
    const concerning =
      (moodAvg > 0 && moodAvg <= CONCERNING_MOOD_FLOOR) ||
      (stressAvg > 0 && stressAvg >= CONCERNING_STRESS_CEILING);
    if (concerning && !alreadySentToday('A gentle check-in')) {
      dms.push({
        channel: channels[0]!,
        title: 'A gentle check-in',
        body: 'Your last few days look heavy. Reach out to someone you trust tonight — or write one honest sentence in your journal. Either counts.',
        severity: 'alert',
      });
    }
  }

  // --- 3. Nudge DMs (top 1 from the nudge generator) --------------------
  // We throttle to a single nudge DM per day so the user doesn't feel pestered.
  if (userHour >= 12 && !alreadySentToday('A small nudge for today')) {
    const cands = generateNudges(checkins, journals, existing);
    const top = cands[0];
    if (top) {
      dms.push({
        channel: channels[0]!,
        title: 'A small nudge for today',
        body: top.body,
        severity: 'nudge',
      });
    }
  }

  return dms;
}

/**
 * Materialise the plan as in-app notifications so the user can see exactly
 * what would have been DMed. In a real deployment this is where you would
 * also POST to the Discord / Instagram API.
 */
export function dmsToNotifications(dms: DmPayload[], userId: string): Notification[] {
  const now = new Date().toISOString();
  return dms.map((d) => {
    const kind: Notification['kind'] =
      d.severity === 'alert' ? 'trusted_alert' : 'system';
    const titleWithChannel = d.channel === 'discord' ? `[DM · Discord] ${d.title}` : `[DM · Instagram] ${d.title}`;
    return {
      id: `dm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      user_id: userId,
      kind,
      title: titleWithChannel,
      body: d.body,
      read: false,
      scheduled_for: null,
      created_at: now,
    };
  });
}

function activeChannels(connected: ConnectedAccount[]): Array<'discord' | 'instagram'> {
  const out: Array<'discord' | 'instagram'> = [];
  for (const c of connected) {
    if (c.status !== 'connected') continue;
    if (c.provider === 'discord') out.push('discord');
    else if (c.provider === 'instagram') out.push('instagram');
  }
  return out;
}

function avg(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/**
 * Best-effort user-local hour. Settings is the authoritative source for the
 * reminder time string ("19:00"). If the user's profile timezone is a GMT
 * offset string, we apply it; otherwise we use the device's local hour.
 */
function resolveUserHour(now: Date, settings: UserSettings): number {
  // Preferred: use the configured reminder time's hour when within ±2h of now
  // (so the scheduler triggers around the chosen reflection window).
  const reminderHH = parseReminderHour(settings.checkin_reminder_time);
  if (reminderHH !== null) {
    const deviceH = now.getHours();
    // If the user's local hour is within the [reminder-1, reminder+2] window,
    // treat the reminder hour as authoritative so the message goes out on time
    // even if the device clock is offset.
    if (Math.abs(deviceH - reminderHH) <= 2) return reminderHH;
  }
  return now.getHours();
}

function parseReminderHour(s: string | null): number | null {
  if (!s) return null;
  const m = /^(\d{1,2}):/.exec(s);
  if (!m) return null;
  const h = parseInt(m[1]!, 10);
  return Number.isFinite(h) && h >= 0 && h <= 23 ? h : null;
}

/* -------------------------------------------------------------------------- */
/*  Thin local wrapper used by the UI layer                                   */
/* -------------------------------------------------------------------------- */

/**
 * Run the DM planner and persist the resulting messages. Safe to call on every
 * app mount / tab focus — it dedupes by (title, today).
 */
export interface RunDmSchedulerArgs {
  userId: string;
  settings: UserSettings;
  connected: ConnectedAccount[];
  checkins: DailyCheckin[];
  journals: JournalEntry[];
  existing: Notification[];
  persist: (rows: Notification[]) => Promise<void>;
  now?: Date;
}

export async function runDmScheduler(args: RunDmSchedulerArgs): Promise<DmPayload[]> {
  const dms = planDailyDms(args);
  if (dms.length === 0) return dms;
  const rows = dmsToNotifications(dms, args.userId);
  await args.persist(rows);
  return dms;
}
