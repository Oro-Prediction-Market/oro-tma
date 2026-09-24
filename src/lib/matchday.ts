import type { Market } from "@shared/api/client";

export interface MatchdayGroup {
  /** Stable React key. */
  key: string;
  /** "Gameweek 4", "Matchday 2", "Round of 16", or "Other fixtures". */
  label: string;
  markets: Market[];
}

/**
 * The competition round a fixture market belongs to.
 *
 * Written to `metadata.matchday` by the keeper when it creates the market, from
 * football-data's own `matchday`. Deliberately not derived from the kickoff
 * date: a gameweek routinely straddles a Saturday and the following Tuesday,
 * and any date-based bucketing splits it across two headings.
 */
export function matchdayOf(m: Market): number | null {
  const raw = (m.metadata as Record<string, unknown> | null)?.matchday;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Split a fixture list into round-labelled groups, preserving the order it
 * arrives in — the caller has already sorted by kickoff, ascending for
 * upcoming and descending for results, and the headings should follow that.
 *
 * Markets with no matchday (knockout ties, anything created by hand) collect
 * into one trailing group rather than being dropped.
 */
export function groupByMatchday(
  markets: Market[],
  noun: "Gameweek" | "Matchday",
): MatchdayGroup[] {
  const groups: MatchdayGroup[] = [];
  const index = new Map<string, MatchdayGroup>();

  for (const m of markets) {
    const md = matchdayOf(m);
    const key = md == null ? "other" : String(md);
    let group = index.get(key);
    if (!group) {
      group = {
        key,
        label: md == null ? "Other fixtures" : `${noun} ${md}`,
        markets: [],
      };
      index.set(key, group);
      groups.push(group);
    }
    group.markets.push(m);
  }

  return groups;
}
