'use client';

import { useState } from 'react';
import { useTrends } from '@/hooks/use-trends';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart } from '@/components/charts/line-chart';
import { FullScreenLoader, ErrorBanner } from '@/components/ui/loading';
import { InkIcon } from '@/components/ui/ink-icon';
import { cn, formatHours, formatMinutes } from '@/lib/utils';
import type { TrendSeries } from '@/lib/types';

type Period = 'week' | 'month' | 'year';

const METRICS: { key: TrendSeries['metric']; label: string; icon: string; unit: (v: number) => string }[] = [
  { key: 'mood',    label: 'Mood',    icon: 'sparkle', unit: (v) => `${v.toFixed(1)}/10` },
  { key: 'sleep',   label: 'Sleep',   icon: 'moon',    unit: formatHours },
  { key: 'stress',  label: 'Stress',  icon: 'cloud',   unit: (v) => `${v.toFixed(1)}/10` },
  { key: 'outdoor', label: 'Outdoor', icon: 'tree',    unit: formatMinutes },
  { key: 'social',  label: 'Social',  icon: 'people',  unit: (v) => `${v.toFixed(1)}/10` },
  { key: 'energy',  label: 'Energy',  icon: 'bolt',    unit: (v) => `${v.toFixed(1)}/10` },
  { key: 'focus',   label: 'Focus',   icon: 'book',    unit: (v) => `${v.toFixed(1)}/10` },
];

export default function TrendsPage() {
  const { weekSeries, monthSeries, yearSeries, pattern, loading, error } = useTrends();
  const [period, setPeriod] = useState<Period>('week');
  const [metric, setMetric] = useState<TrendSeries['metric']>('mood');

  if (loading) return <FullScreenLoader />;

  const series = period === 'week' ? weekSeries : period === 'month' ? monthSeries : yearSeries;
  const active = series.find((s) => s.metric === metric) ?? series[0]!;
  const meta = METRICS.find((m) => m.key === active.metric)!;

  return (
    <div className="space-y-lg pt-md">
      <header>
        <p className="font-hand text-[18px] text-[#8C8878] italic">patterns from your own baseline</p>
        <h1
          className="text-[36px] leading-none text-[#2C2C2C]"
          style={{ fontFamily: 'var(--font-changa-one), Changa One, serif' }}
        >
          Trends
        </h1>
      </header>

      {error && <ErrorBanner message={error} />}

      <div className="flex bg-[#C5D8C0]/50 p-xs rounded-lg w-fit border border-[#D0C5AA]">
        {(['week', 'month', 'year'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              'px-md py-xs text-sm font-label-md rounded-md transition-colors capitalize',
              period === p ? 'bg-[#F5DEB3] shadow-sm text-[#2C2C2C]' : 'text-[#5C5850] hover:text-[#2C2C2C]',
            )}
          >
            {p}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>{meta.label}</CardTitle>
            <div className="text-right">
              <p
                className="text-[24px] leading-none text-[#2C2C2C]"
                style={{ fontFamily: 'var(--font-changa-one), Changa One, serif' }}
              >
                {meta.unit(active.movingAverage)}
              </p>
              <p className="font-hand text-[15px] text-[#5C5850]">7-day avg</p>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <LineChart
            points={active.points}
            height={180}
            stroke="#C5D8C0"
            xAxisLabels={active.points
              .filter((_, i) => i % Math.max(1, Math.floor(active.points.length / 5)) === 0)
              .map((p) => new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pattern detection</CardTitle>
        </CardHeader>
        <CardBody className="space-y-md">
          <PatternRow label="Sleep change"   value={`${pattern.sleep_change_percentage >= 0 ? '+' : ''}${pattern.sleep_change_percentage.toFixed(1)}%`} tone={pattern.sleep_change_percentage >= 0 ? 'up' : 'down'} />
          <PatternRow label="Stress change"  value={`${pattern.stress_change_percentage >= 0 ? '+' : ''}${pattern.stress_change_percentage.toFixed(1)}%`} tone={pattern.stress_change_percentage <= 0 ? 'up' : 'down'} />
          <PatternRow label="Outdoor (last month)" value={formatMinutes(pattern.last_month_outdoor_average)} />
          <PatternRow label="Outdoor (this month)" value={formatMinutes(pattern.current_month_outdoor_average)} />
          <PatternRow label="Social change"  value={`${pattern.social_change >= 0 ? '+' : ''}${pattern.social_change.toFixed(1)}%`} tone={pattern.social_change >= 0 ? 'up' : 'down'} />
        </CardBody>
      </Card>

      <div className="space-y-md">
        <h2
          className="text-[20px] text-[#2C2C2C]"
          style={{ fontFamily: 'var(--font-changa-one), Changa One, serif' }}
        >
          By metric
        </h2>
        <div className="grid grid-cols-3 gap-sm">
          {METRICS.map((m) => {
            const s = series.find((x) => x.metric === m.key);
            return (
              <button
                key={m.key}
                onClick={() => setMetric(m.key)}
                className={cn(
                  'p-sm rounded-md border text-left transition-colors',
                  metric === m.key ? 'bg-[#2C2C2C] text-[#F5DEB3] border-[#2C2C2C]' : 'bg-[#F5DEB3] text-[#2C2C2C] border-[#D0C5AA]',
                )}
              >
                <p className={cn('font-label-sm uppercase tracking-wider', metric === m.key ? 'text-[#F5DEB3]/80' : 'text-[#5C5850]')}>
                  {m.label}
                </p>
                <p
                  className="text-[18px]"
                  style={{ fontFamily: 'var(--font-changa-one), Changa One, serif', color: metric === m.key ? '#F5DEB3' : undefined }}
                >
                  {s ? m.unit(s.movingAverage) : '—'}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PatternRow({ label, value, tone }: { label: string; value: string; tone?: 'up' | 'down' }) {
  return (
    <div className="flex justify-between items-center border-b border-[#E0D5BA]/50 last:border-b-0 pb-xs last:pb-0">
      <span className="font-label-md text-[#5C5850] uppercase tracking-wider text-[12px]">{label}</span>
      <span
        className={cn(
          'text-[18px] text-[#2C2C2C]',
          tone === 'up' && 'text-[#9CAF92]',
          tone === 'down' && 'text-[#C5D8C0]',
        )}
        style={{ fontFamily: 'var(--font-changa-one), Changa One, serif' }}
      >
        {value}
      </span>
    </div>
  );
}
