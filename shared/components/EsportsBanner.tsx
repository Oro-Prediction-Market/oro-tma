import React from "react";
import {
  Swords,
  Crosshair,
  Skull,
  Castle,
  Flame,
  Crown,
  Trophy,
  Target,
  Sword,
} from "lucide-react";
import { EsportsWordmark } from "./EsportsWordmark";
import { EWC, NotchTile, CornerMark, TrophyStage } from "./EsportsUi";

// Local aliases onto the shared tokens (see EsportsUi) — keeps the JSX terse.
const BG = EWC.bg;
const SHEET = EWC.sheet;
const BORDER = EWC.border;
const GOLD_LINE = EWC.goldLine;
const GOLD = EWC.gold;
const GOLD_BRIGHT = EWC.goldBright;
const TRACK = EWC.trackTiny;

// Bracket arms carry four each — the hub's headline categories. The footer
// rail lists every discipline the hub buckets into.
const LEFT_DISCIPLINES = [
  { label: "MLBB", Icon: Sword },
  { label: "PUBG", Icon: Target },
  { label: "Dota 2", Icon: Swords },
  { label: "League of Legends", Icon: Crown },
];
const RIGHT_DISCIPLINES = [
  { label: "Call of Duty", Icon: Crosshair },
  { label: "EA FC Pro", Icon: Trophy },
  { label: "Street Fighter", Icon: Flame },
  { label: "Tekken 8", Icon: Skull },
];
const ALL_DISCIPLINES = [
  ...LEFT_DISCIPLINES,
  ...RIGHT_DISCIPLINES,
  { label: "Chess", Icon: Castle },
];

/**
 * One side of the bracket: four discipline tiles feeding 4 → 2 → 1 toward the
 * trophy. Tiles and connector rail share a 4-row grid, so the joints land at
 * 12.5 / 37.5 / 62.5 / 87.5% however tall the banner gets.
 */
