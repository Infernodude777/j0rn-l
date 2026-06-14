import { Sparkline } from '@/components/charts/sparkline';
import { cn } from '@/lib/utils';

export function MetricCard({
  label,
  value,
  icon,
  trend,
  trendTone = 'neutral',
  spark,
  dashed,
  className,
}: {
  label: string;
  value: string;
  icon: string;
  trend?: string;
  trendTone?: 'up' | 'down' | 'neutral';
  spark?: number[];
  dashed?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('relative bg-surface-container-low border border-outline-variant rounded-lg shadow-paper p-md overflow-hidden paper-texture', className)}>
      <div className="relative z-10 flex flex-col gap-sm">
        <div className="flex items-start justify-between">
          <span className="material-symbols-outlined text-secondary opacity-60" style={{ fontSize: 20 }}>{icon}</span>
          {trend && (
            <span
              className={cn(
                'font-label-sm text-[11px] font-bold',
                trendTone === 'up' && 'text-on-tertiary-container',
                trendTone === 'down' && 'text-error',
                trendTone === 'neutral' && 'text-secondary',
              )}
            >
              {trend}
            </span>
          )}
        </div>
        <p className="font-label-sm text-secondary uppercase tracking-wider">{label}</p>
        <p className="font-metric text-primary text-[20px]">{value}</p>
        {spark && <div className="h-8"><Sparkline values={spark} dashed={dashed} /></div>}
      </div>
    </div>
  );
}
