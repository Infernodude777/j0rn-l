'use client';

import { useMemo } from 'react';
import type { TrendPoint } from '@/lib/types';

export function LineChart({
  points,
  height = 160,
  showGrid = true,
  yAxisLabels,
  xAxisLabels,
  stroke = '#2C2C2C',
}: {
  points: TrendPoint[];
  height?: number;
  showGrid?: boolean;
  yAxisLabels?: string[];
  xAxisLabels?: string[];
  stroke?: string;
}) {
  const width = 400;
  const padding = { top: 16, right: 12, bottom: 24, left: 12 };

  const { path, areaPath, ticks, xLabels } = useMemo(() => {
    if (points.length === 0) return { path: '', areaPath: '', ticks: [], xLabels: [] };
    const values = points.map((p) => p.value);
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    const stepX = points.length > 1 ? (width - padding.left - padding.right) / (points.length - 1) : 0;
    const coords = points.map((p, i) => {
      const x = padding.left + i * stepX;
      const y = padding.top + (1 - (p.value - min) / range) * (height - padding.top - padding.bottom);
      return [x, y] as const;
    });
    const segs: string[] = [];
    coords.forEach(([x, y], i) => {
      if (i === 0) segs.push(`M ${x} ${y}`);
      else {
        const [px, py] = coords[i - 1]!;
        const cx1 = (px + x) / 2;
        const cy1 = py;
        const cx2 = (px + x) / 2;
        const cy2 = y;
        segs.push(`C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x} ${y}`);
      }
    });
    const path = segs.join(' ');
    const lastX = coords.length > 0 ? coords[coords.length - 1]![0] : padding.left;
    const firstX = coords[0]?.[0] ?? padding.left;
    const baseY = height - padding.bottom;
    const areaPath = `${path} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;
    const ticks = [max, (max + min) / 2, min];
    const xLabels = points
      .filter((_, i) => i % Math.max(1, Math.floor(points.length / 4)) === 0)
      .map((p) => new Date(p.date).toLocaleDateString('en-US', { weekday: 'short' }));
    return { path, areaPath, ticks, xLabels };
  }, [points, height]);

  if (points.length === 0) return null;

  return (
    <div className="w-full" style={{ height }}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.12" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {showGrid && ticks.map((t, i) => {
          const max = Math.max(...points.map((p) => p.value), 1);
          const min = Math.min(...points.map((p) => p.value), 0);
          const range = max - min || 1;
          const y = padding.top + (1 - (t - min) / range) * (height - padding.top - padding.bottom);
          return (
            <line
              key={i}
              x1={padding.left}
              x2={width - padding.right}
              y1={y}
              y2={y}
              stroke="#D0C5AA"
              strokeWidth="0.5"
              strokeDasharray="3 3"
            />
          );
        })}
        <path d={areaPath} fill="url(#lineFill)" />
        <path d={path} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      {xAxisLabels && xAxisLabels.length > 0 && (
        <div className="flex justify-between mt-sm font-label-sm text-secondary opacity-70">
          {xAxisLabels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      )}
    </div>
  );
}
