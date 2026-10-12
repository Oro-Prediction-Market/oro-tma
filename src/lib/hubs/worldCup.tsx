// Moved verbatim from src/pages/WorldCupHubPage.tsx so the feed, detail pages
// and other hubs can use these without loading that page.
import { looksEsports } from "@shared/helpers/esportsKeywords";
import { type Market, type Outcome } from "@shared/api/client";
import { formatQuoteOnCard, quotePayout, type PayoutQuote } from "@shared/payout";

// ── Country flag map ──────────────────────────────────────────────────────────

export const SVG_MAP: Record<string, string> = {
  algeria: "Algeria", argentina: "Argentina", australia: "Australia",
  austria: "Austria", belgium: "Belgium",
  "bosnia and herzegovina": "BosniaAndHerzegovina", bosnia: "BosniaAndHerzegovina",
  brazil: "Brazil", canada: "Canada", "cape verde": "Cape Verde",
  colombia: "Colombia", croatia: "Croatia",
  "curaçao": "Curaçao", curacao: "Curaçao",
  czechia: "Czechia", "czech republic": "Czechia",
  "dr congo": "DR Congo", congo: "DR Congo",
  ecuador: "Ecuador", egypt: "Egypt", england: "England",
  france: "France", germany: "Germany", ghana: "Ghana", haiti: "Haiti",
  iran: "Iran", iraq: "Iraq",
  "ivory coast": "Ivory Coast", "côte d'ivoire": "Ivory Coast",
  japan: "Japan", jordan: "Jordan", mexico: "Mexico", morocco: "Morocco",
  netherlands: "Netherlands", holland: "Netherlands",
  "new zealand": "NewZealand", norway: "Norway",
  panama: "Panama", paraguay: "Paraguay", portugal: "Portugal", qatar: "Qatar",
  "saudi arabia": "Saudi Arabia", scotland: "Scotland", senegal: "Senegal",
  "south africa": "SouthAfrica",
  "south korea": "SouthKorea", korea: "SouthKorea",
  spain: "Spain", sweden: "Sweden", switzerland: "Switzerland", tunisia: "Tunisia",
  turkey: "Türkiye", "türkiye": "Türkiye",
  "united states": "USA", usa: "USA", america: "USA", us: "USA",
  uruguay: "Uruguay", uzbekistan: "Uzbekistan",
};

// Outcome labels that are answers/markers, not countries — must never map to a flag.
export const NON_COUNTRY_LABELS = new Set([
  "yes", "no", "over", "under", "draw", "tie", "odd", "even",
  "none", "both", "neither", "other", "tbd",
]);

export function getWCFlag(country: string): string {
  const lower = country.toLowerCase().trim();
  // Generic prop/outcome labels are NOT teams — never resolve them to a flag,
  // e.g. "No" must not fuzzy-match "Norway", "Yes"/"Draw"/"Over" etc.
  if (!lower || NON_COUNTRY_LABELS.has(lower)) return "";
  if (SVG_MAP[lower]) return `/worldcup/${SVG_MAP[lower]}.svg`;
  for (const [key, file] of Object.entries(SVG_MAP)) {
    // Label contains a country name, OR (only for sufficiently long labels) the
    // country name contains the label. The length guard blocks short tokens
    // ("no", "us") from matching a longer country via the reverse direction.
    if (lower.includes(key) || (lower.length >= 4 && key.includes(lower)))
      return `/worldcup/${file}.svg`;
  }
  return "";
}

export function isWCMarket(m: Market): boolean {
  if (m.subcategory?.startsWith("wc-")) return true;
  // "Esports World Cup" / "Free Fire World Cup" are different events entirely —
  // they belong to the /esports hub, not the FIFA World Cup hub
  if (looksEsports(m.title, m.description)) return false;
  return m.title.toLowerCase().includes("world cup");
}

// ── Probability helpers ───────────────────────────────────────────────────────

