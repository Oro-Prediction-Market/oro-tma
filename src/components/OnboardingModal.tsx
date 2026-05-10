import { useState } from "react";
import { ChevronRight, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

const STORAGE_KEY = "oro_onboarding_done";

// ── Per-step visual mockups ────────────────────────────────────────────────────

function WalletVisual() {
  return (
    <div
      style={{
        background: "rgba(167,139,250,0.08)",
        border: "1px solid rgba(167,139,250,0.2)",
        borderRadius: 16,
        padding: "14px 16px",
        marginBottom: 18,
        textAlign: "left",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "rgba(167,139,250,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
          }}
        >
          🏦
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main)" }}>DK Bank</span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 10,
            color: "#22c55e",
            fontWeight: 800,
            background: "rgba(34,197,94,0.15)",
            padding: "2px 8px",
            borderRadius: 99,
          }}
        >
          Link →
        </span>
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: "var(--text-subtle)", marginBottom: 2 }}>Your balance</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "var(--text-main)" }}>Nu 0.00</div>
      </div>
      <div
        style={{
          background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
          borderRadius: 10,
          padding: "9px 14px",
          fontSize: 12,
          fontWeight: 800,
          color: "#fff",
          textAlign: "center",
          marginBottom: 8,
        }}
      >
        + Top Up
      </div>
      <div style={{ fontSize: 10, color: "#a78bfa", fontWeight: 700, textAlign: "center" }}>
        ✨ +10% bonus on your first top up
      </div>
    </div>
  );
}

function MarketsVisual() {
  return (
    <div
      style={{
        background: "rgba(59,130,246,0.08)",
        border: "1px solid rgba(59,130,246,0.2)",
        borderRadius: 16,
        padding: "14px 16px",
        marginBottom: 18,
        textAlign: "left",
      }}
    >
      {/* Trending badge + title */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 800,
            color: "#ff6b00",
            background: "rgba(255,107,0,0.12)",
            border: "1px solid rgba(255,107,0,0.3)",
            padding: "2px 6px",
            borderRadius: 99,
            textTransform: "uppercase" as const,
            letterSpacing: "0.05em",
          }}
        >
          🔥 Trending
        </span>
        <span style={{ fontSize: 9, color: "var(--text-subtle)", fontWeight: 600 }}>
          Highest volume
        </span>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-main)", marginBottom: 10 }}>
        Who wins NCA Finals 2024?
      </div>
      {/* Outcome A — leading */}
      <div
        style={{
          borderRadius: 10,
          overflow: "hidden",
          marginBottom: 6,
          position: "relative",
          background: "rgba(255,255,255,0.04)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: "71%",
            background: "rgba(34,197,94,0.22)",
            borderRadius: 10,
          }}
        />
        <div
          style={{
            position: "relative",
            padding: "8px 12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-main)" }}>
            Team Thimphu
          </span>
          <span style={{ fontSize: 12, fontWeight: 900, color: "#22c55e" }}>71%</span>
        </div>
      </div>
      {/* Outcome B */}
      <div
        style={{
          borderRadius: 10,
          overflow: "hidden",
          position: "relative",
          background: "rgba(255,255,255,0.04)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: "29%",
            background: "rgba(239,68,68,0.2)",
            borderRadius: 10,
          }}
        />
        <div
          style={{
            position: "relative",
            padding: "8px 12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-main)" }}>
            Paro Warriors
          </span>
          <span style={{ fontSize: 12, fontWeight: 900, color: "#ef4444" }}>29%</span>
        </div>
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 10,
          color: "var(--text-subtle)",
          display: "flex",
          justifyContent: "space-between",
          fontWeight: 600,
        }}
      >
        <span style={{ color: "#22c55e" }}>● Live</span>
        <span>Nu 48,200 vol · 2h left</span>
      </div>
    </div>
  );
}

