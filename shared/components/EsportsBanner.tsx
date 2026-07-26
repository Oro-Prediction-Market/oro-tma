import React from "react";
import {
  Swords,
  Crosshair,
  Skull,
  Castle,
  Flame,
  Flag,
  Spade,
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
  { label: "PUBG", Icon: Target },
  { label: "MLBB", Icon: Sword },
  { label: "MOBA", Icon: Swords },
  { label: "FPS", Icon: Crosshair },
];
const RIGHT_DISCIPLINES = [
  { label: "Battle Royale", Icon: Skull },
  { label: "Strategy", Icon: Castle },
  { label: "Fighting", Icon: Flame },
  { label: "Racing", Icon: Flag },
];
const ALL_DISCIPLINES = [
  ...LEFT_DISCIPLINES,
  ...RIGHT_DISCIPLINES,
  { label: "Card Games", Icon: Spade },
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
  const seg = (
    key: string,
    css: React.CSSProperties,
  ): React.ReactElement => (
    <div
      key={key}
      style={{ position: "absolute", background: BORDER, ...css }}
    />
  );

  const rail = (
    <div style={{ position: "relative", width: 28, flexShrink: 0 }}>
      {/* stub off each tile */}
      {[12.5, 37.5, 62.5, 87.5].map((top) =>
        seg(`s${top}`, { [inner]: 0, top: `${top}%`, width: 9, height: 1 }),
      )}
      {/* pair them into two semis */}
      {[
        [12.5, 37.5],
        [62.5, 87.5],
      ].map(([a, b]) =>
        seg(`v${a}`, { [inner]: 9, top: `${a}%`, height: `${b - a}%`, width: 1 }),
      )}
      {[25, 75].map((top) =>
        seg(`m${top}`, { [inner]: 9, top: `${top}%`, width: 9, height: 1 }),
      )}
      {/* semis into the final, last leg in gold */}
      {seg("final", { [inner]: 18, top: "25%", height: "50%", width: 1 })}
      {seg("gold", {
        [inner]: 18,
        top: "50%",
        width: 10,
        height: 1,
        background: GOLD,
      })}
      <div
        style={{
          position: "absolute",
          [inner]: 16,
          top: "50%",
          transform: "translateY(-50%)",
          width: 5,
          height: 5,
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
          style={{ display: "flex", alignItems: "center", padding: "3px 0" }}
        >
          <div style={{ width: "100%" }}>
            <NotchTile padding="8px 9px">
              <div
                title={label}
                aria-label={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon size={16} color={GOLD_BRIGHT} />
              </div>
            </NotchTile>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div
      className="ewc-banner-side"
      style={{
        display: "flex",
        alignItems: "stretch",
        width: 82,
        flexShrink: 0,
      }}
    >
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
      className={className}
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
        minHeight: 320,
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
        .ewc-banner-ficon { padding: 0 4px; }
        @media (max-width: 599px) {
          .ewc-banner-side { display: none !important; }
          /* Reclaim room so "Play now" stays whole on a phone */
          .ewc-banner-ficon { padding: 0 2px; }
          .ewc-banner-divider { display: none; }
        }
      `}</style>

      <CornerMark v="top" h="left" />
      <CornerMark v="top" h="right" />
      <CornerMark v="bottom" h="left" />
      <CornerMark v="bottom" h="right" />

      <div
        style={{
          position: "relative",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "16px 18px 12px",
          gap: 10,
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
            <TrophyStage />
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            {ALL_DISCIPLINES.map(({ label, Icon }, i) => (
              <React.Fragment key={label}>
                {i > 0 && (
                  <span
                    className="ewc-banner-divider"
                    style={{
                      width: 1,
                      height: 13,
                      background: BORDER,
                      flexShrink: 0,
                    }}
                  />
                )}
                <span
                  className="ewc-banner-ficon"
                  title={label}
                  aria-label={label}
                  style={{ display: "inline-flex", flexShrink: 0 }}
                >
                  <Icon size={15} color={GOLD_BRIGHT} />
                </span>
              </React.Fragment>
            ))}
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
