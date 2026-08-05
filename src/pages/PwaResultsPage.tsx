import { useEffect, useState, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Trophy,
  TrendingUp,
  Award,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Flame,
  Crosshair,
  Sprout,
  Clock,
} from "lucide-react";
import {
  getMyResults,
  getMyBets,
  getMyDisputes,
  getMe,
  type Bet,
  type MyDisputeSummary,
  type AuthUser,
} from "@shared/api/client";
import { useAuth } from "@shared/hooks/useAuth";

// Collapse/expand toggle for the Active & Settled lists.
function ShowMore({
  expanded,
  remaining,
  onClick,
}: {
  expanded: boolean;
  remaining: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        padding: "12px",
        marginTop: 12,
        background: "var(--glass-bg)",
        border: "1px solid var(--glass-border)",
        borderRadius: 12,
        color: "var(--text-main)",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          transform: expanded ? "rotate(180deg)" : "none",
          transition: "transform 0.2s",
        }}
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
      {expanded ? "Show Less" : `Show More (${remaining} more)`}
    </button>
  );
}

export function PwaResultsPage() {
  const { loading: authLoading } = useAuth();
  const [bets, setBets] = useState<Bet[]>([]);
  const [pending, setPending] = useState<Bet[]>([]);
  const [betsLoading, setBetsLoading] = useState(true);
  const [me, setMe] = useState<AuthUser | null>(null);
  const [repOpen, setRepOpen] = useState(true);
  // "active" = open picks awaiting resolution, "settled" = won/lost/refunded.
  const [resultsTab, setResultsTab] = useState<"active" | "settled">("settled");
  const initedTab = useRef(false);
  // Each list shows this many rows collapsed; a toggle reveals the rest.
  const RESULTS_COLLAPSED = 5;
  const [activeShowAll, setActiveShowAll] = useState(false);
  const [settledShowAll, setSettledShowAll] = useState(false);
  const [myDisputes, setMyDisputes] = useState<MyDisputeSummary[]>(
    [],
  );

  // Wait for TMA auto-auth to finish before fetching user-specific data
  useEffect(() => {
    if (authLoading) return;
    getMyResults()
      .then(setBets)
      .catch(() => {})
      .finally(() => setBetsLoading(false));
    // Open picks awaiting resolution — powers the "Active" tab.
    getMyBets("pending")
      .then(setPending)
      .catch(() => {});
    // Which markets the user disputed (+ result) — flags rows in the list.
    getMyDisputes()
      .then(setMyDisputes)
      .catch(() => {});
    getMe()
      .then(setMe)
      .catch(() => {});
  }, [authLoading]);

  // Land on the Active tab the first time we learn the user has open picks,
  // without overriding a later manual tab switch.
  useEffect(() => {
    if (initedTab.current) return;
    if (pending.length > 0) {
      setResultsTab("active");
      initedTab.current = true;
    } else if (bets.length > 0) {
      initedTab.current = true;
    }
  }, [pending.length, bets.length]);

  // Latest-first ordering for both lists (most recent placement on top).
  const byNewest = (a: Bet, b: Bet) =>
    new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime();
  const sortedPending = useMemo(() => [...pending].sort(byNewest), [pending]);
  const sortedBets = useMemo(() => [...bets].sort(byNewest), [bets]);

  // Map marketId -> the caller's dispute on it, for the "Disputed" row badge.
  const disputeByMarket = useMemo(() => {
    const map = new Map<string, MyDisputeSummary>();
    for (const d of myDisputes) if (!map.has(d.marketId)) map.set(d.marketId, d);
    return map;
  }, [myDisputes]);

  const stats = useMemo(() => {
    const won = bets.filter((b) => b.status === "won");
    const validBets = bets.filter(
      (b) => b.status !== "refunded" && b.status !== "pending",
    );
    const winRate =
      validBets.length > 0 ? (won.length / validBets.length) * 100 : 0;
    const totalPayout = bets.reduce((acc, b) => acc + (b.payout || 0), 0);
    const totalWagered = bets.reduce((acc, b) => acc + Number(b.amount), 0);
    const netGains = totalPayout - totalWagered;

    return {
      total: bets.length,
      won: won.length,
      lost: bets.filter((b) => b.status === "lost").length,
      winRate: winRate.toFixed(0),
      netGains: Math.round(netGains),
    };
  }, [bets]);

  return (
    <div
      style={{ maxWidth: 700, margin: "0 auto", padding: "24px 16px 100px" }}
    >
      <div className="mesh-bg" />

      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontSize: "1.3rem",
            fontWeight: 900,
            marginBottom: 6,
            color: "var(--text-main)",
            letterSpacing: "-0.03em",
          }}
        >
          Performance
        </h1>
        <p
          style={{
            fontSize: "0.95rem",
            color: "var(--text-muted)",
            fontWeight: 600,
          }}
        >
          Your prediction history
        </p>
      </div>

      {/* ── Personal stats ── */}
      {betsLoading ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px 0",
            color: "var(--text-subtle)",
          }}
        >
          Loading your record…
        </div>
      ) : (
        <>
          {/* Prediction Reputation Achievement Card */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--glass-border)",
              borderRadius: 20,
              padding: "20px",
              marginBottom: 32,
              boxShadow: "var(--shadow-premium)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                userSelect: "none",
                marginBottom: 20,
              }}
              onClick={() => setRepOpen((o) => !o)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "rgba(245, 158, 11, 0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#f59e0b",
                  }}
                >
                  <Award size={20} />
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span
                    style={{
                      fontSize: "1rem",
                      fontWeight: 800,
                      color: "var(--text-main)",
                    }}
                  >
                    Prediction Tier
                  </span>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    {(() => {
                      const tier = me?.reputationTier ?? "newcomer";
                      const label =
                        tier === "expert"
                          ? "Legend"
                          : tier === "reliable"
                            ? "Hot Hand"
                            : tier === "regular"
                              ? "Sharpshooter"
                              : "Rookie";
                      const bg =
                        tier === "expert"
                          ? "rgba(245,158,11,0.15)"
                          : tier === "reliable"
                            ? "rgba(34,197,94,0.15)"
                            : tier === "regular"
                              ? "rgba(59,130,246,0.15)"
                              : "rgba(100,116,139,0.15)";
                      const color =
                        tier === "expert"
                          ? "#f59e0b"
                          : tier === "reliable"
                            ? "#22c55e"
                            : tier === "regular"
                              ? "#3b82f6"
                              : "var(--text-subtle)";
                      const border =
                        tier === "expert"
                          ? "rgba(245,158,11,0.25)"
                          : tier === "reliable"
                            ? "rgba(34,197,94,0.25)"
                            : tier === "regular"
                              ? "rgba(59,130,246,0.25)"
                              : "rgba(100,116,139,0.25)";
                      const tierIcon =
                        tier === "expert" ? (
                          <Trophy size={11} />
                        ) : tier === "reliable" ? (
                          <Flame size={11} />
                        ) : tier === "regular" ? (
                          <Crosshair size={11} />
                        ) : (
                          <Sprout size={11} />
                        );
                      return (
                        <span
                          style={{
                            fontSize: "0.68rem",
                            fontWeight: 800,
                            color,
                            background: bg,
                            border: `1px solid ${border}`,
                            padding: "2px 8px",
                            borderRadius: 99,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            marginTop: 4,
                            textTransform: "uppercase",
                            letterSpacing: "0.02em",
                          }}
                        >
                          {tierIcon}
                          {label} Rank
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div style={{ flex: 1, textAlign: "right", paddingRight: 16 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 950,
                    color: "var(--text-main)",
                    letterSpacing: "-0.02em",
                    lineHeight: 1,
                  }}
                >
                  {stats.winRate}%
                </div>
                <div
                  style={{
                    fontSize: 7,
                    fontWeight: 800,
                    color:
                      Number(stats.winRate) >= 65
                        ? "#22c55e"
                        : Number(stats.winRate) >= 50
                          ? "#3b82f6"
                          : "#f59e0b",
                    textTransform: "uppercase",
                    marginTop: 2,
                    letterSpacing: "0.02em",
                  }}
                >
                  Win Rate
                </div>
              </div>

              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "var(--bg-secondary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-subtle)",
                }}
              >
                {repOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
                padding: "20px 0",
                borderTop: "1px solid var(--glass-border)",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 900,
                    color: "var(--text-main)",
                  }}
                >
                  {stats.total}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--text-subtle)",
                    textTransform: "uppercase",
                  }}
                >
                  Picks
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{ fontSize: 18, fontWeight: 900, color: "#22c55e" }}
                >
                  {stats.won}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--text-subtle)",
                    textTransform: "uppercase",
                  }}
                >
                  Wins
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{ fontSize: 18, fontWeight: 900, color: "#ef4444" }}
                >
                  {stats.lost}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--text-subtle)",
                    textTransform: "uppercase",
                  }}
                >
                  Losses
                </div>
              </div>
            </div>

            {repOpen && (
              <div style={{ marginTop: 0 }}>
                {(me?.totalPredictions ?? 0) === 0 ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: "var(--text-muted)",
                      lineHeight: 1.6,
                      paddingTop: 10,
                      borderTop: "1px solid var(--glass-border)",
                    }}
                  >
                    Make your first prediction to start building your reputation
                    score. Top predictors earn a Legend badge and their
                    predictions carry more weight in market probabilities.
                  </p>
                ) : (
                  <>
                    {(() => {
                      const total = me?.totalPredictions ?? 0;
                      const correct = me?.correctPredictions ?? 0;
                      const accuracy = total > 0 ? correct / total : 0;
                      const tier = me?.reputationTier ?? "newcomer";
                      if (tier === "expert") {
                        return (
                          <>
                            <div
                              style={{
                                background: "var(--glass-border)",
                                borderRadius: 99,
                                height: 8,
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  borderRadius: 99,
                                  background:
                                    "linear-gradient(90deg, #f59e0b, #fbbf24)",
                                }}
                              />
                            </div>
                            <div
                              style={{
                                marginTop: 8,
                                fontSize: 12,
                                color: "#f59e0b",
                                fontWeight: 800,
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <Award size={14} /> Maximum Tier Reached
                            </div>
                          </>
                        );
                      }
                      let label: string,
                        color: string,
                        progressPct: number,
                        hint: string;
                      if (tier === "newcomer") {
                        progressPct = Math.min((total / 10) * 100, 100);
                        const rem = 10 - total;
                        label = "Sharpshooter";
                        color = "#3b82f6";
                        hint = `Predict ${rem} more to reach ${label}`;
                      } else if (tier === "regular") {
                        progressPct =
                          ((Math.min(total / 50, 1) +
                            Math.min(accuracy / 0.65, 1)) /
                            2) *
                          100;
                        const rem = Math.max(0, 50 - total);
                        label = "Hot Hand";
                        color = "#059669";
                        hint =
                          rem > 0 && accuracy < 0.65
                            ? `${rem} more & 65% accuracy for ${label}`
                            : rem > 0
                              ? `${rem} more for ${label}`
                              : `Reach 65% accuracy for ${label}`;
                      } else {
                        progressPct =
                          ((Math.min(total / 100, 1) +
                            Math.min(accuracy / 0.75, 1)) /
                            2) *
                          100;
                        const rem = Math.max(0, 100 - total);
                        label = "Legend";
                        color = "#f59e0b";
                        hint =
                          rem > 0 && accuracy < 0.75
                            ? `${rem} more & 75% accuracy for ${label}`
                            : rem > 0
                              ? `${rem} more for ${label}`
                              : `Reach 75% accuracy for ${label}`;
                      }
                      return (
                        <>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginBottom: 8,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                color: "var(--text-subtle)",
                                textTransform: "uppercase",
                              }}
                            >
                              Next Rank: <span style={{ color }}>{label}</span>
                            </span>
                            <span
                              style={{ fontSize: 12, fontWeight: 900, color }}
                            >
                              {Math.round(progressPct)}%
                            </span>
                          </div>
                          <div
                            style={{
                              background: "var(--bg-secondary)",
                              borderRadius: 99,
                              height: 8,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${progressPct}%`,
                                height: "100%",
                                borderRadius: 99,
                                background: color,
                                transition:
                                  "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                              }}
                            />
                          </div>
                          <div
                            style={{
                              marginTop: 10,
                              fontSize: 11,
                              color: "var(--text-subtle)",
                              fontWeight: 600,
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <TrendingUp size={12} /> {hint}
                          </div>
                        </>
                      );
                    })()}
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Your bets: Active picks + Settled results ── */}
          {(bets.length > 0 || pending.length > 0) && (
            <div style={{ marginBottom: 32 }}>
              {/* Tab switcher */}
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginBottom: 14,
                  background: "var(--bg-secondary)",
                  padding: 4,
                  borderRadius: 12,
                }}
              >
                {(
                  [
                    { key: "active", label: "Active", count: pending.length },
                    { key: "settled", label: "Settled", count: bets.length },
                  ] as const
                ).map((t) => {
                  const isActive = resultsTab === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => {
                        initedTab.current = true;
                        setResultsTab(t.key);
                      }}
                      style={{
                        flex: 1,
                        border: "none",
                        cursor: "pointer",
                        borderRadius: 9,
                        padding: "8px 10px",
                        fontSize: "0.8rem",
                        fontWeight: 800,
                        background: isActive ? "var(--bg-card)" : "transparent",
                        color: isActive
                          ? "var(--text-main)"
                          : "var(--text-muted)",
                        boxShadow: isActive
                          ? "0 1px 4px rgba(0,0,0,0.15)"
                          : "none",
                      }}
                    >
                      {t.label} {t.count > 0 ? `(${t.count})` : ""}
                    </button>
                  );
                })}
              </div>

              {/* Active picks list */}
              {resultsTab === "active" && (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  {pending.length === 0 ? (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "32px 0",
                        color: "var(--text-subtle)",
                        fontSize: "0.85rem",
                      }}
                    >
                      No active picks. Your open predictions will appear here.
                    </div>
                  ) : (
                    sortedPending
                      .slice(0, activeShowAll ? undefined : RESULTS_COLLAPSED)
                      .map((bet) => (
                      <Link
                        key={bet.id}
                        to={`/market/${bet.marketId}`}
                        style={{ textDecoration: "none" }}
                      >
                        <div
                          style={{
                            background: "rgba(245,158,11,0.05)",
                            border: "1px solid rgba(245,158,11,0.2)",
                            borderRadius: 16,
                            padding: "14px 16px",
                            display: "flex",
                            alignItems: "center",
                            gap: 14,
                            position: "relative",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: 3,
                              background: "#f59e0b",
                            }}
                          />
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 10,
                              background: "rgba(245,158,11,0.15)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#f59e0b",
                              flexShrink: 0,
                            }}
                          >
                            <Clock size={18} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: "0.85rem",
                                fontWeight: 800,
                                color: "var(--text-main)",
                                lineHeight: 1.3,
                                marginBottom: 4,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {bet.market?.title ?? `Market #${bet.marketId}`}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: "#f59e0b",
                                  background: "rgba(245,158,11,0.1)",
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                }}
                              >
                                Active
                              </span>
                              {bet.outcome?.label && (
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: "var(--text-muted)",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {bet.outcome.label}
                                </span>
                              )}
                            </div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: "var(--text-muted)",
                              }}
                            >
                              Nu {Number(bet.amount).toLocaleString()}
                            </div>
                            <div
                              style={{
                                fontSize: 10,
                                fontWeight: 600,
                                color: "var(--text-subtle)",
                                marginTop: 2,
                              }}
                            >
                              {new Date(bet.placedAt).toLocaleDateString()}
                            </div>
                          </div>
                          <ChevronRight
                            size={14}
                            style={{
                              color: "var(--text-subtle)",
                              flexShrink: 0,
                            }}
                          />
                        </div>
                      </Link>
                    ))
                  )}
                  {pending.length > RESULTS_COLLAPSED && (
                    <ShowMore
                      expanded={activeShowAll}
                      remaining={pending.length - RESULTS_COLLAPSED}
                      onClick={() => setActiveShowAll((s) => !s)}
                    />
                  )}
                </div>
              )}

              {/* Settled results list */}
              {resultsTab === "settled" && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {bets.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "32px 0",
                      color: "var(--text-subtle)",
                      fontSize: "0.85rem",
                    }}
                  >
                    No settled results yet.
                  </div>
                ) : (
                sortedBets
                  .slice(0, settledShowAll ? undefined : RESULTS_COLLAPSED)
                  .map((bet) => {
                  const isWon = bet.status === "won";
                  const isLost = bet.status === "lost";
                  const dispute = disputeByMarket.get(bet.marketId);
                  const disputeColor =
                    dispute?.bondStatus === "rewarded"
                      ? "#22c55e"
                      : dispute?.bondStatus === "forfeited"
                        ? "#ef4444"
                        : "#f59e0b";
                  const disputeLabel =
                    dispute?.bondStatus === "rewarded"
                      ? " · won"
                      : dispute?.bondStatus === "forfeited"
                        ? " · lost"
                        : "";
                  const accentColor = isWon
                    ? "#22c55e"
                    : isLost
                      ? "#ef4444"
                      : "var(--text-muted)";
                  const cardBg = isWon
                    ? "rgba(34,197,94,0.05)"
                    : isLost
                      ? "rgba(239,68,68,0.05)"
                      : "var(--bg-card)";
                  const cardBorder = isWon
                    ? "rgba(34,197,94,0.2)"
                    : isLost
                      ? "rgba(239,68,68,0.2)"
                      : "var(--glass-border)";

                  return (
                    <Link
                      key={bet.id}
                      to={`/market/${bet.marketId}`}
                      style={{ textDecoration: "none" }}
                    >
                      <div
                        style={{
                          background: cardBg,
                          border: `1px solid ${cardBorder}`,
                          borderRadius: 16,
                          padding: "14px 16px",
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: 3,
                            background: accentColor,
                          }}
                        />
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 10,
                            background: isWon
                              ? "rgba(34,197,94,0.15)"
                              : isLost
                                ? "rgba(239,68,68,0.15)"
                                : "var(--bg-secondary)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 18,
                            fontWeight: 900,
                            color: accentColor,
                            flexShrink: 0,
                          }}
                        >
                          {isWon ? "✓" : isLost ? "✗" : "↩"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: "0.85rem",
                              fontWeight: 800,
                              color: "var(--text-main)",
                              lineHeight: 1.3,
                              marginBottom: 4,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {bet.market?.title ?? `Market #${bet.marketId}`}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: accentColor,
                                background: isWon
                                  ? "rgba(34,197,94,0.1)"
                                  : isLost
                                    ? "rgba(239,68,68,0.1)"
                                    : "var(--bg-secondary)",
                                padding: "1px 6px",
                                borderRadius: 4,
                              }}
                            >
                              {isWon ? "Won" : isLost ? "Lost" : "Refunded"}
                            </span>
                            {dispute && (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 800,
                                  color: disputeColor,
                                  background: `${disputeColor}1a`,
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                ⚖ Disputed{disputeLabel}
                              </span>
                            )}
                            {bet.outcome?.label && (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: "var(--text-muted)",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {bet.outcome.label}
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          {isWon && bet.payout != null ? (
                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: 900,
                                color: "#22c55e",
                              }}
                            >
                              +Nu {Number(bet.payout).toLocaleString()}
                            </div>
                          ) : isLost ? (
                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: 900,
                                color: "#ef4444",
                              }}
                            >
                              -Nu {Number(bet.amount).toLocaleString()}
                            </div>
                          ) : (
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: "var(--text-muted)",
                              }}
                            >
                              Nu {Number(bet.amount).toLocaleString()}
                            </div>
                          )}
                          <div
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              color: "var(--text-subtle)",
                              marginTop: 2,
                            }}
                          >
                            {new Date(bet.placedAt).toLocaleDateString()}
                          </div>
                        </div>
                        <ChevronRight
                          size={14}
                          style={{ color: "var(--text-subtle)", flexShrink: 0 }}
                        />
                      </div>
                    </Link>
                  );
                })
                )}
                {bets.length > RESULTS_COLLAPSED && (
                  <ShowMore
                    expanded={settledShowAll}
                    remaining={bets.length - RESULTS_COLLAPSED}
                    onClick={() => setSettledShowAll((s) => !s)}
                  />
                )}
              </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
