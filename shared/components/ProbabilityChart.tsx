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
  /** Pre-formatted payout multiple (e.g. "3.57x"), shown beside the % in the legend. */
  odds?: string;
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

/** Approximate width of one character at 9.5px, weight 700. */
const LABEL_CHAR = 5.3;
const LABEL_H = 15;

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
 * Which side of its anchor an end label's box sits on.
 *
 * Right by default, flipping left when the right would run past the frame —
 * which is what happens as the crosshair approaches the right edge.
 *
 * This is the mirror of what the chart used to do: it preferred the left and
 * flipped right where the y-axis would clip it. Only the preferred side
 * changed. The plot still spans the full frame, so a label always overlays the
 * lines somewhere — the choice is only which way it falls from the point it
 * describes, and leading away from the cursor's direction of travel keeps it
 * off the stretch being read.
 *
 * Exported so the placement can be swept across every anchor position without
 * a browser — a clipped label is this function's only failure mode, and it
 * fails silently.
 */
export function endLabelX(
  anchorX: number,
  width: number,
  W: number,
): { x: number; onRight: boolean } {
  const right = anchorX + 8;
  if (right + width <= W - 2) return { x: right, onRight: true };
  // No room on the right. Sit left of the anchor, clamped so the box stays
  // inside the frame — and, for a label too wide to fit anywhere, pinned to
  // the frame's left edge so the name is readable rather than its tail.
  const x = Math.min(
    Math.max(PAD.left, anchorX - 8 - width),
    Math.max(2, W - 2 - width),
  );
  return { x, onRight: false };
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

  // No nearest-line highlight. Every line keeps its own weight and opacity at
  // all times — with the name and price now printed on each line, singling one
  // out by fading the others took the chart further from readable, not closer.

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

  /**
   * A label per line, carrying that outcome's name and its price at whatever
   * moment is being read — the old single tooltip, split into one box each and
   * put on the line it describes.
   *
   * It rides its own line in both directions: sideways with the cursor, and up
   * and down to the height that line stood at, so the reader never has to match
   * a colour in a list back to a curve.
   *
   * Shown only while a cursor is on the chart. The labels have to overlay the
   * plot — the lines run the full width and there is nowhere else to put them —
   * so leaving them up at rest meant the chart's own shape was permanently
   * obscured by boxes repeating what the legend underneath already says. On
   * hover they are worth the cover because they answer a question that is
   * being asked; at rest they answer nothing and hide the curve.
   *
   * Two outcomes a point apart would print on top of each other, so colliding
   * labels are spread — but only the ones that collide, and only around their
   * own average height, so every other label stays exactly on its line. What
   * is left over gets a leader back to the line it belongs to.
   */
  const endLabels = (() => {
    if (cursor === null) return [];
    const avail = W - PAD.left - PAD.right;
    // Below this there is no room for a label that is not mostly ellipsis.
    if (avail < 150) return [];
    const CHAR = LABEL_CHAR;
    const maxW = Math.min(avail - 14, 172);

    const items = lines.map((l) => {
      const pct = `${Math.round(valueOf(l) * 100)}%`;
      const fits = (name: string) =>
        (name.length + 1 + pct.length) * CHAR + 16 <= maxW;
      let name = l.label;
      if (!fits(name)) {
        let n = name.length;
        while (n > 1 && !fits(`${name.slice(0, n)}…`)) n--;
        name = `${name.slice(0, n)}…`;
      }
      const text = `${name} ${pct}`;
      return {
        key: l.label,
        color: l.color,
        text,
        width: text.length * CHAR + 16,
        // Sideways: the crosshair while scrubbing, the line's own end at rest.
        anchorX: cursorX ?? l.cx,
        // Where the line actually is, kept apart from the height the label
        // ends up drawn at so a displaced label can be tied back to it.
        target: l.toY(valueOf(l)),
        y: l.toY(valueOf(l)),
      };
    });

    const ordered = [...items].sort((a, b) => a.target - b.target);
    const top = PAD.top + LABEL_H / 2;
    const bottom = H - PAD.bottom - LABEL_H / 2;
    const SPAN = LABEL_H + 2;

    // Only labels that actually collide get moved, and a colliding group
    // spreads around the average of its own members rather than cascading
    // downwards from the topmost one. An outcome with clear air either side
    // therefore keeps the exact height of its line.
    type Cluster = { items: typeof ordered; start: number };
    const clusters: Cluster[] = [];
    const recentre = (c: Cluster) => {
      const mean =
        c.items.reduce((s, it) => s + it.target, 0) / c.items.length;
      c.start = mean - ((c.items.length - 1) * SPAN) / 2;
    };
    for (const it of ordered) {
      clusters.push({ items: [it], start: it.target });
      // Absorb the cluster above while the two would overlap, then re-centre —
      // a merge can push the group up into the one before it, so loop.
      while (clusters.length > 1) {
        const b = clusters[clusters.length - 1];
        const a = clusters[clusters.length - 2];
        if (a.start + a.items.length * SPAN <= b.start) break;
        clusters.splice(clusters.length - 2, 2, {
          items: [...a.items, ...b.items],
          start: 0,
        });
        recentre(clusters[clusters.length - 1]);
      }
    }

    // Hold the groups inside the plot, walking down then back up so a tall
    // group pinned to one edge cannot shove another off the other edge.
    for (const c of clusters) {
      c.start = Math.max(c.start, top);
      c.start = Math.min(c.start, bottom - (c.items.length - 1) * SPAN);
    }
    for (let i = 1; i < clusters.length; i++) {
      const a = clusters[i - 1];
      const floor = a.start + a.items.length * SPAN;
      if (clusters[i].start < floor) clusters[i].start = floor;
    }
    for (let i = clusters.length - 2; i >= 0; i--) {
      const b = clusters[i + 1];
      const ceil = b.start - clusters[i].items.length * SPAN;
      if (clusters[i].start > ceil) clusters[i].start = ceil;
    }

    for (const c of clusters) {
      c.items.forEach((it, i) => {
        it.y = Math.min(Math.max(c.start + i * SPAN, top), bottom);
      });
    }
    return clusters.flatMap((c) => c.items);
  })();

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
        return (
          <span
            key={l.label}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
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
            {l.odds && (
              <span style={{ color: mutedFill, fontWeight: 600 }}>
                {l.odds}
              </span>
            )}
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
                  opacity={0.25}
                />
              )}
              {past && (
                <path
                  d={past}
                  fill="none"
                  stroke={l.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
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
          return (
            <circle
              key={l.label}
              cx={cursorX}
              cy={l.toY(v)}
              r={3.5}
              fill={l.color}
              stroke={surface}
              strokeWidth={1.5}
            />
          );
        })}

        {/* Each label in the panel the old tooltip wore, one per line, drawn
            only while the chart is being hovered or scrubbed. Sits to the
            RIGHT of the crosshair so it leads the line rather than trailing
            it, and flips left near the end of the range. See `endLabelX`. */}
        {/* Drawn before every box, so a leader passing a crowded neighbour
            runs under that neighbour's panel instead of across its text. */}
        {endLabels.map((it) => {
          if (Math.abs(it.y - it.target) < 1.5) return null;
          const { x, onRight } = endLabelX(it.anchorX, it.width, W);
          // Leader runs from whichever edge faces the line back to it.
          const edgeX = onRight ? x : x + it.width;
          return (
            <path
              key={`lead-${it.key}`}
              d={`M${edgeX} ${it.y} L${it.anchorX} ${it.target}`}
              stroke={it.color}
              strokeWidth={1}
              strokeOpacity={0.5}
              fill="none"
              pointerEvents="none"
            />
          );
        })}

        {endLabels.map((it) => {
          const { x } = endLabelX(it.anchorX, it.width, W);
          return (
            <g key={it.key} pointerEvents="none">
              <rect
                x={x}
                y={it.y - LABEL_H / 2}
                width={it.width}
                height={LABEL_H}
                rx={4}
                fill={tooltipFill}
                stroke={stroke}
                strokeWidth={1}
              />
              <rect
                x={x + 4}
                y={it.y - LABEL_H / 2 + 3.5}
                width={2.5}
                height={LABEL_H - 7}
                rx={1.25}
                fill={it.color}
              />
              <text
                x={x + 10}
                y={it.y + 3.4}
                fontSize={9.5}
                fontWeight={700}
                fill={textFill}
              >
                {it.text}
              </text>
            </g>
          );
        })}
      </svg>

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
