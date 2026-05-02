import { FC, useState, useEffect, useRef } from "react";
import dkBankLogo from "@shared/assets/dk blue.png";
import { useAuth } from "@shared/hooks/useAuth";
import {
  linkDKBank,
  verifyPhoneTma,
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
  formatBTN,
} from "@shared/api/dkbank";
import { Page } from "@/components/Page";
import { Button, Card } from "@/components/ui";
import { BetShareCard } from "@shared/components/BetShareCard";
import {
  CheckCircle2,
  XCircle,
  Link2,
  Smartphone,
  AlertCircle,
  Loader2,
  ShieldCheck,
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
  CalendarDays,
  Swords,
  Lightbulb,
  CheckCircle,
  Users,
} from "lucide-react";

// ── Shared types ──────────────────────────────────────────────────────────────
type PaymentModalType = "deposit" | "withdraw" | null;
type PaymentStep = "amount" | "otp" | "success" | "failed";

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
};

const TX_LABEL: Record<Transaction["type"], string> = {
  deposit: "Top Up",
  withdrawal: "Cash Out",
  bet_placed: "Bet placed",
  bet_payout: "Win — payout received",
  refund: "Bet refunded",
  dispute_bond: "Dispute bond",
  dispute_refund: "Dispute bond refunded",
  referral_bonus: "Referral bonus",
  duel_wager: "Duel wager locked",
  duel_payout: "Duel payout",
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
}: {
  tx: Transaction;
  onShareWin?: (tx: Transaction) => void;
}) {
  const isCredit = tx.amount > 0;
  const color = isCredit ? TX_COLOR_IN : TX_COLOR_OUT;
  const isWin = tx.type === "bet_payout";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "13px 16px",
        borderBottom: "1px solid var(--glass-border)",
        background: isWin ? "rgba(34,197,94,0.04)" : "transparent",
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
          {tx.note ? tx.note : TX_LABEL[tx.type]}
        </div>
        {tx.note && (
          <div
            style={{
              fontSize: 11,
              color: "var(--text-subtle)",
              marginBottom: 2,
            }}
          >
            {TX_LABEL[tx.type]}
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
        {isWin && onShareWin && (
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
  const [depositStreakDays, setDepositStreakDays] = useState(0);
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

  // DK Bank setup state — single flow: link CID then auto-verify phone
  const [cid, setCid] = useState("");
  const [setupStep, setSetupStep] = useState<
    "idle" | "linking" | "verifying" | "bot-pending" | "success" | "error"
  >("idle");
  const [setupError, setSetupError] = useState("");


  useEffect(() => {
    getMe()
      .then(setFreshUser)
      .catch(() => setFreshUser(authUser))
      .finally(() => setFreshLoading(false));
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

        const depositTxs = txList.filter((t) => t.type === "deposit");

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const depositDays = new Set(
          depositTxs.map((t) => {
            const d = new Date(t.createdAt);
            d.setHours(0, 0, 0, 0);
            return d.getTime();
          }),
        );
        let streak = 0;
        for (let i = 0; i < 365; i++) {
          const day = new Date(today.getTime() - i * 86_400_000);
          if (depositDays.has(day.getTime())) {
            streak++;
          } else if (i > 0) {
            break;
          }
        }
        setDepositStreakDays(streak);

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

  const hasDKBank = !!user?.dkCid;
  const hasPhoneVerified = !!user?.isPhoneVerified;

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
      setPayError(`Maximum deposit is Nu ${MAX_DEPOSIT.toLocaleString()} per transaction.`);
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
        if (!user?.dkCid) {
          setPayError("Please link your DK Bank account first.");
          setPayProcessing(false);
          return;
        }
        res = await initiateDKBankDeposit({ amount, cid: user.dkCid });
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

  const handleSetup = async () => {
    if (cid.length !== 11) {
      setSetupError("CID must be exactly 11 digits.");
      setSetupStep("error");
      return;
    }

    // ── Step 1: link DK Bank CID ─────────────────────────────────────────────
    setSetupStep("linking");
    setSetupError("");
    try {
      await linkDKBank(cid);
    } catch (err: any) {
      const raw = (err.message || "").toLowerCase();
      // Map any server-side failure to a clear, actionable message.
      const msg =
        raw.includes("no dk bank account") ||
        raw.includes("not found") ||
        raw.includes("missing record")
          ? "No DK Bank account found for this CID. Please check your 11-digit CID and try again."
          : raw.includes("internal server error") ||
              raw.includes("unavailable") ||
              raw.includes("timed out") ||
              raw.includes("503") ||
              raw.includes("500")
            ? "No DK Bank account found for this CID. Please check your 11-digit CID and try again."
            : err.message || "Failed to link CID. Please try again.";
      setSetupError(msg);
      setSetupStep("error");
      return;
    }

    // ── Step 2: phone verification via Telegram.WebApp.requestContact ────────
    const tg = (window as any).Telegram?.WebApp;
    if (!tg?.requestContact) {
      // Older Telegram client — refresh and show a simple open-bot nudge
      const updated = await getMe().catch(() => null);
      if (updated) setFreshUser(updated);
      setSetupStep("success");
      return;
    }

    setSetupStep("verifying");

    tg.onEvent("contactRequested", async (result: any) => {
      tg.offEvent("contactRequested");
      if (result?.status !== "sent" || !result?.contact?.phone_number) {
        // User dismissed the popup — CID is still linked, phone pending
        const updated = await getMe().catch(() => null);
        if (updated) setFreshUser(updated);
        setSetupStep("success");
        return;
      }
      try {
        // user_id is optional in the Telegram contact payload — fall back to
        // the authenticated user's own telegramId so the backend check passes.
        const contactUserId: number =
          result.contact.user_id ?? Number(user?.telegramId);
        await verifyPhoneTma({
          phoneNumber: result.contact.phone_number,
          userId: contactUserId,
          authDate: result.auth_date,
          hash: result.hash,
        });
        setSetupStep("success");
        const updated = await getMe();
        setFreshUser(updated);
      } catch (err: any) {
        setSetupError(err.message || "Phone verification failed. Please try again.");
        setSetupStep("error");
        // Refresh so hasDKBank becomes true — UI moves to "one more step" panel
        // and the user can retry without re-entering their CID.
        const updated = await getMe().catch(() => null);
        if (updated) setFreshUser(updated);
      }
    });

    tg.requestContact();
  };

  if (loading) {
    return (
      <Page>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "50vh",
          }}
        >
          <div style={spinner} />
        </div>
      </Page>
    );
  }

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
        <div className="wallet-hero-card" style={balanceCard}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "rgba(255,255,255,0.6)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 4,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            Available Balance
            <button
              onClick={() => setBalanceHidden((h) => !h)}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                color: "rgba(255,255,255,0.55)",
                display: "flex",
                alignItems: "center",
              }}
              aria-label={balanceHidden ? "Show balance" : "Hide balance"}
            >
              {balanceHidden ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 6,
              opacity: balanceLoading ? 0.5 : 1,
              transition: "opacity 0.3s",
              marginBottom: 20,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "rgba(255,255,255,0.8)",
              }}
            >
              BTN
            </span>
            <span
              style={{
                fontSize: 36,
                fontWeight: 900,
                color: "#fff",
                letterSpacing: "-1px",
                filter: balanceHidden ? "blur(10px)" : "none",
                userSelect: balanceHidden ? "none" : "auto",
                transition: "filter 0.2s ease",
                textShadow: balanceFlash
                  ? "0 0 24px rgba(34,197,94,0.9)"
                  : "none",
                animation: balanceFlash ? "balanceWin 1.4s ease-out" : "none",
              }}
            >
              <AnimatedCounter
                value={Number(
                  freshUser?.creditsBalance ?? user?.creditsBalance ?? 0,
                )}
              />
            </span>
          </div>

          {/* Financial stats row */}
          <div
            style={{
              display: "flex",
              gap: 0,
              borderTop: "1px solid rgba(255,255,255,0.15)",
              paddingTop: 14,
            }}
          >
            {[
              {
                label: "Total Won",
                value: `+${totalWon.toLocaleString()}`,
                color: "#6ee7b7",
              },
              {
                label: "Deposited",
                value: `+${totalDeposited.toLocaleString()}`,
                color: "rgba(255,255,255,0.7)",
              },
              {
                label: "This Week",
                value: `${weeklyProfit >= 0 ? "+" : ""}${weeklyProfit.toLocaleString()}`,
                color: weeklyProfit >= 0 ? "#6ee7b7" : "#fca5a5",
              },
            ].map((s, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  borderLeft:
                    i > 0 ? "1px solid rgba(255,255,255,0.12)" : "none",
                  paddingLeft: i > 0 ? 14 : 0,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.55)",
                    fontWeight: 600,
                    marginBottom: 3,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {s.label}
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: s.color }}>
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

        {/* ── Deposit Streak Progress ────────────────────────── */}
        {depositStreakDays > 0 && (
          <div
            style={{
              margin: "0 16px",
              borderRadius: 14,
              padding: "12px 14px",
              background:
                "linear-gradient(135deg, rgba(59,130,246,0.1), rgba(99,102,241,0.06))",
              border: "1px solid rgba(99,102,241,0.25)",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <CalendarDays
              size={20}
              style={{ color: "#6366f1", flexShrink: 0 }}
            />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--text-main)",
                }}
              >
                Deposit Streak
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  marginTop: 5,
                }}
              >
                {Array.from({ length: Math.min(depositStreakDays, 7) }).map(
                  (_, i) => (
                    <div
                      key={i}
                      style={{
                        width: 22,
                        height: 8,
                        borderRadius: 4,
                        background:
                          i < depositStreakDays
                            ? "linear-gradient(90deg, #6366f1, #818cf8)"
                            : "var(--glass-border)",
                        transition: "background 0.3s",
                      }}
                    />
                  ),
                )}
                {depositStreakDays < 7 && (
                  <div
                    style={{
                      width: 22,
                      height: 8,
                      borderRadius: 4,
                      background: "var(--glass-border)",
                      opacity: 0.4,
                    }}
                  />
                )}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#818cf8" }}>
                {depositStreakDays}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-subtle)" }}>
                day{depositStreakDays !== 1 ? "s" : ""}
              </div>
            </div>
            <div
              style={{
                fontSize: 10,
                color: "#6366f1",
                fontWeight: 700,
                marginLeft: 2,
              }}
            >
              keep it going →
            </div>
          </div>
        )}

        {/* ── DK Bank Setup ────────────────────────────────────── */}
        <Card style={{ gap: 12, margin: "0 var(--space-md)" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-main)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {hasDKBank && hasPhoneVerified ? (
                <CheckCircle2 size={16} color="#059669" />
              ) : hasDKBank ? (
                <ShieldCheck size={16} color="#f59e0b" />
              ) : (
                <Link2 size={16} color="#2775d0" />
              )}
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {hasDKBank && hasPhoneVerified ? "Payments Active" : "Set Up Payments"}
                <span style={{ background: "#fff", borderRadius: 4, padding: "1px 5px", display: "inline-flex", alignItems: "center" }}>
                  <img src={dkBankLogo} alt="DK Bank" style={{ height: 14, width: "auto" }} />
                </span>
              </span>
            </span>
          </h3>

          {/* ── Already fully set up ── */}
          {hasDKBank && hasPhoneVerified ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { label: "CID", value: user?.dkCid },
                { label: "Account", value: user?.dkAccountName || "—" },
              ].map(({ label, value }) => (
                <p key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: 0, fontSize: 14 }}>
                  <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>{label}</span>
                  <span style={{ color: "var(--text-main)", fontWeight: 600, fontFamily: "monospace", fontSize: 13 }}>{value}</span>
                </p>
              ))}
              <p style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: 0, fontSize: 14 }}>
                <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>Phone</span>
                <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#059669", fontWeight: 600, fontSize: 13 }}>
                  <ShieldCheck size={13} color="#059669" /> Verified
                </span>
              </p>
            </div>

          ) : hasDKBank && !hasPhoneVerified ? (
            /* ── CID linked but phone not yet verified ── */
            <>
              {/* Warning banner — always visible */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
                <AlertCircle size={16} color="#f59e0b" style={{ flexShrink: 0 }} />
                <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
                  <strong style={{ color: "var(--text-main)" }}>One more step:</strong> confirm your phone number matches your DK Bank account to unlock deposits and withdrawals.
                </div>
              </div>

              {/* Error state */}
              {setupStep === "error" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", fontSize: 13, color: "#dc2626" }}>
                  <XCircle size={14} color="#dc2626" style={{ flexShrink: 0 }} />
                  {setupError}
                </div>
              )}


              {/* Bot-pending state — user tapped "Share Phone Number" in the bot */}
              {setupStep === "bot-pending" && (
                <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(39,117,208,0.08)", border: "1px solid rgba(39,117,208,0.25)", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
                  <strong style={{ color: "var(--text-main)" }}>Tap "Share Phone Number" in the Oro Bot</strong>, then come back here and tap <em>Check Status</em> below.
                </div>
              )}

              {/* Primary action button */}
              {setupStep !== "bot-pending" && (
                <button
                  style={{ width: "100%", padding: "14px", fontSize: 15, fontWeight: 700, background: "linear-gradient(135deg, #00499c, #1a5bb5)", color: "#fff", border: "none", borderRadius: 12, cursor: setupStep === "verifying" ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: setupStep === "verifying" ? 0.7 : 1 }}
                  disabled={setupStep === "verifying"}
                  onClick={() => {
                    const tg = (window as any).Telegram?.WebApp;
                    if (typeof tg?.requestContact === "function") {
                      // Native Telegram phone-share popup — no bot chat / message input.
                      setSetupStep("verifying");
                      setSetupError("");
                      tg.onEvent("contactRequested", async (result: any) => {
                        tg.offEvent("contactRequested");
                        if (result?.status !== "sent" || !result?.contact?.phone_number) {
                          setSetupStep("idle");
                          return;
                        }
                        try {
                          const contactUserId: number =
                            result.contact.user_id ?? Number(user?.telegramId);
                          await verifyPhoneTma({ phoneNumber: result.contact.phone_number, userId: contactUserId, authDate: result.auth_date, hash: result.hash });
                          setSetupStep("success");
                          const updated = await getMe();
                          setFreshUser(updated);
                        } catch (err: any) {
                          setSetupError(err.message || "Verification failed. Please try again.");
                          setSetupStep("error");
                        }
                      });
                      tg.requestContact();
                    } else {
                      // requestContact not available — open bot chat which shows
                      // a "Share Phone Number" keyboard button.
                      const url = "https://t.me/OroPredictBot?start=verify";
                      const tg2 = (window as any).Telegram?.WebApp;
                      if (typeof tg2?.openTelegramLink === "function") {
                        tg2.openTelegramLink(url);
                      } else {
                        window.open(url, "_blank");
                      }
                      setSetupStep("bot-pending");
                      setSetupError("");
                    }
                  }}
                >
                  {setupStep === "verifying" ? (
                    <><Loader2 size={15} style={{ animation: "spin 0.8s linear infinite" }} /> Waiting for Telegram…</>
                  ) : (
                    <><ShieldCheck size={15} /> Verify Phone Number</>
                  )}
                </button>
              )}

              {/* Cancel escape hatch while waiting for Telegram popup */}
              {setupStep === "verifying" && (
                <button
                  style={{ width: "100%", padding: "10px", fontSize: 13, background: "transparent", border: "1px solid var(--glass-border)", borderRadius: 10, color: "var(--text-muted)", cursor: "pointer" }}
                  onClick={() => setSetupStep("idle")}
                >
                  Cancel
                </button>
              )}

              {/* Check Status — prominent when bot-pending, secondary otherwise */}
              {(setupStep === "bot-pending" || setupStep === "idle" || setupStep === "error") && (
                <button
                  style={{ width: "100%", padding: setupStep === "bot-pending" ? "14px" : "10px", fontSize: setupStep === "bot-pending" ? 15 : 13, fontWeight: setupStep === "bot-pending" ? 700 : 500, background: setupStep === "bot-pending" ? "rgba(5,150,105,0.12)" : "transparent", border: setupStep === "bot-pending" ? "1px solid rgba(5,150,105,0.35)" : "1px solid var(--glass-border)", borderRadius: 10, color: setupStep === "bot-pending" ? "#059669" : "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  onClick={async () => {
                    const updated = await getMe().catch(() => null);
                    if (updated) {
                      setFreshUser(updated);
                      if (updated.isPhoneVerified) {
                        setSetupStep("success");
                      } else if (setupStep === "bot-pending") {
                        setSetupError("Phone not verified yet. Please tap \"Share Phone Number\" in the Oro Bot first.");
                        setSetupStep("error");
                      }
                    }
                  }}
                >
                  <RotateCcw size={13} /> {setupStep === "bot-pending" ? "Check Status" : "Already verified? Refresh"}
                </button>
              )}
            </>

          ) : (
            /* ── Not set up at all — show single "Link & Verify" form ── */
            <>
              <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
                Enter your 11-digit Bhutanese National ID (CID). We'll link your DK Bank account and verify your phone in one step.
              </p>
              <input
                style={{ width: "100%", padding: "12px 14px", fontSize: 16, borderRadius: 10, border: "1.5px solid var(--glass-border)", background: "var(--bg-main)", color: "var(--text-main)", outline: "none", boxSizing: "border-box", letterSpacing: 2 }}
                type="tel"
                inputMode="numeric"
                placeholder="11-digit CID"
                maxLength={11}
                value={cid}
                onChange={(e) => {
                  setCid(e.target.value.replace(/\D/g, ""));
                  if (setupStep === "error") setSetupStep("idle");
                  setSetupError("");
                }}
              />
              {setupStep === "error" && (
                <p style={{ margin: 0, fontSize: 13, color: "#dc2626", display: "flex", alignItems: "center", gap: 5 }}>
                  <XCircle size={14} color="#dc2626" />{setupError}
                </p>
              )}
              <button
                style={{ width: "100%", padding: "14px", fontSize: 15, fontWeight: 700, background: "var(--grad-primary)", color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: (setupStep === "linking" || setupStep === "verifying" || cid.length !== 11) ? 0.6 : 1 }}
                disabled={setupStep === "linking" || setupStep === "verifying" || cid.length !== 11}
                onClick={handleSetup}
              >
                {setupStep === "linking" ? (
                  <><Loader2 size={15} style={{ animation: "spin 0.8s linear infinite" }} /> Linking account…</>
                ) : setupStep === "verifying" ? (
                  <><Loader2 size={15} style={{ animation: "spin 0.8s linear infinite" }} /> Waiting for Telegram…</>
                ) : (
                  <><Link2 size={15} /> Link & Verify</>
                )}
              </button>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.5 }}>
                Telegram will ask you to share your phone number — this confirms it matches your DK Bank account.
              </p>
            </>
          )}
        </Card>

        {/* ── Transaction History ───────────────────────────── */}
        <div className="wallet-tx-section" style={{ padding: "0 16px", marginBottom: 20 }}>
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
                        {referralTxs.length !== 1 ? "s" : ""} placed a bet ·
                        bonus credited to your wallet
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
                        BTN earned
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
                      <TxRow key={tx.id} tx={tx} onShareWin={setShareWinTx} />
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
                {paymentModal === "deposit" && !user?.dkCid && (
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
                {paymentModal === "withdraw" && !user?.dkCid && (
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
                    Users like you typically deposit Nu 500
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
                      ? "Top-up amount (BTN)"
                      : "Cash out amount (BTN)"}
                  </span>
                  {paymentModal === "withdraw" && (
                    <button
                      onClick={() => {
                        const max = Math.floor(freshUser?.creditsBalance ?? user?.creditsBalance ?? 0);
                        if (max > 0) { setPayAmountStr(String(max)); setPayError(""); }
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
                      {formatBTN(amt).replace("Nu. ", "Nu ")}
                    </button>
                  ))}
                </div>
                {paymentModal === "deposit" && user?.dkCid && (
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
                      {user.dkAccountName || user.dkCid}
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
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#dc2626" }}>
                      <XCircle size={14} color="#dc2626" />
                      <span>{payError}</span>
                    </div>
                    <a
                      href="https://t.me/OroPredictBot"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: "inline-block", marginTop: 6, fontSize: 12, color: "#2775d0", fontWeight: 700, textDecoration: "none" }}
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
                      (paymentModal === "deposit" ? !user?.dkCid : !user?.dkCid)
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
                        ? "Deposit & Send OTP"
                        : "Withdraw & Send OTP"}
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
                  An OTP will be sent to your Telegram bot to confirm this
                  transaction.
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
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    background:
                      "linear-gradient(135deg, rgba(37,117,208,0.2), rgba(37,117,208,0.08))",
                    border: "2px solid rgba(37,117,208,0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Smartphone size={28} style={{ color: "#2575d0" }} />
                </div>
                <p
                  style={{
                    margin: "0 0 4px",
                    fontWeight: 800,
                    fontSize: 17,
                    color: "var(--text-main)",
                  }}
                >
                  {paymentModal === "deposit"
                    ? "Confirm Your Deposit"
                    : "Confirm Withdrawal"}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: "var(--text-muted)",
                    textAlign: "center",
                    lineHeight: 1.5,
                  }}
                >
                  We sent a code to your{" "}
                  <strong style={{ color: "var(--text-main)" }}>
                    Telegram bot
                  </strong>{" "}
                  to confirm{" "}
                  <strong style={{ color: "#2775d0" }}>
                    Nu {parseFloat(payAmountStr).toLocaleString()}
                  </strong>
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    justifyContent: "center",
                    margin: "4px 0",
                    width: "100%",
                  }}
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
                <button
                  onClick={() =>
                    document.getElementById("otp-hidden-input")?.focus()
                  }
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: 10,
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
                  <Smartphone size={14} /> Tap here to enter OTP
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
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#dc2626" }}>
                      <XCircle size={14} color="#dc2626" />
                      <span>{payError}</span>
                    </div>
                    <a
                      href="https://t.me/OroPredictBot"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: "inline-block", marginTop: 6, fontSize: 12, color: "#2775d0", fontWeight: 700, textDecoration: "none" }}
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
                    ? "Deposit Confirmed!"
                    : "Withdrawal Confirmed!"}
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
                      BTN{" "}
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
              stakeAmount={Number(shareWinTx.amount)}
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

const balanceCard: React.CSSProperties = {
  background: "var(--balance-card-bg)",
  borderRadius: "0 0 var(--radius-xl) var(--radius-xl)",
  padding: "var(--space-md) var(--space-md) var(--space-lg)",
  color: "#fff",
  position: "relative",
  overflow: "hidden",
  boxShadow: "var(--balance-card-shadow)",
  borderBottom: "1px solid rgba(255,255,255,0.1)",
};

// actionBtnPrimary, actionBtnSecondary, card — removed; use <Button> and <Card> from ui/
