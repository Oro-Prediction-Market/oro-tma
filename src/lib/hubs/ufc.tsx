// Moved verbatim from src/pages/UfcHubPage.tsx so the feed, detail pages
// and other hubs can use these without loading that page.
import { useState } from "react";
import { type Market } from "@shared/api/client";
import { isWCMarket } from "@/lib/hubs/worldCup";
import { isDrawOutcome } from "@/lib/hubs/bpl";

export function isUfcMarket(m: Market): boolean {
  if (m.category === "political") return false;
  if (m.category === "gaming") return false; // Gaming markets live in /esports
  if (isWCMarket(m)) return false;
  const sub = (m.subcategory ?? "").toLowerCase();
  // covers ufc-fight / ufc-event / mma tags set in the admin form
  if (sub.includes("ufc") || sub.includes("mma")) return true;
  if ((m.settlementSource ?? "").toLowerCase().includes("ufc")) return true;
  const title = m.title.toLowerCase();
  return /\bufc\b/.test(title) || title.includes("octagon");
}

// Avatar priority: per-outcome imageUrl (set in the admin form), then the
// market-level images (imageUrl = first outcome, imageUrlAlt = second).
export function getUfcAvatar(market: Market, fighterIdx: number): string | null {
  const fighterOutcomes = (market.outcomes ?? []).filter(
    (o) => !isDrawOutcome(o.label ?? ""),
  );
  const outcome = fighterOutcomes[fighterIdx];
  if (outcome?.imageUrl) return outcome.imageUrl;
  if (fighterIdx === 0) return market.imageUrl;
  if (fighterIdx === 1) return market.imageUrlAlt;
  return null;
}

// "Jon Jones" → "Jones"; single-word names pass through unchanged
export function shortFighterName(label: string): string {
  const parts = label.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : label.trim();
}

export function FighterAvatar({
  src,
  label,
  size,
}: {
  src: string | null;
  label: string;
  size: number;
}) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <img
        src={src}
        alt={label}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, background: "rgba(255,255,255,0.06)" }}
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
        background: "linear-gradient(135deg, #d20a0a 0%, #450a0a 100%)",
        border: "1.5px solid rgba(255,255,255,0.15)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.4,
        fontWeight: 900,
        color: "#fff",
      }}
    >
      {label.trim().charAt(0).toUpperCase()}
    </div>
  );
}
