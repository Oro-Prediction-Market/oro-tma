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

/**
 * A curve before anyone has decided what colour it is.
 *
 * The themed detail views (UFC, Champions League, Premier League) paint their
 * own lines — red and blue corners, home and away — so the page hands them the
 * outcome's history and its id, and they choose. `outcomeId` is what makes that
 * possible: a label alone cannot be matched back to the tile beneath it.
 */
export interface ChartOutcome {
  outcomeId: string;
  label: string;
  points: ChartPoint[];
}

/**
 * The card's colours, for the themed views.
 *
 * Every one of them paints on its own near-black ground — UFC on #0d0b0c, the
 * Champions League on #070d29 — and the site's `--bg-card` belongs to none of
 * them. Passing this switches the chart to the card treatment those views use
 * for the match itself: a bordered panel with the heading and legend in its
 * header and the current split along its foot.
 */
export interface ChartTheme {
  /** Card fill. */
  surface: string;
  /** Card border, and the gridlines drawn inside it. */
  border: string;
  /** Axis numbers. */
  axis: string;
  /** Outcome names, in the legend and the tooltip. */
  muted: string;
  /** Tooltip body text. */
  text: string;
  /** Tooltip fill. */
  tooltipBg: string;
  /** The heading, in the theme's section-label colour. */
  accent: string;
  /** Corner radius, matched to the cards beside it. */
  radius: number;
}

const DEFAULT_H = 208;
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

