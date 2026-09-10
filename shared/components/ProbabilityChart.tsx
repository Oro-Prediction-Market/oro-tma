import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

/**
 * A probability-over-time chart for a market's outcomes.
 *
 * Deliberately dependency-free hand-rolled SVG. Neither app carries a charting
 * library and the Telegram build already warns on oversized chunks.
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

const H = 208;
const PAD = { top: 12, right: 10, bottom: 24, left: 34 };

/** Fallback width for the frame before the container has been measured. */
const ASSUMED_W = 320;

export function hasPlottableHistory(series: ChartSeries[]): boolean {
  return series.some((s) => s.points.length > 0);
}

function fmtDay(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function fmtMoment(ms: number, spanMs: number): string {
  const d = new Date(ms);
  // Inside a couple of days the date alone repeats on every tick, so the clock
  // is what distinguishes them.
  if (spanMs < 48 * 3600_000) {
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return fmtDay(ms);
}

/**
 * Value of a step series at an arbitrary instant: the last point at or before
 * it. A parimutuel price holds flat between bets and jumps when one lands, so
 * interpolating between vertices would invent prices that never existed.
 */
function valueAt(points: ChartPoint[], t: number): number | null {
  if (points.length === 0) return null;
  if (t < points[0].t) return null;
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (points[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  return points[lo].p;
}

export function ProbabilityChart({
  series,
  borderColor = "var(--border)",
}: {
  series: ChartSeries[];
  /** The two apps' cards use different border tokens. */
  borderColor?: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(0);
  const [cursor, setCursor] = useState<number | null>(null);
  const scrubbing = useRef(false);
  const startX = useRef(0);

  // Measured rather than stretched. An earlier version scaled a fixed viewBox
  // with preserveAspectRatio="none", which distorts glyphs — so every label had
  // to live in HTML outside the SVG. Drawing at real width puts the axis text
  // back inside it and makes the hover maths plain pixels.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const next = el.getBoundingClientRect().width;
      // A collapsed or not-yet-laid-out container reports 0; drawing against
      // that produces a degenerate frame that then has to be rebuilt.
      if (next > 0) setW(next);
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    // rAF-wrapped: resizing inside the callback is what raises "ResizeObserver
    // loop completed with undelivered notifications".
    const ro = new ResizeObserver(() => requestAnimationFrame(measure));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = w > 0 ? w : ASSUMED_W;

  const { tMin, tSpan, lines, ticks, toX } = useMemo(() => {
    const all = series.flatMap((s) => s.points);
    const min = all.length ? Math.min(...all.map((p) => p.t)) : 0;
    const max = all.length ? Math.max(...all.map((p) => p.t)) : 1;
    const span = Math.max(max - min, 1);
    const plotW = Math.max(W - PAD.left - PAD.right, 1);
    const toX = (t: number) => PAD.left + ((t - min) / span) * plotW;
    // Full 0–100% domain, not a zoomed one: a 3pp wiggle rendered floor to
    // ceiling would read as a dramatic swing.
    const toY = (p: number) =>
      PAD.top + (1 - Math.min(Math.max(p, 0), 1)) * (H - PAD.top - PAD.bottom);

    const count = W < 380 ? 3 : 5;
    const tickList = Array.from({ length: count }, (_, i) => {
      const t = min + (span * i) / (count - 1);
      return { t, x: toX(t) };
    });

    return {
      tMin: min,
      tSpan: span,
      toX,
      toY,
      ticks: tickList,
      lines: series.map((s) => {
        // Step-after: each point is the price *after* the bet at its timestamp,
        // so the value holds from there until the next one. Drawn as a diagonal
        // it would suggest the price drifted while nothing was happening.
        let d = "";
        s.points.forEach((pt, i) => {
          const x = toX(pt.t);
          const y = toY(pt.p);
          if (i === 0) d += `M${x},${y}`;
          else d += `L${x},${toY(s.points[i - 1].p)}L${x},${y}`;
        });
        const last = s.points[s.points.length - 1];
        return {
          ...s,
          d,
          toY,
          cx: last ? toX(last.t) : 0,
          cy: last ? toY(last.p) : 0,
        };
      }),
    };
  }, [series, W]);

  const onMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      // Converted through the fraction across the element, not raw client
      // pixels. The measured width is the bordered wrapper's while the SVG
      // fills its content box, so the two differ by the border and the viewBox
      // quietly rescales everything drawn inside it — reading pixels directly
      // put the crosshair a couple of px off the pointer at the right edge.
      const frac = (e.clientX - r.left) / (r.width || 1);
      const plotW = Math.max(W - PAD.left - PAD.right, 1);
      const x = Math.min(Math.max(frac * W - PAD.left, 0), plotW);
      setCursor(tMin + (x / plotW) * tSpan);
    },
    [W, tMin, tSpan],
  );

  const onPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    // A touch is not a scrub until it moves sideways. Claiming the pointer on
    // contact would swallow the vertical drag that scrolls the page — and in
    // the Telegram app, the one that closes the sheet.
    if (e.pointerType === "mouse") {
      scrubbing.current = true;
      return;
    }
    startX.current = e.clientX;
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.pointerType !== "mouse" && !scrubbing.current) {
        if (Math.abs(e.clientX - startX.current) < 8) return;
        scrubbing.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      onMove(e);
    },
    [onMove],
  );

  const endScrub = useCallback(() => {
    scrubbing.current = false;
    setCursor(null);
  }, []);

  if (!series.length || !hasPlottableHistory(series)) return null;

  // The crosshair follows the pointer rather than jumping to the nearest
  // vertex, and the value under it is the last point at or before the cursor —
  // the price that was standing at that moment. On a market whose bets are days
  // apart, snapping sent the line skating across the card to a vertex nowhere
  // near the pointer.
  const cursorX = cursor === null ? null : toX(cursor);

  return (
    <div style={{ marginBottom: "var(--space-md)" }}>
      {/* Legend. Values follow the cursor while scrubbing and fall back to the
          latest price otherwise — blanking them on pointer-out would make the
          numbers flicker every time a finger lifts. */}
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
        {lines.map((l) => {
          const v =
            cursor === null
              ? (l.points[l.points.length - 1]?.p ?? 0)
              : (valueAt(l.points, cursor) ??
                l.points[l.points.length - 1]?.p ??
                0);
          return (
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
              <span style={{ color: l.color }}>{Math.round(v * 100)}%</span>
            </span>
          );
        })}
      </div>

      <div
        ref={wrapRef}
        style={{
          position: "relative",
          border: `1px solid ${borderColor}`,
          borderRadius: "var(--radius-md)",
          background: "var(--bg-card)",
        }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={H}
          style={{ display: "block", touchAction: "pan-y" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endScrub}
          onPointerCancel={endScrub}
          onPointerLeave={endScrub}
          role="img"
          aria-label={lines
            .map(
              (l) =>
                `${l.label} ${Math.round((l.points[l.points.length - 1]?.p ?? 0) * 100)}%`,
            )
            .join(", ")}
        >
          {/* Y axis: gridlines with their own labels, so a reader can put a
              number on a line without hovering. */}
          {[0, 0.25, 0.5, 0.75, 1].map((g) => {
            const y = PAD.top + (1 - g) * (H - PAD.top - PAD.bottom);
            return (
              <g key={g}>
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={y}
                  y2={y}
                  stroke={borderColor}
                  strokeWidth={1}
                  opacity={g === 0 ? 0.9 : 0.45}
                />
                <text
                  x={PAD.left - 6}
                  y={y + 3}
                  textAnchor="end"
                  fontSize={9}
                  fontWeight={600}
                  fill="var(--text-subtle)"
                >
                  {Math.round(g * 100)}%
                </text>
              </g>
            );
          })}

          {/* X axis */}
          {ticks.map((tk, i) => (
            <text
              key={tk.t}
              x={tk.x}
              y={H - PAD.bottom + 14}
              textAnchor={
                i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle"
              }
              fontSize={9}
              fontWeight={600}
              fill="var(--text-subtle)"
            >
              {fmtDay(tk.t)}
            </text>
          ))}

          {lines.map((l) => (
            <path
              key={l.label}
              d={l.d}
              fill="none"
              stroke={l.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {cursorX !== null && (
            <line
              x1={cursorX}
              x2={cursorX}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="var(--text-subtle)"
              strokeWidth={1}
              opacity={0.7}
            />
          )}

          {/* Dots: the hovered instant while scrubbing, the latest price
              otherwise. On a step line the hovered dot still sits exactly on
              the drawn segment, because the line and the dot read the same
              last-value-at rule. */}
          {lines.map((l) => {
            if (cursor === null) {
              return (
                <circle key={l.label} cx={l.cx} cy={l.cy} r={3} fill={l.color} />
              );
            }
            const v = valueAt(l.points, cursor);
            if (v === null || cursorX === null) return null;
            return (
              <circle
                key={l.label}
                cx={cursorX}
                cy={l.toY(v)}
                r={3.5}
                fill={l.color}
                stroke="var(--bg-card)"
                strokeWidth={1.5}
              />
            );
          })}
        </svg>

        {cursor !== null && cursorX !== null && (
          <div
            style={{
              position: "absolute",
              // Clamped inside the plot so a cursor at either end does not push
              // the tooltip out past the card's rounded corner.
              left: Math.min(Math.max(cursorX, 68), W - 68),
              top: 6,
              transform: "translateX(-50%)",
              pointerEvents: "none",
              background: "var(--bg-secondary)",
              border: `1px solid ${borderColor}`,
              borderRadius: "var(--radius-md)",
              padding: "6px 8px",
              fontSize: "0.65rem",
              fontWeight: 700,
              lineHeight: 1.5,
              color: "var(--text-main)",
              whiteSpace: "nowrap",
              boxShadow: "var(--shadow-md)",
            }}
          >
            <div
              style={{ color: "var(--text-subtle)", marginBottom: 2 }}
            >
              {fmtMoment(cursor, tSpan)}
            </div>
            {lines.map((l) => {
              const v = valueAt(l.points, cursor);
              if (v === null) return null;
              return (
                <div
                  key={l.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <span style={{ color: "var(--text-muted)" }}>{l.label}</span>
                  <span style={{ color: l.color }}>
                    {(v * 100).toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
