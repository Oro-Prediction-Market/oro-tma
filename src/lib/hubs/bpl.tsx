// Moved verbatim from src/pages/BplHubPage.tsx so the feed, detail pages
// and other hubs can use these without loading that page.
import { useState } from "react";
import { type Market } from "@shared/api/client";
import { isWCMarket } from "@/lib/hubs/worldCup";

// 2026 season clubs — used for market detection and as the banner fallback strip
export const BPL_CLUBS = [
  { name: "Paro FC", short: "Paro FC" },
  { name: "Thimphu City FC", short: "Thimphu City FC" },
  { name: "Transport United FC", short: "Transport Utd" },
  { name: "Drukpa FC", short: "Drukpa FC" },
  { name: "RTC FC", short: "RTC FC" },
  { name: "Tensung FC", short: "Tensung FC" },
  { name: "Thimphu FC", short: "Thimphu FC" },
  { name: "Tsirang FC", short: "Tsirang FC" },
  { name: "Ugyen Academy FC", short: "Ugyen Academy" },
  { name: "BFF Academy U20", short: "BFF Academy" },
];

export const CLUB_KEYWORDS = [
  "drukpa", "paro fc", "transport utd", "transport united", "rtc fc",
  "tsirang", "tensung", "ugyen academy", "bff academy",
  "thimphu city", "thimphu fc",
];

// Bhutanese clubs (and the national team) also play international/continental
// fixtures — those are NOT the domestic Bhutan Premier League. When the title
// names one of these competitions, skip the loose club-name fallback so the
// market stays in the main feed instead of being filed under /bpl.
export const NON_BPL_COMPETITIONS = [
  "afc challenge league", "afc champions league", "afc cup", "afc club",
  "asian cup", "saff", "world cup", "qualifier", "friendly",
];

// BPL hub is retired/hidden — neutralize the classifier so BPL-type markets
// fall back into the main feed instead of a removed hub. Flip to false (and
// uncomment the /bpl route in routes.tsx / PwaApp.tsx) to bring BPL back.
export const BPL_HIDDEN: boolean = true;

export function isBplMarket(m: Market): boolean {
  if (BPL_HIDDEN) return false;
  if (m.category === "political") return false;
  // A market filed under Gaming belongs to /esports, even if it still carries a
  // leftover BPL settlement URL from the admin form's sports presets
  if (m.category === "gaming") return false;
  if (isWCMarket(m)) return false;
  // covers bpl-match / bpl-winner / bpl-topscorer and legacy "Premier League (BPL)"
  if (m.subcategory?.toLowerCase().includes("bpl")) return true;
  if ((m.settlementSource ?? "").toLowerCase().includes("bhutanfootball"))
    return true;
  const title = m.title.toLowerCase();
  if (title.includes("bhutan premier league")) return true;
  // Non-BPL competition named in the title → not a BPL market (the strong BPL
  // signals above already returned true, so genuine BPL rows are unaffected).
  if (NON_BPL_COMPETITIONS.some((c) => title.includes(c))) return false;
  return CLUB_KEYWORDS.some((k) => title.includes(k));
}

// Strips whitespace including zero-width chars that String.trim() misses.
export function isDrawOutcome(label: string): boolean {
  const normalized = (label ?? "").replace(/[\s\u200b\u200c\u200d\ufeff]/g, "").toLowerCase();
  return normalized === "draw" || normalized === "tie";
}

// Crest priority: per-outcome imageUrl (set in the admin form), then the
// market-level images (imageUrl = first outcome, imageUrlAlt = second).
// Skips Draw outcomes so index 0/1 always refer to the two playing teams.
export function getBplCrest(market: Market, teamIdx: number): string | null {
  const teamOutcomes = (market.outcomes ?? []).filter(
    (o) => !isDrawOutcome(o.label ?? ""),
  );
  const outcome = teamOutcomes[teamIdx];
  if (outcome?.imageUrl) return outcome.imageUrl;
  if (teamIdx === 0) return market.imageUrl;
  if (teamIdx === 1) return market.imageUrlAlt;
  return null;
}

export function shortClubName(label: string): string {
  const known = BPL_CLUBS.find(
    (c) => c.name.toLowerCase() === label.toLowerCase().trim(),
  );
  if (known) return known.short;
  return label
    .replace(/\bfc\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function Crest({
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
        background: "linear-gradient(135deg, #29abe2 0%, #1e3a8a 100%)",
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
