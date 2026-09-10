import { useMemo, useState } from "react";

/**
 * A probability-over-time chart for a market's outcomes.
 *
 * Deliberately dependency-free hand-rolled SVG. Neither app carries a charting
 * library and the Telegram build already warns on oversized chunks; the shape
 * here follows the admin app's TrendChart.
 *
 * Props are primitive on purpose — no `Market`, no currency helpers. This file
 * is hand-copied into both frontends, and `shared/currency/` exists in only one
 * of them, so anything richer would fail `tsc` in the Telegram app and break
 * its build. Each page maps its own data in.
 */

export interface ChartPoint {
  /** Epoch milliseconds. */
  t: number;
  /** Probability 0–1 — the value the outcome rows display, not raw LMSR. */
  p: number;
}

export interface ChartSeries {
  label: string;
  color: string;
  points: ChartPoint[];
}

/** Geometry only. All text is HTML around the SVG — see `viewBox` note below. */
const W = 600;
const H = 200;
const PAD = { top: 10, right: 8, bottom: 8, left: 8 };

/**
 * A curve is only worth drawing once it says something. Two points fifteen
 * minutes apart, or a line that never moves, read as "this market is dead" —
 * which is a lie about a market that simply has not been bet on yet.
 */
const MIN_SPAN_MS = 60 * 60 * 1000;

export function hasPlottableHistory(series: ChartSeries[]): boolean {
  const times = new Set<number>();
  let varies = false;
  for (const s of series) {
    for (const pt of s.points) times.add(pt.t);
    if (s.points.length > 1) {
      const first = s.points[0].p;
      if (s.points.some((pt) => Math.abs(pt.p - first) > 1e-9)) varies = true;
    }
  }
  if (times.size < 2) return false;
  const sorted = [...times].sort((a, b) => a - b);
  return sorted[sorted.length - 1] - sorted[0] >= MIN_SPAN_MS && varies;
}

function fmtDay(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function ProbabilityChart({
  series,
  borderColor = "var(--border)",
  since,
}: {
  series: ChartSeries[];
  /** The two apps' cards use different border tokens. */
  borderColor?: string;
  /** Shown in the low-data state: when tracking began. */
  since?: number | null;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const plottable = hasPlottableHistory(series);

  const { tMin, tSpan, lines } = useMemo(() => {
    const all = series.flatMap((s) => s.points);
    const min = all.length ? Math.min(...all.map((p) => p.t)) : 0;
    const max = all.length ? Math.max(...all.map((p) => p.t)) : 1;
    const span = Math.max(max - min, 1);
    const toX = (t: number) =>
      PAD.left + ((t - min) / span) * (W - PAD.left - PAD.right);
    // Full 0–100% domain, not a zoomed one: a 3pp wiggle rendered floor to
    // ceiling would read as a dramatic swing.
    const toY = (p: number) =>
      PAD.top + (1 - Math.min(Math.max(p, 0), 1)) * (H - PAD.top - PAD.bottom);
    return {
      tMin: min,
      tSpan: span,
      lines: series.map((s) => ({
        ...s,
        d: s.points.map((pt) => `${toX(pt.t)},${toY(pt.p)}`).join(" "),
        last: s.points[s.points.length - 1],
        cx: s.points.length ? toX(s.points[s.points.length - 1].t) : 0,
        cy: s.points.length ? toY(s.points[s.points.length - 1].p) : 0,
      })),
    };
  }, [series]);

  if (!series.length) return null;

  // Low-data state. This is the common case on a market nobody has bet on
  // since it opened, so it gets a real answer rather than an empty box.
  if (!plottable) {
    return (
      <div
        style={{
          border: `1px solid ${borderColor}`,
          borderRadius: "var(--radius-md)",
          padding: "14px 16px",
          marginBottom: "var(--space-md)",
          fontSize: "0.75rem",
          color: "var(--text-subtle)",
          lineHeight: 1.5,
        }}
      >
        {since ? `Tracking since ${fmtDay(since)}. ` : ""}
        The chart appears once the price moves.
      </div>
    );
  }

  const readout =
    hover === null
      ? null
      : tMin + (hover / (W - PAD.left - PAD.right)) * tSpan;

  return (
    <div style={{ marginBottom: "var(--space-md)" }}>
      {/* Legend — HTML, not SVG text. Text inside a viewBox scales with the
          container, so the same chart would render noticeably smaller type in
          the Telegram app's narrow card than in the PWA's wide column. */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 8,
          fontSize: "0.7rem",
          fontWeight: 700,
        }}
      >
        {lines.map((l) => (
          <span
            key={l.label}
            style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: l.color,
              }}
            />
            <span style={{ color: "var(--text-muted)" }}>{l.label}</span>
            <span style={{ color: l.color }}>
              {Math.round((l.last?.p ?? 0) * 100)}%
            </span>
          </span>
        ))}
      </div>

      <div
        style={{
          border: `1px solid ${borderColor}`,
          borderRadius: "var(--radius-md)",
          padding: "8px 4px 4px",
          background: "var(--bg-card)",
        }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          style={{ width: "100%", height: 168, display: "block" }}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const x = ((e.clientX - r.left) / r.width) * W - PAD.left;
            setHover(Math.min(Math.max(x, 0), W - PAD.left - PAD.right));
          }}
        >
          {/* Gridlines at 25/50/75%. vectorEffect keeps them hairline at any
              container width — the viewBox is stretched, the strokes are not. */}
          {[0.25, 0.5, 0.75].map((g) => {
            const y = PAD.top + (1 - g) * (H - PAD.top - PAD.bottom);
            return (
              <line
                key={g}
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y}
                y2={y}
                stroke={borderColor}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
                opacity={0.5}
              />
            );
          })}

          {lines.map((l) => (
            <g key={l.label}>
              <polyline
                points={l.d}
                fill="none"
                stroke={l.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <circle cx={l.cx} cy={l.cy} r={3} fill={l.color} />
            </g>
          ))}

          {hover !== null && (
            <line
              x1={PAD.left + hover}
              x2={PAD.left + hover}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="var(--text-subtle)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              opacity={0.6}
            />
          )}
        </svg>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 6,
          fontSize: "0.65rem",
          color: "var(--text-subtle)",
          fontWeight: 600,
        }}
      >
        <span>{fmtDay(tMin)}</span>
        {readout !== null && <span>{fmtDay(readout)}</span>}
        <span>{fmtDay(tMin + tSpan)}</span>
      </div>
    </div>
  );
}
