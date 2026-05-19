import { FC, useState, useEffect, useRef } from "react";
import dkBankLogo from "@shared/assets/dk blue.png";
import { useAuth } from "@shared/hooks/useAuth";
import {
  linkBankAccount,
  verifyBankLink,
  getLinkedBankAccounts,
  LinkedBankAccount,
  getMe,
  getMyTransactions,
  AuthUser,
  Transaction,
} from "@shared/api/client";
import {
  initiateDKBankDeposit,
  confirmDKBankDeposit,
  initiateDKBankWithdrawal,
  confirmDKBankWithdrawal,
  formatNu,
} from "@shared/api/dkbank";
import { Page } from "@/components/Page";
import { useTmaHaptic } from "@/hooks/useTmaHaptic";
import { Button, Card } from "@/components/ui";
import { BetShareCard } from "@shared/components/BetShareCard";
import { LoadingScreen } from "@shared/components/LoadingScreen";
import {
  CheckCircle2,
  XCircle,
  Link2,
  AlertCircle,
  Loader2,
  ArrowDownLeft,
  ArrowUpRight,
  Target,
  Trophy,
  RotateCcw,
  Lock,
  Unlock,
  Wallet,
  Plus,
  ArrowUpCircle,
  Clock,
  X,
  Send,
  Share2,
  Eye,
  EyeOff,
  UserPlus,
  Swords,
  Lightbulb,
  CheckCircle,
  Users,
  Gift,
  Hash,
  PenLine,
} from "lucide-react";

// ── Shared types ──────────────────────────────────────────────────────────────
type PaymentModalType = "deposit" | "withdraw" | null;
type PaymentStep = "amount" | "otp" | "success" | "failed";

const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME as string;

const QUICK_DEPOSIT_AMOUNTS = [100, 200, 500, 1000];
const QUICK_WITHDRAW_AMOUNTS = [100, 200, 500, 1000];
const MIN_DEPOSIT = 50;
const MAX_DEPOSIT = 15000;
const MIN_WITHDRAW = 50;

const TX_COLOR_IN = "#22c55e";
const TX_COLOR_OUT = "#ef4444";

const TX_ICON: Record<Transaction["type"], React.ReactNode> = {
  deposit: <ArrowDownLeft size={18} />,
  withdrawal: <ArrowUpRight size={18} />,
  bet_placed: <Target size={18} />,
  bet_payout: <Trophy size={18} />,
  refund: <RotateCcw size={18} />,
  dispute_bond: <Lock size={18} />,
  dispute_refund: <Unlock size={18} />,
  referral_bonus: <UserPlus size={18} />,
  duel_wager: <Swords size={18} />,
  duel_payout: <Swords size={18} />,
  free_credit: <Gift size={18} />,
};

const TX_LABEL: Record<Transaction["type"], string> = {
  deposit: "Top Up",
  withdrawal: "Cash Out",
  bet_placed: "Prediction placed",
  bet_payout: "Win — payout received",
  refund: "Prediction refunded",
  dispute_bond: "Dispute bond",
  dispute_refund: "Dispute bond refunded",
  referral_bonus: "Referral bonus",
  duel_wager: "Duel wager locked",
  duel_payout: "Duel payout",
  free_credit: "Welcome bonus",
};

// ── AnimatedCounter ────────────────────────────────────────────────────────────
const AnimatedCounter = ({ value }: { value: number }) => {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    let startTimestamp: number;
    const duration = 1000;
    const startValue = displayValue;
    if (value === startValue) return;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplayValue(startValue + (value - startValue) * ease);
      if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
  }, [value]);

  return <>{Math.round(displayValue).toLocaleString()}</>;
};

