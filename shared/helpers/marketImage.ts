/**
 * The market's own artwork, or `null` if it has none.
 *
 * Exists because "has an image" is not the same as `imageUrl !== null` here:
 * the admin form submits `imageUrl.trim()`, which stores an empty string when
 * the field is left blank, so a plain null check counts blanks as images.
 */
export function marketArtwork(m: { imageUrl?: string | null }): string | null {
  const url = m.imageUrl?.trim();
  return url ? url : null;
}

/**
 * Artwork for a grouped event — a political race, say — taken from any one of
 * its child markets.
 *
 * It lives in `metadata` because a group is virtual: children simply share a
 * `groupId`, there is no group row, and so there is no column to put it in.
 * `createMarketGroup` hands its own `imageUrl` to candidates who have no photo
 * of their own and then drops it, which means a fully illustrated race has no
 * picture for the event itself. Every child of a group carries the same value.
 */
export function groupArtwork(m: {
  metadata?: Record<string, any> | null;
}): string | null {
  const url = m.metadata?.groupImageUrl;
  return typeof url === "string" && url.trim() ? url.trim() : null;
}
