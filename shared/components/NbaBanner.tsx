import React from "react";

/**
 * Feed entry point for the NBA hub.
 *
 * Drawn entirely in CSS: there is no NBA artwork in the app yet, and the
 * league's logo is not ours to use. Same frame as the UNL, UCL and EPL banners
 * (edition pill on top, a team marquee and the CTA at the foot), so it sits in
 * the feed at the same size. When a poster is supplied, set it as the
 * background image here as UnlBanner does.
 */

const BLUE = "#1d428a";
const RED = "#c8102e";
const NIGHT = "#0a1230";

const TEAMS = [
  "Celtics",
  "Lakers",
  "Warriors",
  "Thunder",
  "Knicks",
  "Nuggets",
  "Bucks",
  "Cavaliers",
  "76ers",
  "Mavericks",
  "Heat",
  "Spurs",
];

interface NbaBannerProps {
  onClick?: () => void;
  showCta?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export function NbaBanner({
  onClick,
  showCta = true,
  style,
  className,
}: NbaBannerProps) {
  return (
    <div
      className={["nbab", className].filter(Boolean).join(" ")}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      style={{
        borderRadius: 16,
        overflow: "hidden",
        position: "relative",
        background: `radial-gradient(120% 90% at 85% 15%, ${RED}cc 0%, transparent 55%), radial-gradient(110% 90% at 10% 90%, ${BLUE} 0%, transparent 60%), ${NIGHT}`,
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
        .nbab { min-height: 320px; }
        @keyframes nbabMarquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes nbabPulse {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 0.35; }
        }
        @media (max-width: 599px) {
          .nbab { min-height: 260px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .nbab * { animation: none !important; }
        }
      `}</style>

      {/* Court lines, faint: a centre circle and the half-court line. */}
      <svg
        aria-hidden
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMid slice"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0.12,
          pointerEvents: "none",
        }}
      >
        <line x1="200" y1="0" x2="200" y2="300" stroke="#fff" strokeWidth="2" />
        <circle
          cx="200"
          cy="150"
          r="58"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
        />
        <circle
          cx="200"
          cy="150"
          r="18"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
        />
      </svg>

      {/* ── Top: edition pill ── */}
      <div style={{ position: "relative", zIndex: 1, padding: "12px 12px 0" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            background: "rgba(10,18,48,0.6)",
            border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: 20,
            padding: "5px 12px",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: RED,
              animation: "nbabPulse 1.8s ease-in-out infinite",
            }}
          />
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 900,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#e6ebf7",
              whiteSpace: "nowrap",
            }}
          >
            2026/27 Season
          </span>
        </div>
      </div>

      {/* ── Wordmark ── */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding: "0 18px",
          textAlign: "left",
        }}
      >
        <div
          style={{
            fontSize: 64,
            fontWeight: 900,
            fontStyle: "italic",
            letterSpacing: "-0.02em",
            lineHeight: 0.9,
            color: "#fff",
            textShadow: "0 4px 18px rgba(0,0,0,0.45)",
          }}
        >
          NBA
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 12.5,
            fontWeight: 700,
            color: "rgba(230,235,247,0.85)",
          }}
        >
          Every game, every night. Pick the winner.
        </div>
      </div>

      {/* ── Footer: team marquee + CTA ── */}
      {showCta ? (
        <div
          style={{
            position: "relative",
            zIndex: 1,
            background: "rgba(10,18,48,0.5)",
            borderTop: "1px solid rgba(255,255,255,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "9px 12px",
          }}
        >
          <div
            style={{
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                display: "flex",
                width: "max-content",
                animation: "nbabMarquee 26s linear infinite",
              }}
            >
              {[...TEAMS, ...TEAMS].map((team, i) => (
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
                    color: "rgba(230,235,247,0.82)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {team}
                  <span style={{ color: RED, fontSize: 8 }}>●</span>
                </span>
              ))}
            </div>
          </div>
          <div
            style={{
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              background: `linear-gradient(180deg, ${RED} 0%, #8f0b21 100%)`,
              borderRadius: 9,
              padding: "7px 14px",
              boxShadow: `0 4px 12px ${RED}55`,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 900,
                color: "#fff",
                letterSpacing: "0.04em",
                whiteSpace: "nowrap",
              }}
            >
              Predict
            </span>
          </div>
        </div>
      ) : (
        <div style={{ height: 12 }} />
      )}
    </div>
  );
}
