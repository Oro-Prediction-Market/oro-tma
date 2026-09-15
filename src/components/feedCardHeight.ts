import {
  feedCardHeight,
  priceChartHeight,
  VISIBLE_OUTCOMES,
  type FeedCardMetrics,
} from "@shared/feedCardMetrics";

/**
 * The Telegram app's own card measurements, fed into the shared recipe.
 *
 * Deliberately different numbers from the PWA's: this app is phone-only, its
 * outcome rows carry a 36–38px avatar inside `padding: "11px 14px"`, and its
 * card body is `padding: "18px 16px"` with `gap: 12`. Only the policy is shared
 * — how many outcomes a card shows, and that titles get two lines — because
 * that is a product decision, while density is not.
 *
 * One source for all four feed cards (generic, grouped, TER, BTC), which
 * previously sized themselves independently.
 */
const TMA_CARD: FeedCardMetrics = {
  outcomeRowH: 60,
  outcomeGap: 8,
  titleLineH: 21,
  moreLineH: 20,
  sourceLineH: 15,
  // Body padding (18 + 18) + badge row (18) + footer (22) + 5 × gap 12.
  // Five gaps, not four: unlike the PWA, this card's "+N more" hint is a
  // sibling of the outcomes list rather than a child of it.
  chromeH: 136,
};

/** Every card in the Telegram feed lands on exactly this height. */
export const FEED_CARD_H = feedCardHeight(TMA_CARD);

/** Reserved slot for the "+N more" hint, kept even on binary cards. */
export const MORE_LINE_H = TMA_CARD.moreLineH;

/** Reserved slot for the "Resolves via …" line, kept when there is no source. */
export const SOURCE_LINE_H = TMA_CARD.sourceLineH;

/** Two title lines, reserved so a one-line title does not shorten the card. */
export const TITLE_BLOCK_H = TMA_CARD.titleLineH * 2;

/**
 * The outcomes block, fixed so every status occupies the same space.
 *
 * Only `open` markets render outcome rows — resolving, closed and upcoming each
 * swap the list for a single banner, and all four statuses appear in one feed.
 */
export const OUTCOMES_BLOCK_H =
  VISIBLE_OUTCOMES * TMA_CARD.outcomeRowH +
  (VISIBLE_OUTCOMES - 1) * TMA_CARD.outcomeGap;

/**
 * Chart well for the TER/BTC cards.
 *
 * Their non-chart content — header, price row, actions, footer — measures about
 * 210px here. The well is sized from the shared height and always rendered, so
 * these cards match the feed and no longer jump when price history arrives.
 */
export const PRICE_CHART_H = priceChartHeight(FEED_CARD_H, 210);
