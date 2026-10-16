import { useState } from "react";
import type { Market } from "@shared/api/client";

/**
 * NBA hub helpers, kept out of the hub page so the feed can use them without
 * loading it.
 *
 * Every NBA market the backend makes is subcategory `nba-*` and source
 * `espn-nba`; there is no title fallback, because "vs" titles are everywhere.
 */
export function isNbaMarket(m: Market): boolean {
  const sub = (m.subcategory ?? "").toLowerCase();
  if (sub.startsWith("nba-")) return true;
  return (m.externalSource ?? "").toLowerCase() === "espn-nba";
}

/** The ESPN game a market was made for, from its metadata. */
export function nbaGameIdOf(m: Market): string | null {
  const raw = (m.metadata as Record<string, unknown> | null)?.espnGameId;
  return typeof raw === "string" && raw ? raw : null;
}

export const NBA_BLUE = "#1d428a";
export const NBA_RED = "#c8102e";

/**
 * The court banner's palette (shared/components/NbaBanner.css), so the hub and
 * the market detail read as the same place as the banner that leads to them:
 * a night-navy arena, amber from the Predict button, teal from the painted key.
 */
export const NBA_THEME = {
  ink: "#080f1a",
  card: "#101722",
  panel: "#111b28",
  line: "rgba(255,255,255,0.09)",
  amber: "#ffb66d",
  amberHot: "#ffa34d",
  amberSoft: "#ffca8e",
  /** Text on an amber fill, as on the banner's CTA. */
  onAmber: "#17120c",
  teal: "#5fb3c9",
  tealDeep: "#18394a",
  muted: "#c1c9d3",
  live: "#ff4d5e",
  display: 'Impact, "Arial Black", system-ui, sans-serif',
} as const;

/** A team logo, falling back to the abbreviation when the image fails. */
export function NbaLogo({
  src,
  abbr,
  size,
}: {
  src: string | null | undefined;
  abbr: string;
  size: number;
}) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <img
        src={src}
        alt={abbr}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        background: `linear-gradient(135deg, ${NBA_THEME.tealDeep} 0%, ${NBA_THEME.amberHot} 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.max(8, size * 0.3),
        fontWeight: 900,
        color: "#fff",
      }}
    >
      {abbr.slice(0, 3).toUpperCase()}
    </div>
  );
}
