/**
 * The geometry that makes every home-feed card the same height.
 *
 * A feed of cards each sized to its own content reads as a jumble, and the
 * thing that made height unpredictable was the in-card expander: a card showed
 * two outcome rows or four, and grew to thirty-six when expanded in place,
 * reflowing everything around it. Cards now show a fixed number of outcomes and
 * send the rest to the market page, which is what lets a height be fixed at all.
 *
 * The height is composed rather than hard-coded. A literal `height: 320` breaks
 * the moment a badge or a font changes, and silently — the feed just goes ragged
 * again. Adding up the parts means a change to any one of them moves the whole
 * card, and the backstop `minHeight` fails visibly instead.
 *
 * Imports nothing on purpose. This file is hand-copied byte-identical into both
 * frontends, and `shared/currency/` exists only in the PWA — anything richer
 * fails `tsc` in the Telegram app and breaks its build.
 */

/**
 * Outcomes a feed card shows before the rest collapse behind "+N more".
 *
 * Two, because 94% of all markets are binary (3,434 of 3,658) — so this is the
 * whole list for almost every card, and the long tail (one market has 36) is
 * what used to drag the layout around. This number is shared across both apps
 * deliberately: it is a product decision about how much of a market the feed
 * shows, not a per-app layout detail.
 */
export const VISIBLE_OUTCOMES = 2;

/** Lines a card title is clamped to. Longest title ever seen is 102 chars. */
export const TITLE_LINES = 2;

/**
 * The per-app pieces a card is built from. The two apps are legitimately
 * different densities — the Telegram app's outcome rows are taller and its type
 * is sized for a phone — so the numbers live with each app while the recipe
 * that combines them is shared.
 */
export interface FeedCardMetrics {
  /** One outcome row, including its own padding. */
  outcomeRowH: number;
  /** Gap between outcome rows. */
  outcomeGap: number;
  /** One line of the title, at the title's font size and line height. */
  titleLineH: number;
  /** The "+N more" hint. Reserved even on binary cards, which have no hint. */
  moreLineH: number;
  /** The "Resolves via …" line. Reserved even when there is no source. */
  sourceLineH: number;
  /**
   * Everything of constant height: the badge row, the footer, the card's own
   * vertical padding, and the gaps between sections.
   */
  chromeH: number;
}

/**
 * The one height every card in a feed must land on.
 *
 * Note the reserved sections. A binary market has no "+N more" line and a market
 * with no settlement source has no "Resolves via" line — omitting them would
 * make those cards shorter than their neighbours, which is the exact defect
 * being fixed. They render as empty space of the right size instead.
 */
export function feedCardHeight(m: FeedCardMetrics): number {
  return (
    m.chromeH +
    TITLE_LINES * m.titleLineH +
    VISIBLE_OUTCOMES * m.outcomeRowH +
    (VISIBLE_OUTCOMES - 1) * m.outcomeGap +
    m.moreLineH +
    m.sourceLineH
  );
}

/**
 * Height available to a price card's chart, given the rest of that card.
 *
 * The TER and BTC cards carry a chart instead of outcome rows, and it used to be
 * rendered only once price history arrived — so the card stood short and then
 * jumped 150–160px taller mid-session. The well is now always present and sized
 * from the shared height, so those cards match the rest of the feed and never
 * move.
 */
export function priceChartHeight(cardH: number, nonChartH: number): number {
  return Math.max(80, cardH - nonChartH);
}
