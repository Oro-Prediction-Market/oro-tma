import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { getPlatformAccuracy, type PlatformAccuracy } from "../api/client";

/**
 * Oro's public track record, as a dashboard.
 *
 * For every settled market, the share of the pool that sat on the outcome that
 * actually won. It answers the question a sceptical newcomer actually has —
 * "does this thing work?" — with the one number that cannot be dressed up: it
 * is a property of the market, not of a user, so no lucky account skews it and
 * nobody can farm it.
 *
 * Every panel here is derived from the one public endpoint
 * (`overallAccuracyPct`, `totalMarkets`, and a weekly trend of
 * `{ week, marketCount, avgAccuracyPct }`) — nothing is fetched twice and
 * nothing needs a new backend field.
 *
 * The rate and the volume get their own panels rather than sharing a plot with
 * two y-scales: a second axis invents a correlation the data does not contain.
 * Volume still matters, because a week of four markets is noise and the reader
 * deserves to see that next to the rate.
 *
 * Body only: each app wraps this in its own page shell, because the two have
 * different headers and back behaviour.
 */

type Trend = PlatformAccuracy["trend"];

/** Track-record green — the one measure this page is about. */
const LINE_COLOR = "#22c55e";
/** Volume, in the app's own blue: a different measure, so a different panel. */
const BAR_COLOR = "#2775d0";
/** What a coin scores on a two-way market — the line the rest is read against. */
const BASELINE_PCT = 50;

const ASSUMED_W = 320;

function statusColor(accuracyPct: number): string {
  return accuracyPct >= 60 ? "#22c55e" : accuracyPct >= 40 ? "#f59e0b" : "#ef4444";
}

/**
 * Width of a container, tracked across resizes.
 *
 * Measured rather than a fixed viewBox stretched to fit — a stretched user unit
 * distorts the axis text, which is why it would otherwise have to live outside
 * the SVG.
 */
function useMeasuredWidth() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const next = el.getBoundingClientRect().width;
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

  return { ref, width: w > 0 ? w : ASSUMED_W };
}

/**
 * Monotone cubic (Fritsch–Carlson) through the points, as Bezier segments.
 *
 * Plain Catmull-Rom was tried first and is wrong for this data: on a volatile
 * week it overshoots past both neighbours, drawing a dip to 38% in a series
 * whose lowest real reading is 45%. A track-record chart may not invent a
 * number. Monotone tangents are clamped so no segment leaves the range of the
 * two points it joins — smooth, and it cannot overstate a swing.
 */
function smoothPath(points: { x: number; y: number }[]): string {
  const n = points.length;
  if (n === 0) return "";
  if (n === 1) return `M${points[0].x},${points[0].y}`;

  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    slopes.push(dx === 0 ? 0 : (points[i + 1].y - points[i].y) / dx);
  }

  const tangents: number[] = new Array(n);
  tangents[0] = slopes[0];
  tangents[n - 1] = slopes[n - 2];
  for (let i = 1; i < n - 1; i++) {
    tangents[i] =
      slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (slopes[i] === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
      continue;
    }
    const a = tangents[i] / slopes[i];
    const b = tangents[i + 1] / slopes[i];
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      tangents[i] = t * a * slopes[i];
      tangents[i + 1] = t * b * slopes[i];
    }
  }

  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    d +=
      ` C${points[i].x + dx / 3},${points[i].y + (tangents[i] * dx) / 3}` +
      ` ${points[i + 1].x - dx / 3},${points[i + 1].y - (tangents[i + 1] * dx) / 3}` +
      ` ${points[i + 1].x},${points[i + 1].y}`;
  }
  return d;
}

/** Tick step that lands at most ~5 clean gridlines on a span. */
function tickStep(span: number, steps: number[]): number {
  for (const step of steps) {
    if (span / step <= 5) return step;
  }
  return steps[steps.length - 1];
}

function fmtWeek(week: string): string {
  const d = new Date(`${week}T00:00:00`);
  if (Number.isNaN(d.getTime())) return week;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** A bar with its top corners rounded and its foot square on the baseline. */
function barPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return (
    `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y}` +
    ` L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r}` +
    ` L${x + w},${y + h} Z`
  );
}

