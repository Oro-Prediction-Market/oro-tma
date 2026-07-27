import React from "react";

// ── UFC theme tokens ──────────────────────────────────────────────────────────
const RED = "#d20a0a";
const RED_DIM = "#8f0707";

const WEIGHT_CLASSES = [
  "Heavyweight",
  "Light Heavyweight",
  "Middleweight",
  "Welterweight",
  "Lightweight",
  "Featherweight",
  "Bantamweight",
  "Flyweight",
];

interface UfcBannerProps {
  onClick?: () => void;
  showCta?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export function UfcBanner({
  onClick,
  showCta = true,
  style,
  className,
}: UfcBannerProps) {
  return (
    <div
      className={["ufcb", className].filter(Boolean).join(" ")}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      style={{
        borderRadius: 16,
        overflow: "hidden",
        position: "relative",
        // The poster art carries the branding; chrome sits on top of it.
        backgroundImage: "url('/ufc-banner-art.png')",
        backgroundSize: "cover",
        backgroundPosition: "center 42%",
        backgroundColor: "#0d0b0c",
        border: "1px solid rgba(210,10,10,0.35)",
        boxShadow: "0 12px 28px rgba(0,0,0,0.45)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        height: "100%",
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
        outline: "none",
        ...style,
      }}
    >
      <style>{`
        .ufcb { min-height: 320px; }
        @keyframes ufcbPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.35; transform: scale(0.72); }
        }
        @keyframes ufcbMarquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (max-width: 599px) {
          .ufcb { min-height: 260px; }
        }
      `}</style>

      {/* Readability veils — soft at the top for the LIVE pill, stronger at the
          bottom so the weight-class rail + CTA stay legible over the art. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(13,11,12,0.55) 0%, rgba(13,11,12,0) 22%, rgba(13,11,12,0) 60%, rgba(13,11,12,0.85) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* ── Top: LIVE pill ── */}
      <div style={{ position: "relative", zIndex: 1, padding: "12px 12px 0" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            background: "rgba(0,0,0,0.6)",
            border: "1px solid rgba(210,10,10,0.55)",
            borderRadius: 20,
            padding: "5px 12px",
            backdropFilter: "blur(2px)",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: RED,
              boxShadow: `0 0 8px ${RED}`,
              animation: "ufcbPulse 1.4s ease-in-out infinite",
            }}
          />
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 900,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#fff",
              whiteSpace: "nowrap",
            }}
          >
            Live · Fight Night Markets
          </span>
        </div>
      </div>

      {/* ── Footer: weight-class rail + CTA ── */}
      {showCta && (
        <div
          style={{
            position: "relative",
            zIndex: 1,
            background: "rgba(0,0,0,0.42)",
            borderTop: "1px solid rgba(210,10,10,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "9px 12px",
            backdropFilter: "blur(2px)",
          }}
        >
          <div style={{ flex: 1, minWidth: 0, overflow: "hidden", position: "relative" }}>
            {/* Left fade so names ease in from the edge */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: 22,
                background:
                  "linear-gradient(to right, rgba(0,0,0,0.5), transparent)",
                zIndex: 1,
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                display: "flex",
                width: "max-content",
                animation: "ufcbMarquee 20s linear infinite",
              }}
            >
              {[...WEIGHT_CLASSES, ...WEIGHT_CLASSES].map((wc, i) => (
                <span
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    padding: "0 11px",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.7)",
                    whiteSpace: "nowrap",
                    textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                  }}
                >
                  {wc}
                  <span style={{ color: RED, fontSize: 8 }}>◆</span>
                </span>
              ))}
            </div>
          </div>

          <div
            style={{
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              background: `linear-gradient(180deg, ${RED} 0%, ${RED_DIM} 100%)`,
              borderRadius: 9,
              padding: "7px 14px",
              boxShadow: "0 4px 12px rgba(210,10,10,0.4)",
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#fff",
                whiteSpace: "nowrap",
              }}
            >
              Enter the Octagon »
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
