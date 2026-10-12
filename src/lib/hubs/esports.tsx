// Moved verbatim from src/pages/EsportsHubPage.tsx so the feed, detail pages
// and other hubs can use these without loading that page.
import { useState } from "react";
import { type Market, type Outcome } from "@shared/api/client";
import { Swords, Crosshair, Skull, Castle, Flame, Gamepad2, Target, Sword, Crown, Trophy } from "lucide-react";
import { isWCMarket } from "@/lib/hubs/worldCup";
import { isBplMarket, isDrawOutcome } from "@/lib/hubs/bpl";
import { isUfcMarket } from "@/lib/hubs/ufc";
import { isEplMarket } from "@/lib/hubs/epl";
import { hasToken, looksEsports } from "@shared/helpers/esportsKeywords";
import { EWC, notch } from "@shared/components/EsportsUi";

// ── Categories ────────────────────────────────────────────────────────────────
// Two kinds of category live here:
//   • presets — the disciplines and headline game titles below
//   • admin-defined — any other `subcategory` typed into the admin market form
//     on a `gaming` market becomes its own category, keyed `sub:<slug>`
// `tags` match the admin subcategory (bare or `esports-` prefixed); `games` are
// whole-word title/description tokens used to bucket a claimed market.

export type EsportsCategoryKey = string;

export type EsportsCategory = {
  key: EsportsCategoryKey;
  label: string;
  Icon: typeof Swords;
  tags: string[];
  games: string[];
};

export const ESPORTS_CATEGORIES: EsportsCategory[] = [
  {
    key: "mlbb",
    label: "MLBB",
    Icon: Sword,
    tags: ["mlbb", "ml", "mobile-legends", "mobilelegends"],
    games: [
      "mobile legends",
      "mobile legends: bang bang",
      "mlbb",
      "mpl",
      "m6 world championship",
      "msc",
    ],
  },
  {
    key: "pubg",
    label: "PUBG",
    Icon: Target,
    tags: ["pubg", "pubgm", "bgmi", "pubg-mobile"],
    games: [
      "pubg",
      "pubg mobile",
      "pubg: battlegrounds",
      "pubgm",
      "bgmi",
      "pmgc",
      "pmsl",
    ],
  },
  {
    key: "dota2",
    label: "Dota 2",
    Icon: Swords,
    tags: ["dota", "dota2", "dota-2"],
    games: ["dota", "dota 2", "the international", "ti"],
  },
  {
    key: "lol",
    label: "League of Legends",
    Icon: Crown,
    tags: ["lol", "league-of-legends", "leagueoflegends", "league"],
    games: [
      "league of legends",
      "lol",
      "lck",
      "lec",
      "lpl",
      "lcs",
      "worlds",
      "msi",
    ],
  },
  {
    key: "cod",
    label: "Call of Duty",
    Icon: Crosshair,
    tags: ["cod", "call-of-duty", "warzone", "cdl"],
    games: [
      "call of duty",
      "cod",
      "cdl",
      "warzone",
      "modern warfare",
      "black ops",
    ],
  },
  {
    key: "ea-fc",
    label: "EA FC Pro",
    Icon: Trophy,
    tags: ["ea-fc", "eafc", "fc-pro", "ea-sports-fc", "fifa"],
    games: [
      "ea fc",
      "ea sports fc",
      "fc pro",
      "fc 26",
      "fc26",
      "fc 25",
      "fc25",
      "fifa",
    ],
  },
  {
    key: "street-fighter",
    label: "Street Fighter",
    Icon: Flame,
    tags: ["street-fighter", "streetfighter", "sf6", "sf"],
    games: ["street fighter", "sf6", "sfv", "sf 6"],
  },
  {
    key: "tekken",
    label: "Tekken 8",
    Icon: Skull,
    tags: ["tekken", "tekken8", "tekken-8"],
    games: ["tekken", "tekken 8", "tekken8"],
  },
  {
    key: "chess",
    label: "Chess",
    Icon: Castle,
    tags: ["chess"],
    games: ["chess", "fide", "grand chess tour", "candidates tournament"],
  },
  { key: "other", label: "Other", Icon: Gamepad2, tags: [], games: [] },
];

// Subcategories too generic to deserve their own chip — they fall through to
// title-keyword bucketing instead
export const GENERIC_TAGS = [
  "esports",
  "esport",
  "e-sports",
  "gaming",
  "egaming",
  "game",
  "games",
  "match",
  "tournament",
  "event",
];

// Legacy guard: the `gaming` enum value is the renamed `politics` value
// (RenamePoliticsToGaming migration), so old political markets still carry it
export const POLITICAL_HINTS = [
  "election",
  "elections",
  "parliament",
  "national assembly",
  "president",
  "presidential",
  "prime minister",
  "constituency",
  "candidate",
  "referendum",
  "by-election",
];

export const normaliseTag = (sub: string) =>
  sub
    .toLowerCase()
    .trim()
    .replace(/^e-?sports?-/, "")
    .replace(/\s+/g, "-");

export const ACRONYMS = new Set([
  "pubg", "mlbb", "fps", "moba", "br", "tft", "cs2", "csgo", "r6", "kof",
  "aoe", "sf6", "mtg", "tcg", "ccg", "rts", "lol", "mpl", "msc", "bgmi",
  "efootball", "nba2k", "fc26",
]);

/** "mobile-legends" → "Mobile Legends", "csgo" → "CSGO". */
export function prettyTag(tag: string): string {
  return tag
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) =>
      ACRONYMS.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(" ");
}

/**
 * Resolve a preset from an admin subcategory tag. Game names count as well as
 * tags, so a "Rocket League" subcategory joins the same category as a market
 * whose title mentions Rocket League — one game never splits across two chips.
 */
