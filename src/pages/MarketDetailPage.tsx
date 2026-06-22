import { FC, useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Spinner, Placeholder } from "@telegram-apps/telegram-ui";
import { Page } from "@/components/Page";
import {
  getMarket,
  getMyBets,
  getDisputes,
  submitDispute,
  getDisputeRequirements,
  bustCache,
  getTerPrice,
  Market,
  Dispute,
  DisputeRequirements,
  Bet,
  TerPrice,
} from "@shared/api/client";
import { Link } from "@/components/Link/Link";
import { ShareCTA } from "@shared/components/ShareCTA";
import { useMarketSocket } from "@/hooks/useMarketSocket";
import { useTrack } from "@shared/hooks/useTrack";
import { useTmaHaptic } from "@/hooks/useTmaHaptic";
import { TrendingUp, TrendingDown } from "lucide-react";
import {
  UnderdogBanner,
  getUnderdogLabel,
} from "@shared/components/UnderdogBanner";

// ── TER Price Panel ──────────────────────────────────────────────────────────

function TerPricePanel({ market }: { market: Market }) {
  const meta = market.metadata;
  const refPrice = meta?.referenceBuyPrice ?? meta?.referenceTerPrice ?? 0;
  const settlementPrice = meta?.settlementBuyPrice ?? meta?.settlementTerPrice;
  const isSettled = market.status === "settled" || market.status === "resolved";
  const isClosed = market.status === "closed" || market.status === "resolving";

  const [live, setLive] = useState<TerPrice | null>(null);

  useEffect(() => {
    if (isSettled || isClosed) return;
    const fetch_ = () =>
      getTerPrice()
        .then(setLive)
        .catch(() => {});
    fetch_();
    const id = setInterval(fetch_, 30_000);
    return () => clearInterval(id);
  }, [isSettled, isClosed]);

  const displayPrice = isSettled
    ? settlementPrice
    : (live?.buyPrice ?? live?.midPrice);
  const diff = displayPrice != null ? displayPrice - refPrice : null;
  const pct =
    diff != null && refPrice ? ((diff / refPrice) * 100).toFixed(2) : null;
  const dir =
    diff == null ? null : diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  const winLabel = isSettled
    ? market.outcomes.find((o) => o.id === market.resolvedOutcomeId)?.label
    : null;

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${dir === "up" ? "rgba(34,197,94,0.3)" : dir === "down" ? "rgba(239,68,68,0.3)" : "var(--glass-border)"}`,
        borderRadius: "var(--radius-lg)",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        boxShadow: "var(--shadow-premium)",
      }}
    >
      <div
        style={{
          fontSize: "0.65rem",
          fontWeight: 800,
          color: "var(--accent, #a78bfa)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        TER · 24 Hour Price Prediction
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: "0.7rem",
              color: "var(--text-subtle)",
              marginBottom: 2,
            }}
          >
            Open price
          </div>
          <div
            style={{
              fontSize: "1.3rem",
              fontWeight: 800,
              color: "var(--text-main)",
            }}
          >
            Nu {refPrice.toFixed(4)}
          </div>
        </div>
        <div style={{ fontSize: 22, color: "var(--text-subtle)" }}>→</div>
        <div style={{ flex: 1, textAlign: "right" }}>
          <div
            style={{
              fontSize: "0.7rem",
              color: "var(--text-subtle)",
              marginBottom: 2,
            }}
          >
            {isSettled ? "Close price" : "Live price"}
          </div>
          <div
            style={{
              fontSize: "1.3rem",
              fontWeight: 800,
              color:
                dir === "up"
                  ? "#22c55e"
                  : dir === "down"
                    ? "#ef4444"
                    : "var(--text-main)",
            }}
          >
            {displayPrice != null ? `Nu ${displayPrice.toFixed(4)}` : "—"}
          </div>
        </div>
      </div>
      {diff != null && dir !== "flat" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 12px",
            borderRadius: 10,
            background:
              dir === "up" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            color: dir === "up" ? "#22c55e" : "#ef4444",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          {dir === "up" ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          <span>
            {dir === "up" ? "+" : ""}
            Nu {diff.toFixed(4)} ({dir === "up" ? "+" : ""}
            {pct}%)
          </span>
          {isSettled && winLabel && (
            <span style={{ marginLeft: "auto", fontSize: 12, opacity: 0.9 }}>
              {winLabel === "UP" ? "▲ Higher won" : "▼ Lower won"}
            </span>
          )}
        </div>
      )}
      {/* Resolution price */}
      {isSettled && meta && (
        <div
          style={{
            background: "rgba(0,0,0,0.4)",
            borderRadius: 12,
            padding: "14px 16px",
            fontSize: "0.8rem",
            lineHeight: 1.8,
            color: "#e2e8f0",
          }}
        >
          <div
            style={{
              color: "#94a3b8",
              marginBottom: 8,
              fontSize: "0.65rem",
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            Resolution price
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#94a3b8" }}>Price resolved at</span>
            <span>
              {(meta.settlementBuyPrice ?? meta.settlementTerPrice ?? 0).toFixed(4)}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#94a3b8" }}>Effective at</span>
            <span>
              {market.closesAt
                ? new Date(market.closesAt).toLocaleString("en-BT", {
                    timeZone: "Asia/Thimphu",
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : ""}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export const MarketDetailPage: FC = () => {
  const { id } = useParams<{ id: string }>();
  const track = useTrack();
  const haptic = useTmaHaptic();
  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setDisputes] = useState<Dispute[]>([]);
  const [disputeReqs, setDisputeReqs] = useState<DisputeRequirements | null>(
    null,
  );
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const [disputeError, setDisputeError] = useState<string | null>(null);
  const [disputeSuccess, setDisputeSuccess] = useState(false);
  const [hasBet, setHasBet] = useState(false);
  const [userBets, setUserBets] = useState<Bet[]>([]);

  // ── Live WebSocket updates ─────────────────────────────────────────────────
  const liveData = useMarketSocket(id);

  /**
   * Merge the latest WS snapshot on top of the REST-fetched market so that
   * totalPool and per-outcome probabilities update in real time without
   * a full page reload.
   */
  const liveMarket = useMemo<Market | null>(() => {
    if (!market) return null;
    if (!liveData) return market;
    return {
      ...market,
      totalPool: String(liveData.totalPool),
      outcomes: market.outcomes.map((o) => {
        const live = liveData.outcomes.find((lo) => lo.id === o.id);
        if (!live) return o;
        return {
          ...o,
          totalBetAmount: String(live.totalBetAmount),
          lmsrProbability: live.lmsrProbability ?? o.lmsrProbability,
          currentOdds: String(live.currentOdds),
        } as typeof o;
      }),
    };
  }, [market, liveData]);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const data = await getMarket(id);
        setMarket(data);
        track("market.view", { marketId: id, marketTitle: data.title });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
    // Check if user has already bet on this market
    getMyBets()
      .then((bets) => {
        const marketBets = bets.filter((b) => b.marketId === id);
        setUserBets(marketBets);
        setHasBet(marketBets.length > 0);
      })
      .catch(() => {});
  }, [id]);

  // Refetch market data when page becomes visible (e.g. returning from bet page)
  // Also poll every 15s as fallback when WebSocket is unavailable
  useEffect(() => {
    if (!id) return;
    const refetch = () => {
      bustCache(`/markets/${id}`);
      return getMarket(id)
        .then(setMarket)
        .catch(() => {});
    };

    const onVisibility = () => {
      if (!document.hidden) refetch();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const interval = setInterval(refetch, 15_000);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(interval);
    };
  }, [id]);

  useEffect(() => {
    if (!id || !market || market.status !== "resolving") return;
    getDisputes(id)
      .then(setDisputes)
      .catch(() => {});
    getDisputeRequirements(id)
      .then((reqs) => {
        setDisputeReqs(reqs);
      })
      .catch(() => {});
  }, [id, market?.status]);

  // ── Haptic feedback on win
  const resolvedOutcomeId = market?.resolvedOutcomeId;
  const isResolvedForHaptic =
    market?.status === "resolved" || market?.status === "settled";
  const hasWonForHaptic = useMemo(() => {
    if (!isResolvedForHaptic || !resolvedOutcomeId) return false;
    return (
      userBets
        .filter((b) => b.status === "won" || b.outcomeId === resolvedOutcomeId)
        .reduce((sum, b) => sum + (b.payout || 0), 0) > 0
    );
  }, [isResolvedForHaptic, resolvedOutcomeId, userBets]);

  useEffect(() => {
    if (!hasWonForHaptic || !id) return;
    const key = `win-haptic-${id}`;
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      haptic.confirm();
    }
  }, [hasWonForHaptic, id]);

  const handleSubmitDispute = async () => {
    if (!id) return;
    if (!disputeReason.trim()) {
      setDisputeError("Please explain why the proposed outcome is incorrect.");
      return;
    }
    setDisputeSubmitting(true);
    setDisputeError(null);
    try {
      await submitDispute(id, {
        reason: disputeReason,
      });
      setDisputeSuccess(true);
      getDisputes(id)
        .then(setDisputes)
        .catch(() => {});
    } catch (e: any) {
      setDisputeError(e.message || "Failed to submit dispute");
    } finally {
      setDisputeSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Page back={true}>
        <div
          style={{ display: "flex", justifyContent: "center", padding: "2rem" }}
        >
          <Spinner size="l" />
        </div>
      </Page>
    );
  }

  if (error || !market) {
    return (
      <Page back={true}>
        <Placeholder header="Error" description={error || "Market not found"} />
      </Page>
    );
  }

  const isResolving = (liveMarket ?? market).status === "resolving";
  const isResolved =
    (liveMarket ?? market).status === "resolved" ||
    (liveMarket ?? market).status === "settled";
  // Use liveMarket for all display — falls back to REST data until first WS event
  const m = liveMarket ?? market;
  const resolvedOutcome =
    isResolved && m.resolvedOutcomeId
      ? m.outcomes.find((o) => o.id === m.resolvedOutcomeId)
      : null;

  const wonTotalPayout = userBets
    .filter(
      (b) =>
        b.status === "won" ||
        (isResolved && b.outcomeId === m.resolvedOutcomeId),
    )
    .reduce((sum, b) => sum + (b.payout || 0), 0);

  const hasWon = wonTotalPayout > 0;

  const proposedOutcome =
    isResolving && m.proposedOutcomeId
      ? m.outcomes.find((o) => o.id === m.proposedOutcomeId)
      : null;

  const disputeTimeLeft = (() => {
    if (!m.disputeDeadlineAt) return null;
    const diff = new Date(m.disputeDeadlineAt).getTime() - Date.now();
    if (diff <= 0) return "Dispute window closed";
    const h = Math.floor(diff / 3600000);
    const min = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${min}m remaining`;
  })();

  const isOpen = m.status === "open";

  return (
    <Page back={true}>
      <div
        style={{
          position: "relative",
          minHeight: "100vh",
          padding: "0 0 100px",
        }}
      >
        <div className="mesh-bg" />

        <div
          style={{
            padding: "48px 16px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 24,
            position: "relative",
          }}
        >
          {/* Header Section */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--glass-border)",
              borderRadius: "var(--radius-lg)",
              padding: "20px",
              boxShadow: "var(--shadow-premium)",
              backdropFilter: "var(--glass-blur)",
            }}
          >
            <div
              style={{
                fontSize: "0.65rem",
                fontWeight: 800,
                color: "var(--text-subtle)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Market Details
            </div>
            <h1
              style={{
                fontSize: "1.4rem",
                fontWeight: 900,
                color: "var(--text-main)",
                marginBottom: 12,
                lineHeight: 1.2,
                fontFamily: "var(--font-display)",
              }}
            >
              {m.title}
            </h1>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <div
                style={{
                  background: "var(--bg-secondary)",
                  padding: "4px 10px",
                  borderRadius: 8,
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  color: isOpen
                    ? "#22c55e"
                    : isResolving
                      ? "#f59e0b"
                      : "var(--text-muted)",
                }}
              >
                {m.status.toUpperCase()}
              </div>
              <div
                style={{
                  background: "var(--bg-secondary)",
                  padding: "4px 10px",
                  borderRadius: 8,
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  color: "var(--text-main)",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                {liveData && isOpen && (
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "#22c55e",
                      display: "inline-block",
                      boxShadow: "0 0 0 2px rgba(34,197,94,0.3)",
                      animation: "livePulse 1.5s ease-in-out infinite",
                      flexShrink: 0,
                    }}
                  />
                )}
                Nu {Number(m.totalPool).toLocaleString()}
              </div>
            </div>
            {m.description && m.externalSource !== "ter" && (
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: "0.9rem",
                  lineHeight: 1.5,
                  marginTop: 16,
                  fontWeight: 500,
                }}
              >
                {m.description}
              </p>
            )}
          </div>

          {/* TER Price Panel */}
          {m.externalSource === "ter" && m.metadata?.isTer && (
            <TerPricePanel market={m} />
          )}

          {/* Timeline */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--glass-border)",
              borderRadius: "var(--radius-lg)",
              padding: "20px",
              boxShadow: "var(--shadow-premium)",
            }}
          >
            <div
              style={{
                fontSize: "0.65rem",
                fontWeight: 800,
                color: "var(--text-subtle)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 14,
              }}
            >
              Timeline
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "Opens", date: m.opensAt },
                { label: "Closes", date: m.closesAt },
                ...(m.resolvedAt
                  ? [{ label: "Resolved", date: m.resolvedAt }]
                  : []),
              ].map(({ label, date }) =>
                date ? (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        color: "var(--text-subtle)",
                      }}
                    >
                      {label}
                    </span>
                    <span
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: 800,
                        color: "var(--text-main)",
                      }}
                    >
                      {new Date(date).toLocaleString("en-BT", {
                        timeZone: "Asia/Thimphu",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ) : null,
              )}
            </div>
          </div>

          {/* Resolution Criteria */}
          {m.resolutionCriteria && (
            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--glass-border)",
                borderRadius: "var(--radius-lg)",
                padding: "20px",
                boxShadow: "var(--shadow-premium)",
              }}
            >
              <div
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 800,
                  color: "var(--text-subtle)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                How this resolves
              </div>
              <p
                style={{
                  fontSize: "0.88rem",
                  color: "var(--text-muted)",
                  lineHeight: 1.55,
                  fontWeight: 500,
                  margin: 0,
                }}
              >
                {m.resolutionCriteria}
              </p>
            </div>
          )}

          {/* Resolved Winner Banner */}
          {resolvedOutcome && (
            <div
              style={{
                background: "#45be76ff",
                border: "1px solid #22c55e",
                borderRadius: "var(--radius-lg)",
                padding: "20px",
                boxShadow: "var(--shadow-premium)",
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#86efac"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0 }}
              >
                <circle cx="12" cy="8" r="6" />
                <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
              </svg>
              <div>
                <div
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 800,
                    color: "#86efac",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  Resolved
                </div>
                <div
                  style={{ fontSize: "1.1rem", fontWeight: 900, color: "#fff" }}
                >
                  {resolvedOutcome.label}
                </div>
              </div>
            </div>
          )}

          {/* Share CTA for Winner */}
          {resolvedOutcome && hasWon && (
            <ShareCTA
              type="win"
              amount={wonTotalPayout}
              marketTitle={m.title}
            />
          )}

          {/* Share CTA for losing prediction */}
          {resolvedOutcome && !hasWon && userBets.length > 0 && (
            <ShareCTA type="lose" marketTitle={m.title} />
          )}

          {/* Dispute Section */}
          {isResolving && (
            <div
              style={{
                background: "#fff9eb",
                border: "1.5px solid #fcd34d",
                borderRadius: "var(--radius-lg)",
                overflow: "hidden",
                boxShadow: "var(--shadow-premium)",
              }}
            >
              <div
                style={{
                  background: "#fef3c7",
                  padding: "16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 900,
                      color: "#92400e",
                      fontSize: "0.85rem",
                      textTransform: "uppercase",
                    }}
                  >
                    Dispute Window
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "#b45309",
                      fontWeight: 700,
                    }}
                  >
                    {disputeTimeLeft}
                  </div>
                </div>
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#b45309"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3v3" />
                  <path d="m3 9 2 2 2-2" />
                  <path d="m17 9 2 2 2-2" />
                  <path d="M5 11a7 7 0 0 0 14 0" />
                  <path d="M12 21v-6" />
                  <path d="M9 21h6" />
                </svg>
              </div>

              <div
                style={{
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    fontSize: "0.85rem",
                    color: "#b45309",
                    fontWeight: 600,
                  }}
                >
                  Proposed:{" "}
                  <strong style={{ color: "#b45309", fontSize: "1rem" }}>
                    {proposedOutcome?.label ?? "Pending"}
                  </strong>
                </div>

                {/* Ineligibility notice */}
                {disputeReqs && !disputeReqs.eligible && (
                  <div
                    style={{
                      background: "#fef2f2",
                      border: "1px solid #fca5a5",
                      borderRadius: 10,
                      padding: "10px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span
                      style={{
                        fontSize: "0.78rem",
                        color: "#b91c1c",
                        fontWeight: 700,
                      }}
                    >
                      {disputeReqs.reason}
                    </span>
                  </div>
                )}

                {disputeSuccess ? (
                  <div
                    style={{
                      background: "#ecfdf5",
                      padding: "12px",
                      borderRadius: 10,
                      color: "#065f46",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      textAlign: "center",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#065f46"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Dispute Submitted
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        borderRadius: 10,
                        background: "rgba(245,158,11,0.1)",
                        border: "1.5px solid #fde68a",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "#b45309",
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        Dispute Bond
                      </span>
                      <span
                        style={{
                          fontSize: "1rem",
                          fontWeight: 900,
                          color: "#b45309",
                        }}
                      >
                        Nu 10
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "#b45309",
                        fontWeight: 600,
                        lineHeight: 1.5,
                      }}
                    >
                      This bond is locked when you raise an objection. You get
                      it back + a reward if the admin agrees the outcome was
                      wrong. You lose it if the admin upholds their decision.
                    </div>
                    <textarea
                      value={disputeReason}
                      onChange={(e) => setDisputeReason(e.target.value)}
                      placeholder="Explain why the proposed outcome is incorrect..."
                      rows={2}
                      disabled={disputeReqs != null && !disputeReqs.eligible}
                      style={{
                        width: "100%",
                        padding: "12px",
                        borderRadius: 10,
                        border: "1.5px solid #fde68a",
                        fontSize: "0.9rem",
                        outline: "none",
                        resize: "none",
                      }}
                    />
                    {disputeError && (
                      <div
                        style={{
                          color: "#ef4444",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                        }}
                      >
                        {disputeError}
                      </div>
                    )}
                    <button
                      onClick={handleSubmitDispute}
                      disabled={
                        disputeSubmitting ||
                        (disputeReqs != null && !disputeReqs.eligible)
                      }
                      style={{
                        width: "100%",
                        padding: "14px",
                        borderRadius: 12,
                        background:
                          disputeReqs && !disputeReqs.eligible
                            ? "#d1d5db"
                            : "#f59e0b",
                        color: "#fff",
                        fontWeight: 900,
                        border: "none",
                        cursor:
                          disputeReqs && !disputeReqs.eligible
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      {disputeSubmitting ? "SUBMITTING..." : "SUBMIT DISPUTE"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Outcomes — each row is the predict CTA */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--glass-border)",
              borderRadius: "var(--radius-lg)",
              padding: "20px",
              boxShadow: "var(--shadow-premium)",
            }}
          >
            <style>{`
              @keyframes shimmer-slide {
                0%   { transform: translateX(-100%); }
                100% { transform: translateX(250%); }
              }
              @keyframes livePulse {
                0%, 100% { opacity: 1; box-shadow: 0 0 0 2px rgba(34,197,94,0.3); }
                50% { opacity: 0.6; box-shadow: 0 0 0 4px rgba(34,197,94,0.1); }
              }
            `}</style>
            {(m.externalSource === "ter" || m.settlementSource) && (
              <div
                style={{
                  fontSize: "0.68rem",
                  color: "var(--text-subtle)",
                  fontWeight: 600,
                  marginBottom: 10,
                }}
              >
                Resolves via{" "}
                {m.externalSource === "ter" ? (
                  "api.ter.bt"
                ) : (() => {
                  try {
                    const url = new URL(m.settlementSource!);
                    return (
                      <a
                        href={m.settlementSource!}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "inherit", textDecoration: "underline", wordBreak: "break-all" }}
                      >
                        {url.hostname.replace(/^www\./, "")}
                      </a>
                    );
                  } catch {
                    return m.settlementSource;
                  }
                })()}
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 800,
                  color: "var(--text-subtle)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                Pick your outcome
              </div>
              {(() => {
                const meta = (m as any).signalMeta;
                if (!meta || meta.composite === 0) return null;
                const c = meta.composite as number;
                const pct = Math.round(c * 100);
                // colour: red < 30, amber 30-60, green > 60
                const col =
                  c >= 0.6 ? "#22c55e" : c >= 0.3 ? "#f59e0b" : "#ef4444";
                const label = c >= 0.6 ? "High" : c >= 0.3 ? "Moderate" : "Low";
                // Arc SVG: r=7, cx=cy=9, circumference≈43.98, filled portion = pct/100 * 43.98
                const r = 7,
                  circ = 2 * Math.PI * r;
                const dash = (c * circ).toFixed(2);
                return (
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                    title={`Participants: ${meta.participantCount} · Reputation depth: ${Math.round(meta.reputationDepth * 100)}% · Maturity: ${Math.round(meta.maturityScore * 100)}%`}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18">
                      <circle
                        cx="9"
                        cy="9"
                        r={r}
                        fill="none"
                        stroke="var(--bg-secondary)"
                        strokeWidth="2.5"
                      />
                      <circle
                        cx="9"
                        cy="9"
                        r={r}
                        fill="none"
                        stroke={col}
                        strokeWidth="2.5"
                        strokeDasharray={`${dash} ${circ}`}
                        strokeLinecap="round"
                        transform="rotate(-90 9 9)"
                      />
                    </svg>
                    <span
                      style={{
                        fontSize: "0.68rem",
                        fontWeight: 800,
                        color: col,
                        letterSpacing: "0.04em",
                      }}
                    >
                      {label} confidence · {pct}%
                    </span>
                  </div>
                );
              })()}
            </div>
            {(() => {
              const ul = isOpen
                ? getUnderdogLabel(m.outcomes, Number(m.totalPool))
                : null;
              return ul ? <UnderdogBanner underdogLabel={ul} /> : null;
            })()}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {m.outcomes.map((outcome, idx) => {
                const totalBets = Number(m.totalPool);
                // Priority:
                // 1. lmsrProbability  — live WS-updated value (most accurate, naturally smoothed)
                // 2. Laplace-smoothed pool ratio — avoids misleading 100%/0% at thin liquidity
                // 3. equal weight     — fallback before any bets
                const prior = 1000; // virtual BTN spread evenly across outcomes
                const n = m.outcomes.length || 1;
                const pct =
                  outcome.lmsrProbability != null && outcome.lmsrProbability > 0
                    ? outcome.lmsrProbability * 100
                    : (() => {
                        const smoothedAmount =
                          Number(outcome.totalBetAmount) + prior / n;
                        const smoothedTotal = totalBets + prior;
                        return (smoothedAmount / smoothedTotal) * 100;
                      })();

                // Intelligence delta: show expert vs crowd gap (only when hasBet & both values exist)
                const rawPct =
                  outcome.lmsrProbability != null && outcome.lmsrProbability > 0
                    ? outcome.lmsrProbability * 100
                    : null;
                const delta =
                  hasBet && outcome.intelligenceProb != null && rawPct != null
                    ? Math.round(outcome.intelligenceProb * 100) -
                      Math.round(rawPct)
                    : null;
                const colors = isResolved
                  ? ["#22c55e", "#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6"]
                  : ["#3b82f6", "#8b5cf6", "#f59e0b", "#06b6d4", "#f97316"];
                const color = colors[idx % colors.length];
                const signal = outcome.reputationSignal;
                const barWidth = Math.max(4, Math.min(100, pct));
                return (
                  <Link
                    key={outcome.id}
                    to={
                      isOpen
                        ? `/dkbank-bet/${m.id}?outcomeId=${outcome.id}`
                        : "#"
                    }
                    style={{ textDecoration: "none", display: "block" }}
                  >
                    <div
                      style={{
                        position: "relative",
                        borderRadius: 14,
                        overflow: "hidden",
                        background: "var(--bg-secondary)",
                        border: `1.5px solid ${color}30`,
                        boxShadow: `0 2px 8px rgba(0,0,0,0.18), inset 0 0 0 1px ${color}18`,
                        cursor: isOpen ? "pointer" : "default",
                        transition:
                          "transform 0.12s ease, box-shadow 0.15s ease",
                      }}
                      onMouseDown={(e) => {
                        if (!isOpen) return;
                        const el = e.currentTarget as HTMLDivElement;
                        el.style.transform = "scale(0.982)";
                        el.style.boxShadow = `inset 3px 3px 8px rgba(0,0,0,0.28), inset 0 0 0 1px ${color}50`;
                      }}
                      onMouseUp={(e) => {
                        const el = e.currentTarget as HTMLDivElement;
                        el.style.transform = "scale(1)";
                        el.style.boxShadow = `0 2px 8px rgba(0,0,0,0.18), inset 0 0 0 1px ${color}18`;
                      }}
                      onMouseLeave={(e) => {
                        const el = e.currentTarget as HTMLDivElement;
                        el.style.transform = "scale(1)";
                        el.style.boxShadow = `0 2px 8px rgba(0,0,0,0.18), inset 0 0 0 1px ${color}18`;
                      }}
                    >
                      {/* probability fill */}
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          bottom: 0,
                          width: `${barWidth}%`,
                          background: `linear-gradient(90deg, ${color}55 0%, ${color}28 60%, transparent 100%)`,
                          borderRadius: "14px 0 0 14px",
                          transition: "width 1s ease",
                          pointerEvents: "none",
                        }}
                      />

                      {/* shimmer sweep — only on open markets */}
                      {isOpen && (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            overflow: "hidden",
                            borderRadius: 14,
                            pointerEvents: "none",
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              top: 0,
                              bottom: 0,
                              width: "40%",
                              background: `linear-gradient(90deg, transparent, ${color}18, transparent)`,
                              animation:
                                "shimmer-slide 2.4s ease-in-out infinite",
                            }}
                          />
                        </div>
                      )}

                      {/* content */}
                      <div
                        style={{
                          position: "relative",
                          padding: "13px 16px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 3,
                            minWidth: 0,
                          }}
                        >
                          <span
                            style={{
                              fontSize: "0.92rem",
                              fontWeight: 800,
                              color: "var(--text-main)",
                              letterSpacing: "-0.01em",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {outcome.label}
                          </span>
                          {signal != null && hasBet && (
                            <span
                              style={{
                                fontSize: "0.65rem",
                                fontWeight: 700,
                                color: "#f59e0b",
                                display: "flex",
                                alignItems: "center",
                                gap: 3,
                              }}
                            >
                              <svg
                                width="8"
                                height="8"
                                viewBox="0 0 24 24"
                                fill="#f59e0b"
                                stroke="none"
                              >
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                              </svg>
                              Experts {Math.round(signal * 100)}%
                            </span>
                          )}
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexShrink: 0,
                          }}
                        >
                          {delta !== null && delta !== 0 && (
                            <span
                              style={{
                                fontSize: "0.65rem",
                                fontWeight: 700,
                                color: delta > 0 ? "#22c55e" : "#ef4444",
                              }}
                            >
                              {delta > 0 ? "+" : ""}
                              {delta}%
                            </span>
                          )}
                          <div
                            style={{
                              background: `${color}22`,
                              border: `1.5px solid ${color}50`,
                              color: color,
                              padding: "4px 14px",
                              borderRadius: 99,
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              lineHeight: 1.15,
                            }}
                          >
                            <span style={{ fontSize: "1rem", fontWeight: 900, letterSpacing: "-0.01em" }}>{Math.min(99, 100 / Math.max(pct, 1)).toFixed(1)}x</span>
                            <span style={{ fontSize: "0.65rem", fontWeight: 700, opacity: 0.75 }}>{pct.toFixed(0)}%</span>
                          </div>
                          {isOpen && (
                            <div
                              style={{
                                background: color,
                                color: "#fff",
                                fontSize: "0.65rem",
                                fontWeight: 800,
                                padding: "4px 10px",
                                borderRadius: 99,
                                letterSpacing: "0.06em",
                                textTransform: "uppercase",
                              }}
                            >
                              Predict
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
};
