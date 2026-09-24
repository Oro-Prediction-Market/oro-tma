import React from "react";

/**
 * Feed entry point for the Nations League hub.
 *
 * The poster carries the branding — wordmark, trophy and the competition's own
 * colour blocks — so everything drawn on top of it is deliberately minimal:
 * an edition pill, a nation marquee and the CTA. Same structure as the UCL and
 * EPL banners.
 *
 * `/unl-banner.webp` is the wide artwork, cropped to its own edges already.
 * The hub masthead uses the thin strip instead; the two are not
 * interchangeable, since the strip is 8.5:1 and would be unreadable here.
 */

const NAVY = "#0b1637";
const TEAL = "#19c4a6";
const TEAL_DIM = "#0d6b5c";

const NATIONS = [
  "France",
  "Spain",
  "Germany",
  "Portugal",
  "Italy",
  "Netherlands",
  "England",
  "Belgium",
  "Croatia",
  "Denmark",
  "Türkiye",
  "Norway",
];

interface UnlBannerProps {
  onClick?: () => void;
  showCta?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export function UnlBanner({
  onClick,
  showCta = true,
  style,
  className,
}: UnlBannerProps) {
  return (
    <div
      className={["unlb", className].filter(Boolean).join(" ")}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      style={{
        borderRadius: 16,
        overflow: "hidden",
        position: "relative",
        // The poster carries the branding; chrome sits on top of it.
        backgroundImage: "url('/unl-banner.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundColor: NAVY,
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
        .unlb { min-height: 320px; }
        @keyframes unlbMarquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes unlbPulse {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 0.35; }
        }
        @media (max-width: 599px) {
          .unlb { min-height: 260px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .unlb * { animation: none !important; }
        }
      `}</style>

      {/* Readability veil — the poster is darkest in the middle, so this only
          deepens the top and bottom where the chrome sits. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(8,17,44,0.55) 0%, rgba(8,17,44,0) 28%, rgba(8,17,44,0) 56%, rgba(8,17,44,0.85) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* ── Top: edition pill ── */}
      <div style={{ position: "relative", zIndex: 1, padding: "12px 12px 0" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            background: "rgba(8,17,44,0.6)",
            border: `1px solid ${TEAL}66`,
            borderRadius: 20,
            padding: "5px 12px",
            backdropFilter: "blur(2px)",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: TEAL,
              animation: "unlbPulse 1.8s ease-in-out infinite",
            }}
          />
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 900,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#cbe9e2",
              whiteSpace: "nowrap",
            }}
          >
            2026/27 Group Stage
          </span>
        </div>
      </div>

      {/* ── Footer: nation marquee + CTA ── */}
      {showCta ? (
        <div
          style={{
            position: "relative",
            zIndex: 1,
            background: "rgba(8,17,44,0.45)",
            borderTop: `1px solid ${TEAL}3d`,
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
                background: "linear-gradient(to right, rgba(8,17,44,0.65), transparent)",
                zIndex: 1,
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                display: "flex",
                width: "max-content",
                animation: "unlbMarquee 26s linear infinite",
              }}
            >
              {[...NATIONS, ...NATIONS].map((nation, i) => (
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
                    color: "rgba(203,233,226,0.82)",
                    whiteSpace: "nowrap",
                    textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                  }}
                >
                  {nation}
                  <span style={{ color: TEAL, fontSize: 8 }}>●</span>
                </span>
              ))}
            </div>
          </div>

          <div
            style={{
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              background: `linear-gradient(180deg, ${TEAL} 0%, ${TEAL_DIM} 100%)`,
              borderRadius: 9,
              padding: "7px 14px",
              boxShadow: `0 4px 12px ${TEAL}55`,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 900,
                color: "#04211c",
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
