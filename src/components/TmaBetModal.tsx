import { useState, useEffect } from "react";
import { hapticFeedback } from "@tma.js/sdk-react";
import confetti from "canvas-confetti";
import { getMe, placeBet, trackEvent } from "@shared/api/client";
import type { Market, BetStreak } from "@shared/api/client";
import { PayoutBreakdown } from "@shared/components/PayoutBreakdown";
import { ShareCTA } from "@shared/components/ShareCTA";
import { BetShareCard } from "@shared/components/BetShareCard";
import { ChallengeAFriend } from "@shared/components/ChallengeAFriend";
import { StreakBanner } from "@shared/components/StreakBanner";
import { useAuth } from "@shared/hooks/useAuth";

const QUICK_AMOUNTS_DEFAULT = [100, 500, 1000];
const QUICK_AMOUNTS_TER = [10, 25, 50, 100];

function getMinBet(market: Market): number {
  return ["ter", "btc"].includes(market.externalSource ?? "") ? 10 : 50;
}

interface TmaBetModalProps {
  isOpen: boolean;
  onClose: () => void;
  market: Market;
  outcomeId: string;
  initialAmount?: number;
  onSuccess?: () => void;
  onFailure?: (error: string) => void;
  onGoToWallet?: () => void;
}

type Status = "idle" | "processing" | "success" | "failed";

