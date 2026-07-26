import React from "react";

// The "ESPORTS / WORLD CUP" display lockup: heavy blocky caps with a red→gold
// ramp, a top-lit vertical shade, a dark keyline and a solid extrude under the
// glyphs. All offsets are in `em` so the treatment scales with the font size.
const RAMP =
  "linear-gradient(96deg, #ff3600 -8%, #ffa23a 26%, #e8c47a 52%, #d1b26e 74%, #b8974f 100%)";
const SHADE =
  "linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.05) 38%, rgba(0,0,0,0.30) 100%)";
const DISPLAY_FONT =
  '"Arial Black", "Arial Bold", "Helvetica Neue", Impact, system-ui, sans-serif';
const GOLD = "#be9e59";

interface EsportsWordmarkProps {
  /** Font size of the ESPORTS line — any CSS length, clamp() included. */
  size?: string;
  /** Font size of the WORLD CUP line. */
  subSize?: string;
  /** Hide the WORLD CUP line when the lockup needs to sit tight. */
  showSub?: boolean;
  /** Heading level, so each page can keep a sane document outline. */
  as?: "h1" | "h2" | "div";
  style?: React.CSSProperties;
}

export function EsportsWordmark({
  size = "clamp(32px, 8.5vw, 52px)",
  subSize = "clamp(11px, 3.2vw, 16px)",
  showSub = true,
  as = "div",
  style,
}: EsportsWordmarkProps) {
  const Tag = as;
  return (
    <div style={{ display: "inline-block", textAlign: "center", ...style }}>
      <Tag
        style={{
          position: "relative",
          display: "inline-block",
          margin: 0,
          fontFamily: DISPLAY_FONT,
          fontSize: size,
          fontWeight: 900,
          lineHeight: 0.92,
          textTransform: "uppercase",
          letterSpacing: "-0.005em",
          // solid extrude + a soft gold cast, both proportional to the type
          filter:
            "drop-shadow(0 0.06em 0 #2a1c05) drop-shadow(0 0.16em 0.34em rgba(190,158,89,0.28))",
        }}
      >
        {/* Depth layer — decorative, so it stays out of the accessibility tree */}
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            color: "#0d0a04",
            transform: "translate(0.05em, 0.08em)",
          }}
        >
          Esports
        </span>
        <span
          style={{
            position: "relative",
            backgroundImage: `${SHADE}, ${RAMP}`,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            WebkitTextStroke: "0.025em rgba(0,0,0,0.6)",
          }}
        >
          Esports
        </span>
      </Tag>

      {showSub && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.7em",
            marginTop: "0.45em",
            fontSize: subSize,
          }}
        >
          <span
            style={{
              width: "1.6em",
              height: 2,
              background: GOLD,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: DISPLAY_FONT,
              fontWeight: 900,
              fontSize: "1em",
              color: "#ffffff",
              textTransform: "uppercase",
              letterSpacing: "0.3em",
              textIndent: "0.3em",
              whiteSpace: "nowrap",
            }}
          >
            World Cup
          </span>
          <span
            style={{
              width: "1.6em",
              height: 2,
              background: GOLD,
              flexShrink: 0,
            }}
          />
        </div>
      )}
    </div>
  );
}
