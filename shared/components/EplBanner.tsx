import React from "react";

// 2026-27 season clubs for the ticker
const TICKER_CLUBS = [
  { name: "Fulham", crest: "https://crests.football-data.org/63.png" },
  { name: "Hull", crest: "https://crests.football-data.org/322.png" },
  { name: "Ipswich Town", crest: "https://crests.football-data.org/349.png" },
  { name: "Leeds", crest: "https://crests.football-data.org/341.png" },
  { name: "Liverpool", crest: "https://crests.football-data.org/64.png" },
  { name: "Man United", crest: "https://crests.football-data.org/66.png" },
  { name: "Man City", crest: "https://crests.football-data.org/65.png" },
  { name: "Arsenal", crest: "https://crests.football-data.org/57.png" },
  { name: "Aston Villa", crest: "https://crests.football-data.org/58.png" },
  { name: "Chelsea", crest: "https://crests.football-data.org/61.png" },
  { name: "Tottenham", crest: "https://crests.football-data.org/73.png" },
  { name: "Newcastle", crest: "https://crests.football-data.org/67.png" },
  { name: "Bournemouth", crest: "https://crests.football-data.org/1044.png" },
  { name: "Brentford", crest: "https://crests.football-data.org/402.png" },
  { name: "Brighton", crest: "https://crests.football-data.org/397.png" },
  { name: "Crystal Palace", crest: "https://crests.football-data.org/354.png" },
  { name: "Everton", crest: "https://crests.football-data.org/62.png" },
  { name: "Nottm Forest", crest: "https://crests.football-data.org/351.png" },
  { name: "Sunderland", crest: "https://crests.football-data.org/71.png" },
  { name: "Coventry", crest: "https://crests.football-data.org/1076.png" },
];

interface EplBannerProps {
  onClick?: () => void;
  showCta?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export function EplBanner({ onClick, showCta = true, style, className }: EplBannerProps) {
  // Triple the clubs array to make marquee seamless
  const duplicatedClubs = [...TICKER_CLUBS, ...TICKER_CLUBS, ...TICKER_CLUBS];

  return (
    <div
      className={className}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      style={{
        borderRadius: 16,
        overflow: "hidden",
        position: "relative",
        backgroundImage: "url('/epl.png')",
        backgroundSize: "cover",
        backgroundPosition: "12% 68%",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: 320,
        height: "100%",
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
        outline: "none",
        ...style,
      }}
    >
      {/* Scope CSS animations and marquee layout */}
      <style>{`
        @keyframes eplOverlayPulseGlow {
          0%, 100% { opacity: 0.8; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes eplMarqueeScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.33%); }
        }
        .epl-marquee-container {
          display: flex;
          width: max-content;
          animation: eplMarqueeScroll 40s linear infinite;
        }
        .epl-marquee-container:hover {
          animation-play-state: paused;
        }
        @media (max-width: 500px) {
          .epl-season-pill-overlay {
            top: 14px !important;
            left: 14px !important;
            padding: 4px 10px !important;
          }
        }
      `}</style>

      {/* Top section: Season Pill Overlay */}
      <div style={{ padding: "8px 24px 0", pointerEvents: "none", position: "relative", zIndex: 1 }}>
        {/* Dynamic Season Pill covering the static one under it */}
        <div
          className="epl-season-pill-overlay"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(9, 3, 28, 0.85)", 
            border: "1.2px solid #00ff85",
            borderRadius: 20,
            padding: "5px 14px",
            boxShadow: "0 2px 12px rgba(0, 255, 133, 0.25)",
            backdropFilter: "blur(4px)",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#00ff85",
              boxShadow: "0 0 8px #00ff85",
              animation: "eplOverlayPulseGlow 2s ease-in-out infinite",
            }}
          />
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              color: "#00ff85",
              letterSpacing: "0.14em",
              fontFamily: "var(--font-display, system-ui, sans-serif)",
            }}
          >
            2026/27 SEASON
          </span>
        </div>
      </div>

      {/* Bottom Bar: Ticker & CTA Button */}
      {showCta && (
        <div
          style={{
            background: "rgba(6, 2, 20, 0.82)", // Deep translucent color matching banner footer
            backdropFilter: "blur(6px)",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            height: 54,
            position: "relative",
            zIndex: 4,
          }}
        >
          {/* Ticker marquee */}
          <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
            {/* Fade out shadows on sides */}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: 24,
                background: "linear-gradient(to right, rgba(6, 2, 20, 0.95), transparent)",
                zIndex: 5,
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                bottom: 0,
                width: 24,
                background: "linear-gradient(to left, rgba(6, 2, 20, 0.95), transparent)",
                zIndex: 5,
                pointerEvents: "none",
              }}
            />

            <div className="epl-marquee-container">
              {duplicatedClubs.map((club, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "0 14px",
                    whiteSpace: "nowrap",
                  }}
                >
                  <img
                    src={club.crest}
                    alt=""
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                    style={{
                      width: 18,
                      height: 18,
                      objectFit: "contain",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: "rgba(255, 255, 255, 0.85)",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      fontFamily: "system-ui, sans-serif",
                    }}
                  >
                    {club.name}
                  </span>
                  <span
                    style={{
                      color: "#00ff85",
                      fontSize: 10,
                      marginLeft: 6,
                    }}
                  >
                    •
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Vertical Divider */}
          <div
            style={{
              height: "100%",
              width: 1,
              background: "rgba(255, 255, 255, 0.1)",
            }}
          />

          {/* Click Here button */}
          <button
            style={{
              height: "100%",
              background: "rgba(0, 255, 133, 0.04)",
              border: "none",
              padding: "0 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "background 0.2s ease",
              outline: "none",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(0, 255, 133, 0.1)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(0, 255, 133, 0.04)";
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "#00ff85",
                whiteSpace: "nowrap",
                letterSpacing: "0.02em",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              Click Here »
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
