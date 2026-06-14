import { cn } from '@/lib/utils';

type Tone = 'stable' | 'watch' | 'strained' | 'neutral' | 'connected' | 'pending';

const toneStyles: Record<Tone, string> = {
  stable: 'bg-sage text-primary',
  watch: 'bg-gold text-primary',
  strained: 'bg-clay text-surface',
  neutral: 'bg-surface-container-high text-on-surface-variant',
  connected: 'bg-sage text-primary',
  pending: 'bg-gold text-primary',
};

export function StatusBadge({ tone = 'neutral', children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center font-label-md uppercase tracking-wider px-sm py-1 text-[11px] rounded-sm', toneStyles[tone], className)}>
      {children}
    </span>
  );
}
