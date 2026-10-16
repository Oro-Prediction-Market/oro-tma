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
        background: `linear-gradient(135deg, ${NBA_BLUE} 0%, ${NBA_RED} 100%)`,
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
