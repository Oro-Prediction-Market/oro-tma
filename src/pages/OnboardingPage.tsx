import { useEffect, useRef, useState } from "react";
import { CheckCircle, ArrowRight, AtSign, User, Phone, Mail, Loader2, AlertCircle, CheckCircle2, XCircle, TrendingUp, Trophy, Star, Swords } from "lucide-react";
import { checkUsernameAvailable, sendOnboardOtp } from "@shared/api/client";
import { useAuth } from "@shared/hooks/useAuth";
import { PhoneInput } from "@/components/ui/PhoneInput";

type Step = "intro" | "username" | "contact" | "submitting" | "success";
type ContactMethod = "phone" | "email";

const BTN = {
  primary: {
    padding: "16px",
    width: "100%",
    background: "linear-gradient(135deg, #2775d0, #1a5bb5)",
    border: "none",
    borderRadius: 16,
    color: "#fff",
    fontSize: 15,
    fontWeight: 800,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  } as React.CSSProperties,
  ghost: {
    padding: "13px",
    width: "100%",
    background: "transparent",
    border: "1px solid var(--glass-border, rgba(255,255,255,0.1))",
    borderRadius: 16,
    color: "var(--text-muted, #94a3b8)",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  } as React.CSSProperties,
};

function OroLogo() {
  return <img src="/logo.svg" alt="Oro" style={{ height: 36, width: "auto" }} />;
}

function useViewportHeight() {
  const [height, setHeight] = useState(
    () => window.visualViewport?.height ?? (window as any).Telegram?.WebApp?.viewportHeight ?? window.innerHeight,
  );
  useEffect(() => {
    const update = () => {
      const h = window.visualViewport?.height ?? (window as any).Telegram?.WebApp?.viewportHeight ?? window.innerHeight;
      setHeight(h);
      // After keyboard resize, scroll focused input back into view
      const el = document.activeElement;
      if (el instanceof HTMLInputElement) {
        setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
      }
    };
    window.visualViewport?.addEventListener("resize", update);
    const tg = (window as any).Telegram?.WebApp;
    tg?.onEvent("viewportChanged", update);
    return () => {
      window.visualViewport?.removeEventListener("resize", update);
      tg?.offEvent("viewportChanged", update);
    };
  }, []);
  return height;
}

function scrollIntoView(e: React.FocusEvent<HTMLInputElement>) {
  setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
}

interface OnboardingPageProps {
  auth: ReturnType<typeof useAuth>;
}