const AXIS_TEXT = {
  fontSize: 9,
  fontWeight: 600,
  fill: "var(--text-subtle)",
} as const;

// ── Accuracy trend ───────────────────────────────────────────────────────────

const TREND_H = 232;
const TREND_PAD = { top: 20, right: 14, bottom: 30, left: 36 };

function AccuracyTrendChart({ data }: { data: Trend }) {
  const { ref, width } = useMeasuredWidth();
  const lineRef = useRef<SVGPathElement | null>(null);
  const gradientId = useId();
  const [cursor, setCursor] = useState<number | null>(null);

  // Taller once the card is wide: at a desktop's full width a fixed 232px plot
  // is a 5:1 letterbox, and every move in the series reads as flatter than it
  // was. Capped so it never turns into a square on an ultrawide.
  const H = width > 900 ? 300 : width > 620 ? 264 : TREND_H;
  const PAD = TREND_PAD;
  const ys = data.map((d) => d.avgAccuracyPct);

  // Zero-based would flatten the whole series into the top third: these values
  // live between 40% and 80%, and the story is the movement inside that band.
  // The band always contains 50 — the coin-flip line is what makes the rest of
  // the chart mean anything, and an axis that can exclude it is an axis that
  // can flatter a bad week.
  //
  // The domain stays tight to the data; the *ticks* are what get rounded, and
  // they are placed inside it. Snapping the domain itself out to whole steps
  // was tried and left a third of the card empty below the series.
  const lo = Math.max(0, Math.min(...ys, BASELINE_PCT) - 4);
  const hi = Math.min(100, Math.max(...ys, BASELINE_PCT) + 4);
  const span = Math.max(hi - lo, 10);
  const step = tickStep(span, [2, 5, 10, 20, 25, 50]);
  const plotW = Math.max(width - PAD.left - PAD.right, 1);

  const toX = (i: number) =>
    PAD.left + (i / Math.max(data.length - 1, 1)) * plotW;
  const toY = (v: number) =>
    PAD.top + (1 - (v - lo) / span) * (H - PAD.top - PAD.bottom);

  const points = data.map((d, i) => ({ x: toX(i), y: toY(d.avgAccuracyPct) }));
  const linePath = smoothPath(points);
  const areaPath = points.length
    ? `${linePath} L${points[points.length - 1].x},${H - PAD.bottom} L${points[0].x},${H - PAD.bottom} Z`
    : "";

  // Round-number gridlines placed inside the domain, so every label reads
  // 40% / 50% / 60% rather than 37.5% / 58.3%. The 50 line is drawn
  // separately and more firmly, so it is skipped here.
  const grid: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) {
    if (v !== BASELINE_PCT) grid.push(v);
  }
  const labelEvery = Math.ceil(data.length / (width < 420 ? 4 : 7));

  // Draws the line in on first paint rather than appearing fully formed — a
  // measured stroke-dashoffset animation, not a CSS keyframe guessing at path
  // length, since that length changes with the container's measured width.
  useEffect(() => {
    const el = lineRef.current;
    if (!el) return;
    const len = el.getTotalLength();
    el.style.transition = "none";
    el.style.strokeDasharray = `${len}`;
    el.style.strokeDashoffset = `${len}`;
    el.getBoundingClientRect();
    el.style.transition = "stroke-dashoffset 800ms cubic-bezier(0.22, 1, 0.36, 1)";
    el.style.strokeDashoffset = "0";
  }, [linePath]);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / (r.width || 1)) * width;
    let nearest = 0;
    let bestGap = Infinity;
    points.forEach((p, i) => {
      const gap = Math.abs(p.x - x);
      if (gap < bestGap) {
        bestGap = gap;
        nearest = i;
      }
    });
    setCursor(nearest);
  };

  const lastIdx = data.length - 1;
  const activeIdx = cursor ?? lastIdx;
  const active = data[activeIdx];
  const activePoint = points[activeIdx];
  const lastPoint = points[lastIdx];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${width} ${H}`}
        width="100%"
        height={H}
        style={{ display: "block", touchAction: "pan-y" }}
        onPointerMove={onMove}
        onPointerLeave={() => setCursor(null)}
        role="img"
        aria-label={`Weekly crowd accuracy, ${data.length} weeks, latest ${ys[lastIdx]}%`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={LINE_COLOR} stopOpacity={0.22} />
            <stop offset="100%" stopColor={LINE_COLOR} stopOpacity={0} />
          </linearGradient>
        </defs>

        {grid.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={toY(v)}
              y2={toY(v)}
              stroke="var(--border)"
              strokeWidth={1}
              opacity={0.4}
            />
            <text x={PAD.left - 8} y={toY(v) + 3} textAnchor="end" {...AXIS_TEXT}>
              {v}%
            </text>
          </g>
        ))}

        {/* The coin-flip line. Everything above it is the crowd adding
            information, and that is the whole claim the page makes — so it is
            drawn, not left to the caption. */}
        {BASELINE_PCT >= lo && BASELINE_PCT <= hi && (
          <g>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={toY(BASELINE_PCT)}
              y2={toY(BASELINE_PCT)}
              stroke="var(--text-subtle)"
              strokeWidth={1}
              opacity={0.5}
            />
            <text
              x={PAD.left - 8}
              y={toY(BASELINE_PCT) + 3}
              textAnchor="end"
              {...AXIS_TEXT}
              fontWeight={700}
              fill="var(--text-muted)"
            >
              50%
            </text>
            {/* Below the rule, not above it — the series spends most of its
                time above 50, so the space over the line is where the curve
                is. */}
            <text
              x={width - PAD.right}
              y={toY(BASELINE_PCT) + 12}
              textAnchor="end"
              {...AXIS_TEXT}
              fontWeight={700}
            >
              coin flip
            </text>
          </g>
        )}

        <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
        <path
          ref={lineRef}
          d={linePath}
          fill="none"
          stroke={LINE_COLOR}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {cursor !== null && (
          <>
            <line
              x1={activePoint.x}
              x2={activePoint.x}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="var(--text-subtle)"
              strokeWidth={1}
              opacity={0.55}
            />
            <circle
              cx={activePoint.x}
              cy={activePoint.y}
              r={5}
              fill={LINE_COLOR}
              stroke="var(--bg-card)"
              strokeWidth={2}
            />
          </>
        )}

        {/* The latest reading — always on, so the chart still ends on a
            labelled point once the pointer leaves. */}
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r={9}
          fill={LINE_COLOR}
          opacity={cursor === null ? 0.16 : 0}
        />
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r={4}
          fill={LINE_COLOR}
          stroke="var(--bg-card)"
          strokeWidth={2}
          opacity={cursor === null ? 1 : 0.35}
        />

        {data.map((d, i) =>
          i % labelEvery === 0 ? (
            <text
              key={d.week}
              x={toX(i)}
              y={H - PAD.bottom + 14}
              textAnchor="middle"
              {...AXIS_TEXT}
            >
              {fmtWeek(d.week)}
            </text>
          ) : null,
        )}

        {/* Endpoint label — the one value worth reading without a hover, per
            "label the endpoint" rather than every point. */}
        {cursor === null && (
          <text
            x={Math.min(lastPoint.x + 6, width - PAD.right)}
            y={Math.max(lastPoint.y - 12, PAD.top + 2)}
            textAnchor="end"
            fontSize={11}
            fontWeight={800}
            fill={LINE_COLOR}
          >
            {data[lastIdx].avgAccuracyPct.toFixed(1)}%
          </text>
        )}
      </svg>

      {active && (
        <Tooltip
          x={activePoint.x}
          width={width}
          visible={cursor !== null}
          title={`Week of ${fmtWeek(active.week)}`}
          rows={[
            {
              label: "Accuracy",
              value: `${active.avgAccuracyPct.toFixed(1)}%`,
              color: LINE_COLOR,
            },
            { label: "Markets", value: String(active.marketCount) },
          ]}
        />
      )}
    </div>
  );
}

// ── Weekly volume ────────────────────────────────────────────────────────────

const VOL_H = 206;
const VOL_PAD = { top: 16, right: 14, bottom: 28, left: 36 };

function VolumeChart({ data }: { data: Trend }) {
  const { ref, width } = useMeasuredWidth();
  const [cursor, setCursor] = useState<number | null>(null);

  const H = VOL_H;
  const PAD = VOL_PAD;
  const counts = data.map((d) => d.marketCount);
  // Volume is a count, so this axis starts at zero — unlike the rate above it,
  // where a zero baseline would flatten the whole story.
  const peak = Math.max(...counts, 1);
  const step = tickStep(peak, [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500]);
  const top = Math.ceil(peak / step) * step;

  const plotW = Math.max(width - PAD.left - PAD.right, 1);
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / Math.max(data.length, 1);
  // Capped rather than filling the slot — the leftover is the air between bars.
  const barW = Math.max(Math.min(slot - 3, 24), 2);
  const toY = (v: number) => PAD.top + (1 - v / top) * plotH;

  const grid: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) grid.push(v);

  const labelEvery = Math.ceil(data.length / (width < 420 ? 4 : 7));

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / (r.width || 1)) * width;
    const i = Math.floor((x - PAD.left) / slot);
    setCursor(i >= 0 && i < data.length ? i : null);
  };

  const active = cursor === null ? null : data[cursor];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${width} ${H}`}
        width="100%"
        height={H}
        style={{ display: "block", touchAction: "pan-y" }}
        onPointerMove={onMove}
        onPointerLeave={() => setCursor(null)}
        role="img"
        aria-label={`Markets settled per week, ${data.length} weeks, peak ${peak}`}
      >
        {grid.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={toY(v)}
              y2={toY(v)}
              stroke="var(--border)"
              strokeWidth={1}
              opacity={v === 0 ? 0.75 : 0.4}
            />
            <text x={PAD.left - 8} y={toY(v) + 3} textAnchor="end" {...AXIS_TEXT}>
              {v}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const x = PAD.left + i * slot + (slot - barW) / 2;
          const y = toY(d.marketCount);
          const h = Math.max(H - PAD.bottom - y, 1);
          return (
            <path
              key={d.week}
              d={barPath(x, y, barW, h)}
              fill={BAR_COLOR}
              opacity={cursor === null || cursor === i ? 0.85 : 0.35}
            />
          );
        })}

        {data.map((d, i) =>
          i % labelEvery === 0 ? (
            <text
              key={d.week}
              x={PAD.left + i * slot + slot / 2}
              y={H - PAD.bottom + 14}
              textAnchor="middle"
              {...AXIS_TEXT}
            >
              {fmtWeek(d.week)}
            </text>
          ) : null,
        )}
      </svg>

      {active && cursor !== null && (
        <Tooltip
          x={PAD.left + cursor * slot + slot / 2}
          width={width}
          visible
          title={`Week of ${fmtWeek(active.week)}`}
          rows={[
            {
              label: "Markets",
              value: String(active.marketCount),
              color: BAR_COLOR,
            },
            {
              label: "Accuracy",
              value: `${active.avgAccuracyPct.toFixed(1)}%`,
            },
          ]}
        />
      )}
    </div>
  );
}

