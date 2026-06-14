'use client';

import { useMemo } from 'react';

export function BarChart({
  data,
  height = 180,
  color = '#9CAF92',
  xLabels,
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  xLabels?: string[];
}) {
  const width = 400;
  const padding = { top: 12, right: 12, bottom: 24, left: 12 };

  const bars = useMemo(() => {
    if (data.length === 0) return [];
    const max = Math.max(...data.map((d) => d.value), 1);
    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;
    const slotW = innerW / data.length;
    const barW = slotW * 0.55;
    return data.map((d, i) => {
      const h = (d.value / max) * innerH;
      const x = padding.left + i * slotW + (slotW - barW) / 2;
      const y = padding.top + innerH - h;
      return { x, y, w: barW, h, value: d.value, label: d.label };
    });
  }, [data, height]);

  if (data.length === 0) return null;

  return (
    <div className="w-full" style={{ height }}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
        {bars.map((b, i) => (
          <rect
            key={i}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            fill={color}
            rx="3"
            opacity="0.85"
          />
        ))}
      </svg>
      {xLabels && xLabels.length > 0 && (
        <div className="flex justify-between mt-sm font-label-sm text-secondary opacity-70">
          {xLabels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      )}
    </div>
  );
}
