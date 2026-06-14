'use client';

import { memo, useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useDashboardMetrics } from '@/hooks/use-trends';
import { useProfile } from '@/hooks/use-profile';
import { useTodaysCheckin } from '@/hooks/use-checkins';
import { useJournal } from '@/hooks/use-journal';
import { useConnected } from '@/hooks/use-connected';
import { useUser } from '@/hooks/use-user';
import { providerCatalog } from '@/lib/providers/catalog';
import { upsertCheckin } from '@/lib/db/api';
import { invalidateCache } from '@/lib/data-cache';
import { Card, CardBody } from '@/components/ui/card';
import { LineChart } from '@/components/charts/line-chart';
import { ErrorBanner } from '@/components/ui/loading';
import { Slider } from '@/components/ui/slider';
import { InkIcon, type InkIconName } from '@/components/ui/ink-icon';
import { Button } from '@/components/ui/button';
import { cn, formatGreeting, formatHours, formatMinutes, todayISO } from '@/lib/utils';
import type { DailyCheckin } from '@/lib/types';

/* -------------------------------------------------------------------------- */
/*  Hand-drawn styles                                                         */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*  Action of the Day card                                                    */
/* -------------------------------------------------------------------------- */

function ActionOfTheDayCard() {
  const [action, setAction] = useState<{ area: string; text: string; reason: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/action-plan', { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const cm = json?.plan?.countermeasures?.[0];
        if (cm && !cancelled) {
          setAction({ area: cm.area ?? '', text: cm.action ?? '', reason: cm.reason ?? '' });
        }
      } catch { /* silent — card just won't show */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading || !action) return null;

  const AREA_TINT: Record<string, { bg: string; border: string; ink: string }> = {
    sleep: { bg: '#E5DDC8', border: '#C4B896', ink: '#2C2C2C' },
    stress: { bg: '#F5E8E5', border: '#D8A8A6', ink: '#D4786E' },
    mood: { bg: '#C5D8C0', border: '#D8B080', ink: '#5A4620' },
    energy: { bg: '#F8F2E0', border: '#E0D5BA', ink: '#5A4620' },
    connection: { bg: '#E5EDE2', border: '#A8C8A8', ink: '#3A6470' },
    outdoor: { bg: '#E5EDE2', border: '#B0C8D8', ink: '#3A6470' },
    work: { bg: '#D8E8D0', border: '#B8BCC8', ink: '#3A3464' },
    maintenance: { bg: '#E5EDE2', border: '#A8C8A8', ink: '#3A6470' },
  };

  const tint = AREA_TINT[action.area] ?? AREA_TINT.maintenance!;

  return (
    <Link href="/action-plan" className="block">
      <article
        className="paper-card p-lg flex items-center gap-md hover-wobble transition-shadow group"
        style={{ borderColor: tint.border }}
      >
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: tint.bg }}
        >
          <InkIcon name="compass" size={20} style={{ color: tint.ink }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-label-sm uppercase tracking-[0.2em] text-[#8C8878] text-[10px]">
            Action of the day · {action.area}
          </p>
          <p className="font-body-md text-[#2C2C2C] leading-relaxed mt-1">{action.text}</p>
          <p className="font-hand text-[14px] text-[#5C5850] italic mt-1">{action.reason}</p>
        </div>
        <InkIcon name="arrow-right" size={16} className="text-[#8C8878] group-hover:text-[#C5D8C0] transition-colors shrink-0" />
      </article>
    </Link>
  );
}

const METRIC_TINT: Record<MetricKey, { bg: string; border: string; ink: string; }> = {
  mood:    { bg: '#F5E8E5', border: '#D8A8A6', ink: '#D4786E' },
  sleep:   { bg: '#F0E5D5', border: '#E0D5BA', ink: '#2C2C2C' },
  stress:  { bg: '#C5D8C0', border: '#D8B080', ink: '#2C2C2C' },
  energy:  { bg: '#F8F2E0', border: '#E0D5BA', ink: '#5A4620' },
  outdoor: { bg: '#E5DDC8', border: '#C4B896', ink: '#2C2C2C' },
  journal: { bg: '#F2E5D0', border: '#C8B890', ink: '#2C2C2C' },
  social:  { bg: '#EDDCC8', border: '#D0C5AA', ink: '#2C2C2C' },
  focus:   { bg: '#D8E8D0', border: '#B8BCC8', ink: '#3A3464' },
  work:    { bg: '#D8E8D0', border: '#B8BCC8', ink: '#3A3464' },
};

type MetricKey = 'mood' | 'sleep' | 'stress' | 'energy' | 'outdoor' | 'journal' | 'social' | 'focus' | 'work';

