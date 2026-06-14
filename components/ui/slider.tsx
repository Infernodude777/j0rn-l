'use client';

import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface SliderProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  ariaLabel?: string;
  rightLabel?: ReactNode;
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 10,
  step = 1,
  className,
  ariaLabel,
  rightLabel,
}: SliderProps) {
  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between mb-sm">
        <span className="font-metric text-primary">{value}</span>
        {rightLabel}
      </div>
      <input
        type="range"
        aria-label={ariaLabel}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  );
}
