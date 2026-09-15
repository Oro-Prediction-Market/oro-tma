import { useState } from "react";

/**
 * A market's own artwork, shown beside its title.
 *
 * Until now `market.imageUrl` had no slot of its own anywhere in either app. It
 * reached the screen through one accidental path — as the fallback avatar for
 * whichever outcome sat first — so an admin who filled in "MARKET IMAGE URL"
 * got a team's face, not the market's picture. In the PWA feed card that index
 * was probability-sorted, so the artwork moved between outcomes as the odds
 * changed.
 *
 * Props are primitive on purpose — no `Market`. This file is hand-copied into
 * both frontends and must compile against the Telegram app, which has no
 * `shared/currency/`, so anything richer would break its build.
 */

export interface MarketThumbProps {
  /** Already trimmed by the caller — see `marketArtwork()`. */
  src: string | null;
  /** The market title. */
  alt: string;
  /** 40 on feed cards (fits the two-line title block), 52 on detail pages. */
  size: number;
  rounded?: number;
}

export function MarketThumb({ src, alt, size, rounded = 8 }: MarketThumbProps) {
  const [failed, setFailed] = useState(false);

  // Nothing to show, and nothing reserved either — in both directions.
  //
  // Only about one market in four hundred carries an image, so a placeholder
  // tile would narrow the title column on thousands of cards to advertise an
  // absence. And a market whose image 404s should look like those thousands,
  // not like a fault: no broken-image glyph, no grey box. The title reflows to
  // full width and the card's height is unchanged either way, which is the
  // property the fixed-height feed depends on.
  if (!src || failed) return null;

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      style={{
        flexShrink: 0,
        width: size,
        height: size,
        objectFit: "cover",
        borderRadius: rounded,
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        display: "block",
      }}
    />
  );
}
