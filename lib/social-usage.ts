import type { SocialUsageDaily, SocialUsageEvent } from './types';
import { daysAgoISO } from './utils';

/**
 * Compute a daily rollup (seconds + sessions) from raw open/close events.
 * Events are paired by source+app in chronological order. A session is
 * bounded by an `open`/`foreground` event and the next `close`/`background`
 * event (or the report window end if still open).
 */
export function rollupUsage(
  events: SocialUsageEvent[],
  windowDays = 30,
): SocialUsageDaily[] {
  const startISO = daysAgoISO(windowDays - 1);
  const endISO = daysAgoISO(0);
  // Bucket events by (source, app) so open/close pairs don't cross sources.
  const buckets = new Map<string, SocialUsageEvent[]>();
  for (const e of events) {
    if (e.occurred_at.slice(0, 10) < startISO || e.occurred_at.slice(0, 10) > endISO) continue;
    const key = `${e.source}::${e.app}`;
    const list = buckets.get(key) ?? [];
    list.push(e);
    buckets.set(key, list);
  }

  type Accum = {
    user_id: string;
    date: string;
    app: SocialUsageEvent['app'];
    seconds: number;
    sessions: number;
    source_breakdown: Record<string, number>;
  };
  const byKey = new Map<string, Accum>();

  for (const [key, list] of buckets) {
    const sorted = list.slice().sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
    let openAt: string | null = null;
    for (const e of sorted) {
      if (e.event === 'open' || e.event === 'foreground') {
        if (!openAt) openAt = e.occurred_at;
      } else if (e.event === 'close' || e.event === 'background') {
        if (openAt) {
          const start = new Date(openAt).getTime();
          const end = new Date(e.occurred_at).getTime();
          const seconds = Math.max(0, Math.round((end - start) / 1000));
          if (seconds > 0) {
            const date = openAt.slice(0, 10);
            const rkey = `${date}::${e.app}`;
            const acc: Accum = byKey.get(rkey) ?? {
              user_id: e.user_id,
              date,
              app: e.app,
              seconds: 0,
              sessions: 0,
              source_breakdown: {},
            };
            acc.seconds += seconds;
            acc.sessions += 1;
            acc.source_breakdown[e.source] = (acc.source_breakdown[e.source] ?? 0) + seconds;
            byKey.set(rkey, acc);
          }
          openAt = null;
        }
      }
    }
  }

  return Array.from(byKey.values()).map((a) => ({
    id: `${a.user_id}-${a.date}-${a.app}`,
    user_id: a.user_id,
    date: a.date,
    app: a.app,
    seconds: a.seconds,
    sessions: a.sessions,
    source_breakdown: a.source_breakdown as SocialUsageDaily['source_breakdown'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
}

/**
 * Merge a batch of new events into the existing daily rollups by recomputing
 * just the affected (date, app) pairs.
 */
export function mergeRollups(
  existing: SocialUsageDaily[],
  events: SocialUsageEvent[],
): SocialUsageDaily[] {
  const fresh = rollupUsage(events, 365);
  const byKey = new Map<string, SocialUsageDaily>();
  for (const d of existing) byKey.set(`${d.date}::${d.app}`, d);
  for (const d of fresh) {
    const prev = byKey.get(`${d.date}::${d.app}`);
    if (!prev) {
      byKey.set(`${d.date}::${d.app}`, d);
      continue;
    }
    byKey.set(`${d.date}::${d.app}`, {
      ...prev,
      seconds: prev.seconds + d.seconds,
      sessions: prev.sessions + d.sessions,
      source_breakdown: mergeBreakdown(prev.source_breakdown, d.source_breakdown),
      updated_at: new Date().toISOString(),
    });
  }
  return Array.from(byKey.values());
}

function mergeBreakdown(
  a: Record<string, number>,
  b: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v;
  return out;
}
