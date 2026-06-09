import { FC, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Page } from "@/components/Page";
import { useAuth } from "@shared/hooks/useAuth";
import { linkDKBank, getMe, setPwaPassword, type AuthUser } from "@shared/api/client";
import {
  ChevronLeft,
  Check,
  User,
  Building2,
  Info,
  Link2,
  CheckCircle2,
  XCircle,
  Loader2,
  MessageCircle,
  ExternalLink,
  Smartphone,
  Calendar,
  BookOpen,
  X,
  Coins,
  Target,
  BarChart2,
  Trophy,
  Sword,
  ClipboardList,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";

// ── How It Works modal ────────────────────────────────────────────────────────
const STEPS = [
  {
    emoji: <User />,
    title: "Open the app",
    desc: "Launch Oro via Telegram. Your account is created automatically from your Telegram profile — no sign-up needed.",
  },
  {
    emoji: <Building2 />,
    title: "Link your DK Bank account",
    desc: "Go to Wallet → Enter your 11-digit CID. This links your real bank account so you can top up and cash out.",
  },
  {
    emoji: <Coins />,
    title: "Add funds to your wallet",
    desc: "Tap Wallet → Top Up and pay via DK Bank. Your Oro credits top up instantly. Minimum top up is Nu 50.",
  },
  {
    emoji: <Target />,
    title: "Pick a market & predict",
    desc: 'Browse the Feed, tap a market, choose an outcome (e.g. "X team wins"), and enter your amount. Your prediction is locked in immediately.',
  },
  {
    emoji: <BarChart2 />,
    title: "Watch the odds move",
    desc: "Your potential payout adjusts in real time based on how many people agree with you. The more people who pick the same outcome, the smaller each person's share of the winnings.",
  },
  {
    emoji: <Trophy />,
    title: "Market resolves — collect winnings",
    desc: "Once the event has a result, Oro verifies it using a published source and confirms the outcome. If you predicted correctly, your winnings go straight to your wallet.",
  },
  {
    emoji: <Sword />,
    title: "Challenge a friend (Duels)",
    desc: "Already predicted on a market? Create a duel on the same market. Pick your outcome, set a stake amount, and share the link. First person to accept takes the opposite side — winner takes the pot.",
  },
];

function HowItWorksModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-card)",
          borderRadius: "20px 20px 0 0",
          maxHeight: "88vh",
          overflowY: "auto",
          padding: "0 0 calc(env(safe-area-inset-bottom) + 80px)",
        }}
      >
        {/* Handle + header */}
        <div
          style={{
            position: "sticky",
            top: 0,
            background: "var(--bg-card)",
            zIndex: 1,
            padding: "14px 16px 10px",
          }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: "var(--glass-border)",
              margin: "0 auto 14px",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                fontSize: 17,
                fontWeight: 900,
                color: "var(--text-main)",
              }}
            >
              How Oro Works
            </div>
            <button
              onClick={onClose}
              style={{
                background: "var(--bg-secondary)",
                border: "none",
                borderRadius: 8,
                width: 30,
                height: 30,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--text-muted)",
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Steps */}
        <div style={{ padding: "4px 16px 0" }}>
          {STEPS.map((step, i) => (
            <div key={i} style={{ display: "flex", gap: 14, marginBottom: 20 }}>
              {/* Left: number + line */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "var(--bg-secondary)",
                    border: "1.5px solid var(--glass-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                  }}
                >
                  {step.emoji}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    style={{
                      width: 1,
                      flex: 1,
                      minHeight: 16,
                      background: "var(--glass-border)",
                      marginTop: 4,
                    }}
                  />
                )}
              </div>
              {/* Right: text */}
              <div style={{ paddingTop: 6, paddingBottom: 4 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "var(--text-main)",
                    marginBottom: 4,
                  }}
                >
                  {i + 1}. {step.title}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-muted)",
                    lineHeight: 1.55,
                  }}
                >
                  {step.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionLabel({ label }: { label: string }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 800,
        color: "var(--text-subtle)",
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        padding: "0 16px",
        marginBottom: 8,
        marginTop: 24,
      }}
    >
      {label}
    </div>
  );
}

