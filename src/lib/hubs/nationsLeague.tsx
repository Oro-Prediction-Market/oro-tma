// Moved verbatim from src/pages/NationsLeagueHubPage.tsx so the feed, detail pages
// and other hubs can use these without loading that page.
import type { Market } from "@shared/api/client";

/**
 * Whether a market belongs to this hub.
 *
 * The subcategory check is the reliable one — everything the keeper and the
 * seeder create is tagged `unl-*`. The title fallback catches markets an admin
 * typed by hand, and deliberately does NOT match a bare "nations": far too
 * many things are called that.
 */
export function isUnlMarket(m: Market): boolean {
  if (m.category === "gaming" || m.category === "political") return false;
  const sub = (m.subcategory ?? "").toLowerCase();
  if (sub.startsWith("unl-")) return true;
  if ((m.externalSource ?? "").toLowerCase() === "unl-manual") return true;
  return /nations league/i.test(m.title);
}