// ── Shared chrome ────────────────────────────────────────────────────────────

function Tooltip({
  x,
  width,
  visible,
  title,
  rows,
}: {
  x: number;
  width: number;
  visible: boolean;
  title: string;
  rows: { label: string; value: string; color?: string }[];
}) {
  return (
    <div
      style={{
        position: "absolute",
        // Clamped inside the plot so a cursor at either end does not push the
        // tooltip out past the card's rounded corner.
        left: Math.min(Math.max(x, 62), width - 62),
        top: 2,
        transform: "translateX(-50%)",
        pointerEvents: "none",
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "6px 10px",
        fontSize: "0.68rem",
        fontWeight: 700,
        lineHeight: 1.5,
        color: "var(--text-main)",
        whiteSpace: "nowrap",
        boxShadow: "var(--shadow-md)",
        opacity: visible ? 1 : 0,
        transition: "opacity 120ms ease-out",
      }}
    >
      <div style={{ color: "var(--text-subtle)", marginBottom: 2 }}>{title}</div>
      {rows.map((r) => (
        <div
          key={r.label}
          style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
        >
          <span style={{ color: "var(--text-muted)" }}>{r.label}</span>
          <span style={{ color: r.color ?? "var(--text-main)" }}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function Panel({
  title,
  hint,
  children,
  padded = false,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  padded?: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: padded ? "14px 16px 16px" : "14px 6px 6px",
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
          padding: padded ? 0 : "0 12px",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: "0.62rem",
            fontWeight: 800,
            color: "var(--text-subtle)",
            textTransform: "uppercase",
            letterSpacing: "0.07em",
          }}
        >
          {title}
        </span>
        {hint && (
          <span
            style={{
              fontSize: "0.66rem",
              fontWeight: 600,
              color: "var(--text-muted)",
            }}
          >
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Kpi({
  label,
  value,
  note,
  color,
  hero = false,
  delta,
}: {
  label: string;
  value: string;
  note: string;
  color?: string;
  hero?: boolean;
  delta?: number | null;
}) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "14px 16px 15px",
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: "0.62rem",
          fontWeight: 800,
          color: "var(--text-subtle)",
          textTransform: "uppercase",
          letterSpacing: "0.07em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 7,
          // Proportional figures on purpose: tabular-nums makes a large
          // standalone number read loose.
          fontSize: hero ? "2.1rem" : "1.5rem",
          fontWeight: 900,
          letterSpacing: "-0.03em",
          lineHeight: 1,
          color: color ?? "var(--text-main)",
        }}
      >
        {value}
      </div>
      {/* Delta and note share the footer line rather than the value's line:
          at a tile this narrow a baseline-aligned delta wraps under the
          number anyway, and wrapping is worse than placing it deliberately.
          Direction rides an arrow as well as a colour, so the sign never
          depends on hue alone. */}
      <div
        style={{
          marginTop: 8,
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
          fontSize: "0.68rem",
          fontWeight: 600,
          color: "var(--text-muted)",
        }}
      >
        {delta != null && Math.abs(delta) >= 0.05 && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              fontWeight: 800,
              color: delta >= 0 ? "#22c55e" : "#ef4444",
            }}
          >
            {delta >= 0 ? (
              <TrendingUp size={12} strokeWidth={2.75} />
            ) : (
              <TrendingDown size={12} strokeWidth={2.75} />
            )}
            {Math.abs(delta).toFixed(1)}pp
          </span>
        )}
        <span>{note}</span>
      </div>
    </div>
  );
}