interface MetricView {
  key: MetricKey;
  label: string;
  value: string;
  note: string;
  icon: InkIconName;
  /** Number of filled bars in the 5-bar progress strip (0..5). */
  bars: number;
  /** Optional sparkline path. */
  spark?: number[];
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function DashboardPage() {
  const { user } = useUser();
  const { profile } = useProfile();
  const m = useDashboardMetrics();
  const { checkin, refresh: refreshCheckin } = useTodaysCheckin();

  // Memoize the metrics array so React.memo on MetricTile actually saves work
  // (the previous inline construction created a new object on every render).
  // Must be called unconditionally — placed before the early return below.
  const metrics: MetricView[] = useMemo(
    () => [
      { key: 'mood',    label: 'Mood',    value: `${Math.round(m.moodAvg)}/10`, note: m.moodAvg >= 7 ? 'Bright skies.' : m.moodAvg >= 5 ? 'Steady.' : 'Cloudy.',                        icon: 'sparkle', bars: barsFor(m.moodAvg, 1, 10), spark: m.weeklyMoodSeries.map(p => p.value) },
      { key: 'sleep',   label: 'Rest',    value: restLabel(m.sleepAvg),            note: restNote(m.sleepAvg),                                                             icon: 'moon',    bars: barsFor(m.sleepAvg, 1, 10), spark: m.sleepSpark },
      { key: 'stress',  label: 'Stress',  value: stressLabel(m.stressAvg),         note: stressNote(m.stressAvg),                                                           icon: 'cloud',   bars: barsFor(m.stressAvg, 1, 10, true), spark: m.stressSpark },
      { key: 'energy',  label: 'Energy',  value: energyLabel(m.energyAvg),         note: energyNote(m.energyAvg),                                                           icon: 'bolt',    bars: barsFor(m.energyAvg, 1, 10), spark: m.energySpark },
      { key: 'outdoor', label: 'Outdoor', value: formatMinutes(m.outdoorAvg),      note: m.outdoorAvg >= 30 ? 'Among the trees.' : 'Try a walk.',                             icon: 'tree',    bars: barsFor(m.outdoorAvg, 0, 60) },
      { key: 'journal', label: 'Journal', value: `${Math.round((m.journalCompletion / 100) * 7)}/7`,  note: m.journalCompletion >= 70 ? 'Chapter finished.' : 'Open a page.',     icon: 'book',    bars: barsFor(m.journalCompletion, 0, 100) },
      { key: 'social',  label: 'Social',  value: connectionLabel(m.socialAvg),     note: connectionNote(m.socialAvg),                                                        icon: 'people',  bars: barsFor(m.socialAvg, 1, 10) },
    ],
    [m],
  );

  // Render immediately — don't block on loading. The dashboard uses safe
  // fallback values (empty arrays, '—' for missing metrics, 'Traveler' for
  // missing name) so the skeleton paints instantly and fills in as data
  // arrives (typically < 50ms in local mode, < 500ms with Supabase).
  const greeting = formatGreeting();
  const firstName = profile?.name?.split(' ')[0] ?? 'Traveler';
  const hasCheckinToday = !!checkin;
  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const dateISO = new Date().toISOString().slice(0, 10);

  const whisperText = whisperFor(m);

  return (
    <div className="space-y-lg md:space-y-xl pt-md md:pt-lg pb-md">
      {m.error && <ErrorBanner message={m.error} onRetry={() => location.reload()} />}

      {/* HERO ROW =========================================================== */}
      <header className="grid grid-cols-1 md:grid-cols-[1fr_auto] items-end gap-md">
        <div className="space-y-sm">
          <span
            className="inline-flex items-center px-md py-1 rounded-full text-[12px] tracking-[0.2em] uppercase border border-[#D0C5AA] bg-[#C5D8C0]/70 text-[#5C5850]"
            style={{ fontFamily: 'var(--font-nanum), Nanum Gothic, sans-serif', fontWeight: 700 }}
          >
            Today is Yours
          </span>
          <h1
            className="text-[36px] md:text-[44px] leading-[1.05] text-[#2C2C2C]"
            style={{ fontFamily: 'var(--font-changa-one), Changa One, serif' }}
          >
            {greeting}, <span className="text-[#C5D8C0]">{firstName}</span>
          </h1>
          <p className="font-hand text-[20px] text-[#5C5850] max-w-md italic">
            “The pages are blank, waiting for the ink of your experiences to bloom.”
          </p>
        </div>
        <WellnessBadge score={m.wellness.score} dateISO={dateISO} />
      </header>

      {/* TODAY'S METRICS — quick-edit all check-in fields ================== */}
      <TodayMetricsEditor
        checkin={checkin}
        userId={user?.id ?? ''}
        onSaved={() => refreshCheckin()}
      />

      {/* METRIC GRID ======================================================= */}
      <section className="grid grid-cols-2 md:grid-cols-3 gap-md">
        {metrics.map((it) => (
          <MetricTile key={it.key} metric={it} />
        ))}
      </section>

      {/* NARRATIVE + WHISPERS ============================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-md">
        <DailyNarrativeCard
          points={m.weeklyMoodSeries}
          lastCheckin={m.lastCheckin}
          lastJournal={m.lastJournal}
        />
        <WhispersCard text={whisperText} />
      </section>

      {/* INSIGHT ENGINE ==================================================== */}
      <InsightEngineCard
        hasCheckinToday={hasCheckinToday}
        firstName={firstName}
        score={m.wellness.score}
        dateLabel={dateLabel}
      />

      {/* ACTION OF THE DAY ================================================ */}
      <ActionOfTheDayCard />

      {/* DAILY RANT + YOUR DAY ============================================ */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-md">
        <DailyRantCard />
        <YourDayCard />
      </section>

      {/* CTA =============================================================== */}
      <Link
        href="/checkin"
        className="paper-card-ink flex items-center justify-center gap-md h-14 text-[16px] tracking-wide hover:opacity-95 active:scale-[0.99] transition-transform"
        style={{ fontFamily: 'var(--font-lexend), Lexend, sans-serif' }}
      >
        <InkIcon name="feather" size={20} className="text-[#F5DEB3]" />
        <span style={{ color: '#F5DEB3', fontWeight: 700 }}>
          {hasCheckinToday ? "Update today's reflection" : 'Write today’s reflection'}
        </span>
      </Link>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Wellness compass (top-right badge)                                        */
/* -------------------------------------------------------------------------- */

function WellnessBadge({ score, dateISO }: { score: number; dateISO: string }) {
  const label = score >= 75 ? 'Flourishing' : score >= 55 ? 'Steady' : 'Tender';
  return (
    <div className="paper-card-warm relative px-md py-md flex items-center gap-md min-w-[180px]">
      <div className="relative w-14 h-14 shrink-0 compass-pulse">
        <svg viewBox="0 0 56 56" className="w-full h-full text-[#C5D8C0]" fill="none">
          <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 4" opacity="0.5" />
          <path d="M28 6 L31 22 L47 25 L31 28 L28 44 L25 28 L9 25 L25 22 Z" fill="currentColor" />
          <path d="M28 6 L31 22 L47 25 L31 28 L28 44" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="28" cy="28" r="2" fill="#2C2C2C" />
        </svg>
      </div>
      <div className="min-w-0">
        <p className="font-label-sm uppercase tracking-[0.2em] text-[#8C8878] text-[10px]">Wellness</p>
        <p
          className="text-[24px] leading-none text-[#2C2C2C]"
          style={{ fontFamily: 'var(--font-changa-one), Changa One, serif' }}
        >
          {Math.round(score)}
        </p>
        <p className="font-hand text-[15px] text-[#5C5850]">{label} · {dateISO.slice(5)}</p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Metric tile                                                                */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*  Daily Rant card                                                          */
/* -------------------------------------------------------------------------- */

function DailyRantCard() {
  const { data, loading } = useJournal();
  const todayRant = (data ?? []).find(
    (j) => j.created_at.slice(0, 10) === todayISO() && (j.tags ?? []).includes('rant'),
  );
  if (loading) {
    return (
      <div className="paper-card p-lg min-h-[160px] flex items-center justify-center">
        <p className="font-label-sm text-[#8C8878]">Loading…</p>
      </div>
    );
  }
  return (
    <div className="paper-card p-lg flex flex-col gap-md min-h-[160px]">
      <div className="flex items-start justify-between gap-md">
        <div>
          <p className="font-label-sm uppercase tracking-[0.2em] text-[#8C8878]">Daily Rant</p>
          <h3
            className="text-[24px] leading-tight text-[#2C2C2C] mt-1"
            style={{ fontFamily: 'var(--font-changa-one), Changa One, serif' }}
          >
            {todayRant ? 'Today\u2019s rant is in.' : 'A 5-minute practice.'}
          </h3>
        </div>
        <div
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center shrink-0',
            todayRant ? 'bg-[#E5EDE2] border border-[#9CAF92]' : 'bg-[#C5D8C0] border border-[#D0C5AA]',
          )}
        >
          <InkIcon
            name={todayRant ? 'check-double' : 'edit'}
            size={22}
            className={todayRant ? 'text-[#3A6470]' : 'text-[#C5D8C0]'}
          />
        </div>
      </div>
      <p className="font-hand text-[18px] text-[#5C5850] italic leading-snug">
        {todayRant
          ? 'A few words on the page. Tomorrow the page is blank again.'
          : 'Big or small, write it for 5 minutes. The page is listening.'}
      </p>
      {todayRant ? (
        <Link
          href={`/journal/${todayRant.id}`}
          className="self-start inline-flex items-center gap-1 px-md py-1 rounded-full border border-[#D0C5AA] font-label-sm text-[#5C5850] hover:bg-[#C5D8C0] transition-colors"
        >
          Read today\u2019s entry
          <InkIcon name="arrow-right" size={14} />
        </Link>
      ) : (
        <Link href="/journal/rant" className="self-start">
          <Button variant="primary" size="sm" leftIcon={<InkIcon name="edit" size={16} />}>
            Start a 5-minute rant
          </Button>
        </Link>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Your Day card (connectors + what J0rn@l knows)                            */
/* -------------------------------------------------------------------------- */

function YourDayCard() {
  // Use the shared useConnected hook so the connect-apps page and this
  // card share a single localStorage read (and the cache handles the
  // dedupe). Nudge generation is owned by NotificationsBell so there's a
  // single source of truth for notification state.
  const { data: connected } = useConnected();
  const activeProviders = useMemo(
    () => connected.filter((r) => r.status === 'connected').map((r) => r.provider),
    [connected],
  );

  const known = activeProviders.length;
  const total = providerCatalog.length;
  const pct = total > 0 ? Math.round((known / total) * 100) : 0;

  return (
    <div className="paper-card p-lg flex flex-col gap-md min-h-[160px]">
      <div className="flex items-start justify-between gap-md">
        <div>
          <p className="font-label-sm uppercase tracking-[0.2em] text-[#8C8878]">Your Day</p>
          <h3
            className="text-[24px] leading-tight text-[#2C2C2C] mt-1"
            style={{ fontFamily: 'var(--font-changa-one), Changa One, serif' }}
          >
            {known === 0
              ? 'Teach J0rn@l about your day.'
              : `J0rn@l knows ${known} of your ${total} sources.`}
          </h3>
        </div>
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-[#C5D8C0] border border-[#D0C5AA]"
          aria-hidden
        >
          <InkIcon name="link" size={22} className="text-[#C5D8C0]" />
        </div>
      </div>
      <div className="flex items-center gap-sm">
        <div className="flex-1 h-1.5 rounded-full bg-[#C5D8C0] overflow-hidden">
          <div className="h-full rounded-full bg-[#C5D8C0] transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="font-label-sm text-[#5C5850] shrink-0">{pct}%</p>
      </div>
      <p className="font-hand text-[16px] text-[#5C5850] italic leading-snug">
        {known === 0
          ? 'Connect your calendar, screen time, and music. The more J0rn@l sees, the more it can help.'
          : 'The more you connect, the sharper the nudges. Add another source when you have a moment.'}
      </p>
      <Link
        href="/connect-apps"
        className="self-start inline-flex items-center gap-1 px-md py-1 rounded-full border border-[#D0C5AA] font-label-sm text-[#5C5850] hover:bg-[#C5D8C0] transition-colors"
      >
        {known === 0 ? 'Connect a source' : 'Manage connections'}
        <InkIcon name="arrow-right" size={14} />
      </Link>
    </div>
  );
}

const MetricTile = memo(function MetricTile({ metric }: { metric: MetricView }) {
  const tint = METRIC_TINT[metric.key];
  return (
    <div
      className="relative paper-card p-md flex flex-col gap-sm min-h-[130px] hover-wobble"
      style={{ borderColor: tint.border }}
    >
      <div className="flex items-start justify-between">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ backgroundColor: tint.bg, color: tint.ink }}
          aria-hidden
        >
          <InkIcon name={metric.icon} size={20} />
        </div>
        <p
          className="text-[13px] text-[#5C5850] tracking-wide"
          style={{ fontFamily: 'var(--font-nanum), Nanum Gothic, sans-serif' }}
        >
          {metric.label}
        </p>
      </div>
      <div>
        <p
          className="text-[24px] leading-none text-[#2C2C2C]"
          style={{ fontFamily: 'var(--font-changa-one), Changa One, serif' }}
        >
          {metric.value}
        </p>
        <p className="font-hand text-[15px] text-[#5C5850] mt-1 italic">{metric.note}</p>
      </div>
      <BarStrip filled={metric.bars} />
      {metric.spark && metric.spark.length > 1 && (
        <SparkCurve values={metric.spark} stroke={tint.ink} />
      )}
    </div>
  );
});

function BarStrip({ filled }: { filled: number }) {
  const total = 5;
  const f = Math.max(0, Math.min(total, Math.round(filled)));
  return (
    <div className="flex gap-[3px] mt-1">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className="h-[5px] flex-1 rounded-full"
          style={{ backgroundColor: i < f ? '#C5D8C0' : '#E0D5BA' }}
        />
      ))}
    </div>
  );
}

function SparkCurve({ values, stroke }: { values: number[]; stroke: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const width = 100;
  const height = 18;
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * height;
    return [x, y] as const;
  });
  // smooth bezier
  const segs: string[] = [];
  points.forEach(([x, y], i) => {
    if (i === 0) { segs.push(`M ${x} ${y}`); return; }
    const [px, py] = points[i - 1]!;
    const cx1 = (px + x) / 2;
    const cy1 = py;
    const cx2 = (px + x) / 2;
    const cy2 = y;
    segs.push(`C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x} ${y}`);
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      <path d={segs.join(' ')} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Daily narrative chart                                                     */
/* -------------------------------------------------------------------------- */

function DailyNarrativeCard({
  points,
  lastCheckin,
  lastJournal,
}: {
  points: { date: string; value: number }[];
  lastCheckin: { date: string; interpretation: string | null; responses?: Record<string, string> } | null;
  lastJournal: { body: string; title: string | null; created_at: string } | null;
}) {
  const xLabels = points.map((p) => new Date(p.date).toLocaleDateString('en-US', { weekday: 'short' }));
  const values = points.map((p) => p.value);
  const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const peak = values.length > 0 ? Math.max(...values) : 0;
  const trough = values.length > 0 ? Math.min(...values) : 0;
  const trend = values.length >= 2 ? values[values.length - 1]! - values[0]! : 0;

  // Build a multi-source descriptive paragraph from check-ins, journal, and AI.
  const summary = buildDescriptiveNarrative({
    points: values,
    peak, trough, trend,
    lastCheckin, lastJournal,
  });

  return (
    <article className="paper-card p-lg relative">
      <div className="flex items-start justify-between gap-md mb-sm">
        <div>
          <p
            className="text-[24px] leading-tight text-[#2C2C2C]"
            style={{ fontFamily: 'var(--font-changa-one), Changa One, serif' }}
          >
            Daily Narrative
          </p>
          <p className="font-hand text-[16px] text-[#5C5850] italic mt-1">{summary}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-[#D0C5AA] text-[11px] text-[#5C5850]"
            style={{ fontFamily: 'var(--font-nanum), Nanum Gothic, sans-serif' }}
          >
            {points.length}-day mood
          </span>
        </div>
      </div>
      <div className="mt-md">
        {points.length > 0 ? (
          <>
            <LineChart points={points} height={180} stroke="#C5D8C0" xAxisLabels={xLabels} />
            <div className="grid grid-cols-3 gap-md mt-md pt-md border-t border-[#E0D5BA]/60">
              <NarrativeStat label="Peak"   value={`${peak.toFixed(1)}/10`}   tone="up" />
              <NarrativeStat label="Trough" value={`${trough.toFixed(1)}/10`} tone="down" />
              <NarrativeStat label="Avg"    value={`${avg.toFixed(1)}/10`}    tone="neutral" />
            </div>
            {lastCheckin?.interpretation && (
              <p className="mt-md pt-md border-t border-[#E0D5BA]/60 font-body-md text-[#2C2C2C] leading-relaxed">
                <span
                  className="inline-block text-[12px] tracking-[0.2em] uppercase text-[#8C8878] mr-2 align-middle"
                  style={{ fontFamily: 'var(--font-nanum), Nanum Gothic, sans-serif', fontWeight: 700 }}
                >
                  From your last reflection
                </span>
                {lastCheckin.interpretation}
              </p>
            )}
            {lastJournal && (
              <p className="mt-sm font-hand text-[15px] text-[#5C5850] italic">
                <span className="not-italic mr-2">📓</span>
                {lastJournal.title ? <em className="font-semibold">&ldquo;{lastJournal.title}&rdquo; — </em> : null}
                {lastJournal.body.slice(0, 160)}{lastJournal.body.length > 160 ? '…' : ''}
              </p>
            )}
          </>
        ) : (
          <p className="font-body-md text-[#5C5850] text-center py-xl italic">
            The pages are still waiting. Complete a check-in or write a journal entry to see your daily narrative unfold.
          </p>
        )}
      </div>
    </article>
  );
}

function NarrativeStat({ label, value, tone }: { label: string; value: string; tone: 'up' | 'down' | 'neutral' }) {
  const color = tone === 'up' ? '#3A6470' : tone === 'down' ? '#D4786E' : '#2C2C2C';
  return (
    <div>
      <p
        className="text-[10px] tracking-[0.2em] uppercase text-[#8C8878]"
        style={{ fontFamily: 'var(--font-nanum), Nanum Gothic, sans-serif', fontWeight: 700 }}
      >
        {label}
      </p>
      <p
        className="text-[18px] mt-0.5"
        style={{ fontFamily: 'var(--font-changa-one), Changa One, serif', color }}
      >
        {value}
      </p>
    </div>
  );
}

function buildDescriptiveNarrative(args: {
  points: number[];
  peak: number;
  trough: number;
  trend: number;
  lastCheckin: { date: string; interpretation: string | null } | null;
  lastJournal: { body: string; created_at: string } | null;
}): string {
  const { points, peak, trough, trend, lastCheckin, lastJournal } = args;
  if (points.length === 0) {
    return 'No data yet. Your first check-in will plant the seed.';
  }
  const segments: string[] = [];
  const avg = points.reduce((a, b) => a + b, 0) / points.length;
  if (avg >= 7) segments.push('A bright stretch of days');
  else if (avg >= 5) segments.push('A steady stretch of days');
  else segments.push('A tender stretch of days');
  if (trend >= 1.5) segments.push('lifting toward the end');
  else if (trend <= -1.5) segments.push('cooling toward the end');
  else segments.push('holding its shape');
  const range = peak - trough;
  if (range >= 4) segments.push(`with a wide range from ${trough.toFixed(1)} to ${peak.toFixed(1)}`);
  else if (range <= 1) segments.push('in a narrow, even band');
  if (lastCheckin?.interpretation) segments.push('your last reflection echoed this');
  if (lastJournal) {
    const days = Math.floor((Date.now() - new Date(lastJournal.created_at).getTime()) / 86_400_000);
    if (days <= 1) segments.push('and your latest journal entry sits close to the same mood');
  }
  return segments.join(', ') + '.';
}

/* -------------------------------------------------------------------------- */
/*  Whispers of Wisdom                                                         */
/* -------------------------------------------------------------------------- */

function WhispersCard({ text }: { text: string }) {
  return (
    <article className="paper-card-warm p-lg relative flex flex-col gap-md min-h-[200px]">
      <div className="absolute -top-3 right-4">
        <InkIcon name="feather" size={28} className="text-[#C5D8C0]" />
      </div>
      <p
        className="text-[24px] leading-tight text-[#2C2C2C]"
        style={{ fontFamily: 'var(--font-changa-one), Changa One, serif' }}
      >
        Whispers of Wisdom
      </p>
      <p className="font-hand text-[20px] text-[#5C5850] leading-snug italic flex-1">
        {text}
      </p>
      <p className="text-[12px] text-[#8C8878] italic">
        Drawn from your own pages.
      </p>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/*  Insight Engine                                                             */
/* -------------------------------------------------------------------------- */

function InsightEngineCard({
  hasCheckinToday,
  firstName,
  score,
  dateLabel,
}: {
  hasCheckinToday: boolean;
  firstName: string;
  score: number;
  dateLabel: string;
}) {
  return (
    <article className="paper-card p-lg flex items-center gap-md relative">
      <div className="w-12 h-12 rounded-full bg-[#E5DDC8] flex items-center justify-center shrink-0 border border-[#C4B896]">
        <InkIcon name="sparkle" size={22} className="text-[#C5D8C0]" />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="text-[20px] leading-tight text-[#2C2C2C]"
          style={{ fontFamily: 'var(--font-changa-one), Changa One, serif' }}
        >
          Insight Engine
        </p>
        <p className="font-hand text-[16px] text-[#5C5850] italic">
          {hasCheckinToday
            ? `Reading today’s reflection, ${firstName}…`
            : `Today, ${dateLabel.toLowerCase()}, is a fresh page.`}
        </p>
        <p className="text-[12px] text-[#8C8878] mt-1">
          Wellness score {Math.round(score)} · {hasCheckinToday ? 'check-in done' : 'awaiting your words'}
        </p>
      </div>
      <Link
        href="/insights"
        className="shrink-0 inline-flex items-center gap-1 px-md py-1 rounded-full border border-[#D0C5AA] text-[#2C2C2C] hover:bg-[#C5D8C0]/70 text-[13px]"
        style={{ fontFamily: 'var(--font-nanum), Nanum Gothic, sans-serif' }}
      >
        See all
        <InkIcon name="arrow-right" size={14} />
      </Link>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/*  Today's Metrics Editor                                                    */
/* -------------------------------------------------------------------------- */

const METRICS_CONFIG = [
  { key: 'mood' as const,               label: 'Mood',    icon: 'sparkle' as InkIconName, min: 1, max: 10, step: 1,   fmt: (v: number) => `${v}/10` },
  { key: 'stress' as const,             label: 'Stress',  icon: 'cloud' as InkIconName,   min: 1, max: 10, step: 1,   fmt: (v: number) => `${v}/10` },
  { key: 'energy' as const,             label: 'Energy',  icon: 'bolt' as InkIconName,    min: 1, max: 10, step: 1,   fmt: (v: number) => `${v}/10` },
  { key: 'focus' as const,              label: 'Focus',   icon: 'book' as InkIconName,    min: 1, max: 10, step: 1,   fmt: (v: number) => `${v}/10` },
  { key: 'social_connection' as const,  label: 'Social',  icon: 'people' as InkIconName,  min: 1, max: 10, step: 1,   fmt: (v: number) => `${v}/10` },
  { key: 'sleep_hours' as const,        label: 'Sleep',   icon: 'moon' as InkIconName,    min: 0, max: 24, step: 0.5, fmt: (v: number) => `${v}h` },
  { key: 'outdoor_minutes' as const,    label: 'Outdoor', icon: 'tree' as InkIconName,    min: 0, max: 480, step: 5,  fmt: (v: number) => `${v}m` },
] as const;

function TodayMetricsEditor({
  checkin,
  userId,
  onSaved,
}: {
  checkin: DailyCheckin | null;
  userId: string;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, startSaving] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  const [form, setForm] = useState({
    mood: 5,
    stress: 5,
    energy: 5,
    focus: 5,
    social_connection: 5,
    sleep_hours: 7.5,
    outdoor_minutes: 30,
  });

  useEffect(() => {
    if (!editing && checkin) {
      setForm({
        mood: checkin.mood ?? 5,
        stress: checkin.stress ?? 5,
        energy: checkin.energy ?? 5,
        focus: checkin.focus ?? 5,
        social_connection: checkin.social_connection ?? 5,
        sleep_hours: checkin.sleep_hours ?? 7.5,
        outdoor_minutes: checkin.outdoor_minutes ?? 30,
      });
    }
  }, [checkin, editing]);

  const handleSave = useCallback(() => {
    if (!userId || !checkin) return;
    setSaveError(null);
    startSaving(async () => {
      try {
        await upsertCheckin({
          ...checkin,
          mood: form.mood,
          stress: form.stress,
          energy: form.energy,
          focus: form.focus,
          social_connection: form.social_connection,
          sleep_hours: form.sleep_hours,
          outdoor_minutes: form.outdoor_minutes,
        });
        invalidateCache('checkins:', { prefix: true });
        onSaved();
        setEditing(false);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Could not save');
      }
    });
  }, [userId, checkin, form, onSaved, startSaving]);

  if (!checkin) {
    return (
      <article className="paper-card p-lg flex flex-col items-center justify-center gap-md min-h-[160px]">
        <p className="font-hand text-[18px] text-[#5C5850] italic">Complete today's check-in first</p>
        <Link href="/checkin">
          <Button variant="primary" size="sm" leftIcon={<InkIcon name="feather" size={16} />}>
            Go to Check-in
          </Button>
        </Link>
      </article>
    );
  }

  return (
    <article className="paper-card p-lg">
      <div className="flex items-start justify-between gap-md mb-md">
        <div>
          <p className="font-label-sm uppercase tracking-[0.2em] text-[#8C8878]">Today's Metrics</p>
          <h3
            className="text-[22px] leading-tight text-[#2C2C2C] mt-1"
            style={{ fontFamily: 'var(--font-changa-one), Changa One, serif' }}
          >
            Quick Adjust
          </h3>
          <p className="font-hand text-[14px] text-[#5C5850] italic mt-1">
            Tweak today's levels right from here.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setEditing(!editing); setSaveError(null); }}
          className="shrink-0 inline-flex items-center gap-1 px-sm py-1 rounded-full border border-[#D0C5AA] font-label-sm uppercase tracking-wider text-[#5C5850] hover:bg-[#C5D8C0] transition-colors"
        >
          <InkIcon name={editing ? 'close' : 'edit'} size={14} />
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {editing ? (
        <div className="flex flex-col gap-md lg:grid lg:grid-cols-2 lg:gap-lg">
          {METRICS_CONFIG.map((conf) => {
            const val = form[conf.key];
            return (
              <div key={conf.key} className="flex flex-col gap-1">
                <span className="font-label-sm uppercase tracking-wider text-[#5C5850] text-[11px] flex items-center gap-1">
                  <InkIcon name={conf.icon} size={12} className="text-[#8C8878]" />
                  {conf.label}
                </span>
                <Slider
                  value={val}
                  onChange={(v) => setForm((f) => ({ ...f, [conf.key]: v }))}
                  min={conf.min}
                  max={conf.max}
                  step={conf.step}
                  ariaLabel={conf.label}
                  rightLabel={<span className="font-body-md text-[#2C2C2C] font-semibold">{conf.fmt(val)}</span>}
                />
              </div>
            );
          })}

          <div className="pt-sm lg:col-span-2 flex flex-col items-end gap-sm mt-md border-t border-[#E0D5BA]/50 pt-md">
            {saveError && <ErrorBanner message={saveError} />}
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              loading={saving}
              className="w-full sm:w-auto"
            >
              Save Metrics
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
          {METRICS_CONFIG.map((conf) => {
            const tintKey = (
              conf.key === 'social_connection' ? 'social' :
              conf.key === 'sleep_hours' ? 'sleep' :
              conf.key === 'outdoor_minutes' ? 'outdoor' :
              conf.key
            ) as MetricKey;
            const tint = METRIC_TINT[tintKey] ?? METRIC_TINT.sleep!;
            const checkinVal = checkin[conf.key as keyof DailyCheckin] as number | undefined;

            return (
              <div key={conf.key} className="flex items-center gap-sm">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: tint.bg, border: `1px solid ${tint.border}` }}
                >
                  <InkIcon name={conf.icon} size={20} style={{ color: tint.ink }} />
                </div>
                <div>
                  <p className="font-label-sm text-[#8C8878] text-[10px] uppercase tracking-wider">{conf.label}</p>
                  <p
                    className="text-[20px] text-[#2C2C2C]"
                    style={{ fontFamily: 'var(--font-changa-one), Changa One, serif' }}
                  >
                    {checkinVal != null ? conf.fmt(checkinVal) : '\u2014'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function barsFor(value: number, min: number, max: number, reverse = false): number {
  if (!Number.isFinite(value) || max <= min) return 0;
  const t = (value - min) / (max - min);
  const norm = reverse ? 1 - t : t;
  return Math.max(0, Math.min(5, Math.round(norm * 5)));
}

function stressLabel(v: number) {
  if (v === 0) return '—';
  if (v <= 4) return 'Low';
  if (v <= 6.5) return 'Steady';
  return 'High';
}
function stressNote(v: number) {
  if (v === 0) return 'No data yet.';
  if (v <= 4) return 'Calm skies ahead.';
  if (v <= 6.5) return 'A little wind.';
  return 'Rough weather.';
}
function energyLabel(v: number) {
  if (v === 0) return '—';
  if (v >= 7.5) return 'High';
  if (v >= 5) return 'Steady';
  return 'Low';
}
function energyNote(v: number) {
  if (v === 0) return 'No data yet.';
  if (v >= 7.5) return 'Bright & buoyant.';
  if (v >= 5) return 'Plugged in.';
  return 'Running low.';
}
function restLabel(v: number) {
  if (v === 0) return '—';
  if (v >= 7) return 'Restful';
  if (v >= 5) return 'Adequate';
  return 'Poor';
}
function restNote(v: number) {
  if (v === 0) return 'No data yet.';
  if (v >= 7) return 'Deep & restful.';
  if (v >= 5) return 'Fair — could improve.';
  return 'Rest disrupted.';
}
function connectionLabel(v: number) {
  if (v === 0) return '—';
  if (v >= 7) return 'Connected';
  if (v >= 5) return 'Okay';
  return 'Isolated';
}
function connectionNote(v: number) {
  if (v === 0) return 'No data yet.';
  if (v >= 7) return 'Hearts connected.';
  if (v >= 5) return 'Surface level.';
  return 'Reach out.';
}

function whisperFor(m: ReturnType<typeof useDashboardMetrics>): string {
  const { sleepAvg, stressAvg, energyAvg, socialAvg, journalCompletion, moodAvg } = m;
  if (moodAvg >= 7 && energyAvg >= 6) {
    return 'A soft kind of bright is sitting in your chest today. Let it stay a while.';
  }
  if (stressAvg >= 6.5) {
    return 'The day has been heavy, but you carried it. Tomorrow, take a longer runway.';
  }
  if (sleepAvg < 6 && sleepAvg > 0) {
    return 'You are running on less than usual. A slow morning will earn back more than a fast one.';
  }
  if (journalCompletion >= 70) {
    return 'You wrote. You paused. You noticed. The ink dries well on today’s page.';
  }
  if (socialAvg >= 6) {
    return 'Connection carried the day. That isn’t a small thing — it’s the whole thing.';
  }
  return 'A small honest answer would already make tomorrow a little easier to meet.';
}
