import { useEffect, useState } from "react";
import { getPlatformAccuracy, type PlatformAccuracy } from "../api/client";

/**
 * Oro's public track record.
 *
 * For every settled market, the share of the pool that sat on the outcome that
 * actually won. It answers the question a sceptical newcomer actually has —
 * "does this thing work?" — with the one number that cannot be dressed up: it
 * is a property of the market, not of a user, so no lucky account skews it and
 * nobody can farm it.
 *
 * The same figures the admin dashboard shows, from the same service. Body only:
 * each app wraps this in its own page shell, because the two have different
 * headers and back behaviour.
 *
 * Fetches its own data. That is normally the page's job, but this has exactly
 * one caller in each app and one public endpoint behind it, so threading it
 * through a prop would buy nothing.
 */

const H = 200;
const PAD = { top: 14, right: 12, bottom: 30, left: 34 };

function TrendChart({
  data,
  width,
}: {
  data: PlatformAccuracy["trend"];
  width: number;
}) {
  const ys = data.map((d) => d.avgAccuracyPct);
  // Zero-based would flatten the whole series into the top third: these values
  // live between 40% and 80%, and the story is the movement inside that band.
  // Padded to a 20-point floor so a flat month does not read as a cliff.
  const lo = Math.max(0, Math.min(...ys) - 8);
  const hi = Math.min(100, Math.max(...ys) + 8);
  const span = Math.max(hi - lo, 20);
  const plotW = Math.max(width - PAD.left - PAD.right, 1);

  const toX = (i: number) =>
    PAD.left + (i / Math.max(data.length - 1, 1)) * plotW;
  const toY = (v: number) =>
    PAD.top + (1 - (v - lo) / span) * (H - PAD.top - PAD.bottom);

  const line = data.map((d, i) => `${toX(i)},${toY(d.avgAccuracyPct)}`).join(" ");
  const area = `${toX(0)},${H - PAD.bottom} ${line} ${toX(data.length - 1)},${H - PAD.bottom}`;

  // Four gridlines inside the visible band, rounded to whole percents.
  const grid = [0, 1, 2, 3].map((k) => Math.round(lo + (span * k) / 3));
  const labelEvery = Math.ceil(data.length / (width < 420 ? 4 : 7));

  return (
    <svg
      viewBox={`0 0 ${width} ${H}`}
      width="100%"
      height={H}
      style={{ display: "block" }}
      role="img"
      aria-label={`Weekly crowd accuracy, ${data.length} weeks, latest ${ys[ys.length - 1]}%`}
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
            opacity={0.5}
          />
          <text
            x={PAD.left - 6}
            y={toY(v) + 3}
            textAnchor="end"
            fontSize={9}
            fontWeight={600}
            fill="var(--text-subtle)"
          >
            {v}%
          </text>
        </g>
      ))}

      <polyline points={area} fill="rgba(34,197,94,0.10)" stroke="none" />
      <polyline
        points={line}
        fill="none"
        stroke="#22c55e"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {data.map((d, i) => (
        <g key={d.week}>
          <circle cx={toX(i)} cy={toY(d.avgAccuracyPct)} r={2.5} fill="#22c55e" />
          <title>
            {d.week} — {d.avgAccuracyPct}% across {d.marketCount} market
            {d.marketCount === 1 ? "" : "s"}
          </title>
          {i % labelEvery === 0 && (
            <text
              x={toX(i)}
              y={H - PAD.bottom + 14}
              textAnchor="middle"
              fontSize={9}
              fontWeight={600}
              fill="var(--text-subtle)"
            >
              {d.week.slice(5)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

function Stat({
  label,
  value,
  note,
  color,
}: {
  label: string;
  value: string;
  note: string;
  color?: string;
}) {
  return (
    <div
      style={{
        flex: "1 1 140px",
        minWidth: 0,
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "12px 14px",
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
          marginTop: 5,
          fontSize: "1.5rem",
          fontWeight: 900,
          letterSpacing: "-0.02em",
          color: color ?? "var(--text-main)",
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: 2,
          fontSize: "0.66rem",
          fontWeight: 600,
          color: "var(--text-muted)",
        }}
      >
        {note}
      </div>
    </div>
  );
}

export function PlatformAccuracyPanel() {
  const [data, setData] = useState<PlatformAccuracy | null>(null);
  const [error, setError] = useState(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    getPlatformAccuracy()
      .then(setData)
      .catch(() => setError(true));
  }, []);

  // Measured rather than a fixed viewBox stretched to fit: a stretched user
  // unit distorts the axis text, which is why it would otherwise have to live
  // outside the SVG.
  const measure = (el: HTMLDivElement | null) => {
    if (el) setWidth(el.getBoundingClientRect().width || 320);
  };

  const accuracy = data?.overallAccuracyPct ?? 0;
  const color =
    accuracy >= 60 ? "#22c55e" : accuracy >= 40 ? "#f59e0b" : "#ef4444";
  const latest = data?.trend[data.trend.length - 1];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p
        style={{
          margin: 0,
          fontSize: "0.8rem",
          lineHeight: 1.6,
          color: "var(--text-muted)",
        }}
      >
        Every time a market settles, we measure how much of the pool was sitting
        on the outcome that actually won. Averaged across every settled market,
        that is how often the crowd on Oro gets it right.
      </p>

      {error && (
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
      )}

      {!error && !data && (
        <div
          style={{
            padding: "28px 16px",
            textAlign: "center",
            fontSize: "0.8rem",
            color: "var(--text-subtle)",
          }}
        >
          Loading…
        </div>
      )}

      {data && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <Stat
              label="Crowd accuracy"
              value={`${accuracy.toFixed(1)}%`}
              note={`across ${data.totalMarkets.toLocaleString()} settled market${data.totalMarkets === 1 ? "" : "s"}`}
              color={color}
            />
            <Stat
              label="Markets measured"
              value={data.totalMarkets.toLocaleString()}
              note="settled, with a real pool"
            />
            {latest && (
              <Stat
                label="Latest week"
                value={`${latest.avgAccuracyPct.toFixed(1)}%`}
                note={`week of ${latest.week}`}
                color="#60a5fa"
              />
            )}
          </div>

          <div
            ref={measure}
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "12px 4px 4px",
            }}
          >
            <div
              style={{
                fontSize: "0.62rem",
                fontWeight: 800,
                color: "var(--text-subtle)",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                padding: "0 10px 6px",
              }}
            >
              Week by week
            </div>
            {data.trend.length < 2 ? (
              <p
                style={{
                  margin: 0,
                  padding: "10px 10px 18px",
                  fontSize: "0.78rem",
                  color: "var(--text-muted)",
                }}
              >
                Not enough history yet — the trend needs at least two weeks of
                settled markets.
              </p>
            ) : (
              width > 0 && <TrendChart data={data.trend} width={width} />
            )}
          </div>

          <p
            style={{
              margin: 0,
              fontSize: "0.7rem",
              lineHeight: 1.6,
              color: "var(--text-subtle)",
            }}
          >
            Cancelled markets and markets that settled with an empty pool are
            excluded. 50% is what a coin would score on a two-way market, so
            anything above it is the crowd adding information — not a house
            edge, and not a promise about any single market.
          </p>
        </>
      )}
    </div>
  );
}