export function OnboardingPage({ auth }: OnboardingPageProps) {
  const { telegramProfile, preKycToken, register } = auth;
  const viewportHeight = useViewportHeight();

  const [step, setStep] = useState<Step>("intro");

  // username
  const [username, setUsername] = useState(telegramProfile?.username ?? "");
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "error"
  >("idle");
  const [usernameError, setUsernameError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // contact
  const [fullName, setFullName] = useState(
    [telegramProfile?.firstName, telegramProfile?.lastName].filter(Boolean).join(" "),
  );
  const [contactMethod, setContactMethod] = useState<ContactMethod>("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [fullNameError, setFullNameError] = useState("");
  const [contactError, setContactError] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [apiError, setApiError] = useState("");

  // OTP
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpDigits, setOtpDigits] = useState("");
  const [otpError, setOtpError] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [displayName, setDisplayName] = useState("");

  // ── Username check ──────────────────────────────────────────────────────────

  const isValidUsername = (v: string) =>
    v.length >= 3 && v.length <= 50 && /^[a-zA-Z0-9_]+$/.test(v);

  useEffect(() => {
    if (!username) {
      setUsernameStatus("idle");
      setUsernameError("");
      return;
    }
    if (!isValidUsername(username)) {
      setUsernameStatus("error");
      setUsernameError(
        username.length < 3
          ? "At least 3 characters"
          : username.length > 50
            ? "Max 50 characters"
            : "Letters, numbers and underscores only",
      );
      return;
    }
    setUsernameStatus("checking");
    setUsernameError("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const { available } = await checkUsernameAvailable(username);
        setUsernameStatus(available ? "available" : "taken");
        if (!available) setUsernameError("Username already taken");
      } catch {
        setUsernameStatus("error");
        setUsernameError("Could not check availability");
      }
    }, 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [username]);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const startCountdown = () => {
    setResendCountdown(60);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setResendCountdown((n) => {
        if (n <= 1) { clearInterval(countdownRef.current!); return 0; }
        return n - 1;
      });
    }, 1000);
  };

  const haptic = () => {
    try { (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred("light"); } catch {}
  };

  const validateContact = () => {
    let fErr = "";
    let cErr = "";
    if (!fullName.trim()) fErr = "Full name is required";
    if (contactMethod === "phone") {
      if (!phone.trim()) cErr = "Phone number is required";
    } else {
      if (!email.trim()) cErr = "Email is required";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) cErr = "Enter a valid email";
    }
    return { fErr, cErr };
  };

  // ── Send OTP ─────────────────────────────────────────────────────────────────

  const sendOtp = async () => {
    const { fErr, cErr } = validateContact();
    setFullNameError(fErr);
    setContactError(cErr);
    if (fErr || cErr) return;
    setSendingOtp(true);
    setApiError("");
    try {
      await sendOnboardOtp(
        contactMethod === "phone" ? { phoneNumber: phone } : { email: email.trim() },
        preKycToken!,
      );
      setOtpDigits("");
      setOtpError("");
      setShowOtpModal(true);
      startCountdown();
    } catch (err: any) {
      setContactError(err.message || "Failed to send code. Try again.");
    } finally {
      setSendingOtp(false);
    }
  };

  // ── Register ─────────────────────────────────────────────────────────────────

  const handleOtpSubmit = async () => {
    if (otpDigits.length !== 6) { setOtpError("Enter the 6-digit code"); return; }
    setShowOtpModal(false);
    setStep("submitting");
    setApiError("");
    try {
      await register(
        username,
        fullName.trim(),
        otpDigits,
        contactMethod === "phone" ? phone : undefined,
        contactMethod === "email" ? email.trim() : undefined,
      );
      setDisplayName(telegramProfile?.firstName ?? "");
      setStep("success");
    } catch (err: any) {
      const message = err.message || "Something went wrong. Please try again.";
      setApiError(message);
      setOtpError(message);
      setShowOtpModal(true);
      setStep("contact");
    }
  };

  // ── Styles ───────────────────────────────────────────────────────────────────

  const S = {
    screen: {
      height: `${viewportHeight}px`,
      background: "var(--bg-main, #0f1117)",
      display: "flex",
      flexDirection: "column" as const,
      overflow: "hidden",
    },
    input: (hasError?: boolean) => ({
      width: "100%",
      padding: "14px 14px 14px 42px",
      background: "var(--bg-card, #1a1f2e)",
      border: `1px solid ${hasError ? "#ef4444" : "var(--glass-border, rgba(255,255,255,0.08))"}`,
      borderRadius: 14,
      color: "var(--text-main, #f8fafc)",
      fontSize: 16,
      outline: "none",
      boxSizing: "border-box" as const,
    }),
    label: {
      fontSize: 11,
      fontWeight: 700,
      color: "var(--text-subtle, #64748b)",
      textTransform: "uppercase" as const,
      letterSpacing: "0.06em",
      marginBottom: 8,
      display: "block",
    },
    errorRow: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      marginTop: 6,
      fontSize: 12,
      color: "#ef4444",
      fontWeight: 500,
    } as React.CSSProperties,
  };

  // ────────────────────────────────────────────────────────────────────────────
  // INTRO
  // ────────────────────────────────────────────────────────────────────────────

  if (step === "intro") {
    const features: { icon: React.ReactNode; title: string; desc: string }[] = [
      { icon: <TrendingUp size={20} color="#2775d0" />, title: "Prediction Markets", desc: "Predict on real-world outcomes. Odds shift live with every prediction." },
      { icon: <Trophy size={20} color="#2775d0" />, title: "Weekly Seasons", desc: "Compete on the leaderboard. Top predictors win prizes every week." },
      { icon: <Star size={20} color="#2775d0" />, title: "Prediction Rating", desc: "Build your reputation. Rise from Rookie to Legend." },
      { icon: <Swords size={20} color="#2775d0" />, title: "Duels", desc: "Challenge friends head-to-head on any open market." },
    ];
    return (
      <div style={{ ...S.screen, alignItems: "stretch" }}>
        <div style={{ flex: 1, overflowY: "auto", padding: "32px 20px 16px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <OroLogo />
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: "var(--text-subtle, #64748b)", marginTop: 20, marginBottom: 4 }}>
            Prediction Markets
          </p>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: "var(--text-main, #f8fafc)", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
            Welcome{telegramProfile?.firstName ? `, ${telegramProfile.firstName}` : ""}!
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted, #94a3b8)", margin: 0 }}>
            Predict. Compete. Win.
          </p>

          <div style={{ marginTop: 24, width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
            {features.map(({ icon, title, desc }) => (
              <div key={title} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", background: "var(--bg-card, #1a1f2e)", border: "1px solid var(--glass-border, rgba(255,255,255,0.08))", borderRadius: 14, textAlign: "left" }}>
                <span style={{ flexShrink: 0, marginTop: 1 }}>{icon}</span>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--text-main, #f8fafc)" }}>{title}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted, #94a3b8)", lineHeight: 1.4 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: "8px 20px 32px", flexShrink: 0 }}>
          <button style={BTN.primary} onClick={() => { haptic(); setStep("username"); }}>
            Get Started <ArrowRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SUBMITTING
  // ────────────────────────────────────────────────────────────────────────────

  if (step === "submitting") {
    return (
      <div style={{ ...S.screen, alignItems: "center", justifyContent: "center", padding: "0 24px", textAlign: "center" }}>
        <div style={{ position: "relative", marginBottom: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", border: "2px solid rgba(39,117,208,0.2)", borderTopColor: "#2775d0", animation: "spin 1s linear infinite" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <User size={28} color="#2775d0" />
          </div>
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-main, #f8fafc)", margin: "0 0 8px" }}>Setting up your account</h2>
        <p style={{ fontSize: 13, color: "var(--text-muted, #94a3b8)", margin: 0 }}>Just a moment…</p>
        {["Creating your profile…", "Setting up your wallet…", "Almost ready…"].map((msg, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: i === 0 ? 20 : 6, fontSize: 12, color: "var(--text-subtle, #64748b)" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#2775d0", animationDelay: `${i * 0.3}s` }} />
            {msg}
          </div>
        ))}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SUCCESS
  // ────────────────────────────────────────────────────────────────────────────

  if (step === "success") {
    return (
      <div style={{ ...S.screen, alignItems: "center", justifyContent: "center", padding: "0 24px", textAlign: "center" }}>
        <OroLogo />
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "20px 0" }}>
          <CheckCircle size={36} color="#22c55e" />
        </div>
        <h2 style={{ fontSize: 26, fontWeight: 900, color: "var(--text-main, #f8fafc)", margin: "0 0 8px" }}>
          You're in{displayName ? `, ${displayName}` : ""}!
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-muted, #94a3b8)", margin: 0 }}>
          Your Nu 20 free credit is ready.
        </p>
        <p style={{ fontSize: 12, color: "#2775d0", marginTop: 12 }}>Loading Oro…</p>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // USERNAME + CONTACT (shared shell)
  // ────────────────────────────────────────────────────────────────────────────

  const stepIndex = step === "username" ? 0 : 1;

  return (
    <div style={S.screen}>
      {/* Header */}
      <div style={{ padding: "48px 20px 16px", flexShrink: 0 }}>
        <button
          onClick={() => setStep(step === "username" ? "intro" : "username")}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted, #94a3b8)", fontSize: 13, padding: 0, marginBottom: 20 }}
        >
          ← Back
        </button>

        {/* Progress */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 99, background: i <= stepIndex ? "#2775d0" : "var(--glass-border, rgba(255,255,255,0.1))", transition: "background 0.3s" }} />
          ))}
        </div>

        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "var(--text-main, #f8fafc)" }}>
            {step === "username" ? "Pick a username" : "About you"}
          </h1>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-subtle, #64748b)" }}>
            {step === "username" ? "How others will find you" : "A few more details"}
          </p>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px" }}>

        {/* USERNAME STEP */}
        {step === "username" && (
          <div style={{ paddingTop: 8 }}>
            <label style={S.label}>Username</label>
            <div style={{ position: "relative" }}>
              <AtSign size={16} color="var(--text-subtle, #64748b)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
              <input
                autoFocus
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 50))}
                onFocus={scrollIntoView}
                placeholder="your_username"
                style={{
                  ...S.input(usernameStatus === "error" || usernameStatus === "taken"),
                  ...(usernameStatus === "available" ? { borderColor: "#22c55e" } : {}),
                  paddingRight: 40,
                }}
              />
              <div style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)" }}>
                {usernameStatus === "checking" && <Loader2 size={16} color="var(--text-subtle, #64748b)" style={{ animation: "spin 1s linear infinite" }} />}
                {usernameStatus === "available" && <CheckCircle2 size={16} color="#22c55e" />}
                {(usernameStatus === "taken" || usernameStatus === "error") && <XCircle size={16} color="#ef4444" />}
              </div>
            </div>
            {usernameStatus === "available" ? (
              <p style={{ fontSize: 12, color: "#22c55e", marginTop: 6 }}>@{username} is available</p>
            ) : usernameError ? (
              <div style={S.errorRow}><AlertCircle size={13} /> {usernameError}</div>
            ) : (
              <p style={{ fontSize: 12, color: "var(--text-subtle, #64748b)", marginTop: 6 }}>3–50 characters · letters, numbers and underscores</p>
            )}
          </div>
        )}

        {/* CONTACT STEP */}
        {step === "contact" && (
          <div style={{ paddingTop: 8, paddingBottom: 16, display: "flex", flexDirection: "column", gap: 18 }}>
            {apiError && (
              <div style={{ padding: "12px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12, display: "flex", gap: 10 }}>
                <AlertCircle size={15} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ margin: 0, fontSize: 12, color: "#ef4444", lineHeight: 1.5 }}>{apiError}</p>
              </div>
            )}

            {/* Full name */}
            <div>
              <label style={S.label}>Full Name</label>
              <div style={{ position: "relative" }}>
                <User size={16} color="var(--text-subtle, #64748b)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  autoFocus
                  type="text"
                  value={fullName}
                  onChange={(e) => { setFullName(e.target.value.slice(0, 255)); if (fullNameError) setFullNameError(""); }}
                  onFocus={scrollIntoView}
                  placeholder="Your full name"
                  style={S.input(!!fullNameError)}
                />
              </div>
              {fullNameError && <div style={S.errorRow}><AlertCircle size={13} /> {fullNameError}</div>}
            </div>

            {/* Contact method */}
            <div>
              <label style={S.label}>Contact</label>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {(["phone", "email"] as ContactMethod[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setContactMethod(m); setContactError(""); }}
                    style={{
                      flex: 1, padding: "10px", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      background: contactMethod === m ? "rgba(39,117,208,0.15)" : "var(--bg-card, #1a1f2e)",
                      border: contactMethod === m ? "1px solid rgba(39,117,208,0.5)" : "1px solid var(--glass-border, rgba(255,255,255,0.08))",
                      color: contactMethod === m ? "#2775d0" : "var(--text-muted, #94a3b8)",
                    }}
                  >
                    {m === "phone" ? <Phone size={14} /> : <Mail size={14} />}
                    {m === "phone" ? "Phone" : "Email"}
                  </button>
                ))}
              </div>

              {contactMethod === "phone" ? (
                <PhoneInput
                  value={phone}
                  onChange={(e164) => { setPhone(e164); if (contactError) setContactError(""); }}
                  error={contactError || undefined}
                />
              ) : (
                <div style={{ position: "relative" }}>
                  <Mail size={16} color="var(--text-subtle, #64748b)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    type="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (contactError) setContactError(""); }}
                    onFocus={scrollIntoView}
                    placeholder="you@example.com"
                    style={S.input(!!contactError)}
                  />
                </div>
              )}
              {contactMethod === "email" && contactError && (
                <div style={S.errorRow}><AlertCircle size={13} /> {contactError}</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "12px 20px 32px", flexShrink: 0 }}>
        {step === "username" ? (
          <button
            style={{ ...BTN.primary, opacity: usernameStatus !== "available" ? 0.4 : 1, pointerEvents: usernameStatus !== "available" ? "none" : "auto" }}
            onClick={() => { haptic(); setStep("contact"); }}
          >
            Continue <ArrowRight size={18} />
          </button>
        ) : (
          <button
            disabled={sendingOtp || !fullName.trim() || (contactMethod === "phone" ? !phone.trim() : !email.trim())}
            style={{ ...BTN.primary, opacity: (sendingOtp || !fullName.trim() || (contactMethod === "phone" ? !phone.trim() : !email.trim())) ? 0.4 : 1 }}
            onClick={sendOtp}
          >
            {sendingOtp ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : <>Send Code <ArrowRight size={18} /></>}
          </button>
        )}
      </div>

      {/* OTP Modal */}
      {showOtpModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "flex-end" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }} onClick={() => setShowOtpModal(false)} />
          <div style={{ position: "relative", width: "100%", background: "var(--bg-card, #1a1f2e)", borderRadius: "24px 24px 0 0", padding: "20px 20px 40px", borderTop: "1px solid var(--glass-border, rgba(255,255,255,0.08))" }}>
            <div style={{ width: 36, height: 4, borderRadius: 99, background: "var(--glass-border, rgba(255,255,255,0.12))", margin: "0 auto 20px" }} />
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 800, color: "var(--text-main, #f8fafc)" }}>Enter verification code</h2>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--text-muted, #94a3b8)" }}>
              {contactMethod === "phone"
                ? `Code sent to ${phone}`
                : `Code sent to ${email}`}
            </p>

            {/* 6-box OTP input */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <input
                  key={i}
                  id={`otp-${i}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={otpDigits[i] ?? ""}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    const next = otpDigits.split("");
                    next[i] = val.slice(-1);
                    const joined = next.join("").slice(0, 6);
                    setOtpDigits(joined);
                    setOtpError("");
                    if (val && i < 5) document.getElementById(`otp-${i + 1}`)?.focus();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace" && !otpDigits[i] && i > 0) {
                      document.getElementById(`otp-${i - 1}`)?.focus();
                    }
                  }}
                  style={{
                    flex: 1, height: 52, textAlign: "center", fontSize: 20, fontWeight: 800, minWidth: 0,
                    background: "var(--bg-main, #0f1117)", borderRadius: 12,
                    border: `1px solid ${otpError ? "#ef4444" : otpDigits[i] ? "#2775d0" : "var(--glass-border, rgba(255,255,255,0.1))"}`,
                    color: "var(--text-main, #f8fafc)", outline: "none",
                  }}
                />
              ))}
            </div>

            {otpError && (
              <div style={{ ...S.errorRow, justifyContent: "center", marginBottom: 12 }}>
                <AlertCircle size={13} /> {otpError}
              </div>
            )}

            <button style={BTN.primary} onClick={handleOtpSubmit}>
              Verify & Join <ArrowRight size={18} />
            </button>

            <div style={{ textAlign: "center", marginTop: 14 }}>
              {resendCountdown > 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted, #94a3b8)" }}>
                  Resend in <span style={{ color: "var(--text-main, #f8fafc)", fontWeight: 700 }}>{resendCountdown}s</span>
                </p>
              ) : (
                <button
                  type="button"
                  onClick={sendOtp}
                  disabled={sendingOtp}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#2775d0", fontWeight: 700 }}
                >
                  {sendingOtp ? "Sending…" : "Resend code"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
