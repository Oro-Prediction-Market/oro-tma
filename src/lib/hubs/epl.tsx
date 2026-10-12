// Moved verbatim from src/pages/EplHubPage.tsx so the feed, detail pages
// and other hubs can use these without loading that page.
import { useState } from "react";
import { type Market } from "@shared/api/client";
import { isWCMarket } from "@/lib/hubs/worldCup";
import { isBplMarket, isDrawOutcome } from "@/lib/hubs/bpl";

// 2026-27 season clubs — update after each season's promotions/relegations.
// `name` matches football-data.org naming; `keys` are lowercase title-match tokens;
// `crest` is football-data.org's public crest CDN (no auth needed to load the image).
export const EPL_CLUBS = [
  { name: "AFC Bournemouth", short: "Bournemouth", crest: "https://crests.football-data.org/1044.png", keys: ["bournemouth"] },
  { name: "Arsenal FC", short: "Arsenal", crest: "https://crests.football-data.org/57.png", keys: ["arsenal"] },
  { name: "Aston Villa FC", short: "Aston Villa", crest: "https://crests.football-data.org/58.png", keys: ["aston villa"] },
  { name: "Brentford FC", short: "Brentford", crest: "https://crests.football-data.org/402.png", keys: ["brentford"] },
  { name: "Brighton & Hove Albion FC", short: "Brighton", crest: "https://crests.football-data.org/397.png", keys: ["brighton"] },
  { name: "Chelsea FC", short: "Chelsea", crest: "https://crests.football-data.org/61.png", keys: ["chelsea"] },
  { name: "Coventry City FC", short: "Coventry", crest: "https://crests.football-data.org/1076.png", keys: ["coventry"] },
  { name: "Crystal Palace FC", short: "Palace", crest: "https://crests.football-data.org/354.png", keys: ["crystal palace"] },
  { name: "Everton FC", short: "Everton", crest: "https://crests.football-data.org/62.png", keys: ["everton"] },
  { name: "Fulham FC", short: "Fulham", crest: "https://crests.football-data.org/63.png", keys: ["fulham"] },
  { name: "Hull City AFC", short: "Hull", crest: "https://crests.football-data.org/322.png", keys: ["hull city", "hull"] },
  { name: "Ipswich Town FC", short: "Ipswich Town", crest: "https://crests.football-data.org/349.png", keys: ["ipswich"] },
  { name: "Leeds United FC", short: "Leeds", crest: "https://crests.football-data.org/341.png", keys: ["leeds"] },
  { name: "Liverpool FC", short: "Liverpool", crest: "https://crests.football-data.org/64.png", keys: ["liverpool"] },
  { name: "Manchester City FC", short: "Man City", crest: "https://crests.football-data.org/65.png", keys: ["manchester city", "man city"] },
  { name: "Manchester United FC", short: "Man United", crest: "https://crests.football-data.org/66.png", keys: ["manchester united", "man united", "man utd"] },
  { name: "Newcastle United FC", short: "Newcastle", crest: "https://crests.football-data.org/67.png", keys: ["newcastle"] },
  { name: "Nottingham Forest FC", short: "Nottm Forest", crest: "https://crests.football-data.org/351.png", keys: ["nottingham forest"] },
  { name: "Sunderland AFC", short: "Sunderland", crest: "https://crests.football-data.org/71.png", keys: ["sunderland"] },
  { name: "Tottenham Hotspur FC", short: "Spurs", crest: "https://crests.football-data.org/73.png", keys: ["tottenham"] },
];

// Competitions that share clubs with the EPL — never claim a market tagged to
// one of these, even if an EPL club is named (e.g. a Champions League tie).
export const OTHER_COMPETITIONS = [
  "champions league", "europa", "fa cup", "efl", "carabao",
  "bundesliga", "serie a", "la liga", "ligue 1", "world cup",
];

export function isEplMarket(m: Market): boolean {
  if (m.category === "political") return false;
  if (m.category === "gaming") return false; // Gaming markets live in /esports
  if (isWCMarket(m)) return false;
  // BPL owns "Bhutan Premier League" titles, bpl-* subcategories and local clubs
  if (isBplMarket(m)) return false;
  const sub = (m.subcategory ?? "").toLowerCase();
  const cat = (m.category ?? "").toLowerCase();
  const title = m.title.toLowerCase();
  // Reject anything belonging to another competition (checked in title OR category)
  if (OTHER_COMPETITIONS.some((c) => cat.includes(c) || title.includes(c)))
    return false;
  // Only recognise markets EXPLICITLY tagged EPL: an epl-* subcategory from the
  // admin form, or the "Premier League" category set by the fixtures import.
  // Loose club-name title matching was removed — it swept in old/settled markets
  // like "Who Will Lift Premier League Trophy" and Champions League ties.
  if (sub.includes("epl")) return true;
  if (cat.includes("premier league")) return true;
  return false;
}

// Crest priority: per-outcome imageUrl (set in the admin form), then the
// market-level images (imageUrl = first outcome, imageUrlAlt = second).
// Skips Draw outcomes so index 0/1 always refer to the two playing teams.
export function getEplCrest(market: Market, teamIdx: number): string | null {
  const teamOutcomes = (market.outcomes ?? []).filter(
    (o) => !isDrawOutcome(o.label ?? ""),
  );
  const outcome = teamOutcomes[teamIdx];
  if (outcome?.imageUrl) return outcome.imageUrl;
  if (teamIdx === 0) return market.imageUrl;
  if (teamIdx === 1) return market.imageUrlAlt;
  return null;
}

export function shortEplName(label: string): string {
  const t = label.toLowerCase().trim();
  const known = EPL_CLUBS.find(
    (c) => c.name.toLowerCase() === t || c.keys.some((k) => t.includes(k)),
  );
  if (known) return known.short;
  return label
    .replace(/\b(fc|afc)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function EplCrest({
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
        background: "linear-gradient(135deg, #963cff 0%, #38003c 100%)",
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