/** Index of the last point at or before `t`, or -1 if `t` predates the series. */
function indexAt(points: ChartPoint[], t: number): number {
  if (points.length === 0 || t < points[0].t) return -1;
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (points[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * Value of a step series at an arbitrary instant: the last point at or before
 * it. A parimutuel price holds flat between bets and jumps when one lands, so
 * interpolating between vertices would invent prices that never existed.
 */
function valueAt(points: ChartPoint[], t: number): number | null {
  const i = indexAt(points, t);
  return i < 0 ? null : points[i].p;
}

/**
 * The staircase for a run of points. Each point is the price *after* the bet at
 * its timestamp, so the value holds flat until the next one — drawn as a
 * diagonal it would suggest the price drifted while nothing was happening.
 */
function stepPath(
  points: ChartPoint[],
  from: number,
  to: number,
  toX: (t: number) => number,
  toY: (p: number) => number,
): string {
  let d = "";
  for (let i = from; i <= to; i++) {
    const x = toX(points[i].t);
    const y = toY(points[i].p);
    d += i === from ? `M${x},${y}` : `L${x},${toY(points[i - 1].p)}L${x},${y}`;
  }
  return d;
}

/**
 * The line split at the hovered instant: what had already happened, and what
 * had not yet.
 *
 * The second half is drawn faint, so the chart reads as the market did at the
 * moment under the cursor rather than as a finished picture with a marker on
 * it. The cut lands mid-tread — the price at the cursor is the one standing
 * since the last bet — so the two halves meet exactly and the join is
 * invisible.
 */
function splitStep(
  points: ChartPoint[],
  cut: number | null,
  toX: (t: number) => number,
  toY: (p: number) => number,
): { past: string; future: string } {
  if (points.length === 0) return { past: "", future: "" };
  const whole = stepPath(points, 0, points.length - 1, toX, toY);
  if (cut === null) return { past: whole, future: "" };

  const k = indexAt(points, cut);
  // Cursor sits before this outcome had any price: all of it is still ahead.
  if (k < 0) return { past: "", future: whole };

  const xc = toX(cut);
  const yc = toY(points[k].p);
  const past = stepPath(points, 0, k, toX, toY) + `L${xc},${yc}`;

  let future = `M${xc},${yc}`;
  for (let i = k + 1; i < points.length; i++) {
    const x = toX(points[i].t);
    future += `L${x},${toY(points[i - 1].p)}L${x},${toY(points[i].p)}`;
  }
  return { past, future: k === points.length - 1 ? "" : future };
}

export function ProbabilityChart({
  series,
  borderColor = "var(--border)",
  theme,
  title = "Price history",
  fit = false,
  height,
}: {
  series: ChartSeries[];
  /** The two apps' cards use different border tokens. */
  borderColor?: string;
  /**
   * Set to draw the themed card instead of the plain one — see `ChartTheme`.
   * The generic market view leaves this off and is unchanged.
   */
  theme?: ChartTheme;
  /** Heading for the themed card. Ignored without a theme. */
  title?: string;
  /**
   * Cap the y axis just above the highest price instead of always drawing to
   * 100%.
   *
   * A twenty-runner season market where the favourite is on 50% spends half the
   * card empty. The axis still starts at zero — the point of the full domain
   * was never to flatter small moves, it was to keep the baseline honest — but
   * the ceiling comes down to the next quarter above the leader.
   */
  fit?: boolean;
  /** Plot height. Defaults to 208px, which is what the narrow rail wants. */
  height?: number;
}) {
  const H = height ?? DEFAULT_H;
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(0);
  const [cursor, setCursor] = useState<number | null>(null);
  // Height of the pointer in viewBox units — what decides which line is being
  // read when several are on screen.
  const [cursorY, setCursorY] = useState<number | null>(null);
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

  const { tMin, tSpan, lines, ticks, toX, toY, gridlines } = useMemo(() => {
    const all = series.flatMap((s) => s.points);
    const min = all.length ? Math.min(...all.map((p) => p.t)) : 0;
    const max = all.length ? Math.max(...all.map((p) => p.t)) : 1;
    const span = Math.max(max - min, 1);
    const plotW = Math.max(W - PAD.left - PAD.right, 1);
    const toX = (t: number) => PAD.left + ((t - min) / span) * plotW;

    // Zero-based whatever happens — a chart that starts the axis at the lowest
    // price turns a 3pp wiggle into a dramatic swing. Only the ceiling moves,
    // and only when asked: up to the next quarter above the leader, with a
    // little headroom so the top line is not drawn along the frame.
    const hi = all.length ? Math.max(...all.map((p) => p.p)) : 1;
    const yMax = fit
      ? Math.min(1, Math.max(0.25, Math.ceil(hi * 1.08 * 4) / 4))
      : 1;
    const toY = (p: number) =>
      PAD.top +
      (1 - Math.min(Math.max(p, 0), yMax) / yMax) * (H - PAD.top - PAD.bottom);

    const grid: number[] = [];
    for (let g = 0; g <= yMax + 1e-9; g += 0.25) grid.push(Number(g.toFixed(2)));

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
      gridlines: grid,
      lines: series.map((s) => {
        const last = s.points[s.points.length - 1];
        return {
          ...s,
          toX,
          toY,
          cx: last ? toX(last.t) : 0,
          cy: last ? toY(last.p) : 0,
        };
      }),
    };
  }, [series, W, H, fit]);

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
      setCursorY(((e.clientY - r.top) / (r.height || 1)) * H);
    },
    [W, H, tMin, tSpan],
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
    setCursorY(null);
  }, []);

  if (!series.length || !hasPlottableHistory(series)) return null;

  /**
   * The line the pointer is nearest, vertically, at the hovered instant.
   *
   * With five outcomes on one chart the crosshair alone does not say which
   * number is being read, so the nearest line is brought forward and the rest
   * are pushed back. Measured against each line's own height at that instant —
   * the value the reader is looking at — not against its last point.
   */
  const active = (() => {
    if (cursor === null || cursorY === null) return null;
    let best: string | null = null;
    let bestGap = Infinity;
    for (const l of lines) {
      const v = valueAt(l.points, cursor);
      if (v === null) continue;
      const gap = Math.abs(l.toY(v) - cursorY);
      if (gap < bestGap) {
        bestGap = gap;
        best = l.label;
      }
    }
    return best;
  })();

  // The crosshair follows the pointer rather than jumping to the nearest
  // vertex, and the value under it is the last point at or before the cursor —
  // the price that was standing at that moment. On a market whose bets are days
  // apart, snapping sent the line skating across the card to a vertex nowhere
  // near the pointer.
  const cursorX = cursor === null ? null : toX(cursor);


  // The card's own colours where a theme was given, the site's tokens where it
  // was not. Only the chrome differs between the two — the plot is one block of
  // markup drawn with whichever set applies.
  const surface = theme?.surface ?? "var(--bg-card)";
  const stroke = theme?.border ?? borderColor;
  const axisFill = theme?.axis ?? "var(--text-subtle)";
  const mutedFill = theme?.muted ?? "var(--text-muted)";
  const textFill = theme?.text ?? "var(--text-main)";
  const tooltipFill = theme?.tooltipBg ?? "var(--bg-secondary)";
  const radius = theme ? `${theme.radius}px` : "var(--radius-md)";

  /**
   * What a line reads at the moment being looked at: the hovered price while
   * scrubbing, the latest otherwise. Blanking it on pointer-out would make
   * every number flicker each time a finger lifts.
   */
  const valueOf = (l: (typeof lines)[number]) => {
    const last = l.points[l.points.length - 1]?.p ?? 0;
    return cursor === null ? last : (valueAt(l.points, cursor) ?? last);
  };

  const legend = (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: theme ? 10 : 12,
        fontSize: theme ? 10.5 : "0.7rem",
        fontWeight: 700,
      }}
    >
      {lines.map((l) => {
        const dim = active !== null && active !== l.label;
        return (
          <span
            key={l.label}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              opacity: dim ? 0.4 : 1,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: l.color,
              }}
            />
            <span style={{ color: mutedFill }}>{l.label}</span>
            <span style={{ color: l.color }}>
              {Math.round(valueOf(l) * 100)}%
            </span>
          </span>
        );
      })}
    </div>
  );

  const plot = (
    <div
      ref={wrapRef}
      style={{
        position: "relative",
        // Themed, the card around this holds the border; plain, this IS the
        // card.
        ...(theme
          ? null
          : {
              border: `1px solid ${stroke}`,
              borderRadius: radius,
              background: surface,
            }),
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
        {gridlines.map((g) => {
          const y = toY(g);
          return (
            <g key={g}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y}
                y2={y}
                stroke={stroke}
                strokeWidth={1}
                opacity={g === 0 ? 0.9 : 0.45}
              />
              <text
                x={PAD.left - 6}
                y={y + 3}
                textAnchor="end"
                fontSize={9}
                fontWeight={600}
                fill={axisFill}
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
            fill={axisFill}
          >
            {fmtDay(tk.t)}
          </text>
        ))}

        {/* Each line in two halves: what had happened by the hovered moment,
            and what had not yet. The second is drawn faint so the chart reads
            as the market looked at that moment rather than as a finished
            picture with a marker dropped on it. With no cursor there is only
            one half and nothing is dimmed. */}
        {lines.map((l) => {
          const { past, future } = splitStep(l.points, cursor, l.toX, l.toY);
          const dim = active !== null && active !== l.label;
          return (
            <g key={l.label}>
              {future && (
                <path
                  d={future}
                  fill="none"
                  stroke={l.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  opacity={dim ? 0.1 : 0.25}
                />
              )}
              {past && (
                <path
                  d={past}
                  fill="none"
                  stroke={l.color}
                  // Weight as well as opacity: on a phone, colour alone at
                  // this stroke width is not enough separation to read.
                  strokeWidth={active === l.label ? 3 : 2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  opacity={dim ? 0.3 : 1}
                />
              )}
            </g>
          );
        })}

        {cursorX !== null && (
          <line
            x1={cursorX}
            x2={cursorX}
            y1={PAD.top}
            y2={H - PAD.bottom}
            stroke={axisFill}
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
          const dim = active !== null && active !== l.label;
          return (
            <circle
              key={l.label}
              cx={cursorX}
              cy={l.toY(v)}
              r={active === l.label ? 4.5 : 3.5}
              fill={l.color}
              stroke={surface}
              strokeWidth={1.5}
              opacity={dim ? 0.35 : 1}
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
            background: tooltipFill,
            border: `1px solid ${stroke}`,
            borderRadius: radius,
            padding: "6px 8px",
            fontSize: "0.65rem",
            fontWeight: 700,
            lineHeight: 1.5,
            color: textFill,
            whiteSpace: "nowrap",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <div style={{ color: axisFill, marginBottom: 2 }}>
            {fmtMoment(cursor, tSpan)}
          </div>
          {lines.map((l) => {
            const v = valueAt(l.points, cursor);
            if (v === null) return null;
            const dim = active !== null && active !== l.label;
            return (
              <div
                key={l.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  opacity: dim ? 0.45 : 1,
                }}
              >
                <span style={{ color: mutedFill }}>{l.label}</span>
                <span style={{ color: l.color }}>{(v * 100).toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  if (!theme) {
    return (
      <div style={{ marginBottom: "var(--space-md)" }}>
        <div style={{ marginBottom: 8 }}>{legend}</div>
        {plot}
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 14,
        border: `1px solid ${theme.border}`,
        borderRadius: theme.radius,
        overflow: "hidden",
        background: theme.surface,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
          padding: "13px 14px 4px",
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: theme.accent,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {title}
        </span>
        {legend}
      </div>
      {plot}
      {/* The same split bar the match card carries along its foot, on the same
          colours — the chart is the story of how that bar got here. It follows
          the cursor too, so scrubbing rewinds the bar as well as the lines.
          Only the outcomes on the chart are drawn, so on a field market the
          remainder is everyone the chart left out, and it stays grey. */}
      <div
        style={{
          display: "flex",
          height: 5,
          background: "rgba(255,255,255,0.07)",
        }}
      >
        {lines.map((l) => (
          <div
            key={l.label}
            style={{
              width: `${Math.max(valueOf(l) * 100, 0)}%`,
              background: l.color,
            }}
          />
        ))}
      </div>
    </div>
  );
}
