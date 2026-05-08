import { useState, useEffect, memo, type FC } from "react";
import { useNavigate } from "react-router-dom";
import { getTerPrice, type Market, type TerPrice } from "@shared/api/client";
import { TrendingUp, TrendingDown, Clock } from "lucide-react";

function useCountdown(targetAt: string | null): string {
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (!targetAt) return;
    const tick = () => {
      const ms = new Date(targetAt).getTime() - Date.now();
      if (ms <= 0) {
        setLabel("Closing");
        return;
      }
      const m = Math.floor(ms / 60_000);
      const s = Math.floor((ms % 60_000) / 1000);
      setLabel(m > 0 ? `${m}m ${s}s` : `${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetAt]);
  return label;
}

function useLivePrice(active: boolean) {
  const [live, setLive] = useState<TerPrice | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  useEffect(() => {
    if (!active) return;
    const fetch_ = () =>
      getTerPrice()
        .then((p) => {
          setLive(p);
          setHistory((h) => [...h.slice(-19), p.midPrice]);
        })
        .catch(() => {});
    fetch_();
    const id = setInterval(fetch_, 5_000);
    return () => clearInterval(id);
  }, [active]);
  return { live, history };
}

interface Props {
  market: Market;
  onBet?: (outcomeId: string) => void;
  hasBet?: boolean;
  userPickedOutcomeId?: string;
}

export const TerMarketCard: FC<Props> = memo(
  ({ market, onBet, hasBet, userPickedOutcomeId }) => {
    const navigate = useNavigate();
    const meta = market.metadata;
    const isSettled =
      market.status === "settled" || market.status === "resolved";
    const isClosed =
      market.status === "closed" || market.status === "resolving";
    const bettingClosed = !!(
      market.bettingClosesAt && new Date() > new Date(market.bettingClosesAt)
    );

    const countdown = useCountdown(
      isClosed || isSettled
        ? null
        : (market.bettingClosesAt ?? market.closesAt),
    );
    const { live: livePrice, history } = useLivePrice(!isSettled && !isClosed);

    // Use buy price for display to match TER portal's convention
    const refPrice = meta?.referenceBuyPrice ?? meta?.referenceTerPrice ?? 0;
    const liveDisplayPrice = isSettled
      ? (meta?.settlementBuyPrice ?? meta?.settlementTerPrice)
      : (livePrice?.buyPrice ?? livePrice?.midPrice);

    // Direction based on mid (objective, matches resolution logic)
    const refMid = meta?.referenceTerPrice ?? 0;
    const liveMid = isSettled ? meta?.settlementTerPrice : livePrice?.midPrice;
    const direction =
      liveMid == null
        ? null
        : liveMid > refMid
          ? "up"
          : liveMid < refMid
            ? "down"
            : "flat";

    const priceDiff =
      liveDisplayPrice != null ? liveDisplayPrice - refPrice : null;
    const pricePct =
      priceDiff != null && refPrice
        ? ((priceDiff / refPrice) * 100).toFixed(2)
        : null;

    const upOutcome = market.outcomes.find((o) => o.label === "UP");
    const downOutcome = market.outcomes.find((o) => o.label === "DOWN");
    const totalPool = Number(market.totalPool);
    const upPct =
      totalPool > 0 && upOutcome
        ? Math.round((Number(upOutcome.totalBetAmount) / totalPool) * 100)
        : 50;
    const downPct = 100 - upPct;

    const userPicked =
      userPickedOutcomeId === upOutcome?.id
        ? "UP"
        : userPickedOutcomeId === downOutcome?.id
          ? "DOWN"
          : null;

    const winLabel = isSettled
      ? (market.outcomes.find((o) => o.id === market.resolvedOutcomeId)
          ?.label ?? null)
      : null;

    const upColor = "#22c55e";
    const downColor = "#ef4444";
    const liveColor =
      direction === "up"
        ? upColor
        : direction === "down"
          ? downColor
          : "var(--text-primary, #fff)";

    const borderColor =
      direction === "up"
        ? "rgba(34,197,94,0.3)"
        : direction === "down"
          ? "rgba(239,68,68,0.3)"
          : "rgba(255,255,255,0.08)";

    return (
      <div
        onClick={() => navigate(`/market/${market.id}`)}
        style={{
          background: "var(--bg-card, #1a1a2e)",
          border: `1.5px solid ${borderColor}`,
          borderRadius: 16,
          padding: "12px 14px",
          marginBottom: 14,
          cursor: "pointer",
          userSelect: "none",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: "var(--accent, #a78bfa)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            TER · 5 Min
          </span>
          {!isSettled && !isClosed && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 3,
                color: bettingClosed
                  ? "#f59e0b"
                  : "var(--text-secondary, #9ca3af)",
                fontSize: 10,
                minWidth: 52,
                justifyContent: "flex-end",
                whiteSpace: "nowrap",
              }}
            >
              <Clock size={10} />
              <span>{bettingClosed ? "Resolving…" : countdown || "--"}</span>
            </div>
          )}
          {(isSettled || isClosed) && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: isSettled ? upColor : "#f59e0b",
                background: isSettled
                  ? "rgba(34,197,94,0.12)"
                  : "rgba(245,158,11,0.12)",
                padding: "2px 8px",
                borderRadius: 99,
              }}
            >
              {isSettled ? "SETTLED" : "RESOLVING"}
            </span>
          )}
        </div>

        {/* TER Price: base → live (buy price, matching TER portal) */}
        <div
          style={{
            marginBottom: 14,
            padding: "10px",
            background: "rgba(255,255,255,0.04)",
            borderRadius: 12,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: "var(--text-secondary, #9ca3af)",
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              textAlign: "center",
            }}
          >
            TER Price · {isSettled ? "Open → Close" : "Base → Live"}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "var(--text-primary, #fff)",
              }}
            >
              Nu {refPrice > 0 ? refPrice.toFixed(4) : "—"}
            </span>
            <span
              style={{ color: "var(--text-secondary, #6b7280)", fontSize: 14 }}
            >
              →
            </span>
            <span style={{ fontSize: 16, fontWeight: 700, color: liveColor }}>
              {liveDisplayPrice != null
                ? `Nu ${liveDisplayPrice.toFixed(4)}`
                : "—"}
            </span>
            {direction === "up" && <TrendingUp size={14} color={upColor} />}
            {direction === "down" && (
              <TrendingDown size={14} color={downColor} />
            )}
          </div>

          {priceDiff != null && direction !== "flat" && direction != null && (
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: liveColor,
                textAlign: "center",
              }}
            >
              {priceDiff > 0 ? "+" : ""}
              {Math.round(priceDiff * 10000)} pips ({priceDiff > 0 ? "+" : ""}
              {pricePct}%)
            </div>
          )}
        </div>

        {/* Sparkline */}
        {history.length > 2 && (
          <div style={{ marginBottom: 6 }}>
            <svg
              viewBox="0 0 120 28"
              style={{ width: "100%", height: 28, display: "block" }}
            >
              {(() => {
                const min = Math.min(...history);
                const max = Math.max(...history);
                const range = max - min || 1;
                const pts = history.map((p, i) => ({
                  x: (i / (history.length - 1)) * 120,
                  y: 24 - ((p - min) / range) * 20,
                }));
                // Catmull-Rom to cubic bezier smooth path
                let d = `M${pts[0].x},${pts[0].y}`;
                for (let i = 0; i < pts.length - 1; i++) {
                  const p0 = pts[Math.max(i - 1, 0)];
                  const p1 = pts[i];
                  const p2 = pts[i + 1];
                  const p3 = pts[Math.min(i + 2, pts.length - 1)];
                  const cp1x = p1.x + (p2.x - p0.x) / 6;
                  const cp1y = p1.y + (p2.y - p0.y) / 6;
                  const cp2x = p2.x - (p3.x - p1.x) / 6;
                  const cp2y = p2.y - (p3.y - p1.y) / 6;
                  d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
                }
                const lineColor =
                  direction === "up"
                    ? upColor
                    : direction === "down"
                      ? downColor
                      : "#6b7280";
                const last = pts[pts.length - 1];
                return (
                  <>
                    <path
                      d={d}
                      fill="none"
                      stroke={lineColor}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx={last.x} cy={last.y} r="3" fill={lineColor}>
                      <animate
                        attributeName="r"
                        values="3;4;3"
                        dur="1.5s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="1;0.6;1"
                        dur="1.5s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  </>
                );
              })()}
            </svg>
          </div>
        )}

        {/* Sentiment bar */}
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              height: 6,
              borderRadius: 99,
              background: "rgba(255,255,255,0.08)",
              overflow: "hidden",
              display: "flex",
            }}
          >
            <div
              style={{
                width: `${upPct}%`,
                background: upColor,
                transition: "width 0.4s ease",
              }}
            />
            <div style={{ flex: 1, background: downColor }} />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 4,
            }}
          >
            <span style={{ fontSize: 11, color: upColor }}>▲ UP {upPct}%</span>
            <span style={{ fontSize: 11, color: downColor }}>
              ▼ DOWN {downPct}%
            </span>
          </div>
        </div>

        {/* Action area */}
        {isSettled ? (
          <div
            style={{
              textAlign: "center",
              padding: "10px",
              borderRadius: 10,
              background:
                winLabel === "UP"
                  ? "rgba(34,197,94,0.12)"
                  : "rgba(239,68,68,0.12)",
              color: winLabel === "UP" ? upColor : downColor,
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {winLabel === "UP" ? "▲ UP won" : "▼ DOWN won"}
            {userPicked && (
              <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.8 }}>
                {userPicked === winLabel ? "· You won 🎉" : "· You lost"}
              </span>
            )}
          </div>
        ) : hasBet ? (
          <div
            style={{
              textAlign: "center",
              fontSize: 12,
              color: "var(--text-secondary, #9ca3af)",
              padding: "8px 0",
            }}
          >
            You picked{" "}
            <b style={{ color: userPicked === "UP" ? upColor : downColor }}>
              {userPicked}
            </b>
          </div>
        ) : bettingClosed ? (
          <div
            style={{
              textAlign: "center",
              fontSize: 12,
              color: "#f59e0b",
              padding: "8px 0",
            }}
          >
            Betting closed — results incoming
          </div>
        ) : (
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (upOutcome) onBet?.(upOutcome.id);
              }}
              style={{
                padding: "8px 0",
                borderRadius: 10,
                border: "none",
                background: "rgba(34,197,94,0.15)",
                color: upColor,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <TrendingUp size={14} /> UP
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (downOutcome) onBet?.(downOutcome.id);
              }}
              style={{
                padding: "8px 0",
                borderRadius: 10,
                border: "none",
                background: "rgba(239,68,68,0.15)",
                color: downColor,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <TrendingDown size={14} /> DOWN
            </button>
          </div>
        )}

        {totalPool > 0 && (
          <div
            style={{
              textAlign: "center",
              marginTop: 10,
              fontSize: 11,
              color: "var(--text-secondary, #6b7280)",
            }}
          >
            Pool: Nu {totalPool.toLocaleString()}
          </div>
        )}
      </div>
    );
  },
);