// ── TxRow ─────────────────────────────────────────────────────────────────────
function TxRow({
  tx,
  onShareWin,
  stakeAmount,
}: {
  tx: Transaction;
  onShareWin?: (tx: Transaction) => void;
  stakeAmount?: number;
}) {
  const isCredit = tx.amount > 0;
  const color = isCredit ? TX_COLOR_IN : TX_COLOR_OUT;
  const isWin = tx.type === "bet_payout";
  const isPositiveNet = !!stakeAmount && Number(tx.amount) > stakeAmount;
  const isShareableWin = isWin && isPositiveNet;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "13px 16px",
        borderBottom: "1px solid var(--glass-border)",
        background: isShareableWin ? "rgba(34,197,94,0.04)" : "transparent",
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          background: `${color}18`,
          color,
        }}
      >
        {TX_ICON[tx.type]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: 13,
            color: "var(--text-main)",
            marginBottom: tx.note ? 2 : 0,
          }}
        >
          {tx.note
            ? tx.note
            : isWin && !isPositiveNet
              ? "Payout received"
              : TX_LABEL[tx.type]}
        </div>
        {tx.note && (
          <div
            style={{
              fontSize: 11,
              color: "var(--text-subtle)",
              marginBottom: 2,
            }}
          >
            {isWin && !isPositiveNet ? "Payout received" : TX_LABEL[tx.type]}
          </div>
        )}
        <div style={{ fontSize: 11, color: "var(--text-subtle)" }}>
          {new Date(tx.createdAt).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color }}>
          {isCredit ? "+" : "−"}
          {Math.abs(Number(tx.amount)).toLocaleString()}
        </div>
        <div
          style={{ fontSize: 10, color: "var(--text-subtle)", marginTop: 2 }}
        >
          Bal {Number(tx.balanceAfter).toLocaleString()}
        </div>
        {isShareableWin && onShareWin && (
          <button
            onClick={() => onShareWin(tx)}
            style={{
              marginTop: 6,
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 8px",
              borderRadius: 20,
              border: "1px solid rgba(34,197,94,0.4)",
              background: "rgba(34,197,94,0.1)",
              color: "#22c55e",
              fontSize: 10,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <Share2 size={10} /> Share win
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export const TmaWalletPage: FC = () => {
  const { user: authUser, loading: authLoading } = useAuth();
  const haptic = useTmaHaptic();

  const [freshUser, setFreshUser] = useState<AuthUser | null>(null);
  const [freshLoading, setFreshLoading] = useState(true);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [showAllTxs, setShowAllTxs] = useState(false);
  const [balanceHidden, setBalanceHidden] = useState(true);
  const [balanceFlash, setBalanceFlash] = useState(false);
  const prevBalance = useRef(0);
  const [shareWinTx, setShareWinTx] = useState<Transaction | null>(null);
  const [showCoins, setShowCoins] = useState(false);

  // Deposit UX state
  const [referralDepositNudge, setReferralDepositNudge] = useState<{
    friendName: string;
    amount: number;
    bonusEarned: number;
  } | null>(null);
  const depositPrevBalance = useRef(0);

  // Payment modal state
  const [paymentModal, setPaymentModal] = useState<PaymentModalType>(null);
  const [payStep, setPayStep] = useState<PaymentStep>("amount");
  const [payAmountStr, setPayAmountStr] = useState("200");
  const [payOtp, setPayOtp] = useState("");
  const [payPendingId, setPayPendingId] = useState("");
  const [payError, setPayError] = useState("");
  const [payProcessing, setPayProcessing] = useState(false);
  const [paySuccessMsg, setPaySuccessMsg] = useState("");

  // Auto-focus OTP input when step becomes "otp" so keyboard opens immediately
  useEffect(() => {
    if (payStep === "otp") {
      const t = setTimeout(() => {
        document.getElementById("otp-hidden-input")?.focus();
      }, 150);
      return () => clearTimeout(t);
    }
  }, [payStep]);

  // Bank linking state (luckypem-style: CID → OTP to DK phone → verify)
  const [linkedAccount, setLinkedAccount] = useState<LinkedBankAccount | null>(
    null,
  );
  const [bankStep, setBankStep] = useState<"cid" | "otp" | "done">("cid");
  const [bankCid, setBankCid] = useState("");
  const [bankOtp, setBankOtp] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankMaskedPhone, setBankMaskedPhone] = useState("");
  const [bankLoading, setBankLoading] = useState(false);
  const [bankError, setBankError] = useState("");
  const [bankAccountRevealed, setBankAccountRevealed] = useState(false);

  useEffect(() => {
    getMe()
      .then(setFreshUser)
      .catch(() => setFreshUser(authUser))
      .finally(() => setFreshLoading(false));

    getLinkedBankAccounts()
      .then((accounts) => {
        const def = accounts.find((a) => a.isDefault) ?? accounts[0] ?? null;
        setLinkedAccount(def);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = () => refreshWallet();
    window.addEventListener("oro:balance-changed", handler);
    return () => window.removeEventListener("oro:balance-changed", handler);
  }, []);

  const refreshWallet = () => {
    setBalanceLoading(true);
    getMe()
      .then((updated) => {
        const newBal = Number(updated.creditsBalance ?? 0);
        if (prevBalance.current > 0 && newBal > prevBalance.current) {
          setBalanceFlash(true);
          setTimeout(() => setBalanceFlash(false), 1400);
        }
        prevBalance.current = newBal;
        setFreshUser(updated);
      })
      .catch(() => {})
      .finally(() => setBalanceLoading(false));

    setTxLoading(true);
    setTxError(null);
    getMyTransactions()
      .then((txList) => {
        setTxs(txList);

        const latestReferralBonus = txList.find(
          (t) => t.type === "referral_bonus",
        );
        if (latestReferralBonus) {
          setReferralDepositNudge({
            friendName:
              latestReferralBonus.note
                ?.replace("Referral bonus: ", "")
                .split(" ")[0] ?? "Your friend",
            amount: Math.abs(Number(latestReferralBonus.amount)) * 20,
            bonusEarned: Math.abs(Number(latestReferralBonus.amount)),
          });
        }
      })
      .catch((e) => setTxError(e.message))
      .finally(() => setTxLoading(false));
  };

  useEffect(() => {
    refreshWallet();
  }, []);

  const user = freshUser ?? authUser;
  const loading = authLoading && freshLoading;

  const totalWon = txs
    .filter((t) => t.type === "bet_payout")
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalDeposited = txs
    .filter((t) => t.type === "deposit")
    .reduce((s, t) => s + Number(t.amount), 0);
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const weeklyProfit = txs
    .filter((tx) => new Date(tx.createdAt) >= oneWeekAgo)
    .reduce((acc, tx) => {
      if (tx.type === "bet_payout") return acc + Math.abs(Number(tx.amount));
      if (tx.type === "bet_placed") return acc - Math.abs(Number(tx.amount));
      return acc;
    }, 0);

  // Payment modal handlers
  const openPaymentModal = (type: PaymentModalType) => {
    setPaymentModal(type);
    setPayStep("amount");
    setPayAmountStr("200");
    setPayOtp("");
    setPayPendingId("");
    setPayError("");
    setPayProcessing(false);
    setPaySuccessMsg("");
  };

  const closePaymentModal = () => {
    setPaymentModal(null);
    if (payStep === "success") refreshWallet();
  };

  const handlePaymentInitiate = async () => {
    const amount = parseFloat(payAmountStr);
    const minAmt = paymentModal === "deposit" ? MIN_DEPOSIT : MIN_WITHDRAW;
    if (!Number.isFinite(amount) || amount < minAmt) {
      setPayError(
        `Minimum ${paymentModal === "deposit" ? "top-up" : "cash out"} is Nu ${minAmt}.`,
      );
      return;
    }
    if (paymentModal === "deposit" && amount > MAX_DEPOSIT) {
      setPayError(
        `Maximum deposit is Nu ${MAX_DEPOSIT.toLocaleString()} per transaction.`,
      );
      return;
    }
    setPayError("");
    setPayProcessing(true);
    if (paymentModal === "deposit") {
      depositPrevBalance.current = Number(
        freshUser?.creditsBalance ?? user?.creditsBalance ?? 0,
      );
    }
    try {
      let res;
      if (paymentModal === "deposit") {
        if (!linkedAccount?.cid) {
          setPayError("Please link your DK Bank account first.");
          setPayProcessing(false);
          return;
        }
        res = await initiateDKBankDeposit({ amount, cid: linkedAccount.cid });
      } else {
        res = await initiateDKBankWithdrawal({ amount });
      }
      setPayPendingId(res.paymentId);
      setPayStep("otp");
    } catch (err: any) {
      setPayError(err.message || "Something went wrong. Please try again.");
    } finally {
      setPayProcessing(false);
    }
  };

  const handlePaymentConfirm = async () => {
    if (payOtp.length < 4) {
      setPayError("Please enter the OTP sent to your Telegram bot.");
      return;
    }
    setPayError("");
    setPayProcessing(true);
    try {
      if (paymentModal === "deposit") {
        await confirmDKBankDeposit(payPendingId, payOtp);
      } else {
        await confirmDKBankWithdrawal(payPendingId, payOtp);
      }
      setPaySuccessMsg(
        paymentModal === "deposit"
          ? `Nu ${parseFloat(payAmountStr).toLocaleString()} topped up successfully!`
          : `Nu ${parseFloat(payAmountStr).toLocaleString()} cash out confirmed. Funds on their way to DK Bank.`,
      );
      haptic.confirm();
      setPayStep("success");
      if (paymentModal === "deposit") {
        setShowCoins(true);
        setTimeout(() => setShowCoins(false), 3500);
      }
    } catch (err: any) {
      setPayError(err.message || "OTP confirmation failed. Please try again.");
      if (
        err.message?.toLowerCase().includes("expired") ||
        err.message?.toLowerCase().includes("initiate")
      ) {
        setPayStep("failed");
      }
    } finally {
      setPayProcessing(false);
    }
  };

  if (loading) return <LoadingScreen message="Syncing wallet…" />;

  return (
    <Page>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes balanceWin {
          0%   { transform: scale(1);    color: #fff; }
          20%  { transform: scale(1.08); color: #4ade80; }
          60%  { transform: scale(1.04); color: #4ade80; }
          100% { transform: scale(1);    color: #fff; }
        }
        @keyframes coinFall {
          0%   { transform: translateY(-60px) rotate(0deg);   opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        @keyframes depositSuccessPop {
          0%   { transform: scale(0.4) rotate(-8deg); opacity: 0; }
          55%  { transform: scale(1.18) rotate(3deg); opacity: 1; }
          80%  { transform: scale(0.95) rotate(-1deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes depositSuccessGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.5); }
          50%       { box-shadow: 0 0 0 20px rgba(16,185,129,0); }
        }
        @keyframes otpDigitPop {
          0%   { transform: scale(0.7); opacity: 0.3; }
          60%  { transform: scale(1.15); }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes nudgePulse {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.015); }
        }
        @keyframes otpStepIn {
          from { opacity: 0; transform: translateX(-10px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes otpStepDot {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50%       { transform: scale(1.4); opacity: 1; }
        }
        @keyframes bonusBannerShimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Desktop layout */
        @media (min-width: 640px) {
          .wallet-hero-card {
            border-radius: var(--radius-xl) !important;
            margin: 20px 0 0 !important;
          }
          .wallet-actions {
            padding: 0 !important;
          }
          .wallet-card-section {
            margin: 0 !important;
          }
          .wallet-tx-section {
            padding: 0 !important;
          }
        }
      `}</style>

      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "0 0 100px",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-md)",
        }}
      >
        {/* ── Balance Hero Card ─────────────────────────────── */}
        <div
          className="wallet-hero-card"
          style={{
            background: "var(--surface)",
            borderRadius: "0 0 var(--radius-xl) var(--radius-xl)",
            padding: "20px 20px 0",
            position: "relative",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {/* Label row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                fontWeight: 500,
              }}
            >
              Available Balance
            </span>
            <button
              onClick={() => setBalanceHidden((h) => !h)}
              style={{
                background: "none",
                border: "none",
                padding: "0 0 0 4px",
                cursor: "pointer",
                color: "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
                marginLeft: "auto",
              }}
              aria-label={balanceHidden ? "Show balance" : "Hide balance"}
            >
              {balanceHidden ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* Balance amount */}
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              opacity: balanceLoading ? 0.4 : 1,
              transition: "opacity 0.3s",
              marginBottom: 20,
            }}
          >
            <span
              style={{
                fontSize: 36,
                fontWeight: 800,
                color: "var(--text-primary)",
                letterSpacing: "-1px",
                textShadow: balanceFlash
                  ? "0 0 20px rgba(34,197,94,0.6)"
                  : "none",
                animation: balanceFlash ? "balanceWin 1.4s ease-out" : "none",
              }}
            >
              {balanceHidden ? (
                "****"
              ) : (
                <AnimatedCounter
                  value={Number(
                    freshUser?.creditsBalance ?? user?.creditsBalance ?? 0,
                  )}
                />
              )}
            </span>
            <span
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "var(--text-secondary)",
              }}
            >
              Nu
            </span>
          </div>

          {/* Financial stats row */}
          <div
            style={{
              display: "flex",
              gap: 0,
              borderTop: "1px solid var(--border)",
              paddingTop: 12,
              paddingBottom: 14,
            }}
          >
            {[
              {
                label: "Total Won",
                value: `+${totalWon.toLocaleString()}`,
                color: "var(--success)",
              },
              {
                label: "Deposited",
                value: `+${totalDeposited.toLocaleString()}`,
                color: "var(--text-primary)",
              },
              {
                label: "7-Day P&L",
                value: `${weeklyProfit >= 0 ? "+" : ""}${weeklyProfit.toLocaleString()}`,
                color:
                  weeklyProfit >= 0
                    ? "var(--success)"
                    : "var(--error, #ef4444)",
              },
            ].map((s, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  borderLeft: i > 0 ? "1px solid var(--border)" : "none",
                  paddingLeft: i > 0 ? 14 : 0,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--text-secondary)",
                    fontWeight: 600,
                    marginBottom: 3,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: s.color,
                  }}
                >
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Quick Actions ─────────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "var(--space-sm)",
            padding: "0 var(--space-md)",
          }}
        >
          <Button
            fullWidth
            icon={<Plus size={16} />}
            onClick={() => openPaymentModal("deposit")}
          >
            Top Up
          </Button>
          <Button
            fullWidth
            variant="secondary"
            icon={<ArrowUpCircle size={16} />}
            onClick={() => openPaymentModal("withdraw")}
          >
            Cash Out
          </Button>
        </div>

        {/* ── Referral Deposit Nudge ─────────────────────────── */}
        {referralDepositNudge && (
          <div
            style={{
              margin: "0 16px",
              borderRadius: 14,
              padding: "12px 14px",
              background:
                "linear-gradient(135deg, rgba(34,197,94,0.12), rgba(16,185,129,0.06))",
              border: "1px solid rgba(34,197,94,0.3)",
              animation: "nudgePulse 3s ease-in-out infinite",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Users size={22} color="#22c55e" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--text-main)",
                }}
              >
                Your friend{" "}
                <span style={{ color: "#22c55e" }}>
                  {referralDepositNudge.friendName}
                </span>{" "}
                deposited Nu {referralDepositNudge.amount.toLocaleString()}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-subtle)",
                  marginTop: 2,
                }}
              >
                You earned{" "}
                <strong style={{ color: "#4ade80" }}>
                  Nu {referralDepositNudge.bonusEarned.toLocaleString()}
                </strong>{" "}
                instantly!
              </div>
            </div>
            <button
              onClick={() => setReferralDepositNudge(null)}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-subtle)",
                cursor: "pointer",
                padding: 4,
                display: "flex",
                alignItems: "center",
              }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── DK Bank Setup ────────────────────────────────────── */}
        <Card style={{ gap: 12, margin: "0 var(--space-md)" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "var(--text-main)",
              }}
            >
              {linkedAccount ? "Linked Bank Account" : "Link Bank Account"}
            </span>
            <span
              style={{
                background: "#fff",
                borderRadius: 4,
                padding: "1px 5px",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              <img
                src={dkBankLogo}
                alt="DK Bank"
                style={{ height: 13, width: "auto" }}
              />
            </span>
            {linkedAccount && (
              <span style={{ fontSize: 12, color: "#059669", marginLeft: 2 }}>
                · Connected
              </span>
            )}
          </div>

          {/* ── Already linked: show account details ── */}
          {linkedAccount ? (
            <>
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: "var(--bg-main)",
                  border: "1px solid var(--glass-border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      marginBottom: 2,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Account Name
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--text-main)",
                    }}
                  >
                    {linkedAccount.accountName || "—"}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      marginBottom: 2,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Account Number
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        fontFamily: "monospace",
                        color: "var(--text-main)",
                        letterSpacing: 1,
                      }}
                    >
                      {linkedAccount.accountNumber
                        ? bankAccountRevealed
                          ? linkedAccount.accountNumber
                          : linkedAccount.accountNumber
                              .slice(0, -4)
                              .replace(/./g, "•") +
                            linkedAccount.accountNumber.slice(-4)
                        : "—"}
                    </div>
                    {linkedAccount.accountNumber && (
                      <button
                        onClick={() => setBankAccountRevealed((v) => !v)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--text-muted)",
                          padding: 4,
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        {bankAccountRevealed ? (
                          <EyeOff size={15} />
                        ) : (
                          <Eye size={15} />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#059669",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  DK Bank · Linked
                </span>
              </div>
            </>
          ) : bankStep === "done" ? (
            /* ── Success state ── */
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "12px 0 4px",
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "rgba(5,150,105,0.1)",
                  border: "1px solid rgba(5,150,105,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CheckCircle2 size={28} color="#059669" />
              </div>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 15,
                    color: "var(--text-main)",
                  }}
                >
                  Bank Linked!
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-muted)",
                    marginTop: 3,
                  }}
                >
                  Your DK Bank account is connected.
                </div>
              </div>
            </div>
          ) : bankStep === "otp" ? (
            /* ── OTP step ── */
            <>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: "var(--text-muted)",
                  lineHeight: 1.6,
                }}
              >
                OTP sent to your DK-registered phone
                {bankMaskedPhone ? ` (${bankMaskedPhone})` : ""}. Account:{" "}
                <strong style={{ color: "var(--text-main)" }}>
                  {bankAccountName}
                </strong>
                .
              </p>

              {/* OTP digit boxes */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  justifyContent: "center",
                  cursor: "text",
                }}
                onClick={() =>
                  document.getElementById("bank-otp-input")?.focus()
                }
              >
                {Array.from({ length: 6 }).map((_, i) => {
                  const digit = bankOtp[i];
                  const isFilled = !!digit;
                  const isActive = bankOtp.length === i;
                  return (
                    <div
                      key={i}
                      style={{
                        width: 44,
                        height: 52,
                        borderRadius: 10,
                        border: isFilled
                          ? "2px solid #2775d0"
                          : isActive
                            ? "2px solid rgba(39,117,208,0.5)"
                            : "2px solid var(--glass-border)",
                        background: isFilled
                          ? "rgba(39,117,208,0.08)"
                          : "var(--bg-main)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 20,
                        fontWeight: 800,
                        color: "#2775d0",
                        transition: "all 0.12s",
                        boxShadow: isActive
                          ? "0 0 0 3px rgba(39,117,208,0.12)"
                          : "none",
                      }}
                    >
                      {digit ??
                        (isActive ? (
                          <span
                            style={{
                              width: 2,
                              height: 20,
                              background: "#2775d0",
                              borderRadius: 2,
                              animation: "nudgePulse 0.8s ease-in-out infinite",
                            }}
                          />
                        ) : (
                          ""
                        ))}
                    </div>
                  );
                })}
              </div>
              <input
                id="bank-otp-input"
                style={{
                  position: "absolute",
                  opacity: 0,
                  pointerEvents: "none",
                  width: 1,
                  height: 1,
                }}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={bankOtp}
                autoFocus
                onChange={(e) => {
                  setBankOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setBankError("");
                }}
              />

              {bankError && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 13,
                    color: "#dc2626",
                  }}
                >
                  <XCircle size={13} color="#dc2626" />
                  {bankError}
                </div>
              )}

              <button
                style={{
                  width: "100%",
                  padding: "14px",
                  fontSize: 15,
                  fontWeight: 700,
                  background: "linear-gradient(135deg, #2775d0, #1a5bb5)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  cursor:
                    bankLoading || bankOtp.length !== 6
                      ? "not-allowed"
                      : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  opacity: bankLoading || bankOtp.length !== 6 ? 0.6 : 1,
                }}
                disabled={bankLoading || bankOtp.length !== 6}
                onClick={async () => {
                  setBankLoading(true);
                  setBankError("");
                  try {
                    const account = await verifyBankLink(bankOtp);
                    setLinkedAccount(account);
                    setBankStep("done");
                    setTimeout(() => {}, 1800);
                  } catch (err: any) {
                    setBankError(err.message || "Invalid OTP. Try again.");
                  } finally {
                    setBankLoading(false);
                  }
                }}
              >
                {bankLoading ? (
                  <>
                    <Loader2
                      size={15}
                      style={{ animation: "spin 0.8s linear infinite" }}
                    />{" "}
                    Verifying…
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} /> Verify & Link
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  setBankStep("cid");
                  setBankError("");
                  setBankOtp("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  padding: "8px 0",
                  fontSize: 13,
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "center",
                }}
              >
                ← Change CID
              </button>
            </>
          ) : (
            /* ── CID entry step ── */
            <>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: "var(--text-muted)",
                  lineHeight: 1.6,
                }}
              >
                Enter your 11-digit Bhutanese National ID (CID). An OTP will be
                sent to your DK Bank registered phone.
              </p>
              <div>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Citizenship ID (CID)
                </label>
                <input
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    fontSize: 16,
                    borderRadius: 10,
                    border: "1.5px solid var(--glass-border)",
                    background: "var(--bg-main)",
                    color: "var(--text-main)",
                    outline: "none",
                    boxSizing: "border-box",
                    letterSpacing: 2,
                  }}
                  type="text"
                  inputMode="numeric"
                  placeholder="11-digit CID"
                  maxLength={11}
                  value={bankCid}
                  onChange={(e) => {
                    setBankCid(e.target.value.replace(/\D/g, "").slice(0, 11));
                    setBankError("");
                  }}
                />
              </div>

              {bankError && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 13,
                    color: "#dc2626",
                  }}
                >
                  <XCircle size={13} color="#dc2626" />
                  {bankError}
                </div>
              )}

              <button
                style={{
                  width: "100%",
                  padding: "14px",
                  fontSize: 15,
                  fontWeight: 700,
                  background: "linear-gradient(135deg, #2775d0, #1a5bb5)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  cursor:
                    bankLoading || bankCid.length !== 11
                      ? "not-allowed"
                      : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  opacity: bankLoading || bankCid.length !== 11 ? 0.6 : 1,
                }}
                disabled={bankLoading || bankCid.length !== 11}
                onClick={async () => {
                  setBankLoading(true);
                  setBankError("");
                  try {
                    const res = await linkBankAccount(bankCid);
                    setBankAccountName(res.accountName);
                    setBankMaskedPhone(res.maskedPhone);
                    setBankStep("otp");
                  } catch (err: any) {
                    setBankError(
                      err.message || "Failed to send OTP. Try again.",
                    );
                  } finally {
                    setBankLoading(false);
                  }
                }}
              >
                {bankLoading ? (
                  <>
                    <Loader2
                      size={15}
                      style={{ animation: "spin 0.8s linear infinite" }}
                    />{" "}
                    Sending OTP…
                  </>
                ) : (
                  <>
                    <Link2 size={15} /> Send OTP
                  </>
                )}
              </button>
            </>
          )}
        </Card>

        {/* ── Transaction History ───────────────────────────── */}
        <div
          className="wallet-tx-section"
          style={{ padding: "0 16px", marginBottom: 20 }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  color: "var(--text-main)",
                }}
              >
                Transaction History
              </h2>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "var(--text-muted)",
                  marginTop: 3,
                }}
              >
                {txLoading
                  ? "Updating…"
                  : `${txs.length} transaction${txs.length !== 1 ? "s" : ""}`}
              </div>
            </div>
            <Clock size={16} color="#9ca3af" />
          </div>

          {txLoading && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "20px 0",
              }}
            >
              <div style={spinner} />
            </div>
          )}
          {txError && !txLoading && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                padding: "40px 20px",
                color: "var(--text-muted)",
              }}
            >
              <AlertCircle size={48} color="#ef4444" />
              <p style={{ color: "#ef4444" }}>{txError}</p>
            </div>
          )}

          {!txLoading && !txError && (
            <>
              {(() => {
                const referralTxs = txs.filter(
                  (t) => t.type === "referral_bonus",
                );
                if (referralTxs.length === 0) return null;
                const totalEarned = referralTxs.reduce(
                  (s, t) => s + Number(t.amount),
                  0,
                );
                return (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 16px",
                      marginBottom: 8,
                      borderRadius: 12,
                      background: "rgba(34,197,94,0.06)",
                      border: "1px solid rgba(34,197,94,0.18)",
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: "rgba(34,197,94,0.15)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Users size={16} color="#22c55e" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "var(--text-main)",
                        }}
                      >
                        Friends earned you a bonus
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-subtle)",
                          marginTop: 2,
                        }}
                      >
                        {referralTxs.length} friend
                        {referralTxs.length !== 1 ? "s" : ""} made a prediction
                        · bonus credited to your wallet
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 800,
                          color: "#22c55e",
                        }}
                      >
                        +{totalEarned.toLocaleString()}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--text-subtle)",
                          marginTop: 1,
                        }}
                      >
                        Earnings
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div
                style={{
                  background: "var(--bg-card)",
                  borderRadius: 16,
                  overflow: "hidden",
                  boxShadow: "var(--shadow-sm)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                {txs.length === 0 ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 12,
                      padding: "40px 20px",
                      color: "var(--text-muted)",
                    }}
                  >
                    <Wallet size={48} color="#9ca3af" />
                    <p style={{ color: "#9ca3af" }}>No transactions yet</p>
                  </div>
                ) : (
                  txs
                    .slice(0, showAllTxs ? undefined : 5)
                    .map((tx) => (
                      <TxRow
                        key={tx.id}
                        tx={tx}
                        onShareWin={setShareWinTx}
                        stakeAmount={tx.stakeAmount ?? undefined}
                      />
                    ))
                )}
              </div>

              {txs.length > 5 && (
                <button
                  onClick={() => setShowAllTxs(!showAllTxs)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    marginTop: 12,
                    background: "var(--bg-card)",
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
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <Clock size={14} />
                  {showAllTxs ? "Show Less" : "View More History"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Payment Modal ─────────────────────────────────────── */}
      {paymentModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closePaymentModal();
          }}
        >
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: "20px 20px 0 0",
              width: "100%",
              maxWidth: 480,
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 -4px 40px rgba(0,0,0,0.25)",
              paddingBottom: 70,
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "18px 20px 12px",
                borderBottom: "1px solid var(--glass-border)",
              }}
            >
              <span
                style={{
                  fontWeight: 800,
                  fontSize: 17,
                  color: "var(--text-main)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {paymentModal === "deposit" ? "Top Up via" : "Cash Out to"}
                <span
                  style={{
                    background: "#fff",
                    borderRadius: 5,
                    padding: "2px 6px",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  <img
                    src={dkBankLogo}
                    alt="DK Bank"
                    style={{ height: 14, width: "auto" }}
                  />
                </span>
              </span>
              <button
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                }}
                onClick={closePaymentModal}
              >
                <X size={18} />
              </button>
            </div>

            {/* Step: Amount */}
            {payStep === "amount" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  padding: "20px",
                }}
              >
                {paymentModal === "deposit" && !linkedAccount && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "12px 14px",
                      borderRadius: 10,
                      background: "rgba(217,119,6,0.1)",
                      border: "1px solid rgba(217,119,6,0.3)",
                      fontSize: 13,
                      color: "#d97706",
                    }}
                  >
                    <AlertCircle size={14} color="#d97706" />
                    <span>Link your DK Bank account before topping up.</span>
                  </div>
                )}
                {paymentModal === "withdraw" && !linkedAccount && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "12px 14px",
                      borderRadius: 10,
                      background: "rgba(217,119,6,0.1)",
                      border: "1px solid rgba(217,119,6,0.3)",
                      fontSize: 13,
                      color: "#d97706",
                    }}
                  >
                    <AlertCircle size={14} color="#d97706" />
                    <span>You need a linked DK Bank account to cash out.</span>
                  </div>
                )}
                {paymentModal === "deposit" && (
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: "rgba(99,102,241,0.08)",
                      border: "1px solid rgba(99,102,241,0.2)",
                      fontSize: 12,
                      color: "#a5b4fc",
                      fontWeight: 600,
                    }}
                  >
                    <Lightbulb
                      size={13}
                      style={{
                        verticalAlign: "middle",
                        marginRight: 5,
                        color: "#a5b4fc",
                      }}
                    />
                    Users like you typically top up Nu 500
                  </div>
                )}
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: "var(--text-muted)",
                    fontWeight: 500,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span>
                    {paymentModal === "deposit"
                      ? "Top-up amount (Nu)"
                      : "Cash out amount (Nu)"}
                  </span>
                  {paymentModal === "withdraw" && (
                    <button
                      onClick={() => {
                        const max = Math.floor(
                          freshUser?.creditsBalance ??
                            user?.creditsBalance ??
                            0,
                        );
                        if (max > 0) {
                          setPayAmountStr(String(max));
                          setPayError("");
                        }
                      }}
                      style={{
                        background: "rgba(39,117,208,0.15)",
                        color: "#2775d0",
                        border: "1px solid rgba(39,117,208,0.3)",
                        borderRadius: 6,
                        padding: "3px 9px",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Max
                    </button>
                  )}
                </p>
                <input
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    fontSize: 18,
                    borderRadius: 12,
                    border: "2px solid var(--glass-border)",
                    background: "var(--bg-main)",
                    color: "var(--text-main)",
                    outline: "none",
                    boxSizing: "border-box",
                    fontWeight: 700,
                  }}
                  type="number"
                  inputMode="numeric"
                  min={paymentModal === "deposit" ? MIN_DEPOSIT : MIN_WITHDRAW}
                  max={paymentModal === "deposit" ? MAX_DEPOSIT : undefined}
                  placeholder="Enter amount"
                  value={payAmountStr}
                  onChange={(e) => {
                    setPayAmountStr(e.target.value);
                    setPayError("");
                  }}
                />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {(paymentModal === "deposit"
                    ? QUICK_DEPOSIT_AMOUNTS
                    : QUICK_WITHDRAW_AMOUNTS
                  ).map((amt) => (
                    <button
                      key={amt}
                      style={{
                        flex: 1,
                        minWidth: 60,
                        padding: "8px 4px",
                        borderRadius: 8,
                        border:
                          payAmountStr === String(amt)
                            ? "1.5px solid #2775d0"
                            : "1.5px solid var(--glass-border)",
                        background:
                          payAmountStr === String(amt)
                            ? "rgba(39,117,208,0.12)"
                            : "var(--bg-main)",
                        color:
                          payAmountStr === String(amt)
                            ? "#2775d0"
                            : "var(--text-muted)",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        setPayAmountStr(String(amt));
                        setPayError("");
                      }}
                    >
                      {formatNu(amt)}
                    </button>
                  ))}
                </div>
                {paymentModal === "deposit" && linkedAccount && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 0",
                      borderTop: "1px solid var(--glass-border)",
                    }}
                  >
                    <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
                      DK Account
                    </span>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>
                      {linkedAccount.accountName ||
                        (linkedAccount.cid
                          ? linkedAccount.cid.slice(0, 5) +
                            "•••" +
                            linkedAccount.cid.slice(-3)
                          : "—")}
                    </span>
                  </div>
                )}
                {paymentModal === "withdraw" && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 0",
                      borderTop: "1px solid var(--glass-border)",
                    }}
                  >
                    <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
                      Available balance
                    </span>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>
                      Nu{" "}
                      {Number(
                        freshUser?.creditsBalance ?? user?.creditsBalance ?? 0,
                      ).toLocaleString()}
                    </span>
                  </div>
                )}
                {payError && (
                  <div
                    style={{
                      borderRadius: 10,
                      background: "rgba(220,38,38,0.08)",
                      border: "1px solid rgba(220,38,38,0.25)",
                      padding: "12px 14px",
                      fontSize: 13,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        color: "#dc2626",
                      }}
                    >
                      <XCircle size={14} color="#dc2626" />
                      <span>{payError}</span>
                    </div>
                    <a
                      href={`https://t.me/${BOT_USERNAME}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-block",
                        marginTop: 6,
                        fontSize: 12,
                        color: "#2775d0",
                        fontWeight: 700,
                        textDecoration: "none",
                      }}
                    >
                      Need help? Contact support →
                    </a>
                  </div>
                )}
                <button
                  style={{
                    width: "100%",
                    padding: "15px",
                    borderRadius: 12,
                    border: "none",
                    background: "linear-gradient(135deg, #2775d0, #1a5bb5)",
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    opacity:
                      payProcessing ||
                      (paymentModal === "deposit"
                        ? !linkedAccount
                        : !linkedAccount)
                        ? 0.6
                        : 1,
                  }}
                  disabled={payProcessing}
                  onClick={handlePaymentInitiate}
                >
                  {payProcessing ? (
                    <>
                      <Loader2
                        size={16}
                        style={{ animation: "spin 0.8s linear infinite" }}
                      />{" "}
                      Sending OTP…
                    </>
                  ) : (
                    <>
                      <Send size={16} />{" "}
                      {paymentModal === "deposit"
                        ? "Top Up & Send OTP"
                        : "Cash Out & Send OTP"}
                    </>
                  )}
                </button>
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: "var(--text-muted)",
                    textAlign: "center",
                  }}
                >
                  {paymentModal === "deposit"
                    ? "An OTP will be sent via SMS to your DK Bank registered phone."
                    : "An OTP will be sent to your Telegram bot to confirm this transaction."}
                </p>
              </div>
            )}

            {/* Step: OTP */}
            {payStep === "otp" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  padding: "20px",
                  alignItems: "center",
                }}
              >
                <p
                  style={{
                    margin: "0 0 2px",
                    fontWeight: 800,
                    fontSize: 17,
                    color: "var(--text-main)",
                  }}
                >
                  {paymentModal === "deposit"
                    ? "Confirm Your Top Up"
                    : "Confirm Cash Out"}
                </p>

                {/* Animated step-by-step instruction banner */}
                <div
                  style={{
                    width: "100%",
                    borderRadius: 14,
                    background: "rgba(39,117,208,0.07)",
                    border: "1px solid rgba(39,117,208,0.2)",
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  {(paymentModal === "deposit"
                    ? [
                        {
                          icon: <Hash size={14} color="#2775d0" />,
                          text: "An OTP will be sent to your DK Bank registered phone",
                          delay: "0ms",
                        },
                        {
                          icon: <PenLine size={14} color="#2775d0" />,
                          text: "Enter the 6-digit code below to confirm",
                          delay: "120ms",
                        },
                      ]
                    : [
                        {
                          icon: <Send size={14} color="#2775d0" />,
                          text: "Open Oro Bot in Telegram",
                          delay: "0ms",
                        },
                        {
                          icon: <Hash size={14} color="#2775d0" />,
                          text: "Copy the 6-digit code sent to you",
                          delay: "120ms",
                        },
                        {
                          icon: <PenLine size={14} color="#2775d0" />,
                          text: "Enter it below to confirm",
                          delay: "240ms",
                        },
                      ]
                  ).map((step, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        animation: `otpStepIn 0.35s ease both`,
                        animationDelay: step.delay,
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          background: "rgba(39,117,208,0.15)",
                          border: "1.5px solid rgba(39,117,208,0.3)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 14,
                          flexShrink: 0,
                          animation: `otpStepDot 1.8s ease-in-out ${step.delay} infinite`,
                        }}
                      >
                        {step.icon}
                      </div>
                      <span
                        style={{
                          fontSize: 13,
                          color: "var(--text-muted)",
                          fontWeight: 500,
                          lineHeight: 1.4,
                        }}
                      >
                        {paymentModal === "withdraw" && i === 0 ? (
                          <>
                            Open{" "}
                            <a
                              href={`https://t.me/${BOT_USERNAME}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: "#2775d0",
                                fontWeight: 700,
                                textDecoration: "none",
                              }}
                            >
                              @{BOT_USERNAME}
                            </a>{" "}
                            in Telegram
                          </>
                        ) : (
                          step.text
                        )}
                      </span>
                    </div>
                  ))}
                </div>

                {/* OTP digit boxes — tapping any box re-focuses the hidden input */}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    justifyContent: "center",
                    margin: "4px 0",
                    width: "100%",
                    cursor: "text",
                  }}
                  onClick={() =>
                    document.getElementById("otp-hidden-input")?.focus()
                  }
                >
                  {Array.from({ length: 6 }).map((_, i) => {
                    const digit = payOtp[i];
                    const isFilled = !!digit;
                    const isActive = payOtp.length === i;
                    return (
                      <div
                        key={i}
                        style={{
                          width: 44,
                          height: 54,
                          borderRadius: 12,
                          border: isFilled
                            ? "2px solid #2775d0"
                            : isActive
                              ? "2px solid rgba(39,117,208,0.5)"
                              : "2px solid var(--glass-border)",
                          background: isFilled
                            ? "rgba(39,117,208,0.1)"
                            : "var(--bg-main)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 22,
                          fontWeight: 800,
                          color: "#2775d0",
                          transition: "all 0.15s",
                          animation: isFilled
                            ? "otpDigitPop 0.2s ease"
                            : "none",
                          boxShadow: isActive
                            ? "0 0 0 3px rgba(39,117,208,0.15)"
                            : "none",
                        }}
                      >
                        {digit ??
                          (isActive ? (
                            <span
                              style={{
                                width: 2,
                                height: 22,
                                background: "#2775d0",
                                borderRadius: 2,
                                animation:
                                  "nudgePulse 0.8s ease-in-out infinite",
                              }}
                            />
                          ) : (
                            ""
                          ))}
                      </div>
                    );
                  })}
                </div>
                <input
                  style={{
                    position: "absolute",
                    opacity: 0,
                    pointerEvents: "none",
                    width: 1,
                    height: 1,
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={8}
                  value={payOtp}
                  onChange={(e) => {
                    setPayOtp(e.target.value.replace(/\D/g, ""));
                    setPayError("");
                  }}
                  autoFocus
                  id="otp-hidden-input"
                />
                {/* Subtle fallback — only shown, not prominent */}
                <button
                  onClick={() =>
                    document.getElementById("otp-hidden-input")?.focus()
                  }
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-subtle)",
                    fontSize: 11,
                    cursor: "pointer",
                    opacity: 0.6,
                    padding: "2px 0",
                  }}
                >
                  Keyboard not showing? Tap here
                </button>
                {payError && (
                  <div
                    style={{
                      borderRadius: 10,
                      background: "rgba(220,38,38,0.08)",
                      border: "1px solid rgba(220,38,38,0.25)",
                      padding: "12px 14px",
                      fontSize: 13,
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        color: "#dc2626",
                      }}
                    >
                      <XCircle size={14} color="#dc2626" />
                      <span>{payError}</span>
                    </div>
                    <a
                      href={`https://t.me/${BOT_USERNAME}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-block",
                        marginTop: 6,
                        fontSize: 12,
                        color: "#2775d0",
                        fontWeight: 700,
                        textDecoration: "none",
                      }}
                    >
                      Need help? Contact support →
                    </a>
                  </div>
                )}
                <button
                  style={{
                    width: "100%",
                    padding: "15px",
                    borderRadius: 12,
                    border: "none",
                    background: "linear-gradient(135deg, #2775d0, #1a5bb5)",
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    opacity: payProcessing || payOtp.length < 4 ? 0.6 : 1,
                  }}
                  disabled={payProcessing || payOtp.length < 4}
                  onClick={handlePaymentConfirm}
                >
                  {payProcessing ? (
                    <>
                      <Loader2
                        size={16}
                        style={{ animation: "spin 0.8s linear infinite" }}
                      />{" "}
                      Confirming…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} /> Confirm
                    </>
                  )}
                </button>
                <button
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: 12,
                    border: "1px solid var(--glass-border)",
                    background: "transparent",
                    color: "var(--text-muted)",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    setPayStep("amount");
                    setPayOtp("");
                    setPayError("");
                  }}
                >
                  ← Change amount
                </button>
              </div>
            )}

            {/* Step: Success */}
            {payStep === "success" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  padding: "20px",
                  alignItems: "center",
                  textAlign: "center",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {showCoins && paymentModal === "deposit" && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      pointerEvents: "none",
                      zIndex: 10,
                      overflow: "hidden",
                    }}
                  >
                    {Array.from({ length: 18 }).map((_, i) => (
                      <div
                        key={i}
                        style={{
                          position: "absolute",
                          left: `${(i * 37 + 11) % 100}%`,
                          top: 0,
                          width: [8, 10, 7, 9][i % 4],
                          height: [8, 10, 7, 9][i % 4],
                          borderRadius: i % 3 === 0 ? "50%" : 2,
                          background: [
                            "#6366f1",
                            "#f59e0b",
                            "#10b981",
                            "#ec4899",
                          ][i % 4],
                          animation: `coinFall ${1.2 + (i % 5) * 0.36}s ease-in ${(i % 4) * 0.2}s both`,
                        }}
                      />
                    ))}
                  </div>
                )}
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #d1fae5, #a7f3d0)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    animation:
                      paymentModal === "deposit"
                        ? "depositSuccessPop 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards, depositSuccessGlow 1.5s ease 0.55s 2"
                        : "none",
                  }}
                >
                  <CheckCircle
                    size={38}
                    style={{
                      color: "#059669",
                      animation:
                        "depositSuccessPop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards",
                    }}
                  />
                </div>
                <p
                  style={{
                    fontWeight: 800,
                    fontSize: 20,
                    margin: "0 0 6px",
                    color:
                      paymentModal === "deposit"
                        ? "#059669"
                        : "var(--text-main)",
                  }}
                >
                  {paymentModal === "deposit"
                    ? "Top Up Confirmed!"
                    : "Cash Out Confirmed!"}
                </p>
                {paymentModal === "deposit" && (
                  <div
                    style={{
                      margin: "8px 0 14px",
                      padding: "12px 20px",
                      borderRadius: 12,
                      background: "rgba(16,185,129,0.1)",
                      border: "1px solid rgba(16,185,129,0.3)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-subtle)",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        marginBottom: 4,
                      }}
                    >
                      New Balance
                    </div>
                    <div
                      style={{
                        fontSize: 28,
                        fontWeight: 900,
                        color: "#10b981",
                      }}
                    >
                      Nu{" "}
                      <AnimatedCounter
                        value={
                          depositPrevBalance.current + parseFloat(payAmountStr)
                        }
                      />
                    </div>
                  </div>
                )}
                <p
                  style={{
                    color: "var(--text-muted)",
                    fontSize: 14,
                    margin: "0 0 24px",
                    lineHeight: 1.6,
                  }}
                >
                  {paySuccessMsg}
                </p>
                <button
                  style={{
                    width: "100%",
                    padding: "15px",
                    borderRadius: 12,
                    border: "none",
                    background: "linear-gradient(135deg, #2775d0, #1a5bb5)",
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  onClick={closePaymentModal}
                >
                  Done
                </button>
              </div>
            )}

            {/* Step: Failed */}
            {payStep === "failed" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  padding: "20px",
                  alignItems: "center",
                  textAlign: "center",
                }}
              >
                <XCircle size={56} color="#dc2626" />
                <p style={{ fontWeight: 700, fontSize: 18, margin: "0 0 8px" }}>
                  Transaction Failed
                </p>
                <p
                  style={{
                    color: "var(--text-muted)",
                    fontSize: 14,
                    margin: "0 0 24px",
                    lineHeight: 1.6,
                  }}
                >
                  {payError ||
                    "The transaction could not be completed. Please try again."}
                </p>
                <button
                  style={{
                    width: "100%",
                    padding: "15px",
                    borderRadius: 12,
                    border: "none",
                    background: "linear-gradient(135deg, #2775d0, #1a5bb5)",
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    setPayStep("amount");
                    setPayError("");
                  }}
                >
                  Try Again
                </button>
                <button
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: 12,
                    border: "1px solid var(--glass-border)",
                    background: "transparent",
                    color: "var(--text-muted)",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                  onClick={closePaymentModal}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Share Win Modal ─────────────────────────────────── */}
      {shareWinTx && (
        <div
          onClick={() => setShareWinTx(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px 16px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 560, position: "relative" }}
          >
            <button
              onClick={() => setShareWinTx(null)}
              style={{
                position: "absolute",
                top: -36,
                right: 0,
                background: "transparent",
                border: "none",
                color: "rgba(255,255,255,0.7)",
                cursor: "pointer",
                padding: 6,
              }}
            >
              <X size={22} />
            </button>
            <BetShareCard
              userName={
                user?.username
                  ? `@${user.username}`
                  : (user?.firstName ?? "Predictor")
              }
              userPhotoUrl={user?.photoUrl ?? null}
              marketTitle={shareWinTx.note ?? "My prediction"}
              outcomePicked="Correct call!"
              stakeAmount={shareWinTx.stakeAmount ?? Number(shareWinTx.amount)}
              outcomeColor="#22c55e"
              referralId={String(user?.telegramId ?? user?.id ?? "")}
            />
          </div>
        </div>
      )}
    </Page>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────────
const spinner: React.CSSProperties = {
  width: 36,
  height: 36,
  border: "4px solid #e5e7eb",
  borderTop: "4px solid #2775d0",
  borderRadius: "50%",
  animation: "spin 0.8s linear infinite",
};

// actionBtnPrimary, actionBtnSecondary, card — removed; use <Button> and <Card> from ui/