export function calcProb(market: Market, outcomeId: string): number {
  const outcomes = market.outcomes ?? [];
  const o = outcomes.find((x) => x.id === outcomeId);
  if (!o) return 0;
  const n = outcomes.length || 1;
  const prior = 1000;
  const tPool = Number(market.totalPool) || 0;
  // Once there is real money in the pool, the honest probability is the
  // outcome's Laplace-smoothed share of the pool — which is also consistent with
  // the parimutuel payout multiple shown next to it. The stored LMSR values are
  // NOT used here: on a lopsided pool they saturate (favourite → ~0.99, everyone
  // else → a tiny non-zero number), which read as "99% / 0%" and don't reflect
  // the actual money on each side.
  if (tPool > 0) {
    return (Number(o.totalBetAmount) + prior / n) / (tPool + prior);
  }
  // Empty pool: show sensible initial odds from LMSR when every outcome has one
  // (they sum to ~100), otherwise fall back to equal priors.
  const lmsr = outcomes.map((x) => Number(x.lmsrProbability) || 0);
  if (lmsr.every((p) => p > 0)) {
    const sum = lmsr.reduce((a, b) => a + b, 0);
    return (Number(o.lmsrProbability) || 0) / sum;
  }
  return (Number(o.totalBetAmount) + prior / n) / (tPool + prior);
}

/** The reference stake every listed multiplier is quoted for. */
export const ODDS_REFERENCE_STAKE = 100;

/**
 * Renders a listed multiplier for display.
 *
 * The leading "~" is load-bearing, not decoration. Listed odds are quoted for
 * a Nu 100 reference stake (ODDS_REFERENCE_STAKE); the multiple a viewer
 * actually receives falls as their stake grows, because in a parimutuel their
 * own money joins the pool they are claiming from. On a Nu 1,900 pool the same
 * outcome pays 12x at Nu 100 and 1.2x at Nu 5,000. Printing a bare "12.00x"
 * reads as a promise; "~12.00x" reads as an indication, which is all a card
 * without a stake box can honestly offer. The exact figure is computed from
 * the real amount on the bet page.
 */
export function formatOdds(q: PayoutQuote): string {
  return formatQuoteOnCard(q);
}

/**
 * The multiplier a `stake` bet on this outcome would return right now.
 *
 * Parimutuel, so your own stake joins the pool you are claiming from: the
 * bigger the bet relative to the pool, the more it dilutes itself. A quoted
 * multiplier is therefore only true for the stake it was computed with, which
 * is why callers listing odds must label them "per Nu 100" (see
 * ODDS_REFERENCE_STAKE) rather than presenting them as what the viewer will
 * get. On a Nu 1,900 pool the same outcome is 12x at Nu 100 and 1.2x at
 * Nu 5,000 — quoting the first as if it were the second overstates the return
 * by an order of magnitude.
 *
 * DKBankBetPage computes the real figure from the amount actually entered;
 * this exists for cards and lists, where no amount is known yet.
 */
export function calcOdds(
  market: Market,
  outcomeId: string,
  stake = ODDS_REFERENCE_STAKE,
): PayoutQuote {
  const o = market.outcomes?.find((x) => x.id === outcomeId);
  if (!o) return { kind: "no_pool" };
  return quotePayout({
    stake,
    outcomePool: Number(o.totalBetAmount) || 0,
    totalPool: Number(market.totalPool) || 0,
    houseEdgePct: Number(market.houseEdgePct) || 0,
  });
}/**
 * A market's outcomes, likeliest first.
 *
 * The order the API returns is the order they were created in, which says
 * nothing a reader wants to know. Eliminated outcomes sink to the bottom
 * whatever their price — they cannot win, so they are not in the running.
 *
 * Returns a copy: `market.outcomes` is shared with everything else on the
 * page, and `sort` mutates in place.
 *
 * Match markets do NOT use this. Home / Draw / Away has a reading order of
 * its own, and the two-sided cards pin each side to a fixed position — the
 * left crest, the red corner — so re-ranking them would swap the teams around
 * as the price moved.
 */
export function rankedOutcomes(market: Market): Outcome[] {
  return [...(market.outcomes ?? [])].sort((a, b) => {
    const ea = Number(!!a.isEliminated);
    const eb = Number(!!b.isEliminated);
    if (ea !== eb) return ea - eb;
    return calcProb(market, b.id) - calcProb(market, a.id);
  });
}
