import { useState, useRef, useEffect } from "react";
import dkBankLogo from "@shared/assets/dk blue.png";
import {
  initiateDKBankPayment,
  confirmDKBankPayment,
  checkDKBankPaymentStatus,
  formatBTN,
} from "@shared/api/dkbank";
import { getMe } from "@shared/api/client";
import type { Market } from "@shared/api/client";
import type { DKBankPaymentRequest, PaymentResponse } from "@shared/types/payment";
import { PayoutBreakdown } from "@shared/components/PayoutBreakdown";

const QUICK_AMOUNTS = [50, 100, 200, 500];
const MIN_BET = 50;

interface TmaPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  market: Market;
  outcomeId: string;
  initialAmount?: number;
  onSuccess?: (payment: PaymentResponse) => void;
  onFailure?: (error: string) => void;
}

type Status = "idle" | "processing" | "otp_required" | "success" | "failed";

export function TmaPaymentModal({
  isOpen,
  onClose,
  market,
  outcomeId,
  initialAmount,
  onSuccess,
  onFailure,
}: TmaPaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<
    "dkbank" | "credits" | null
  >(null);
  const [amountStr, setAmountStr] = useState(() =>
    initialAmount ? String(initialAmount) : "100",
  );
  const [cidNumber, setCidNumber] = useState("");
  const [linkedCid, setLinkedCid] = useState<string | null>(null); // from user's profile
  const [customerName, setCustomerName] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [pendingPaymentId, setPendingPaymentId] = useState("");
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const [creditsBalance, setCreditsBalance] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch user's linked CID when modal opens — auto-fill and lock
  useEffect(() => {
    if (!isOpen) return;
    getMe()
      .then((u) => {
        if (u.dkCid) {
          setLinkedCid(u.dkCid);
          setCidNumber(u.dkCid);
          if (u.dkAccountName) setCustomerName(u.dkAccountName);
        }
        setCreditsBalance(u.creditsBalance ?? 0);
      })
      .catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handleResize = () => setViewportHeight(vv.height);
    vv.addEventListener("resize", handleResize);
    return () => vv.removeEventListener("resize", handleResize);
  }, []);

  const outcome = market.outcomes.find((o) => o.id === outcomeId);

  // Derive the outcome color using the same rank-based logic as the feed card
  const outcomeColor = (() => {
    const sorted = [...market.outcomes].sort(
      (a, b) => Number(b.totalBetAmount) - Number(a.totalBetAmount),
    );
    const rank = sorted.findIndex((o) => o.id === outcomeId);
    const total = market.outcomes.length;
    if (rank === 0) return "#22c55e";
    if (rank === total - 1 && total > 1) return "#ef4444";
    return "#f59e0b";
  })();

  const betAmount = parseFloat(amountStr) || 0;
  const isValidAmount = betAmount >= MIN_BET;
  // Payment is only allowed when using the user's own linked CID
  const canPay =
    isValidAmount &&
    !!linkedCid &&
    cidNumber === linkedCid &&
    status === "idle" &&
    selectedMethod === "dkbank";

  // Credits bet is allowed when user has sufficient balance
  const hasEnoughCredits =
    creditsBalance !== null && creditsBalance >= betAmount;
  const canPayWithCredits =
    isValidAmount &&
    selectedMethod === "credits" &&
    hasEnoughCredits &&
    status === "idle";

  const estPayout = (() => {
    if (!isValidAmount || !outcome) return 0;
    const houseEdge = Number(market.houseEdgePct) || 0;
    const outcomePool = (Number(outcome.totalBetAmount) || 0) + betAmount;
    const totalPool = (Number(market.totalPool) || 0) + betAmount;
    if (outcomePool <= 0 || isNaN(outcomePool) || isNaN(totalPool)) return 0;
    return betAmount * ((totalPool * (1 - houseEdge / 100)) / outcomePool);
  })();
  const estProfit = estPayout - betAmount;

  useEffect(() => {
    if (selectedMethod === "dkbank")
      setTimeout(() => inputRef.current?.focus(), 50);
  }, [selectedMethod]);

  if (!isOpen) return null;

  const resetForm = () => {
    setSelectedMethod(null);
    setAmountStr(initialAmount ? String(initialAmount) : "100");
    setCidNumber("");
    setLinkedCid(null);
    setCustomerName("");
    setOtpValue("");
    setStatus("idle");
    setError("");
    setPendingPaymentId("");
    setCreditsBalance(null);
  };

  const handleClose = () => {
    if (status === "processing") return;
    onClose();
    resetForm();
  };

  const handlePay = async () => {
    if (!canPay) return;
    setStatus("processing");
    setError("");
    try {
      const req: DKBankPaymentRequest = {
        amount: betAmount,
        cid: cidNumber,
        customerName: customerName || undefined,
        description: `Predict: ${market.title} — ${outcome?.label}`,
        merchantTxnId: `ORO_TMA_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      };
      const payment = await initiateDKBankPayment(req);
      if (payment.otpRequired) {
        setPendingPaymentId(payment.paymentId);
        setStatus("otp_required");
      } else if (payment.status === "success") {
        setStatus("success");
        setTimeout(() => {
          onClose();
          resetForm();
          onSuccess?.({ ...payment, amount: betAmount });
        }, 2500);
      } else {
        pollStatus(payment.paymentId, payment);
      }
    } catch (err: any) {
      setError(err.message || "Payment failed");
      setStatus("failed");
      onFailure?.(err.message || "Payment failed");
    }
  };

  const handleConfirmOtp = async () => {
    if (!otpValue || otpValue.length < 4 || !pendingPaymentId) return;
    setStatus("processing");
    setError("");
    try {
      const confirmed = await confirmDKBankPayment(pendingPaymentId, otpValue);
      pollStatus(confirmed.paymentId, confirmed);
    } catch (err: any) {
      setError(err.message || "OTP confirmation failed");
      setStatus("otp_required");
    }
  };

  const pollStatus = async (
    paymentId: string,
    initiatedPayment: PaymentResponse,
  ) => {
    const max = 30;
    let attempts = 0;
    const poll = async () => {
      try {
        const s = await checkDKBankPaymentStatus(paymentId);
        if (s.status === "success") {
          setStatus("success");
          setTimeout(() => {
            onClose();
            resetForm();
            onSuccess?.({ ...initiatedPayment, amount: betAmount });
          }, 2500);
        } else if (s.status === "failed") {
          setError(s.failureReason || "Payment failed");
          setStatus("failed");
          onFailure?.(s.failureReason || "Payment failed");
        } else if (attempts < max) {
          attempts++;
          setTimeout(poll, 10000);
        } else {
          setError("Payment verification timeout");
          setStatus("failed");
          onFailure?.("Payment verification timeout");
        }
      } catch {
        if (attempts < max) {
          attempts++;
          setTimeout(poll, 10000);
        } else {
          setError("Unable to verify payment");
          setStatus("failed");
        }
      }
    };
    poll();
  };

  /** Pay directly from Oro credits balance (no DK Bank debit needed). */
  const handlePayWithCredits = async () => {
    if (!canPayWithCredits || !outcomeId) return;
    setStatus("processing");
    setError("");
    try {
      // Verify balance is still sufficient (re-fetch to prevent stale reads)
      const fresh = await getMe();
      const freshBal = fresh.creditsBalance ?? 0;
      setCreditsBalance(freshBal);
      if (freshBal < betAmount) {
        setError(
          `Insufficient balance. You have Nu ${freshBal.toLocaleString()}, need Nu ${betAmount.toLocaleString()}.`,
        );
        setStatus("idle");
        return;
      }
      setStatus("success");
      setTimeout(() => {
        // onSuccess MUST fire before onClose so the parent's activeBet is
        // still set when handlePaymentSuccess reads it to call placeBet.
        onSuccess?.({
          success: true,
          paymentId: `credits-${Date.now()}`,
          status: "success",
          amount: betAmount,
          currency: "BTN",
          method: "credits",
          message: "Bet placed from Oro Credits",
          timestamp: new Date().toISOString(),
        } as PaymentResponse);
        onClose();
        resetForm();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to verify balance");
      setStatus("failed");
      onFailure?.(err.message || "Failed to verify balance");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <style>{`
        @keyframes tmaModalUp {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
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
        @keyframes tmaCoinFall {
          0%   { transform: translateY(-50px) rotate(0deg);   opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(300px) rotate(540deg); opacity: 0; }
        }
        @keyframes tmaOtpPop {
          0%   { transform: scale(0.7); opacity: 0.4; }
          60%  { transform: scale(1.12); }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes tmaBalanceCountUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .pay-method-btn { transition: transform 0.12s ease, box-shadow 0.12s ease; }
        .pay-method-btn:active { transform: scale(0.97); }
      `}</style>

      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: 20,
          padding: "24px 20px 28px",
          width: "100%",
          maxWidth: 460,
          boxSizing: "border-box",
          margin: "0 16px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          animation: "tmaModalUp 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards",
          maxHeight: `${viewportHeight * 0.5}px`,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ── Success ── */}
        {status === "success" && (
          <div
            style={{
              textAlign: "center",
              padding: "28px 0 20px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Coins-falling overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                overflow: "hidden",
              }}
            >
              {Array.from({ length: 14 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: `${Math.random() * 100}%`,
                    top: 0,
                    fontSize: [12, 16, 20, 12][i % 4],
                    animation: `tmaCoinFall ${1.0 + Math.random() * 1.5}s ease-in ${Math.random() * 0.6}s both`,
                  }}
                >
                  {["🪙", "💰", "✨", "🎊"][i % 4]}
                </div>
              ))}
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #dcfce7, #bbf7d0)",
                marginBottom: 14,
                animation:
                  "tmaSuccessPop 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards, tmaSuccessGlow 1.2s ease 0.55s 2",
              }}
            >
              <span style={{ fontSize: 36 }}>🎉</span>
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "#16a34a",
                marginBottom: 6,
                animation: "tmaFadeIn 0.35s ease 0.3s both",
              }}
            >
              Position Opened!
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                marginBottom: 12,
                animation: "tmaFadeIn 0.35s ease 0.45s both",
              }}
            >
              Your payment was confirmed
            </div>
            {/* Balance count-up after bet */}
            <div
              style={{
                display: "inline-block",
                padding: "8px 18px",
                borderRadius: 10,
                background: "rgba(22,163,74,0.1)",
                border: "1px solid rgba(22,163,74,0.25)",
                animation: "tmaBalanceCountUp 0.4s ease 0.6s both",
              }}
            >
              <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 700 }}>
                Bet placed · Nu {betAmount.toLocaleString()} 🎯
              </span>
            </div>
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
              Payment Failed
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
              {error || "Could not complete payment"}
            </div>
            <button
              onClick={() => {
                setStatus("idle");
                setError("");
                setOtpValue("");
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

        {/* ── OTP step ── */}
        {status === "otp_required" && (
          <div>
            {/* Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
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
                    marginBottom: 3,
                  }}
                >
                  Verify OTP
                </div>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <div
                    style={{
                      background: "#fff",
                      borderRadius: 6,
                      padding: "3px 8px",
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    <img
                      src={dkBankLogo}
                      alt="DK Bank"
                      style={{ height: 18, width: "auto" }}
                    />
                  </div>
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
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>
            <div
              style={{
                height: 1,
                background: "var(--glass-border)",
                marginBottom: 20,
              }}
            />

            {/* OTP Visual header */}
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: "50%",
                  background:
                    "linear-gradient(135deg, rgba(37,117,208,0.18), rgba(37,117,208,0.06))",
                  border: "2px solid rgba(37,117,208,0.3)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 26,
                  marginBottom: 10,
                }}
              >
                📲
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: "var(--text-main)",
                  marginBottom: 4,
                }}
              >
                Confirm Your Bet
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-subtle)",
                  lineHeight: 1.5,
                }}
              >
                Enter the code sent to your{" "}
                <strong style={{ color: "var(--text-muted)" }}>
                  Telegram bot
                </strong>
              </div>
            </div>

            {/* Animated digit boxes */}
            <div
              style={{
                display: "flex",
                gap: 7,
                justifyContent: "center",
                marginBottom: 14,
              }}
            >
              {Array.from({ length: 6 }).map((_, i) => {
                const digit = otpValue[i];
                const isFilled = !!digit;
                const isActive = otpValue.length === i;
                return (
                  <div
                    key={i}
                    style={{
                      width: 42,
                      height: 52,
                      borderRadius: 11,
                      border: isFilled
                        ? "2px solid #2563eb"
                        : isActive
                          ? "2px solid rgba(37,99,235,0.45)"
                          : "2px solid var(--glass-border)",
                      background: isFilled
                        ? "rgba(37,99,235,0.1)"
                        : "var(--bg-main)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                      fontWeight: 800,
                      color: "#3b82f6",
                      transition: "all 0.12s",
                      animation: isFilled ? "tmaOtpPop 0.2s ease" : "none",
                      boxShadow: isActive
                        ? "0 0 0 3px rgba(37,99,235,0.12)"
                        : "none",
                    }}
                  >
                    {digit ??
                      (isActive ? (
                        <span
                          style={{
                            width: 2,
                            height: 20,
                            background: "#3b82f6",
                            borderRadius: 2,
                            animation:
                              "tmaSuccessGlow 0.9s ease-in-out infinite",
                          }}
                        />
                      ) : (
                        ""
                      ))}
                  </div>
                );
              })}
            </div>

            {/* Hidden real input */}
            <input
              type="text"
              inputMode="numeric"
              value={otpValue}
              onChange={(e) => {
                setOtpValue(e.target.value.replace(/\D/g, "").slice(0, 8));
                setError("");
              }}
              autoFocus
              id="tma-otp-input"
              style={{
                position: "absolute",
                opacity: 0,
                pointerEvents: "none",
                width: 1,
                height: 1,
              }}
            />

            {/* Tap to open keyboard */}
            <button
              onClick={() => document.getElementById("tma-otp-input")?.focus()}
              style={{
                width: "100%",
                padding: "9px",
                marginBottom: 6,
                borderRadius: 9,
                border: "1.5px dashed var(--glass-border)",
                background: "transparent",
                color: "var(--text-subtle)",
                fontSize: 12,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              📱 Tap to enter OTP
            </button>

            {error && (
              <div
                style={{
                  fontSize: 13,
                  color: "#ef4444",
                  marginTop: 8,
                  textAlign: "center",
                }}
              >
                {error}
              </div>
            )}

            <button
              onClick={handleConfirmOtp}
              disabled={otpValue.length < 4}
              style={{
                width: "100%",
                padding: "14px",
                marginTop: 16,
                background:
                  otpValue.length < 4 ? "var(--glass-border)" : "#3b82f6",
                color: otpValue.length < 4 ? "var(--text-subtle)" : "#fff",
                border: "none",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                cursor: otpValue.length < 4 ? "not-allowed" : "pointer",
              }}
            >
              {`Confirm & Pay ${formatBTN(betAmount)}`}
            </button>
            <button
              onClick={() => {
                setStatus("idle");
                setOtpValue("");
                setError("");
              }}
              style={{
                width: "100%",
                padding: "12px",
                marginTop: 8,
                background: "transparent",
                color: "var(--text-muted)",
                border: "none",
                borderRadius: 10,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              ← Change CID
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
                  Placing a bet on
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
              {/* Payment method */}
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--text-subtle)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 10,
                }}
              >
                Pay with
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {/* DK Bank button */}
                <button
                  onClick={() => setSelectedMethod("dkbank")}
                  className="pay-method-btn"
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: 10,
                    cursor: "pointer",
                    border:
                      selectedMethod === "dkbank"
                        ? "2px solid #2563eb"
                        : "1.5px solid rgba(255,255,255,0.18)",
                    background:
                      selectedMethod === "dkbank"
                        ? "rgba(37,99,235,0.15)"
                        : "rgba(255,255,255,0.09)",
                    boxShadow:
                      selectedMethod === "dkbank"
                        ? "0 0 0 3px rgba(37,99,235,0.2), 0 4px 14px rgba(37,99,235,0.35)"
                        : "0 3px 8px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.12)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      background: "#fff",
                      borderRadius: 5,
                      padding: "2px 6px",
                      display: "inline-flex",
                      alignItems: "center",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={dkBankLogo}
                      alt="DK Bank"
                      style={{ height: 16, width: "auto" }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color:
                        selectedMethod === "dkbank"
                          ? "#60a5fa"
                          : "var(--text-muted)",
                    }}
                  >
                    BTN · Nu
                  </span>
                </button>

                {/* TON Wallet — disabled */}
                <div
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1.5px solid rgba(255, 255, 255, 1)",
                    background: "rgba(255,255,255,0.09)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    opacity: 0.45,
                    cursor: "not-allowed",
                    boxShadow:
                      "0 3px 8px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.12)",
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 22,
                      borderRadius: 5,
                      background: "linear-gradient(135deg, #00b4ed, #0088cc)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 56 56" fill="none">
                      <path
                        d="M37.56 15.63H18.44c-3.52 0-5.74 3.79-3.97 6.86l11.8 20.45c.77 1.34 2.7 1.34 3.47 0l11.8-20.45c1.77-3.06-.46-6.86-3.98-6.86zm-11.3 21.18l-2.57-4.97-6.2-11.09c-.41-.71.09-1.62.95-1.62h7.82v17.68zm12.25-16.06l-6.2 11.09-2.57 4.97V19.12h7.82c.86 0 1.36.91.95 1.63z"
                        fill="#fff"
                      />
                    </svg>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--text-muted)",
                      }}
                    >
                      TON Wallet
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-subtle)" }}>
                      Coming soon
                    </div>
                  </div>
                </div>

                {/* Oro Credits button */}
                <button
                  onClick={() => setSelectedMethod("credits")}
                  className="pay-method-btn"
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: 10,
                    cursor: "pointer",
                    border:
                      selectedMethod === "credits"
                        ? "2px solid #10b981"
                        : "1.5px solid rgba(255,255,255,0.18)",
                    background:
                      selectedMethod === "credits"
                        ? "rgba(16,185,129,0.15)"
                        : "rgba(255,255,255,0.09)",
                    boxShadow:
                      selectedMethod === "credits"
                        ? "0 0 0 3px rgba(16,185,129,0.2), 0 4px 14px rgba(16,185,129,0.25)"
                        : "0 3px 8px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.12)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 22,
                      borderRadius: 5,
                      background: "linear-gradient(135deg, #10b981, #059669)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      fontSize: 13,
                    }}
                  >
                    💰
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color:
                          selectedMethod === "credits"
                            ? "#6ee7b7"
                            : "var(--text-muted)",
                      }}
                    >
                      Oro Credits
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color:
                          selectedMethod === "credits"
                            ? "#6ee7b7"
                            : "var(--text-subtle)",
                      }}
                    >
                      {creditsBalance !== null
                        ? `Nu ${Number(creditsBalance).toLocaleString()}`
                        : "Loading…"}
                    </div>
                  </div>
                </button>
              </div>

              {/* Amount + CID */}
              {selectedMethod === "dkbank" && (
                <>
                  <div
                    style={{
                      height: 1,
                      background: "var(--glass-border)",
                      marginBottom: 16,
                    }}
                  />

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
                    Amount (Nu)
                  </div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    {QUICK_AMOUNTS.map((q) => (
                      <button
                        key={q}
                        onClick={() => setAmountStr(q.toString())}
                        className="tma-outcome-btn"
                        style={{
                          flex: 1,
                          padding: "10px 0",
                          borderRadius: 12,
                          border:
                            amountStr === q.toString()
                              ? "2px solid #3b82f6"
                              : "1px solid var(--border)",
                          borderBottomWidth: 2,
                          background:
                            amountStr === q.toString()
                              ? "rgba(59, 130, 246, 0.1)"
                              : "var(--bg-secondary)",
                          color:
                            amountStr === q.toString()
                              ? "#3b82f6"
                              : "var(--text-main)",
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                  <div style={{ position: "relative", marginBottom: 16 }}>
                    <span
                      style={{
                        position: "absolute",
                        left: 13,
                        top: "50%",
                        transform: "translateY(-50%)",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text-subtle)",
                        pointerEvents: "none",
                      }}
                    >
                      Nu
                    </span>
                    <input
                      ref={inputRef}
                      type="number"
                      min={MIN_BET}
                      value={amountStr}
                      onChange={(e) => setAmountStr(e.target.value)}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "12px 14px 12px 34px",
                        borderRadius: 10,
                        border:
                          isValidAmount || !betAmount
                            ? "2px solid var(--glass-border)"
                            : "2px solid #fca5a5",
                        fontSize: 15,
                        fontWeight: 600,
                        color: "var(--text-main)",
                        background: "var(--bg-main)",
                        outline: "none",
                      }}
                    />
                  </div>

                  {/* Estimated payout */}
                  {isValidAmount && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background:
                          estProfit >= 0
                            ? "rgba(22, 163, 74, 0.1)"
                            : "var(--bg-main)",
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
                          Est. payout if win
                        </div>
                        <div
                          style={{
                            fontSize: 18,
                            fontWeight: 800,
                            color:
                              estProfit >= 0 ? "#16a34a" : "var(--text-muted)",
                          }}
                        >
                          {estProfit >= 0 ? `Nu ${estPayout.toFixed(2)}` : "—"}
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
                            +Nu {estProfit.toFixed(2)}
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
                            Grows as more bets join
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Payout breakdown */}
                  {isValidAmount && (
                    <PayoutBreakdown
                      market={market}
                      outcomeId={outcomeId}
                      betAmount={betAmount}
                    />
                  )}

                  {/* CID — locked to user's linked account */}
                  <div style={{ marginBottom: 12, marginTop: 16 }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--text-subtle)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        marginBottom: 6,
                      }}
                    >
                      CID Number {linkedCid ? "🔒" : "*"}
                    </label>
                    {linkedCid ? (
                      <div
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          padding: "12px 14px",
                          borderRadius: 10,
                          border: "2px solid rgba(22, 163, 74, 0.3)",
                          fontSize: 15,
                          fontWeight: 600,
                          color: "#10b981",
                          background: "rgba(22, 163, 74, 0.1)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{ fontFamily: "monospace", letterSpacing: 2 }}
                        >
                          {linkedCid}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            color: "#16a34a",
                            fontWeight: 700,
                          }}
                        >
                          Your account ✓
                        </span>
                      </div>
                    ) : (
                      <input
                        type="text"
                        inputMode="numeric"
                        value={cidNumber}
                        onChange={(e) =>
                          setCidNumber(
                            e.target.value.replace(/\D/g, "").slice(0, 11),
                          )
                        }
                        placeholder="11-digit CID"
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          padding: "12px 14px",
                          borderRadius: 10,
                          border: "2px solid rgba(239, 68, 68, 0.5)",
                          fontSize: 15,
                          fontWeight: 600,
                          color: "var(--text-main)",
                          background: "rgba(239, 68, 68, 0.05)",
                          outline: "none",
                        }}
                      />
                    )}
                    {!linkedCid && (
                      <p
                        style={{
                          margin: "6px 0 0",
                          fontSize: 12,
                          color: "#ef4444",
                        }}
                      >
                        ⚠️ No DK Bank account linked. Go to Profile → Link DK
                        Bank Account first.
                      </p>
                    )}
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--text-subtle)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        marginBottom: 6,
                      }}
                    >
                      Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Your name"
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "12px 14px",
                        borderRadius: 10,
                        border: "2px solid var(--glass-border)",
                        fontSize: 15,
                        fontWeight: 600,
                        color: "var(--text-main)",
                        background: "var(--bg-main)",
                        outline: "none",
                      }}
                    />
                  </div>
                </>
              )}

              {/* ── Oro Credits form ── */}
              {selectedMethod === "credits" && (
                <>
                  <div
                    style={{
                      height: 1,
                      background: "var(--glass-border)",
                      marginBottom: 16,
                    }}
                  />

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
                        style={{
                          fontSize: 20,
                          fontWeight: 800,
                          color: "#10b981",
                        }}
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
                            color: hasEnoughCredits
                              ? "var(--text-main)"
                              : "#ef4444",
                          }}
                        >
                          Nu {(creditsBalance - betAmount).toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>

                  {!hasEnoughCredits && betAmount > 0 && (
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
                      }}
                    >
                      ⚠️ Insufficient balance. Deposit via DK Bank first.
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
                    Amount (Nu)
                  </div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    {QUICK_AMOUNTS.map((q) => (
                      <button
                        key={q}
                        onClick={() => setAmountStr(q.toString())}
                        className="tma-outcome-btn"
                        style={{
                          flex: 1,
                          padding: "10px 0",
                          borderRadius: 12,
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
                  </div>
                  <div style={{ position: "relative", marginBottom: 16 }}>
                    <span
                      style={{
                        position: "absolute",
                        left: 13,
                        top: "50%",
                        transform: "translateY(-50%)",
                        fontSize: 13,
                        fontWeight: 600,
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
                      onChange={(e) => setAmountStr(e.target.value)}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "12px 14px 12px 34px",
                        borderRadius: 10,
                        border:
                          isValidAmount || !betAmount
                            ? "2px solid var(--glass-border)"
                            : "2px solid #fca5a5",
                        fontSize: 15,
                        fontWeight: 600,
                        color: "var(--text-main)",
                        background: "var(--bg-main)",
                        outline: "none",
                      }}
                    />
                  </div>

                  {/* Estimated payout */}
                  {isValidAmount && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background:
                          estProfit >= 0
                            ? "rgba(22,163,74,0.1)"
                            : "var(--bg-main)",
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
                          Est. payout if win
                        </div>
                        <div
                          style={{
                            fontSize: 18,
                            fontWeight: 800,
                            color:
                              estProfit >= 0 ? "#16a34a" : "var(--text-muted)",
                          }}
                        >
                          {estProfit >= 0 ? `Nu ${estPayout.toFixed(2)}` : "—"}
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
                            +Nu {estProfit.toFixed(2)}
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
                            Grows as more bets join
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {isValidAmount && (
                    <PayoutBreakdown
                      market={market}
                      outcomeId={outcomeId}
                      betAmount={betAmount}
                    />
                  )}
                </>
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

              {selectedMethod === "credits" ? (
                <button
                  onClick={handlePayWithCredits}
                  disabled={!canPayWithCredits}
                  style={{
                    width: "100%",
                    padding: "16px",
                    background: canPayWithCredits
                      ? "linear-gradient(135deg, #059669, #047857)"
                      : "var(--glass-border)",
                    color: canPayWithCredits ? "#fff" : "var(--text-subtle)",
                    border: "none",
                    borderRadius: 12,
                    fontSize: 15,
                    fontWeight: 800,
                    cursor: canPayWithCredits ? "pointer" : "not-allowed",
                    boxShadow: canPayWithCredits
                      ? "0 4px 14px rgba(5,150,105,0.4)"
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
                      Placing Bet…
                    </span>
                  ) : !isValidAmount ? (
                    `Min Nu ${MIN_BET}`
                  ) : !hasEnoughCredits ? (
                    "Insufficient Balance"
                  ) : (
                    `Place Bet — Nu ${betAmount.toLocaleString()}`
                  )}
                </button>
              ) : (
                <button
                  onClick={handlePay}
                  disabled={!canPay}
                  style={{
                    width: "100%",
                    padding: "16px",
                    background: canPay
                      ? "linear-gradient(135deg, #2563eb, #1d4ed8)"
                      : "var(--glass-border)",
                    color: canPay ? "#fff" : "var(--text-subtle)",
                    border: "none",
                    borderRadius: 12,
                    fontSize: 15,
                    fontWeight: 800,
                    cursor: canPay ? "pointer" : "not-allowed",
                    boxShadow: canPay
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
                      Processing…
                    </span>
                  ) : canPay ? (
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                      }}
                    >
                      Pay {formatBTN(betAmount)} with
                      <span
                        style={{
                          background: "#fff",
                          borderRadius: 5,
                          padding: "2px 8px",
                          display: "inline-flex",
                          alignItems: "center",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                        }}
                      >
                        <img
                          src={dkBankLogo}
                          alt="DK Bank"
                          style={{ height: 15, width: "auto" }}
                        />
                      </span>
                    </span>
                  ) : !isValidAmount ? (
                    `Min Nu ${MIN_BET}`
                  ) : !selectedMethod ? (
                    "Select payment method above"
                  ) : null}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
