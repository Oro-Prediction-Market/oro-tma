import { useState, useEffect, useCallback, useRef, memo, type FC } from "react";
import { useNavigate } from "react-router-dom";
import { getTerPrice, getTerPriceHistory, type Market, type TerPrice } from "@shared/api/client";

function useCountdown(targetAt: string | null): string {
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (!targetAt) return;
    const tick = () => {
      const ms = new Date(targetAt).getTime() - Date.now();
      if (ms <= 0) { setLabel("Closing"); return; }
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      const s = Math.floor((ms % 60_000) / 1000);
      const p = (n: number) => String(n).padStart(2, "0");
      setLabel(`${p(h)}:${p(m)}:${p(s)}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetAt]);
  return label;
}

const POLL_MS = 5_000;

function useLiveTerPrice(active: boolean) {
  const [live, setLive] = useState<TerPrice | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  useEffect(() => {
    if (!active) return;
    // Seed the chart from the backend's rolling history so it renders on
    // first paint instead of waiting several polls to accumulate points
    getTerPriceHistory()
      .then((pts) => {
        if (pts.length === 0) return;
        setLive((l) => l ?? pts[pts.length - 1]);
        setHistory((h) =>
          pts.length > h.length ? pts.slice(-60).map((p) => p.buyPrice) : h,
        );
      })
      .catch(() => {});
    const fetch_ = () =>
      getTerPrice()
        .then((p) => {
          setLive(p);
          // Buy price — matches the TER portal's display convention
          setHistory((h) => [...h.slice(-59), p.buyPrice]);
        })
        .catch(() => {});
    fetch_();
    const id = setInterval(fetch_, POLL_MS);
    return () => clearInterval(id);
  }, [active]);
  return { live, history };
}

function fmtNu(n: number): string {
  return "Nu " + n.toFixed(4);
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function niceGridPrices(min: number, max: number): number[] {
  const range = max - min || 1;
  const mag   = Math.pow(10, Math.floor(Math.log10(range)));
  const nr    = range / mag;
  const step  = nr <= 2 ? mag * 0.5 : nr <= 5 ? mag : mag * 2;
  const lo    = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= max + step * 0.01 && out.length < 3; v += step)
    out.push(Math.round(v * 10000) / 10000);
  return out;
}

interface SparkState { curr: number[]; prevLast: number; t: number }

const TerSparkline: FC<{ history: number[]; refPrice: number }> = memo(
  ({ history, refPrice }) => {
    const canvasRef    = useRef<HTMLCanvasElement>(null);
    const rafIdRef     = useRef(0);
    const lastNowRef   = useRef(0);
    const stateRef     = useRef<SparkState>({ curr: [], prevLast: 0, t: 1 });
    const refPriceRef  = useRef(refPrice);
    const firstTsRef   = useRef(0);

    useEffect(() => { refPriceRef.current = refPrice; }, [refPrice]);

    useEffect(() => {
      if (history.length < 2) return;
      firstTsRef.current = Date.now() - (history.length - 1) * POLL_MS;
      const s = stateRef.current;
      s.prevLast = s.curr.length > 0 ? s.curr[s.curr.length - 1] : history[history.length - 1];
      s.curr = [...history];
      s.t = 0;
    }, [history]);

    useEffect(() => {
      const DURATION = 400;
      const TENSION  = 0.35;
      const GOLD     = "#F4AF39";

      const render = (now: number) => {
        const delta = lastNowRef.current > 0 ? now - lastNowRef.current : 16;
        lastNowRef.current = now;

        const s = stateRef.current;
        s.t = Math.min(1, s.t + delta / DURATION);

        const canvas = canvasRef.current;
        if (canvas) {
          const dpr = Math.round(window.devicePixelRatio || 1);
          const W   = canvas.offsetWidth;
          const H   = canvas.offsetHeight;
          if (W > 0 && H > 0) {
            if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
              canvas.width  = W * dpr;
              canvas.height = H * dpr;
            }
            const ctx = canvas.getContext("2d");
            if (ctx && s.curr.length >= 2) {
              ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
              ctx.clearRect(0, 0, W, H);

              const et      = easeOut(s.t);
              const lastIdx = s.curr.length - 1;
              const animLast = s.prevLast + (s.curr[lastIdx] - s.prevLast) * et;
              const vals = s.curr.map((v, i) => i === lastIdx ? animLast : v);

              const smooth = vals.map((v, i) => {
                if (i < 2 || i >= vals.length - 2) return v;
                return (vals[i - 2] + vals[i - 1] + v + vals[i + 1] + vals[i + 2]) / 5;
              });

              const rawMin = Math.min(...smooth);
              const rawMax = Math.max(...smooth);
              const rawR   = rawMax - rawMin || 1;
              const yMin   = rawMin - rawR * 0.12;
              const yMax   = rawMax + rawR * 0.12;
              const yR     = yMax - yMin;

              const LPAD   = 52;
              const BPAD   = 16;
              const chartW = W - LPAD;
              const chartH = H - BPAD;

              const toX = (i: number) => (i / (smooth.length - 1)) * chartW;
              const toY = (v: number) => chartH - ((v - yMin) / yR) * chartH;
              const pts = smooth.map((v, i) => ({ x: toX(i), y: toY(v) }));

              // Grid + Y labels
              const gridPrices = niceGridPrices(rawMin, rawMax);
              ctx.font = "500 7px Inter, -apple-system, sans-serif";
              ctx.textAlign = "right";
              ctx.textBaseline = "middle";
              for (const gp of gridPrices) {
                const gy = toY(gp);
                if (gy < 4 || gy > chartH - 4) continue;
                ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(chartW, gy);
                ctx.strokeStyle = "rgba(255,255,255,0.06)";
                ctx.lineWidth = 1; ctx.setLineDash([]); ctx.stroke();
                ctx.fillStyle = "rgba(255,255,255,0.28)";
                ctx.fillText(gp.toFixed(4), W - 2, gy);
              }

              // Catmull-Rom
              const drawCurve = () => {
                ctx.moveTo(pts[0].x, pts[0].y);
                for (let i = 0; i < pts.length - 1; i++) {
                  const p0 = pts[Math.max(i - 1, 0)];
                  const p1 = pts[i];
                  const p2 = pts[i + 1];
                  const p3 = pts[Math.min(i + 2, pts.length - 1)];
                  ctx.bezierCurveTo(
                    p1.x + (p2.x - p0.x) * TENSION, p1.y + (p2.y - p0.y) * TENSION,
                    p2.x - (p3.x - p1.x) * TENSION, p2.y - (p3.y - p1.y) * TENSION,
                    p2.x, p2.y,
                  );
                }
              };

              // Area fill
              const grad = ctx.createLinearGradient(0, 0, 0, chartH);
              grad.addColorStop(0, "rgba(244,175,57,0.18)");
              grad.addColorStop(1, "rgba(244,175,57,0)");
              ctx.beginPath(); drawCurve();
              ctx.lineTo(chartW, chartH); ctx.lineTo(0, chartH); ctx.closePath();
              ctx.fillStyle = grad; ctx.fill();

              // Line
              ctx.beginPath(); drawCurve();
              ctx.strokeStyle = GOLD; ctx.lineWidth = 1.8;
              ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();

              // Target dashed line
              const rp = refPriceRef.current;
              if (rp > 0) {
                const ty = toY(rp);
                if (ty > 2 && ty < chartH - 2) {
                  ctx.save();
                  ctx.setLineDash([5, 4]);
                  ctx.beginPath(); ctx.moveTo(0, ty); ctx.lineTo(chartW, ty);
                  ctx.strokeStyle = "rgba(255,255,255,0.2)";
                  ctx.lineWidth = 1; ctx.stroke();
                  ctx.restore();
                  ctx.fillStyle = "rgba(255,255,255,0.09)";
                  ctx.fillRect(chartW + 2, ty - 8, LPAD - 2, 16);
                  ctx.fillStyle = "rgba(255,255,255,0.6)";
                  ctx.font = "600 7px Inter, -apple-system, sans-serif";
                  ctx.textAlign = "center"; ctx.textBaseline = "middle";
                  ctx.fillText("Target", chartW + LPAD / 2, ty);
                }
              }

              // X-axis time labels
              const fts = firstTsRef.current;
              if (fts > 0 && smooth.length >= 3) {
                ctx.font = "500 7px Inter, -apple-system, sans-serif";
                ctx.fillStyle = "rgba(255,255,255,0.22)";
                ctx.textBaseline = "bottom";
                const idxs = [
                  Math.floor(smooth.length * 0.05),
                  Math.floor(smooth.length * 0.5),
                  smooth.length - 1,
                ];
                idxs.forEach((idx, pos) => {
                  const d  = new Date(fts + idx * POLL_MS);
                  const hh = String(d.getHours()).padStart(2, "0");
                  const mm = String(d.getMinutes()).padStart(2, "0");
                  const ss = String(d.getSeconds()).padStart(2, "0");
                  const x  = toX(idx);
                  ctx.textAlign = pos === 0 ? "left" : pos === 1 ? "center" : "right";
                  ctx.fillText(`${hh}:${mm}:${ss}`, Math.min(x, chartW - 2), H - 1);
                });
              }

              // Pulsing dot
              const last  = pts[pts.length - 1];
              const phase = (1 + Math.sin(now / 560)) / 2;
              ctx.beginPath();
              ctx.arc(last.x, last.y, 3 + phase * 4, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(244,175,57,${(0.3 * (1 - phase)).toFixed(2)})`;
              ctx.fill();
              ctx.beginPath();
              ctx.arc(last.x, last.y, 2.5, 0, Math.PI * 2);
              ctx.fillStyle = GOLD; ctx.fill();
            }
          }
        }

        rafIdRef.current = requestAnimationFrame(render);
      };

      rafIdRef.current = requestAnimationFrame(render);
      return () => { cancelAnimationFrame(rafIdRef.current); lastNowRef.current = 0; };
    }, []);

    return <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />;
  },
);

