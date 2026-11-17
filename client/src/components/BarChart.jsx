import { useState } from 'react';
import { compact } from '../lib/format';

/**
 * Daily bar chart. data: [{ date: 'YYYY-MM-DD', value: number|null }].
 * Monochrome bars; tap/hover a bar to see its value. Fluid width, fixed height.
 */
export default function BarChart({ data, label, height = 160 }) {
  const [active, setActive] = useState(null);
  const values = data.map((d) => d.value ?? 0);
  const max = Math.max(1, ...values);
  const total = values.reduce((a, b) => a + b, 0);
  const n = data.length || 1;
  const gap = n > 40 ? 1 : 2;
  const shown = active ?? data.length - 1;
  const cur = data[shown];
  const fmt = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  if (!data.length || total === 0) {
    return <div className="grid place-items-center rounded-2xl bg-glass-2 text-sm text-muted" style={{ height }}>No {label.toLowerCase()} data for this period yet</div>;
  }

  return (
    <figure>
      <figcaption className="mb-3 flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-muted">
          {label} · {cur ? fmt(cur.date) : ''}
        </span>
        <span className="font-mono text-sm font-medium tabular-nums">{cur?.value != null ? compact(cur.value) : '—'}</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${n * 10} 100`}
        preserveAspectRatio="none"
        className="w-full touch-none"
        style={{ height }}
        role="img"
        aria-label={`${label} per day, ${compact(total)} in total`}
        onPointerLeave={() => setActive(null)}
      >
        {data.map((d, i) => {
          const h = d.value ? Math.max(2, (d.value / max) * 96) : 0;
          return (
            <g key={d.date} onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)}>
              <rect x={i * 10} y={0} width={10} height={100} fill="transparent" />
              <rect
                x={i * 10 + gap / 2}
                y={100 - h}
                width={10 - gap}
                height={h}
                rx={1.5}
                fill="var(--text)"
                opacity={i === shown ? 1 : 0.32}
              />
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-faint">
        <span>{fmt(data[0].date)}</span>
        <span>{fmt(data[data.length - 1].date)}</span>
      </div>
    </figure>
  );
}
