// Moved verbatim from src/pages/UclHubPage.tsx so the feed, detail pages
// and other hubs can use these without loading that page.
import type { Market } from "@shared/api/client";

// Detection: a market belongs to the Champions League hub if it's tagged ucl /
// champions-league, or its title names the competition. Excludes gaming/politics.
export function isUclMarket(m: Market): boolean {
  if (m.category === "gaming" || m.category === "political") return false;
  const sub = (m.subcategory ?? "").toLowerCase();
  const cat = (m.category ?? "").toLowerCase();
  const title = m.title.toLowerCase();
  if (sub.includes("ucl") || sub.includes("champions")) return true;
  if (cat.includes("champions league")) return true;
  return /champions league/.test(title) || /\bucl\b/.test(title);
}
