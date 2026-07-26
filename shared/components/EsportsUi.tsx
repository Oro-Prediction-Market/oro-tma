import React from "react";

/**
 * Esports design tokens + primitives, shared by the feed banner and the
 * /esports hub so the two can't drift. Values are lifted from
 * esportsworldcup.com's stylesheet (surfaces, gold ramp, button gradients).
 */
export const EWC = {
  bg: "#0f0e0b",
  panel: "#12110d",
  surface: "#16150f",
  sheet: "#1a1813",
  control: "#221f18",
  border: "#3a3a3a",
  goldLine: "rgba(190,158,89,0.45)",
  glass: "rgba(255,255,255,0.05)",
  text: "#ffffff",
  textSecondary: "#9a9a9a",
  textMuted: "#6e6e6e",
  gold: "#be9e59",
  goldBright: "#f2c575",
  goldDeep: "#987c4b",
  green: "#00b868",
  greenBright: "#33c984",
  danger: "#e5484d",
  // --gradient-primary-button and its hover state
  goldButton:
    "radial-gradient(122.78% 179% at 50.21% 0%, #f2c575 0%, #987c4b 40.5%, #4e442d 92.88%)",
  goldButtonHover:
    "radial-gradient(122.78% 179% at 50.21% 0%, #f4ce8a 0%, #ab8b54 40.5%, #615538 92.88%)",
  greenButton: "linear-gradient(#00b868, #00b868)",
  greenButtonHover: "linear-gradient(#009656, #009656)",
  // --letter-spacing-primary-tiny / -small
  trackTiny: "0.12em",
  trackSmall: "0.06em",
} as const;

/** Angular panel shape — corners cut top-left and bottom-right. */
export const notch = (r = 9) =>
  `polygon(${r}px 0, 100% 0, 100% calc(100% - ${r}px), calc(100% - ${r}px) 100%, 0 100%, 0 ${r}px)`;

export const NOTCH = notch();

/**
 * Notched panel with a 1px keyline. `accent` swaps the keyline and fill for the
 * gold button gradient, which is how selected chips and CTAs are drawn.
 */
export function NotchTile({
  children,
  padding = "8px 10px",
  radius = 9,
  accent = false,
  fill,
  line,
  className,
  style,
  onClick,
  title,
}: {
  children: React.ReactNode;
  padding?: string;
  radius?: number;
  accent?: boolean;
  fill?: string;
  line?: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
}) {
  const clip = notch(radius);
  return (
    <div
      className={className}
      title={title}
      onClick={onClick}
      style={{
        background: line ?? (accent ? EWC.goldBright : EWC.goldLine),
        clipPath: clip,
        padding: 1,
        ...style,
      }}
    >
      <div
        style={{
          background:
            fill ??
            (accent
              ? EWC.goldButton
              : `linear-gradient(180deg, ${EWC.panel} 0%, #0c0b08 100%)`),
          clipPath: clip,
          padding,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Gold L-mark used to frame a panel like a HUD. */
export function CornerMark({
  v,
  h,
  size = 22,
  inset = 9,
  opacity = 0.6,
}: {
  v: "top" | "bottom";
  h: "left" | "right";
  size?: number;
  inset?: number;
  opacity?: number;
}) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        [v]: inset,
        [h]: inset,
        width: size,
        height: size,
        [v === "top" ? "borderTop" : "borderBottom"]: `2px solid ${EWC.gold}`,
        [h === "left" ? "borderLeft" : "borderRight"]: `2px solid ${EWC.gold}`,
        opacity,
        pointerEvents: "none",
      }}
    />
  );
}

/** The trophy cut out of esports.png, on its soft stage bloom. */
export function TrophyStage({
  height = "clamp(104px, 21vw, 156px)",
  showFloor = true,
}: {
  height?: string;
  showFloor?: boolean;
}) {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <svg
        viewBox="0 0 240 150"
        preserveAspectRatio="none"
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <defs>
          <radialGradient id="ewcBloom" cx="0.5" cy="0.48" r="0.5">
            <stop offset="0%" stopColor="#f2c575" stopOpacity="0.26" />
            <stop offset="55%" stopColor="#be9e59" stopOpacity="0.09" />
            <stop offset="100%" stopColor="#be9e59" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="ewcFloorLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#8a6a12" stopOpacity="0" />
            <stop offset="50%" stopColor="#f2c575" />
            <stop offset="100%" stopColor="#8a6a12" stopOpacity="0" />
          </linearGradient>
        </defs>
        <ellipse cx="120" cy="72" rx="104" ry="72" fill="url(#ewcBloom)" />
        {showFloor && (
          <path
            d="M10 143 H230"
            stroke="url(#ewcFloorLine)"
            strokeWidth="1.4"
            opacity="0.75"
          />
        )}
      </svg>
      <img
        src="/esports-trophy.webp"
        alt="Esports World Cup trophy"
        loading="lazy"
        decoding="async"
        style={{
          position: "relative",
          height,
          width: "auto",
          maxWidth: "100%",
          objectFit: "contain",
          filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.55))",
        }}
      />
    </div>
  );
}
