import React from "react";

// ── UEFA Champions League theme tokens ────────────────────────────────────────
const BLUE = "#2b6bff";
const BLUE_DIM = "#12336f";
const GOLD = "#e8c766";

const CLUBS = [
  "Real Madrid",
  "Man City",
  "Bayern",
  "Barcelona",
  "Arsenal",
  "Liverpool",
  "PSG",
  "Inter",
  "Dortmund",
  "Atlético",
  "Juventus",
  "Chelsea",
];

interface UclBannerProps {
  onClick?: () => void;
  showCta?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export function UclBanner({
  onClick,
  showCta = true,
  style,
  className,
}: UclBannerProps) {
  return (
    <div
      className={["uclb", className].filter(Boolean).join(" ")}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      style={{
        borderRadius: 16,
        overflow: "hidden",
        position: "relative",
        // The poster carries the branding; chrome sits on top of it.
        backgroundImage: "url('/ucl-hero.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center 28%",
        backgroundColor: "#070d29",
        border: "1px solid rgba(43,107,255,0.4)",
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
        .uclb { min-height: 320px; }
        @keyframes uclbMarquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes uclbTwinkle {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @media (max-width: 599px) {
          .uclb { min-height: 260px; }
        }
      `}</style>

      {/* Readability veils */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(7,13,41,0.5) 0%, rgba(7,13,41,0) 24%, rgba(7,13,41,0) 58%, rgba(7,13,41,0.88) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* ── Top: season pill ── */}
      <div style={{ position: "relative", zIndex: 1, padding: "12px 12px 0" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            background: "rgba(7,13,41,0.6)",
            border: "1px solid rgba(43,107,255,0.55)",
            borderRadius: 20,
            padding: "5px 12px",
            backdropFilter: "blur(2px)",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              animation: "uclbTwinkle 1.6s ease-in-out infinite",
            }}
          >
            ★
          </span>
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 900,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#cfe0ff",
              whiteSpace: "nowrap",
            }}
          >
            Champions League · 2026/27
          </span>
        </div>
      </div>

      {/* ── Footer: club marquee + CTA ── */}
      {showCta && (
        <div
          style={{
            position: "relative",
            zIndex: 1,
            background: "rgba(7,13,41,0.45)",
            borderTop: "1px solid rgba(43,107,255,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "9px 12px",
            backdropFilter: "blur(2px)",
          }}
        >
          <div style={{ flex: 1, minWidth: 0, overflow: "hidden", position: "relative" }}>
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: 22,
                background: "linear-gradient(to right, rgba(7,13,41,0.6), transparent)",
                zIndex: 1,
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                display: "flex",
                width: "max-content",
                animation: "uclbMarquee 24s linear infinite",
              }}
            >
              {[...CLUBS, ...CLUBS].map((club, i) => (
                <span
                  key={i}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "0 11px",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "rgba(207,224,255,0.8)",
                    whiteSpace: "nowrap",
                    textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                  }}
                >
                  {club}
                  <span style={{ color: GOLD, fontSize: 8 }}>★</span>
                </span>
              ))}
            </div>
          </div>

          <div
            style={{
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              background: `linear-gradient(180deg, ${BLUE} 0%, ${BLUE_DIM} 100%)`,
              borderRadius: 9,
              padding: "7px 14px",
              boxShadow: "0 4px 12px rgba(43,107,255,0.4)",
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
              Enter the Hub »
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
