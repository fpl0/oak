// A small bar chart for Progress › Your sessions: one series, labelled bars, an optional reference value per
// bar (drawn as a tick) and an optional horizontal guide. Values print on the bars, so the chart reads
// without hover.
import { clsx } from "clsx";

export interface Bar {
  key: string;
  label: string;
  value: number;
  /** Planned or target value: drawn as a tick across the bar. */
  ref?: number;
  /** Bars past their reference take the second colour. */
  over?: boolean;
}

export function Bars({
  bars,
  unit,
  title,
  height = 140,
  guide,
}: {
  bars: readonly Bar[];
  unit: string;
  title: string;
  height?: number;
  guide?: { value: number; label: string };
}) {
  const max = Math.max(1e-9, ...bars.map((b) => Math.max(b.value, b.ref ?? 0)), guide?.value ?? 0);
  const bw = 34;
  const gap = 12;
  const top = 18;
  const bottom = 22;
  const plot = height - top - bottom;
  const width = Math.max(1, bars.length) * (bw + gap) + gap;
  const y = (v: number) => top + plot - (v / max) * plot;
  const fmt = (v: number) => (v >= 10 ? Math.round(v).toString() : v.toFixed(1));
  const summary = bars
    .map((b) => `${b.label}: ${fmt(b.value)} ${unit}${b.ref !== undefined ? ` (plan ${fmt(b.ref)})` : ""}`)
    .join("; ");
  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} role="img" aria-label={`${title}. ${summary}`} className="block">
        <line x1={0} x2={width} y1={top + plot} y2={top + plot} className="stroke-border" />
        {guide && (
          <g>
            <line
              x1={0}
              x2={width}
              y1={y(guide.value)}
              y2={y(guide.value)}
              className="stroke-text-3"
              strokeDasharray="4 3"
            />
            <text x={width - 4} y={y(guide.value) - 4} textAnchor="end" className="fill-text-3 text-[10px]">
              {guide.label}
            </text>
          </g>
        )}
        {bars.map((b, i) => {
          const x = gap + i * (bw + gap);
          const h = Math.max(b.value > 0 ? 1 : 0, (b.value / max) * plot);
          return (
            <g key={b.key}>
              <rect
                x={x}
                y={top + plot - h}
                width={bw}
                height={h}
                rx={3}
                className={clsx(b.over ? "fill-accent-2" : "fill-accent")}
              />
              {b.ref !== undefined && (
                <line
                  x1={x - 3}
                  x2={x + bw + 3}
                  y1={y(b.ref)}
                  y2={y(b.ref)}
                  className="stroke-text"
                  strokeWidth={1.5}
                />
              )}
              <text
                x={x + bw / 2}
                y={top + plot - h - 4}
                textAnchor="middle"
                className="fill-text text-[10.5px] tabular-nums"
              >
                {fmt(b.value)}
              </text>
              <text x={x + bw / 2} y={height - 6} textAnchor="middle" className="fill-text-3 text-[10.5px]">
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
