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
 * The narrowest window worth an axis. A single sample, or several inside the
 * same minute, has no width to plot against, so the domain is stretched to at
 * least this and the line runs flat across it.
 */
const MIN_SPAN_MS = 60 * 60 * 1000;

/**
 * A market that has not moved still has a price, and a flat line is the honest
 * picture of it. An earlier version of this withheld the chart until the price
 * moved — which meant nearly every market showed no chart at all, since the
 * sampler writes a baseline and then only on movement.
 */
export function hasPlottableHistory(series: ChartSeries[]): boolean {
  return series.some((s) => s.points.length > 0);
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
    // Sampling can have begun before the oldest point we are able to plot, so
    // the axis starts at `since` when it is earlier — the dates then describe
    // the tracked window rather than just the plottable part of it.
    let min = all.length ? Math.min(...all.map((p) => p.t)) : 0;
    if (since != null && since < min) min = since;
    let max = all.length ? Math.max(...all.map((p) => p.t)) : 1;
    if (max - min < MIN_SPAN_MS) max = Math.max(Date.now(), min + MIN_SPAN_MS);
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
      lines: series.map((s) => {
        // A polyline needs two vertices, so a lone sample is held flat across
        // the axis. That is not an assumption about the past — it is what the
        // market has done since it was first sampled.
        const pts =
          s.points.length === 1
            ? [
                { t: min, p: s.points[0].p },
                { t: max, p: s.points[0].p },
              ]
            : s.points;
        return {
          ...s,
          d: pts.map((pt) => `${toX(pt.t)},${toY(pt.p)}`).join(" "),
          last: pts[pts.length - 1],
          cx: pts.length ? toX(pts[pts.length - 1].t) : 0,
          cy: pts.length ? toY(pts[pts.length - 1].p) : 0,
        };
      }),
    };
  }, [series, since]);

  // Nothing to draw at all — no outcome has a usable point. The card keeps its
  // previous shape rather than showing an empty box.
  if (!series.length || !plottable) return null;

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
