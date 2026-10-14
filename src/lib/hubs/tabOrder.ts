/**
 * A football hub's tabs with Matches first while there is a match to bet on,
 * and Season first when there is not. The hub opens on whichever leads, so a
 * visitor lands on the tab with something in it; the rest keep their order.
 */
export function leadTabs<T extends { id: string }>(
  tabs: readonly T[],
  hasMatches: boolean,
): T[] {
  const lead = hasMatches ? "matches" : "season";
  return [...tabs.filter((t) => t.id === lead), ...tabs.filter((t) => t.id !== lead)];
}