// ── Settings row ──────────────────────────────────────────────────────────────
function SettingsRow({
  icon,
  label,
  value,
  valueColor,
  onClick,
  children,
  noBorder,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  valueColor?: string;
  onClick?: () => void;
  children?: React.ReactNode;
  noBorder?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px",
        background: "var(--bg-card)",
        borderBottom: noBorder ? "none" : "1px solid var(--glass-border)",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: "var(--bg-secondary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "var(--text-muted)",
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{ fontSize: 14, fontWeight: 600, color: "var(--text-main)" }}
        >
          {label}
        </div>
        {value && (
          <div
            style={{
              fontSize: 12,
              color: valueColor ?? "var(--text-subtle)",
              marginTop: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {value}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export const TmaSettingsPage: FC = () => {
  const navigate = useNavigate();
  const { user: authUser, retry } = useAuth();
  const [user, setUser] = useState<AuthUser | null>(null);

  const [cidInput, setCidInput] = useState("");
  const [linkStep, setLinkStep] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [linkError, setLinkError] = useState("");
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  // PWA Password state
  const [showPwaForm, setShowPwaForm] = useState(false);
  const [pwaPassword, setPwaPasswordInput] = useState("");
  const [pwaConfirm, setPwaConfirm] = useState("");
  const [showPwaPassword, setShowPwaPassword] = useState(false);
  const [pwaStep, setPwaStep] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [pwaError, setPwaError] = useState("");

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => setUser(authUser));
  }, []);

  const currentUser = user ?? authUser;

  const handleLinkDKBank = async () => {
    if (cidInput.length !== 11) {
      setLinkError("CID must be exactly 11 digits.");
      setLinkStep("error");
      return;
    }
    setLinkStep("loading");
    setLinkError("");
    try {
      const res = await linkDKBank(cidInput);
      setUser(res.user);
      await retry();
      setLinkStep("success");
    } catch (err: any) {
      setLinkError(err.message || "Failed to link CID. Please try again.");
      setLinkStep("error");
    }
  };

  const handleSetPwaPassword = async () => {
    if (pwaPassword.length < 6) {
      setPwaError("Password must be at least 6 characters.");
      setPwaStep("error");
      return;
    }
    if (pwaPassword !== pwaConfirm) {
      setPwaError("Passwords do not match.");
      setPwaStep("error");
      return;
    }
    setPwaStep("loading");
    setPwaError("");
    try {
      await setPwaPassword(pwaPassword);
      setPwaStep("success");
      setPwaPasswordInput("");
      setPwaConfirm("");
      setTimeout(() => {
        setPwaStep("idle");
        setShowPwaForm(false);
      }, 2000);
    } catch (err: any) {
      setPwaError(err.message || "Failed to set password.");
      setPwaStep("error");
    }
  };

  const hasDKBank = !!currentUser?.dkCid;
  const hasPhone = !!currentUser?.isPhoneVerified;
  const memberSince = currentUser?.createdAt
    ? new Date(currentUser.createdAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
      })
    : null;

  return (
    <Page>
      <div style={{ paddingBottom: 100, minHeight: "100vh" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", width: "100%" }}>
          {/* ── Header ── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "20px 16px 16px",
            }}
          >
            <button
              onClick={() => navigate(-1)}
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--glass-border)",
                borderRadius: 10,
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--text-main)",
                flexShrink: 0,
              }}
            >
              <ChevronLeft size={20} />
            </button>
            <h1
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 900,
                color: "var(--text-main)",
                letterSpacing: "-0.02em",
              }}
            >
              Settings
            </h1>
          </div>

          {/* ══════════════════════════════════════════════════════
            ACCOUNT
        ══════════════════════════════════════════════════════ */}
          <SectionLabel label="Account" />
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: 16,
              margin: "0 16px",
              border: "1px solid var(--glass-border)",
              overflow: "hidden",
            }}
          >
            <SettingsRow
              icon={<User size={17} />}
              label="Name"
              value={
                [currentUser?.firstName, currentUser?.lastName]
                  .filter(Boolean)
                  .join(" ") || "—"
              }
            />
            <SettingsRow
              icon={<span style={{ fontSize: 16 }}>@</span>}
              label="Username"
              value={
                currentUser?.username
                  ? `@${currentUser.username}`
                  : "No username set"
              }
            />
            {memberSince && (
              <SettingsRow
                icon={<Calendar size={17} />}
                label="Member since"
                value={memberSince}
                noBorder
              />
            )}
          </div>

          {/* ══════════════════════════════════════════════════════
            LINKED ACCOUNTS
        ══════════════════════════════════════════════════════ */}
          <SectionLabel label="Linked Accounts" />
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: 16,
              margin: "0 16px",
              border: "1px solid var(--glass-border)",
              overflow: "hidden",
            }}
          >
            {/* DK Bank */}
            <div
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid var(--glass-border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: hasDKBank
                      ? "rgba(16,185,129,0.12)"
                      : "var(--bg-secondary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Building2
                    size={17}
                    color={hasDKBank ? "#10b981" : "var(--text-muted)"}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--text-main)",
                    }}
                  >
                    DK Bank
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: hasDKBank ? "#10b981" : "var(--text-subtle)",
                      marginTop: 1,
                    }}
                  >
                    {hasDKBank
                      ? currentUser?.dkAccountName
                        ? `Linked · ${currentUser.dkAccountName}`
                        : "Linked"
                      : "Not linked — required to top up"}
                  </div>
                </div>
                {hasDKBank ? (
                  <CheckCircle2 size={18} color="#10b981" />
                ) : (
                  <XCircle size={18} color="#ef4444" />
                )}
              </div>

              {/* Link form — only shown when not linked */}
              {!hasDKBank && linkStep !== "success" && (
                <div style={{ marginTop: 14 }}>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="Enter 11-digit CID"
                      value={cidInput}
                      onChange={(e) => {
                        setCidInput(e.target.value.slice(0, 11));
                        if (linkStep === "error") setLinkStep("idle");
                      }}
                      style={{
                        flex: 1,
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: `1px solid ${linkStep === "error" ? "#ef4444" : "var(--glass-border)"}`,
                        background: "var(--bg-secondary)",
                        color: "var(--text-main)",
                        fontSize: 16,
                        outline: "none",
                      }}
                    />
                    <button
                      onClick={handleLinkDKBank}
                      disabled={
                        linkStep === "loading" || cidInput.length !== 11
                      }
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: "none",
                        background:
                          cidInput.length === 11
                            ? "#2563eb"
                            : "var(--bg-secondary)",
                        color:
                          cidInput.length === 11
                            ? "#fff"
                            : "var(--text-subtle)",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor:
                          cidInput.length === 11 ? "pointer" : "not-allowed",
                        transition: "all 0.15s",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {linkStep === "loading" ? (
                        <Loader2
                          size={14}
                          style={{ animation: "spin 0.8s linear infinite" }}
                        />
                      ) : (
                        <Link2 size={14} />
                      )}
                      Link
                    </button>
                  </div>
                  {linkStep === "error" && (
                    <div
                      style={{ fontSize: 12, color: "#f87171", marginTop: 6 }}
                    >
                      {linkError}
                    </div>
                  )}
                </div>
              )}
              {linkStep === "success" && !hasDKBank && (
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 12,
                    color: "#4ade80",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Check size={13} /> DK Bank linked successfully!
                </div>
              )}
            </div>

            {/* Telegram Phone */}
            <div style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: hasPhone
                      ? "rgba(16,185,129,0.12)"
                      : "var(--bg-secondary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Smartphone
                    size={17}
                    color={hasPhone ? "#10b981" : "var(--text-muted)"}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--text-main)",
                    }}
                  >
                    Telegram Phone
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: hasPhone ? "#10b981" : "var(--text-subtle)",
                      marginTop: 1,
                    }}
                  >
                    {hasPhone
                      ? "Verified"
                      : "Not verified — share via Telegram bot"}
                  </div>
                </div>
                {hasPhone ? (
                  <CheckCircle2 size={18} color="#10b981" />
                ) : (
                  <XCircle size={18} color="#94a3b8" />
                )}
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════
            PWA ACCESS
        ══════════════════════════════════════════════════════ */}
          <SectionLabel label="Website Access" />
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: 16,
              margin: "0 16px",
              border: "1px solid var(--glass-border)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: "var(--bg-secondary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    color: "var(--text-muted)",
                  }}
                >
                  <Lock size={17} />
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--text-main)",
                    }}
                  >
                    Website Password
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-subtle)",
                      marginTop: 1,
                    }}
                  >
                    Set a password to log in at oro.app without Telegram
                  </div>
                </div>
                {pwaStep === "success" ? (
                  <CheckCircle2 size={18} color="#10b981" />
                ) : (
                  <button
                    onClick={() => {
                      setShowPwaForm(!showPwaForm);
                      setPwaStep("idle");
                      setPwaError("");
                    }}
                    style={{
                      background: "var(--bg-secondary)",
                      border: "none",
                      borderRadius: 8,
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--color-primary)",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {showPwaForm ? "Cancel" : "Set Password"}
                  </button>
                )}
              </div>

              {showPwaForm && pwaStep !== "success" && (
                <div
                  style={{
                    marginTop: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  {/* Password input */}
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPwaPassword ? "text" : "password"}
                      placeholder="New password (min 6 chars)"
                      value={pwaPassword}
                      onChange={(e) => {
                        setPwaPasswordInput(e.target.value);
                        if (pwaStep === "error") setPwaStep("idle");
                      }}
                      style={{
                        width: "100%",
                        padding: "10px 40px 10px 12px",
                        borderRadius: 10,
                        border: `1px solid ${pwaStep === "error" ? "#ef4444" : "var(--glass-border)"}`,
                        background: "var(--bg-secondary)",
                        color: "var(--text-main)",
                        fontSize: 16,
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    <button
                      onClick={() => setShowPwaPassword(!showPwaPassword)}
                      style={{
                        position: "absolute",
                        right: 10,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--text-subtle)",
                        padding: 0,
                        display: "flex",
                      }}
                    >
                      {showPwaPassword ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                    </button>
                  </div>

                  {/* Confirm input */}
                  <input
                    type={showPwaPassword ? "text" : "password"}
                    placeholder="Confirm password"
                    value={pwaConfirm}
                    onChange={(e) => {
                      setPwaConfirm(e.target.value);
                      if (pwaStep === "error") setPwaStep("idle");
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: `1px solid ${pwaStep === "error" ? "#ef4444" : "var(--glass-border)"}`,
                      background: "var(--bg-secondary)",
                      color: "var(--text-main)",
                      fontSize: 16,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />

                  {pwaStep === "error" && (
                    <div style={{ fontSize: 12, color: "#f87171" }}>
                      {pwaError}
                    </div>
                  )}

                  <button
                    onClick={handleSetPwaPassword}
                    disabled={
                      pwaStep === "loading" ||
                      pwaPassword.length < 6 ||
                      pwaConfirm.length < 6
                    }
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 7,
                      padding: "11px 0",
                      borderRadius: 10,
                      border: "none",
                      background:
                        pwaPassword.length >= 6 && pwaConfirm.length >= 6
                          ? "#2563eb"
                          : "var(--bg-secondary)",
                      color:
                        pwaPassword.length >= 6 && pwaConfirm.length >= 6
                          ? "#fff"
                          : "var(--text-subtle)",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor:
                        pwaPassword.length >= 6 && pwaConfirm.length >= 6
                          ? "pointer"
                          : "not-allowed",
                      transition: "all 0.15s",
                    }}
                  >
                    {pwaStep === "loading" ? (
                      <>
                        <Loader2
                          size={14}
                          style={{ animation: "spin 0.8s linear infinite" }}
                        />{" "}
                        Saving…
                      </>
                    ) : (
                      <>
                        <Lock size={14} /> Save Password
                      </>
                    )}
                  </button>
                </div>
              )}

              {pwaStep === "success" && (
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 12,
                    color: "#4ade80",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Check size={13} /> PWA password set successfully!
                </div>
              )}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════
            ABOUT / SUPPORT
        ══════════════════════════════════════════════════════ */}
          <SectionLabel label="About & Support" />
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: 16,
              margin: "0 16px",
              border: "1px solid var(--glass-border)",
              overflow: "hidden",
            }}
          >
            <SettingsRow
              icon={<BookOpen size={17} />}
              label="How It Works"
              value="Quick guide to getting started"
              onClick={() => setShowHowItWorks(true)}
            >
              <ChevronLeft
                size={15}
                color="var(--text-subtle)"
                style={{ transform: "rotate(180deg)" }}
              />
            </SettingsRow>

            <SettingsRow
              icon={<ClipboardList size={17} />}
              label="Resolution Record"
              value="All settled markets & outcomes"
              onClick={() => navigate("/resolved")}
            >
              <ChevronLeft
                size={15}
                color="var(--text-subtle)"
                style={{ transform: "rotate(180deg)" }}
              />
            </SettingsRow>

            <SettingsRow
              icon={<MessageCircle size={17} />}
              label="Support"
              value="oro@21.tech.bt"
              onClick={() => {
                window.open("https://mail.google.com/mail/?view=cm&to=oro@21.tech.bt", "_blank");
              }}
            >
              <ExternalLink size={15} color="var(--text-subtle)" />
            </SettingsRow>

            <SettingsRow
              icon={<Info size={17} />}
              label="App version"
              value="1.0.0"
              noBorder
            />
          </div>

          <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          input[type=number]::-webkit-inner-spin-button,
          input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
        `}</style>
        </div>
      </div>

      {showHowItWorks && (
        <HowItWorksModal onClose={() => setShowHowItWorks(false)} />
      )}
    </Page>
  );
};