function BracketSide({
  items,
  side,
}: {
  items: { label: string; Icon: typeof Swords }[];
  side: "left" | "right";
}) {
  const inner = side === "left" ? "left" : "right";
  const seg = (key: string, css: React.CSSProperties): React.ReactElement => (
    <div key={key} style={{ position: "absolute", background: BORDER, ...css }} />
  );
  // --stub / --mid / --leg come from .ewc-bracket-rail, which the media query
  // rewrites, so the whole bracket scales without duplicating the markup
  const joint = "calc(var(--stub) + var(--mid))";

  const rail = (
    <div className="ewc-bracket-rail" style={{ position: "relative", flexShrink: 0 }}>
      {/* stub off each tile */}
      {[12.5, 37.5, 62.5, 87.5].map((top) =>
        seg(`s${top}`, {
          [inner]: 0,
          top: `${top}%`,
          width: "var(--stub)",
          height: 1,
        }),
      )}
      {/* pair them into two semis */}
      {[
        [12.5, 37.5],
        [62.5, 87.5],
      ].map(([a, b]) =>
        seg(`v${a}`, {
          [inner]: "var(--stub)",
          top: `${a}%`,
          height: `${b - a}%`,
          width: 1,
        }),
      )}
      {[25, 75].map((top) =>
        seg(`m${top}`, {
          [inner]: "var(--stub)",
          top: `${top}%`,
          width: "var(--mid)",
          height: 1,
        }),
      )}
      {/* semis into the final, last leg in gold */}
      {seg("final", { [inner]: joint, top: "25%", height: "50%", width: 1 })}
      {seg("gold", {
        [inner]: joint,
        top: "50%",
        width: "var(--leg)",
        height: 1,
        background: GOLD,
      })}
      <div
        className="ewc-bracket-node"
        style={{
          position: "absolute",
          [inner]: `calc(${joint} - var(--node) / 2)`,
          top: "50%",
          transform: "translateY(-50%)",
          borderRadius: "50%",
          background: GOLD,
        }}
      />
    </div>
  );

  const column = (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: "grid",
        gridTemplateRows: "repeat(4, 1fr)",
      }}
    >
      {items.map(({ label, Icon }) => (
        <div
          key={label}
          className="ewc-bracket-cell"
          style={{ display: "flex", alignItems: "center" }}
        >
          <div style={{ width: "100%" }}>
            <NotchTile
              radius={7}
              className="ewc-bracket-tile"
              innerClassName="ewc-bracket-tile-inner"
            >
              <div
                title={label}
                aria-label={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon color={GOLD_BRIGHT} />
              </div>
            </NotchTile>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="ewc-bracket-side" style={{ display: "flex", alignItems: "stretch" }}>
      {side === "left" ? (
        <>
          {column}
          {rail}
        </>
      ) : (
        <>
          {rail}
          {column}
        </>
      )}
    </div>
  );
}

interface EsportsBannerProps {
  onClick?: () => void;
  showCta?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export function EsportsBanner({
  onClick,
  showCta = true,
  style,
  className,
}: EsportsBannerProps) {
  return (
    <div
      className={["ewc-banner", className].filter(Boolean).join(" ")}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      style={{
        borderRadius: 16,
        overflow: "hidden",
        position: "relative",
        background: BG,
        border: `1px solid ${BORDER}`,
        boxShadow: "0 12px 24px rgba(0,0,0,0.4)",
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
      {/* The side brackets need width; narrower than that, the footer rail
          carries all eight disciplines on its own */}
      <style>{`
        .ewc-banner { min-height: 320px; }
        @keyframes ewcMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes ewcSheen {
          0% { transform: translateX(-140%) skewX(-18deg); }
          55%, 100% { transform: translateX(360%) skewX(-18deg); }
        }
        .ewc-banner-body { padding: 16px 18px 12px; gap: 10px; }
        .ewc-bracket-side { width: 84px; flex-shrink: 0; }
        .ewc-bracket-rail { --stub: 9px; --mid: 9px; --leg: 10px; --node: 5px; width: 28px; }
        .ewc-bracket-node { width: var(--node); height: var(--node); }
        .ewc-bracket-cell { padding: 3px 0; }
        .ewc-bracket-tile-inner { padding: 8px 9px; }
        .ewc-bracket-tile svg { width: 16px; height: 16px; }
        .ewc-banner-ficon { padding: 0 4px; }
        /* Phones (incl. the Telegram mini app): keep the bracket, shrink it */
        @media (max-width: 599px) {
          .ewc-banner { min-height: 272px; }
          .ewc-banner-body { padding: 12px 10px 10px; gap: 7px; }
          .ewc-bracket-side { width: 52px; }
          .ewc-bracket-rail { --stub: 5px; --mid: 5px; --leg: 7px; --node: 4px; width: 18px; }
          .ewc-bracket-cell { padding: 2px 0; }
          .ewc-bracket-tile-inner { padding: 5px 3px; }
          .ewc-bracket-tile svg { width: 13px; height: 13px; }
          /* Reclaim room so "Play now" stays whole */
          .ewc-banner-ficon { padding: 0 2px; }
          .ewc-banner-divider { display: none; }
        }
      `}</style>

      <CornerMark v="top" h="left" />
      <CornerMark v="top" h="right" />
      <CornerMark v="bottom" h="left" />
      <CornerMark v="bottom" h="right" />

      {/* Slow diagonal light sheen — premium sweep across the obsidian */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: "30%",
          background:
            "linear-gradient(105deg, transparent 0%, rgba(242,197,117,0.10) 50%, transparent 100%)",
          animation: "ewcSheen 5s ease-in-out infinite",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div
        className="ewc-banner-body"
        style={{
          position: "relative",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Top tab */}
        <NotchTile padding="6px 16px">
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: TRACK,
              textTransform: "uppercase",
              color: GOLD_BRIGHT,
              whiteSpace: "nowrap",
            }}
          >
            Pick&#39;em <span style={{ color: GOLD }}>◆</span> Fantasy{" "}
            <span style={{ color: GOLD }}>◆</span> Quests
          </span>
        </NotchTile>

        {/* bracket · trophy + lockup · bracket */}
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            justifyContent: "center",
            gap: 6,
            width: "100%",
            flex: 1,
            minHeight: 0,
          }}
        >
          <BracketSide items={LEFT_DISCIPLINES} side="left" />

          <div
            style={{
              flex: 1,
              minWidth: 0,
              maxWidth: 320,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <TrophyStage height="clamp(80px, 19vw, 150px)" />
            <EsportsWordmark as="h2" showSub={false} style={{ marginTop: 2 }} />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                width: "100%",
                marginTop: 10,
              }}
            >
              <span
                style={{ flex: 1, maxWidth: 40, height: 1, background: BORDER }}
              />
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: TRACK,
                  textTransform: "uppercase",
                  color: GOLD,
                  whiteSpace: "nowrap",
                }}
              >
                Nothing is Granted
              </span>
              <span
                style={{ flex: 1, maxWidth: 40, height: 1, background: BORDER }}
              />
            </div>
          </div>

          <BracketSide items={RIGHT_DISCIPLINES} side="right" />
        </div>
      </div>

      {/* ── Discipline rail + PLAY NOW ── */}
      {showCta && (
        <div
          style={{
            position: "relative",
            background: SHEET,
            borderTop: `1px solid ${GOLD_LINE}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "9px 12px",
          }}
        >
          <div style={{ flex: 1, minWidth: 0, overflow: "hidden", position: "relative" }}>
            {/* Left fade so titles ease in from the edge */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: 22,
                background: `linear-gradient(to right, ${SHEET}, transparent)`,
                zIndex: 1,
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                display: "flex",
                width: "max-content",
                animation: "ewcMarquee 22s linear infinite",
              }}
            >
              {[...ALL_DISCIPLINES, ...ALL_DISCIPLINES].map(({ label, Icon }, i) => (
                <span
                  key={i}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "0 12px",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Icon size={14} color={GOLD_BRIGHT} />
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: TRACK,
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.72)",
                    }}
                  >
                    {label}
                  </span>
                  <span style={{ color: GOLD, fontSize: 8 }}>◆</span>
                </span>
              ))}
            </div>
          </div>

          <div style={{ flexShrink: 0 }}>
            <NotchTile padding="7px 14px">
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: TRACK,
                  textTransform: "uppercase",
                  color: GOLD_BRIGHT,
                  whiteSpace: "nowrap",
                }}
              >
                Play now »
              </span>
            </NotchTile>
          </div>
        </div>
      )}
    </div>
  );
}
