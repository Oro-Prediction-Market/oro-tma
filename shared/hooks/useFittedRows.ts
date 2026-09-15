import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { VISIBLE_OUTCOMES } from "../feedCardMetrics";

/**
 * How many outcome rows actually fit in a feed card's outcomes block.
 *
 * Feed cards are a fixed height, but not all the same fixed height: the grid
 * stretches every card in a row to its tallest member, and the banner cards
 * (`PwaFeedPage.tsx`) stand 320px against the shared recipe's 271. A market
 * card sharing a row with one was carrying ~50px of dead space — enough for a
 * whole extra outcome row — collected into a single gap above the footer by the
 * footer's `marginTop: auto`.
 *
 * Rather than pick a new constant and hope it matches, the block measures the
 * space it was actually given and fills it. A binary market still shows its two
 * rows and no blank; a market with more shows a third when the row is tall
 * enough. Both cases land on the same card height, which is the property the
 * fixed-height feed exists to protect.
 *
 * `VISIBLE_OUTCOMES` stays the floor: it is the number every card is guaranteed
 * to show, and what `feedCardHeight()` sizes the card from. This hook only ever
 * adds rows into space that already exists — it never makes a card taller.
 *
 * The block this measures MUST lay its rows out in an absolutely-positioned
 * child (`ROWS_LAYER`), not as its own flex children. A flex item in a column
 * container is sized by its content as well as by `flex`, so rows rendered
 * directly into the block make the block taller, which makes the card taller,
 * which makes another row fit — a feedback loop that pushed cards to 282, 320
 * and 340px in the same feed. Taking the rows out of flow means the block's
 * height comes only from the space the card gave it.
 *
 * Imports only `react` and a sibling constant, so it compiles in the Telegram
 * app, which has no `shared/currency/`. Hand-copied byte-identical into both
 * frontends.
 */
export function useFittedRows(opts: {
  /** Height of one outcome row, including its padding. */
  rowH: number;
  /** Gap between rows. */
  gap: number;
  /** Space inside the block that is not a row — the "+N more" line. */
  reserveH: number;
  /** Outcomes this market has. Never render more rows than there are. */
  total: number;
}) {
  const { rowH, gap, reserveH, total } = opts;
  const ref = useRef<HTMLDivElement | null>(null);
  const [fit, setFit] = useState(VISIBLE_OUTCOMES);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // `clientHeight` excludes the border, which is what the rows are laid out
    // inside. The block is `flex: 1`, so this is the space the card gave it,
    // not the space its contents asked for — there is no feedback loop between
    // rendering another row and the measurement.
    // The "+N more" line is a flex child, so it costs its own height *and* a
    // gap. Leaving that gap out is what made the block report room for a row it
    // could not actually show.
    const usable = el.clientHeight - (reserveH + gap);
    const n = Math.floor((usable + gap) / (rowH + gap));
    // Never below the guaranteed floor: a short row would otherwise drop a card
    // to one outcome, which reads as missing data rather than as a tight fit.
    setFit(Math.max(VISIBLE_OUTCOMES, n));
  }, [rowH, gap, reserveH]);

  useLayoutEffect(() => {
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  return { blockRef: ref, visibleRows: Math.min(total, fit) };
}

/**
 * Styles for the layer the rows actually live in — see the note above about the
 * feedback loop. Spread onto a single child of the measured block.
 */
export const ROWS_LAYER = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
} as const;