function OracleVisual() {
  const tiers = ["Rookie", "Sharpshooter", "Hot Hand", "Legend"];
  return (
    <div
      style={{
        background: "rgba(34,197,94,0.08)",
        border: "1px solid rgba(34,197,94,0.2)",
        borderRadius: 16,
        padding: "14px 16px",
        marginBottom: 18,
        textAlign: "left",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background:
              "conic-gradient(#22c55e 0deg 115deg, rgba(34,197,94,0.15) 115deg 360deg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "var(--bg-card, #1a1f2e)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 900, color: "#22c55e" }}>32</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 900, color: "var(--text-main)" }}>
            Prediction Rating
          </div>
          <div style={{ fontSize: 10, color: "#22c55e", fontWeight: 700 }}>
            Rookie · 3 correct
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {tiers.map((t, i) => (
          <div
            key={t}
            style={{
              flex: 1,
              textAlign: "center",
              padding: "5px 0",
              borderRadius: 6,
              background: i === 0 ? "rgba(34,197,94,0.22)" : "rgba(255,255,255,0.04)",
              border:
                i === 0
                  ? "1px solid rgba(34,197,94,0.4)"
                  : "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 800,
                color: i === 0 ? "#22c55e" : "var(--text-subtle)",
              }}
            >
              {t}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompeteVisual() {
  const entries = [
    { medal: "🥇", name: "@Pema_D", score: "2,400", isYou: false },
    { medal: "🥈", name: "@Kinley", score: "1,820", isYou: false },
    { medal: "🥉", name: "You", score: "1,200", isYou: true },
  ];
  return (
    <div
      style={{
        background: "rgba(245,158,11,0.08)",
        border: "1px solid rgba(245,158,11,0.2)",
        borderRadius: 16,
        padding: "14px 16px",
        marginBottom: 18,
        textAlign: "left",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: "#f59e0b",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 10,
        }}
      >
        🏆 Weekly Season · 4 days left
      </div>
      {entries.map((e) => (
        <div
          key={e.name}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 8px",
            borderRadius: 8,
            marginBottom: 4,
            background: e.isYou ? "rgba(245,158,11,0.12)" : "transparent",
            border: e.isYou
              ? "1px solid rgba(245,158,11,0.3)"
              : "1px solid transparent",
          }}
        >
          <span style={{ fontSize: 14 }}>{e.medal}</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: e.isYou ? 800 : 600,
              color: e.isYou ? "#f59e0b" : "var(--text-main)",
              flex: 1,
            }}
          >
            {e.name}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>
            Nu {e.score}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Step definitions ───────────────────────────────────────────────────────────

const STEPS = [
  {
    visual: <WalletVisual />,
    title: "Set up your wallet",
    body: "Link your DK Bank account, top up, and you're ready to predict. Takes under 2 minutes.",
  },
  {
    visual: <MarketsVisual />,
    title: "Predict markets",
    body: "Pick outcomes on live prediction markets. Odds shift with every bet — get in early for the best returns.",
  },
  {
    visual: <OracleVisual />,
    title: "Build your Prediction Rating",
    body: "Every correct prediction boosts your score. Rise through Rookie, Sharpshooter, Hot Hand, to Legend.",
  },
  {
    visual: <CompeteVisual />,
    title: "Compete weekly",
    body: "Seasons reset every week. Earn referral bonuses, keep your daily streak, and climb the board.",
  },
];

// ── Exports ────────────────────────────────────────────────────────────────────

export function useOnboarding() {
  return typeof window !== "undefined" && !localStorage.getItem(STORAGE_KEY);
}

export function OnboardingModal({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  function finish(goToWallet?: boolean) {
    localStorage.setItem(STORAGE_KEY, "1");
    onDone();
    if (goToWallet) navigate("/wallet");
  }

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "var(--bg-card, #1a1f2e)",
          borderRadius: 24,
          border: "1px solid var(--glass-border, rgba(255,255,255,0.08))",
          padding: "28px 22px 22px",
          position: "relative",
          textAlign: "center",
        }}
      >
        {/* Skip */}
        <button
          onClick={() => finish()}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-subtle, #64748b)",
            padding: 4,
          }}
        >
          <X size={18} />
        </button>

        {/* Step dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 20 }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 20 : 6,
                height: 6,
                borderRadius: 99,
                background:
                  i === step
                    ? "#3b82f6"
                    : "var(--glass-border, rgba(255,255,255,0.12))",
                transition: "width 0.25s ease",
              }}
            />
          ))}
        </div>

        {/* Visual mockup */}
        {s.visual}

        {/* Text content */}
        <h2
          style={{
            fontSize: 20,
            fontWeight: 900,
            color: "var(--text-main, #f8fafc)",
            margin: "0 0 8px",
            letterSpacing: "-0.02em",
          }}
        >
          {s.title}
        </h2>
        <p
          style={{
            fontSize: 13,
            color: "var(--text-muted, #94a3b8)",
            lineHeight: 1.6,
            margin: "0 0 20px",
            fontWeight: 500,
          }}
        >
          {s.body}
        </p>

        {/* CTA */}
        {isLast ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              onClick={() => finish(true)}
              style={{
                width: "100%",
                padding: "14px",
                background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
                border: "none",
                borderRadius: 14,
                color: "#fff",
                fontSize: 15,
                fontWeight: 800,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              Fund my wallet
              <ChevronRight size={18} />
            </button>
            <button
              onClick={() => finish()}
              style={{
                width: "100%",
                padding: "11px",
                background: "transparent",
                border: "1px solid var(--glass-border, rgba(255,255,255,0.1))",
                borderRadius: 14,
                color: "var(--text-muted, #94a3b8)",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Browse markets first
            </button>
          </div>
        ) : (
          <button
            onClick={() => setStep((n) => n + 1)}
            style={{
              width: "100%",
              padding: "14px",
              background: "linear-gradient(135deg, #3b82f6, #2563eb)",
              border: "none",
              borderRadius: 14,
              color: "#fff",
              fontSize: 15,
              fontWeight: 800,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            Next
            <ChevronRight size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