export function presetForTag(tag: string): EsportsCategory | null {
  if (!tag) return null;
  for (const c of ESPORTS_CATEGORIES) {
    if (c.tags.some((t) => tag === t)) return c;
  }
  for (const c of ESPORTS_CATEGORIES) {
    if (c.games.some((g) => normaliseTag(g) === tag)) return c;
  }
  for (const c of ESPORTS_CATEGORIES) {
    if (c.tags.some((t) => t.length > 3 && tag.includes(t))) return c;
  }
  return null;
}

/**
 * Bucket a market into a category. The admin subcategory wins over title
 * tokens, and an unrecognised subcategory becomes its own category so newly
 * added games show up in the hub without a code change.
 */
export function esportsCategoryOf(market: Market): EsportsCategoryKey {
  const tag = normaliseTag(market.subcategory ?? "");
  if (tag) {
    const preset = presetForTag(tag);
    if (preset) return preset.key;
    if (!GENERIC_TAGS.includes(tag)) return `sub:${tag}`;
  }
  const hay = `${market.title} ${market.description ?? ""}`.toLowerCase();
  for (const c of ESPORTS_CATEGORIES) {
    if (c.games.some((g) => hasToken(hay, g))) return c.key;
  }
  return "other";
}

/** Markets that belong in the /esports hub instead of the main feed grid. */
export function isEsportsMarket(market: Market): boolean {
  const cat = (market.category ?? "").toLowerCase();
  if (cat === "political") return false;

  const sub = (market.subcategory ?? "").toLowerCase();

  // Picking the Gaming category in the admin form is an explicit decision, so
  // it outranks the other hubs' matchers. Without this, a stale sports field —
  // e.g. a BPL settlement URL left over from the form's presets — would route
  // the market to a football hub and it would never appear here.
  if (cat === "gaming") {
    const hay = `${market.title} ${sub}`.toLowerCase();
    if (POLITICAL_HINTS.some((k) => hay.includes(k))) return false;
    // An admin-set subcategory is an explicit signal; without one, only claim
    // the market when its title resolves to a known discipline
    if (sub.trim()) return true;
    return esportsCategoryOf(market) !== "other";
  }

  // Otherwise never poach a market that already has a dedicated hub
  if (isWCMarket(market)) return false;
  if (isBplMarket(market)) return false;
  if (isUfcMarket(market)) return false;
  if (isEplMarket(market)) return false;

  if (sub.includes("esport") || sub.includes("egaming")) return true;
  if (looksEsports(market.title, market.description)) return true;
  return false;
}

export function categoryMeta(key: EsportsCategoryKey): EsportsCategory {
  const preset = ESPORTS_CATEGORIES.find((c) => c.key === key);
  if (preset) return preset;
  if (key.startsWith("sub:")) {
    const tag = key.slice(4);
    return { key, label: prettyTag(tag), Icon: Gamepad2, tags: [tag], games: [] };
  }
  return ESPORTS_CATEGORIES[ESPORTS_CATEGORIES.length - 1];
}

// ── Small helpers ─────────────────────────────────────────────────────────────

export function getSideImage(market: Market, idx: number): string | null {
  const sides = (market.outcomes ?? []).filter(
    (o) => !isDrawOutcome(o.label ?? ""),
  );
  const outcome = sides[idx];
  if (outcome?.imageUrl) return outcome.imageUrl;
  if (idx === 0) return market.imageUrl;
  if (idx === 1) return market.imageUrlAlt;
  return null;
}

export function outcomeImage(market: Market, outcome: Outcome): string | null {
  if (outcome.imageUrl) return outcome.imageUrl;
  const sides = (market.outcomes ?? []).filter(
    (o) => !isDrawOutcome(o.label ?? ""),
  );
  const i = sides.findIndex((o) => o.id === outcome.id);
  if (i === 0) return market.imageUrl;
  if (i === 1) return market.imageUrlAlt;
  return null;
}

export function shortTeamName(label: string): string {
  const trimmed = label.trim();
  if (trimmed.length <= 14) return trimmed;
  const parts = trimmed.split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : trimmed;
}

export function parseVsNames(title: string): { a: string; b: string } {
  const m = title.match(
    /^(?:.*?[:\-–—]\s*)?(.+?)\s+vs\.?\s+(.+?)(?:\s*[–—\-:?]|\s*\(|\s+(?:who|which|will)\b|$)/i,
  );
  if (m) return { a: m[1].trim(), b: m[2].trim() };
  return { a: "Team A", b: "Team B" };
}

export function TeamAvatar({
  src,
  label,
  size,
  color = EWC.gold,
}: {
  src: string | null;
  label: string;
  size: number;
  color?: string;
}) {
  const [failed, setFailed] = useState(false);
  const shape = { width: size, height: size, flexShrink: 0, clipPath: notch(6) };
  if (src && !failed) {
    return (
      <img
        src={src}
        alt={label}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        style={{
          ...shape,
          objectFit: "contain",
          padding: Math.round(size * 0.1),
          boxSizing: "border-box",
          background: EWC.control,
        }}
      />
    );
  }
  return (
    <div
      style={{
        ...shape,
        background: EWC.control,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.42,
        fontWeight: 900,
        color,
      }}
    >
      {label.trim().charAt(0).toUpperCase()}
    </div>
  );
}

export function isMatchMarket(m: Market): boolean {
  const sides = (m.outcomes ?? []).filter((o) => !isDrawOutcome(o.label ?? ""));
  if (sides.length !== 2) return false;
  const isBinary = sides.every((o) => /^(yes|no)$/i.test((o.label ?? "").trim()));
  if (isBinary) return /\bvs\b/i.test(m.title);
  return true;
}
