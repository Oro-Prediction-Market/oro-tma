// Esports detection primitives, shared so both the /esports hub and the other
// hubs agree on what counts as esports. Lives here (not in EsportsHubPage) so
// WorldCupHubPage can hand off "Esports World Cup" without an import cycle.

/** Whole-word containment — keeps "cod" from matching "code". */
export function hasToken(haystack: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(haystack);
}

/** Matches "esports", "e-sports", "esport". */
export const ESPORTS_WORD_RE = /\be-?sports?\b/i;

// Game names that cannot plausibly belong to a non-esports market. Used to
// claim a market for the esports hub when the admin left the category /
// subcategory generic — deliberately excludes ambiguous tokens (poker, f1),
// which still bucket a market once it has been claimed some other way.
export const ESPORTS_ONLY_KEYWORDS = [
  "dota",
  "dota 2",
  "the international",
  "league of legends",
  "wild rift",
  "mobile legends",
  "honor of kings",
  "arena of valor",
  "counter-strike",
  "counter strike",
  "cs2",
  "csgo",
  "cs:go",
  "valorant",
  "overwatch",
  "rainbow six",
  "call of duty",
  "warzone",
  "pubg",
  "bgmi",
  "fortnite",
  "free fire",
  "apex legends",
  "starcraft",
  "age of empires",
  "clash royale",
  "clash of clans",
  "hearthstone",
  "teamfight tactics",
  "legends of runeterra",
  "street fighter",
  "tekken",
  "mortal kombat",
  "super smash",
  "guilty gear",
  "rocket league",
  "f1 esports",
  "gran turismo",
  "trackmania",
  "iracing",
];

/**
 * True when the text names esports outright or an unmistakably esports title.
 * Other hubs use this as a veto: "Esports World Cup" and "Free Fire World Cup"
 * are not the FIFA World Cup.
 */
export function looksEsports(...parts: (string | null | undefined)[]): boolean {
  const hay = parts.filter(Boolean).join(" ").toLowerCase();
  if (!hay) return false;
  if (ESPORTS_WORD_RE.test(hay)) return true;
  return ESPORTS_ONLY_KEYWORDS.some((k) => hasToken(hay, k));
}

/**
 * True when a market's stage marks the tournament's championship decider — the
 * "Grand Final" / "Final". Deliberately excludes the semi-finals, quarter-finals
 * and the third-place match: those also read as "final-ish" but are not the
 * trophy match, and must not get the showpiece treatment. Fed the market title
 * (which carries the stage, e.g. "MSC 2026: FINAL"), optionally + description.
 */
export function isEsportsFinal(...parts: (string | null | undefined)[]): boolean {
  const hay = parts.filter(Boolean).join(" ").toLowerCase();
  if (!hay) return false;
  // Semi-/quarter-finals contain "final" but are not THE final.
  if (/\b(?:semi|quarter)[-\s]?finals?\b/.test(hay)) return false;
  if (/\bgrand finals?\b/.test(hay)) return true;
  return /\bfinals?\b/.test(hay);
}
