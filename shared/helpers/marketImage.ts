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