const TerCoin: FC<{ size?: number }> = ({ size = 36 }) => (
  <img
    src="/ter.webp"
    alt="TER"
    width={size}
    height={size}
    decoding="async"
    style={{ flexShrink: 0, objectFit: "contain", display: "block", borderRadius: "50%", background: "rgba(244,175,57,0.12)" }}
  />
);

interface Props {
  market: Market;
  onBet?: (outcomeId: string) => void;
  hasBet?: boolean;
  userPickedOutcomeId?: string;
}

export const TerMarketCard: FC<Props> = memo(
  ({ market, onBet, hasBet, userPickedOutcomeId }) => {
    const navigate = useNavigate();
    const [hoveredBtn, setHoveredBtn] = useState<"up" | "down" | null>(null);
    const hoverUp   = useCallback(() => setHoveredBtn("up"),   []);
    const hoverDown = useCallback(() => setHoveredBtn("down"), []);
    const hoverOff  = useCallback(() => setHoveredBtn(null),   []);

    const meta = market.metadata || {};
    const isSettled  = market.status === "settled" || market.status === "resolved";
    const isClosed   = market.status === "closed"  || market.status === "resolving";
    const bettingClosed = !!(market.bettingClosesAt && new Date() > new Date(market.bettingClosesAt));

    // Betting phase counts down to the price lock; measuring phase counts
    // down to settlement.
    const countdown = useCountdown(
      isClosed || isSettled
        ? null
        : bettingClosed
          ? (market.closesAt ?? null)
          : (market.bettingClosesAt ?? market.closesAt),
    );
    const livePrice = useLiveTerPrice(!isSettled && !isClosed);

    // Buy price — matches the TER portal's display convention
    const refPrice: number = meta.referenceBuyPrice ?? meta.referenceTerPrice ?? 0;
    // Bet-first-then-measure: the reference price only exists once betting
    // has closed. Before that there is nothing to compare against.
    const refLocked = refPrice > 0;
    const liveDisplayPrice: number | undefined = isSettled
      ? (meta.settlementBuyPrice ?? meta.settlementTerPrice)
      : (livePrice.live?.buyPrice ?? livePrice.live?.midPrice);
    const priceHistory = livePrice.history;

    const priceDiff  = liveDisplayPrice != null && refLocked ? liveDisplayPrice - refPrice : null;
    const direction  = priceDiff == null ? null : priceDiff > 0 ? "up" : priceDiff < 0 ? "down" : "flat";
    const pips       = priceDiff != null ? Math.round(priceDiff * 10000) : null;

    const upOutcome   = market.outcomes.find((o) => o.label === "UP");
    const downOutcome = market.outcomes.find((o) => o.label === "DOWN");
    const totalPool   = Number(market.totalPool);
    const upPool      = upOutcome ? Number(upOutcome.totalBetAmount) : 0;
    const upPct       = totalPool > 0 ? Math.round((upPool / totalPool) * 100) : 50;

    const userPicked =
      userPickedOutcomeId === upOutcome?.id ? "UP" :
      userPickedOutcomeId === downOutcome?.id ? "DOWN" : null;

    const winLabel = isSettled
      ? (market.outcomes.find((o) => o.id === market.resolvedOutcomeId)?.label ?? null)
      : null;

    const C = {
      border:   "rgba(244,175,57,0.16)",
      divider:  "rgba(255,255,255,0.06)",
      text:     "#f8fafc",
      sub:      "#64748b",
      muted:    "#334155",
      green:    "#10b981",
      greenDim: "rgba(16,185,129,0.12)",
      greenBdr: "rgba(16,185,129,0.22)",
      red:      "#f43f5e",
      redDim:   "rgba(220,38,38,0.18)",
      redBdr:   "rgba(244,63,94,0.40)",
      gold:     "#F4AF39",
    } as const;

    const priceColor = direction === "up" ? C.green : direction === "down" ? C.red : C.text;
    const label: React.CSSProperties = {
      fontSize: 10, fontWeight: 600, letterSpacing: "0.07em",
      textTransform: "uppercase", color: C.sub,
    };
    const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

    return (
      <div
        onClick={() => navigate(`/market/${market.id}`)}
        style={{
          background: "linear-gradient(175deg, #1a150b 0%, #0e0b06 100%)",
          border: `1px solid ${C.border}`,
          borderRadius: 20,
          overflow: "hidden",
          cursor: "pointer",
          userSelect: "none",
          marginBottom: 14,
          display: "flex",
          flexDirection: "column",
          fontFamily: FONT,
          WebkitFontSmoothing: "antialiased",
        }}
      >
        {/* Header */}
        <div style={{ padding: "14px 16px 12px", display: "flex", alignItems: "center", gap: 11 }}>
          <TerCoin />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, lineHeight: 1.2, letterSpacing: "-0.015em" }}>
              TER Up or Down
            </div>
          </div>

          {!isSettled && !isClosed ? (
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              background: bettingClosed ? "rgba(245,158,11,0.1)" : "rgba(244,63,94,0.1)",
              border: `1px solid ${bettingClosed ? "rgba(245,158,11,0.2)" : "rgba(244,63,94,0.2)"}`,
              borderRadius: 8, padding: "5px 9px", flexShrink: 0,
            }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: bettingClosed ? "#f59e0b" : "#f43f5e", flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: bettingClosed ? "#f59e0b" : "#f43f5e" }}>
                {bettingClosed ? `${countdown || "Soon"}` : countdown || "--"}
              </span>
            </div>
          ) : (
            <div style={{
              fontSize: 11, fontWeight: 600, flexShrink: 0,
              color: isSettled ? C.green : "#f59e0b",
              background: isSettled ? C.greenDim : "rgba(245,158,11,0.1)",
              border: `1px solid ${isSettled ? C.greenBdr : "rgba(245,158,11,0.2)"}`,
              borderRadius: 8, padding: "5px 10px",
            }}>
              {isSettled ? "Settled" : "Resolving"}
            </div>
          )}
        </div>

        {/* Price row */}
        <div style={{ padding: "2px 16px 12px", display: "flex", gap: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ ...label, marginBottom: 5 }}>Price to Beat</div>
            {refLocked ? (
              <div style={{ fontSize: 18, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums", lineHeight: 1, letterSpacing: "-0.02em" }}>
                {fmtNu(refPrice)}
              </div>
            ) : (
              // Indicative target: the reference locks at whatever the live
              // price is when betting closes, so preview it with the live price
              <>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.text, opacity: 0.75, fontVariantNumeric: "tabular-nums", lineHeight: 1, letterSpacing: "-0.02em" }}>
                  {liveDisplayPrice != null ? `~${fmtNu(liveDisplayPrice)}` : "—"}
                </div>
                <div style={{ fontSize: 9, fontWeight: 600, color: C.sub, marginTop: 3 }}>
                  locks in {countdown || "--"}
                </div>
              </>
            )}
          </div>

          <div style={{ width: 1, background: C.divider, margin: "0 14px", alignSelf: "stretch" }} />

          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
              <span style={{ ...label }}>Current</span>
              {pips != null && direction !== "flat" && direction != null && (
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.03em",
                  color: priceColor,
                  background: direction === "up" ? "rgba(16,185,129,0.12)" : "rgba(244,63,94,0.12)",
                  border: `1px solid ${direction === "up" ? "rgba(16,185,129,0.2)" : "rgba(244,63,94,0.2)"}`,
                  borderRadius: 4, padding: "1px 4px",
                }}>
                  {pips > 0 ? "▲" : "▼"} {Math.abs(pips)} pips
                </span>
              )}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: priceColor, fontVariantNumeric: "tabular-nums", lineHeight: 1, letterSpacing: "-0.02em" }}>
              {liveDisplayPrice != null ? fmtNu(liveDisplayPrice) : "—"}
            </div>
          </div>
        </div>

        {/* Chart */}
        {priceHistory.length >= 2 && (
          <div style={{ height: 150, background: "rgba(0,0,0,0.18)" }}>
            <TerSparkline history={priceHistory} refPrice={refPrice} />
          </div>
        )}

        {/* Actions */}
        <div style={{ padding: "10px 16px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          {isSettled ? (
            <div style={{
              padding: "12px", borderRadius: 12,
              background: winLabel === "UP" ? C.greenDim : C.redDim,
              border: `1px solid ${winLabel === "UP" ? C.greenBdr : C.redBdr}`,
              color: winLabel === "UP" ? C.green : C.red,
              fontWeight: 700, fontSize: 14, textAlign: "center",
            }}>
              {winLabel === "UP" ? "↑ Higher won" : "↓ Lower won"}
              {userPicked && (
                <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.75 }}>
                  {userPicked === winLabel ? "· You won 🎉" : "· You lost"}
                </span>
              )}
            </div>
          ) : hasBet ? (
            <div style={{
              padding: "12px", borderRadius: 12, textAlign: "center",
              background: userPicked === "UP" ? C.greenDim : C.redDim,
              border: `1px solid ${userPicked === "UP" ? C.greenBdr : C.redBdr}`,
              color: userPicked === "UP" ? C.green : C.red,
              fontSize: 13, fontWeight: 700,
            }}>
              You picked {userPicked === "UP" ? "↑ Higher" : "↓ Lower"}
            </div>
          ) : bettingClosed ? (
            <div style={{
              padding: "12px", borderRadius: 12,
              background: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.18)",
              color: "#f59e0b", fontSize: 13, fontWeight: 600, textAlign: "center",
            }}>
              Predictions closed · resolving…
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button
                onClick={(e) => { e.stopPropagation(); if (upOutcome && onBet) onBet(upOutcome.id); }}
                onMouseEnter={hoverUp} onMouseLeave={hoverOff}
                style={{
                  padding: "11px 0", borderRadius: 11,
                  border: `1px solid ${hoveredBtn === "up" ? C.green : C.greenBdr}`,
                  background: hoveredBtn === "up" ? "rgba(16,185,129,0.2)" : C.greenDim,
                  color: C.green, fontWeight: 700, fontSize: 13, cursor: "pointer",
                  fontFamily: FONT,
                  transition: "background 0.15s ease, border-color 0.15s ease",
                }}
              >
                ↑ Higher
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); if (downOutcome && onBet) onBet(downOutcome.id); }}
                onMouseEnter={hoverDown} onMouseLeave={hoverOff}
                style={{
                  padding: "11px 0", borderRadius: 11,
                  border: `1px solid ${hoveredBtn === "down" ? C.red : C.redBdr}`,
                  background: hoveredBtn === "down" ? "rgba(244,63,94,0.30)" : C.redDim,
                  color: C.red, fontWeight: 700, fontSize: 13, cursor: "pointer",
                  fontFamily: FONT,
                  transition: "background 0.15s ease, border-color 0.15s ease",
                }}
              >
                ↓ Lower
              </button>
            </div>
          )}

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: C.muted }}>
              {totalPool > 0 ? `Nu ${totalPool.toLocaleString()} vol` : "No volume yet"}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: upPct >= 50 ? "#10b981" : "#f43f5e" }} />
              <span style={{ fontSize: 10, fontWeight: 600, color: C.sub }}>
                ↑{upPct}% · ↓{100 - upPct}%
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              {!isSettled && !isClosed ? (
                <>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 5px rgba(239,68,68,0.6)" }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: C.sub, letterSpacing: "0.06em" }}>LIVE · ter.bt</span>
                </>
              ) : (
                <span style={{ fontSize: 10, fontWeight: 600, color: C.sub, letterSpacing: "0.06em" }}>ter.bt</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  },
);