export function TmaBetModal({
  isOpen,
  onClose,
  market,
  outcomeId,
  initialAmount,
  onSuccess,
  onFailure,
  onGoToWallet,
}: TmaBetModalProps) {
  const [amountStr, setAmountStr] = useState(() =>
    initialAmount ? String(initialAmount) : "100",
  );
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [creditsBalance, setCreditsBalance] = useState<number | null>(null);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const [viewportOffsetTop, setViewportOffsetTop] = useState(0);
  const [streak, setStreak] = useState<BetStreak | null>(null);
  const { user } = useAuth();

  // Fetch user's balance when modal opens
  useEffect(() => {
    if (!isOpen) return;
    trackEvent({
      eventType: "bet.modal.open",
      platform: "tma",
      meta: { marketId: market.id, marketTitle: market.title },
    });
    getMe()
      .then((u) => {
        setCreditsBalance(u.creditsBalance ?? 0);
      })
      .catch(() => {});
  }, [isOpen]);

  // Track visual viewport so the bottom sheet follows the keyboard precisely
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handle = () => {
      setViewportHeight(vv.height);
      setViewportOffsetTop(vv.offsetTop);
    };
    vv.addEventListener("resize", handle);
    vv.addEventListener("scroll", handle);
    return () => {
      vv.removeEventListener("resize", handle);
      vv.removeEventListener("scroll", handle);
    };
  }, []);

  const outcome = market.outcomes.find((o) => o.id === outcomeId);

  // Derive the outcome color — neutral palette since betting only happens on open markets
  const outcomeColor = (() => {
    const sorted = [...market.outcomes].sort(
      (a, b) => Number(b.totalBetAmount) - Number(a.totalBetAmount),
    );
    const rank = sorted.findIndex((o) => o.id === outcomeId);
    const neutral = ["#3b82f6", "#8b5cf6", "#f59e0b", "#06b6d4", "#f97316"];
    return neutral[rank % neutral.length];
  })();

  const betAmount = parseFloat(amountStr) || 0;
  const MIN_BET = getMinBet(market);
  const QUICK_AMOUNTS = ["ter", "btc"].includes(market.externalSource ?? "")
    ? QUICK_AMOUNTS_TER
    : QUICK_AMOUNTS_DEFAULT;
  const isValidAmount = betAmount >= MIN_BET;
  const hasEnoughBalance =
    creditsBalance !== null && creditsBalance >= betAmount;
  const canPlaceBet = isValidAmount && hasEnoughBalance && status === "idle";

  const estPayout = (() => {
    if (!isValidAmount || !outcome) return 0;
    const houseEdge = Number(market.houseEdgePct) || 0;
    const outcomePool = (Number(outcome.totalBetAmount) || 0) + betAmount;
    const totalPool = (Number(market.totalPool) || 0) + betAmount;
    if (outcomePool <= 0 || isNaN(outcomePool) || isNaN(totalPool)) return 0;
    return betAmount * ((totalPool * (1 - houseEdge / 100)) / outcomePool);
  })();
  const estProfit = estPayout - betAmount;
  // No one has placed a bet on this market yet — the user would be the first
  // predictor, so there's no pool to compute a meaningful payout against.
  const poolEmpty = (Number(market.totalPool) || 0) === 0;

  if (!isOpen) return null;

  const resetForm = () => {
    setAmountStr(initialAmount ? String(initialAmount) : "100");
    setStatus("idle");
    setError("");
    setCreditsBalance(null);
    setStreak(null);
  };

  const handleClose = () => {
    if (status === "processing") return;
    onClose();
    resetForm();
  };

  const handlePlaceBet = async () => {
    if (!canPlaceBet) return;
    setStatus("processing");
    setError("");

    try {
      // Re-fetch balance to ensure it's up-to-date
      const fresh = await getMe();
      const freshBalance = fresh.creditsBalance ?? 0;
      setCreditsBalance(freshBalance);

      if (freshBalance < betAmount) {
        setError(
          `Insufficient balance. You have Nu ${freshBalance.toLocaleString()}, need Nu ${betAmount.toLocaleString()}.`,
        );
        setStatus("idle");
        return;
      }

      // Place the bet - this will deduct from credits balance on backend
      const result = await placeBet(market.id, {
        outcomeId,
        amount: betAmount,
      });
      if (result?.streak) setStreak(result.streak);

      setStatus("success");
      onSuccess?.();
      window.dispatchEvent(new CustomEvent("oro:balance-changed"));

      // Trigger Celebration
      if (hapticFeedback.impactOccurred.isAvailable()) {
        hapticFeedback.impactOccurred("medium");
      }
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        zIndex: 2000,
      });
    } catch (err: any) {
      setError(err.message || "Failed to place prediction");
      setStatus("failed");
      onFailure?.(err.message || "Failed to place prediction");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: viewportOffsetTop,
        left: 0,
        right: 0,
        height: viewportHeight,
        zIndex: 1100,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <style>{`
        @keyframes tmaSheetUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @keyframes tmaSuccessPop {
          0%   { transform: scale(0.3) rotate(-10deg); opacity: 0; }
          55%  { transform: scale(1.25) rotate(4deg); opacity: 1; }
          75%  { transform: scale(0.92) rotate(-2deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes tmaSuccessGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(22,163,74,0.4); }
          50%       { box-shadow: 0 0 0 18px rgba(22,163,74,0); }
        }
        @keyframes tmaFailShake {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          15%       { transform: translateX(-8px) rotate(-6deg); }
          30%       { transform: translateX(8px) rotate(6deg); }
          45%       { transform: translateX(-6px) rotate(-3deg); }
          60%       { transform: translateX(6px) rotate(3deg); }
          75%       { transform: translateX(-3px); }
        }
        @keyframes tmaFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: "20px 20px 0 0",
          padding: "0 20px calc(28px + env(safe-area-inset-bottom))",
          width: "100%",
          maxWidth: 500,
          boxSizing: "border-box",
          boxShadow: "0 -4px 32px rgba(0,0,0,0.22)",
          animation: "tmaSheetUp 0.32s cubic-bezier(0.32,0.72,0,1) forwards",
          maxHeight: `${viewportHeight * 0.92}px`,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 8px", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--glass-border)" }} />
        </div>
        {/* ── Success ── */}
        {status === "success" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              padding: "24px 0 8px",
            }}
          >
            {/* Icon + title row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 60,
                  height: 60,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #dcfce7, #bbf7d0)",
                  animation:
                    "tmaSuccessPop 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards, tmaSuccessGlow 1.2s ease 0.55s 2",
                }}
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#16a34a"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div style={{ animation: "tmaFadeIn 0.35s ease 0.3s both" }}>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: "#16a34a",
                    marginBottom: 4,
                  }}
                >
                  Prediction Locked In!
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Your position is now active
                </div>
              </div>
            </div>

            {/* Bet summary */}
            <div
              style={{
                background: "rgba(16,185,129,0.07)",
                border: "1px solid rgba(16,185,129,0.25)",
                borderRadius: 12,
                padding: "12px 16px",
                marginBottom: 8,
                animation: "tmaFadeIn 0.35s ease 0.45s both",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-subtle)",
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                {market.title}
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: "var(--text-main)",
                }}
              >
                Nu {betAmount.toLocaleString()} on{" "}
                <span style={{ color: "#10b981" }}>{outcome?.label}</span>
              </div>
            </div>

            {/* ── Streak Banner ── */}
            {streak && (
              <div style={{ animation: "tmaFadeIn 0.35s ease 0.5s both" }}>
                <StreakBanner
                  streakCount={streak.count}
                  dayInCycle={streak.dayInCycle}
                  nextBoostInDays={7 - streak.dayInCycle}
                  boostJustActivated={streak.boostActive}
                />
              </div>
            )}

            {/* ── Bet Share Card ── */}
            <div
              style={{
                animation: "tmaFadeIn 0.35s ease 0.55s both",
                marginTop: 12,
              }}
            >
              <BetShareCard
                userName={
                  user?.username
                    ? `@${user.username}`
                    : (user?.firstName ?? "You")
                }
                userPhotoUrl={user?.photoUrl}
                marketTitle={market.title}
                outcomePicked={outcome?.label ?? ""}
                stakeAmount={betAmount}
                outcomeColor={outcomeColor}
                referralId={String(user?.telegramId ?? user?.id ?? "")}
              />
            </div>

            {/* ── Challenge a Friend ── */}
            {(() => {
              const otherOutcomes = market.outcomes.filter(
                (o) => o.id !== outcomeId,
              );
              const opposing =
                otherOutcomes.length === 1 ? otherOutcomes[0].label : undefined;
              return (
                <div
                  style={{
                    animation: "tmaFadeIn 0.35s ease 0.65s both",
                    marginTop: 10,
                  }}
                >
                  <ChallengeAFriend
                    pickedOutcomeLabel={outcome?.label ?? ""}
                    opposingOutcomeLabel={opposing}
                    marketTitle={market.title}
                    marketId={market.id}
                    referralId={String(user?.telegramId ?? user?.id ?? "")}
                  />
                </div>
              );
            })()}

            {/* ── Legacy Share CTA ── */}
            <div
              style={{
                animation: "tmaFadeIn 0.35s ease 0.7s both",
                marginTop: 4,
              }}
            >
              <ShareCTA
                type="predict"
                amount={betAmount}
                marketTitle={market.title}
              />
            </div>

            {/* Done button */}
            <button
              onClick={() => {
                onClose();
                resetForm();
              }}
              style={{
                marginTop: 4,
                width: "100%",
                padding: "14px",
                background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(37,99,235,0.4)",
                animation: "tmaFadeIn 0.35s ease 0.75s both",
              }}
            >
              Done
            </button>
          </div>
        )}

        {/* ── Failed ── */}
        {status === "failed" && (
          <div style={{ textAlign: "center", padding: "32px 0 24px" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #fee2e2, #fecaca)",
                marginBottom: 16,
                animation:
                  "tmaFailShake 0.55s cubic-bezier(0.36,0.07,0.19,0.97) forwards",
              }}
            >
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "#ef4444",
                marginBottom: 8,
                animation: "tmaFadeIn 0.35s ease 0.3s both",
              }}
            >
              Prediction Failed
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                marginBottom: 24,
                lineHeight: 1.5,
                animation: "tmaFadeIn 0.35s ease 0.45s both",
              }}
            >
              {error || "Could not place prediction"}
            </div>
            <button
              onClick={() => {
                setStatus("idle");
                setError("");
              }}
              style={{
                padding: "12px 28px",
                background: "#3b82f6",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Try Again
            </button>
          </div>
        )}

        {/* ── Main form (idle / processing) ── */}
        {(status === "idle" || status === "processing") && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              minHeight: 0,
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 12,
                flexShrink: 0,
              }}
            >
              <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--text-subtle)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 3,
                  }}
                >
                  Predicting on
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    color: "var(--text-main)",
                    lineHeight: 1.3,
                    marginBottom: 8,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {market.title}
                </div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: `${outcomeColor}1a`,
                    border: `1px solid ${outcomeColor}4d`,
                    borderRadius: 20,
                    padding: "4px 12px",
                  }}
                >
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: outcomeColor,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: outcomeColor,
                    }}
                  >
                    {outcome?.label}
                  </span>
                </div>
              </div>
              <button
                onClick={handleClose}
                style={{
                  background: "var(--bg-main)",
                  border: "none",
                  borderRadius: "50%",
                  width: 30,
                  height: 30,
                  fontSize: 18,
                  color: "var(--text-muted)",
                  cursor: status === "processing" ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                height: 1,
                background: "var(--glass-border)",
                marginBottom: 16,
                flexShrink: 0,
              }}
            />

            {/* SCROLLABLE INNER CONTENT */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                minHeight: 0,
                paddingRight: 4,
                marginRight: -4,
              }}
            >
              {/* Balance display */}
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: 12,
                  background: "rgba(16,185,129,0.08)",
                  border: "1px solid rgba(16,185,129,0.3)",
                  marginBottom: 16,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--text-subtle)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Available Balance
                  </div>
                  <div
                    style={{ fontSize: 20, fontWeight: 800, color: "#10b981" }}
                  >
                    Nu{" "}
                    {creditsBalance !== null
                      ? Number(creditsBalance).toLocaleString()
                      : "…"}
                  </div>
                </div>
                {betAmount > 0 && creditsBalance !== null && (
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--text-subtle)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      After bet
                    </div>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        color: hasEnoughBalance
                          ? "var(--text-main)"
                          : "#ef4444",
                      }}
                    >
                      Nu {(creditsBalance - betAmount).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>

              {!hasEnoughBalance && betAmount > 0 && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    color: "#ef4444",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span>⚠️ Insufficient balance.</span>
                  {onGoToWallet && (
                    <button
                      onClick={() => {
                        onClose();
                        onGoToWallet();
                      }}
                      style={{
                        background: "#ef4444",
                        color: "#fff",
                        border: "none",
                        borderRadius: 7,
                        padding: "5px 10px",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Top up →
                    </button>
                  )}
                </div>
              )}

              {/* Amount */}
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--text-subtle)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 8,
                }}
              >
                Stake (Nu)
              </div>
              {/* Stake input with stepper buttons */}
              <div style={{ display: "flex", gap: 8, alignItems: "stretch", marginBottom: 10 }}>
                {/* Decrement */}
                <button
                  onClick={() => {
                    const step = QUICK_AMOUNTS[0];
                    const next = Math.max(MIN_BET, (parseFloat(amountStr) || 0) - step);
                    setAmountStr(next.toString());
                  }}
                  style={{
                    width: 48,
                    flexShrink: 0,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--bg-secondary)",
                    color: "var(--text-main)",
                    fontSize: 22,
                    fontWeight: 400,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 1,
                  }}
                >
                  −
                </button>

                {/* Input */}
                <div style={{ position: "relative", flex: 1 }}>
                  <span
                    style={{
                      position: "absolute",
                      left: 14,
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: 16,
                      fontWeight: 700,
                      color: "var(--text-subtle)",
                      pointerEvents: "none",
                    }}
                  >
                    Nu
                  </span>
                  <input
                    type="number"
                    min={MIN_BET}
                    value={amountStr}
                    inputMode="numeric"
                    placeholder="Amount"
                    onChange={(e) => setAmountStr(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "16px 12px 16px 44px",
                      borderRadius: 12,
                      border:
                        isValidAmount || !betAmount
                          ? "2px solid var(--glass-border)"
                          : "2px solid #fca5a5",
                      fontSize: 22,
                      fontWeight: 800,
                      color: "var(--text-main)",
                      background: "var(--bg-main)",
                      outline: "none",
                      textAlign: "center",
                    }}
                  />
                </div>

                {/* Increment */}
                <button
                  onClick={() => {
                    const step = QUICK_AMOUNTS[0];
                    const max = creditsBalance !== null ? Math.floor(creditsBalance) : Infinity;
                    const next = Math.min(max, (parseFloat(amountStr) || 0) + step);
                    setAmountStr(next.toString());
                  }}
                  style={{
                    width: 48,
                    flexShrink: 0,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--bg-secondary)",
                    color: "var(--text-main)",
                    fontSize: 22,
                    fontWeight: 400,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 1,
                  }}
                >
                  +
                </button>
              </div>
              {/* Quick-fill chips */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {QUICK_AMOUNTS.map((q) => (
                  <button
                    key={q}
                    onClick={() => setAmountStr(q.toString())}
                    className="tma-outcome-btn"
                    style={{
                      flex: 1,
                      padding: "8px 0",
                      borderRadius: 10,
                      border:
                        amountStr === q.toString()
                          ? "2px solid #10b981"
                          : "1px solid var(--border)",
                      borderBottomWidth: 2,
                      background:
                        amountStr === q.toString()
                          ? "rgba(16,185,129,0.1)"
                          : "var(--bg-secondary)",
                      color:
                        amountStr === q.toString()
                          ? "#10b981"
                          : "var(--text-main)",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {q}
                  </button>
                ))}
                {creditsBalance !== null && creditsBalance > 0 && (
                  <button
                    onClick={() =>
                      setAmountStr(Math.floor(creditsBalance).toString())
                    }
                    className="tma-outcome-btn"
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      border:
                        amountStr === Math.floor(creditsBalance).toString()
                          ? "2px solid #10b981"
                          : "1px solid var(--border)",
                      borderBottomWidth: 2,
                      background:
                        amountStr === Math.floor(creditsBalance).toString()
                          ? "rgba(16,185,129,0.1)"
                          : "var(--bg-secondary)",
                      color:
                        amountStr === Math.floor(creditsBalance).toString()
                          ? "#10b981"
                          : "var(--text-subtle)",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Max
                  </button>
                )}
              </div>

              {/* Estimated payout */}
              {isValidAmount && poolEmpty ? (
                <div
                  style={{
                    background: "var(--bg-main)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: 10,
                    padding: "12px 14px",
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--text-main)",
                    }}
                  >
                    No one has predicted yet
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-subtle)",
                      marginTop: 2,
                    }}
                  >
                    Be the first — your payout grows as others join.
                  </div>
                </div>
              ) : isValidAmount ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background:
                      estProfit >= 0 ? "rgba(22,163,74,0.1)" : "var(--bg-main)",
                    border: `1px solid ${estProfit >= 0 ? "#86efac" : "var(--glass-border)"}`,
                    borderRadius: 10,
                    padding: "10px 14px",
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--text-subtle)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      You'll win
                    </div>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 800,
                        color: estProfit >= 0 ? "#16a34a" : "var(--text-muted)",
                      }}
                    >
                      {estProfit >= 0 ? `Nu ${Math.floor(estPayout).toLocaleString()}` : "—"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--text-subtle)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      Est. profit
                    </div>
                    {estProfit >= 0 ? (
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: "#16a34a",
                        }}
                      >
                        +Nu {Math.floor(estProfit).toLocaleString()}
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-subtle)",
                          maxWidth: 120,
                          textAlign: "right",
                        }}
                      >
                        Grows when more people join
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {isValidAmount && (
                <PayoutBreakdown
                  market={market}
                  outcomeId={outcomeId}
                  betAmount={betAmount}
                />
              )}
            </div>

            {/* FIXED FOOTER */}
            <div style={{ flexShrink: 0, marginTop: 12 }}>
              {error && (
                <div
                  style={{
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    color: "#ef4444",
                    padding: "10px 14px",
                    borderRadius: 8,
                    marginBottom: 16,
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  {error}
                </div>
              )}

              <button
                onClick={handlePlaceBet}
                disabled={!canPlaceBet}
                style={{
                  width: "100%",
                  padding: "16px",
                  background: canPlaceBet
                    ? "linear-gradient(135deg, #2563eb, #1d4ed8)"
                    : "var(--glass-border)",
                  color: canPlaceBet ? "#fff" : "var(--text-subtle)",
                  border: "none",
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: 800,
                  cursor: canPlaceBet ? "pointer" : "not-allowed",
                  boxShadow: canPlaceBet
                    ? "0 4px 14px rgba(37,99,235,0.4)"
                    : "none",
                  transition: "all 0.15s ease",
                  letterSpacing: "0.01em",
                }}
              >
                {status === "processing" ? (
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ animation: "spin 0.8s linear infinite" }}
                    >
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    Locking In…
                  </span>
                ) : !isValidAmount ? (
                  `Min Nu ${MIN_BET}`
                ) : !hasEnoughBalance ? (
                  "Insufficient Balance"
                ) : (
                  `Predict — Nu ${betAmount.toLocaleString()}`
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