/**
 * The table view — the WCAG-clean twin of the charts above it.
 *
 * Newest first: on a track record, the question is almost always "where is it
 * now", and the charts already carry the shape of the whole run.
 */
/** Row and header heights are fixed so the scroll box can be cut on a row
 *  boundary — a half-height row at the fold reads as a rendering bug. */
const ROW_H = 36;
const HEAD_H = 26;
const VISIBLE_ROWS = 5;

function WeeksTable({ data }: { data: Trend }) {
  const rows = [...data].reverse();
  const cell: React.CSSProperties = {
    height: ROW_H,
    padding: "0 10px",
    fontSize: "0.72rem",
    fontWeight: 700,
    whiteSpace: "nowrap",
  };
  const head: React.CSSProperties = {
    ...cell,
    height: HEAD_H,
    position: "sticky",
    top: 0,
    background: "var(--bg-card)",
    fontSize: "0.6rem",
    fontWeight: 800,
    color: "var(--text-subtle)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  };

  return (
    // Capped to whole rows, at roughly the height of the chart beside it, so
    // the two panels in that row finish level instead of one stretching.
    <div
      style={{
        maxHeight: HEAD_H + VISIBLE_ROWS * ROW_H,
        overflowY: "auto",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <thead>
          <tr>
            <th style={{ ...head, textAlign: "left" }}>Week</th>
            <th style={{ ...head, textAlign: "right" }}>Markets</th>
            <th style={{ ...head, textAlign: "right" }}>Accuracy</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.week} style={{ borderTop: "1px solid var(--border)" }}>
              <td style={{ ...cell, color: "var(--text-muted)" }}>
                {fmtWeek(d.week)}
              </td>
              <td
                style={{ ...cell, textAlign: "right", color: "var(--text-muted)" }}
              >
                {d.marketCount}
              </td>
              <td
                style={{
                  ...cell,
                  textAlign: "right",
                  color: "var(--text-main)",
                }}
              >
                {/* A dot beside the number carries above/below the coin flip,
                    so the reading never rests on the text's colour. */}
                <span
                  style={{
                    display: "inline-block",
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    marginRight: 6,
                    verticalAlign: "middle",
                    background:
                      d.avgAccuracyPct >= BASELINE_PCT ? LINE_COLOR : "#ef4444",
                  }}
                />
                {d.avgAccuracyPct.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: 0,
        fontSize: "0.72rem",
        lineHeight: 1.6,
        color: "var(--text-muted)",
      }}
    >
      {children}
    </p>
  );
}

export function PlatformAccuracyPanel() {
  const [data, setData] = useState<PlatformAccuracy | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getPlatformAccuracy()
      .then(setData)
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <div
        style={{
          padding: "14px 16px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border)",
          background: "var(--bg-card)",
          fontSize: "0.8rem",
          color: "var(--text-muted)",
        }}
      >
        Could not load the record just now. Please try again shortly.
      </div>
    );
  }

  if (!data) {
    return (
      <div
        style={{
          padding: "40px 16px",
          textAlign: "center",
          fontSize: "0.8rem",
          color: "var(--text-subtle)",
        }}
      >
        Loading…
      </div>
    );
  }

  const accuracy = data.overallAccuracyPct;
  const trend = data.trend;
  const latest = trend[trend.length - 1];
  const prior = trend[trend.length - 2];
  const delta =
    latest && prior ? latest.avgAccuracyPct - prior.avgAccuracyPct : null;
  const best = trend.reduce<Trend[number] | null>(
    (acc, d) => (!acc || d.avgAccuracyPct > acc.avgAccuracyPct ? d : acc),
    null,
  );
  const above = trend.filter((d) => d.avgAccuracyPct >= BASELINE_PCT).length;
  const busiest = trend.reduce((m, d) => Math.max(m, d.marketCount), 0);
  const enoughHistory = trend.length >= 2;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Note>
        Every time a market settles, we measure how much of the pool was sitting
        on the outcome that actually won. Averaged across every settled market,
        that is how often the crowd on Oro gets it right.
      </Note>

      {/* KPI row. auto-fit rather than a media query: this file is shared with
          the Telegram app, whose sheet is narrower than any breakpoint here. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(168px, 1fr))",
          gap: 12,
        }}
      >
        <Kpi
          label="Crowd accuracy"
          value={`${accuracy.toFixed(1)}%`}
          note="all settled markets"
          color={statusColor(accuracy)}
          hero
          delta={delta}
        />
        <Kpi
          label="Markets measured"
          value={data.totalMarkets.toLocaleString()}
          note="settled, with a real pool"
        />
        <Kpi
          label="Latest week"
          value={latest ? `${latest.avgAccuracyPct.toFixed(1)}%` : "—"}
          note={latest ? `week of ${fmtWeek(latest.week)}` : "no weeks yet"}
        />
        <Kpi
          label="Weeks above coin flip"
          value={trend.length ? `${above}/${trend.length}` : "—"}
          note={best ? `best ${best.avgAccuracyPct.toFixed(1)}%` : "no weeks yet"}
        />
      </div>

      <Panel
        title="Weekly accuracy"
        hint={enoughHistory ? `${trend.length} weeks` : undefined}
      >
        {enoughHistory ? (
          <AccuracyTrendChart data={trend} />
        ) : (
          <p
            style={{
              margin: 0,
              padding: "10px 12px 18px",
              fontSize: "0.78rem",
              color: "var(--text-muted)",
            }}
          >
            Not enough history yet — the trend needs at least two weeks of
            settled markets.
          </p>
        )}
      </Panel>

      {enoughHistory && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 12,
          }}
        >
          <Panel title="Markets settled per week" hint={`peak ${busiest}`}>
            <VolumeChart data={trend} />
          </Panel>
          <Panel title="Week by week" hint="newest first" padded>
            <WeeksTable data={trend} />
          </Panel>
        </div>
      )}

      <Note>
        Cancelled markets and markets that settled with an empty pool are
        excluded. 50% is what a coin would score on a two-way market, so
        anything above it is the crowd adding information — not a house edge,
        and not a promise about any single market.
      </Note>
    </div>
  );
}
