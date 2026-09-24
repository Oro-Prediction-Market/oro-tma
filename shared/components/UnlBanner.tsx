import React from "react";

/**
 * Feed entry point for the Nations League hub.
 *
 * Built entirely from CSS, unlike the UCL and EPL banners, which sit on a
 * licensed poster image. There is no Nations League artwork in the app, and a
 * banner that renders a missing file is worse than one that never needed it.
 *
 * The four colour bands are the competition's own structure rather than
 * decoration: League A down to League D, which is what the groups are actually
 * organised into. The same four colours label the group headings on the hub.
 */

const NAVY = "#050f1f";
const PANEL = "#0a1a33";
const TEAL = "#19c4a6";
const TEAL_DIM = "#0d6b5c";

/** League A → D. Also used by the hub's group headings. */
const TIERS = [
  { key: "A", label: "League A", color: "#e8c766" },
  { key: "B", label: "League B", color: "#c0c9d8" },
  { key: "C", label: "League C", color: "#cd8b52" },
  { key: "D", label: "League D", color: "#7d8aa0" },
];

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
        background: `radial-gradient(120% 90% at 50% 0%, ${PANEL} 0%, ${NAVY} 62%)`,
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
        /* The map arcs are pure decoration; anyone who would rather not have
           things moving on screen gets a still banner. */
        @media (prefers-reduced-motion: reduce) {
          .unlb * { animation: none !important; }
        }
      `}</style>

      {/* Faint arc field — suggests a continental map without claiming to be one. */}
      <svg
        aria-hidden
        viewBox="0 0 400 320"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.5 }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <circle
            key={i}
            cx={200}
            cy={150}
            r={46 + i * 38}
            fill="none"
            stroke={TEAL}
            strokeOpacity={0.14 - i * 0.02}
            strokeWidth={1}
          />
        ))}
        <path
          d="M40 250 Q 200 120 360 250"
          fill="none"
          stroke={TEAL}
          strokeOpacity={0.18}
          strokeWidth={1.2}
        />
      </svg>

      {/* ── Top: edition pill ── */}
      <div style={{ position: "relative", zIndex: 1, padding: "12px 12px 0" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            background: "rgba(5,15,31,0.6)",
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

      {/* ── Middle: the wordmark ── */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding: "0 16px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: "clamp(26px, 7vw, 40px)",
            fontWeight: 900,
            lineHeight: 1.02,
            letterSpacing: "-0.02em",
            color: "#fff",
            textShadow: "0 4px 18px rgba(0,0,0,0.6)",
          }}
        >
          Nations
          <br />
          League
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "rgba(203,233,226,0.72)",
          }}
        >
          54 nations · 14 groups
        </div>

        {/* League tiers — the competition's actual structure, not a flourish. */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 6,
            marginTop: 12,
          }}
        >
          {TIERS.map((t) => (
            <span
              key={t.key}
              style={{
                width: 34,
                height: 3,
                borderRadius: 2,
                background: t.color,
                opacity: 0.85,
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Footer: nation marquee + CTA ── */}
      {showCta ? (
        <div
          style={{
            position: "relative",
            zIndex: 1,
            background: "rgba(5,15,31,0.5)",
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
                background: "linear-gradient(to right, rgba(5,15,31,0.65), transparent)",
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
                    color: "rgba(203,233,226,0.78)",
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
