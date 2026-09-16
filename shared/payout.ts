/**
 * The one place a payout quote is calculated.
 *
 * Before this file the same number was worked out in about thirty places across
 * the two apps, under three different clamping policies — some floored at 1.05×,
 * some capped at 99×, some neither — and from two different formulas. The same
 * outcome could read `0.91x` on a feed card and `1.05×` in the bet sheet, and
 * `OutcomeRow` was fed by whichever formula the mounting page happened to use.
 *
 * ── What the engine actually pays ─────────────────────────────────────────────
 *
 * Winners take their pro-rata share of the pool net of Oro's edge. Where that
 * share would fall below 1.05× their stake, settlement gives up house edge — as
 * far as zero — to fund the floor. Where even a zero edge cannot fund it (the
 * winning side holding more than ~95% of the pool), payouts scale down and
 * winners split the entire pool, which still pays each of them more than their
 * stake. So:
 *
 *     raw      = totalPool × (1 − houseEdgePct/100) / outcomePool
 *     ceiling  = totalPool / outcomePool          (what a zero edge pays)
 *     multiple = max(raw, min(1.05, ceiling))
 *
 * A market only refunds when nobody is on the other side — the engine's
 * thin-pool guard — which is the one refund a client can detect.
 *
 * This file previously returned `refund` for everything under 1.05×, because
 * the engine refunded the whole market rather than waiving its cut. It no
 * longer does. Note the bet forms must NOT go back to
 * `Math.max(parimutuel, stake × 1.05)`: that overstates the extreme band, where
 * the floor is scaled down and not actually met.
 *
 * Imports nothing on purpose — hand-copied byte-identical into both frontends,
 * and `shared/currency/` exists only in the PWA, so anything richer fails `tsc`
 * in the Telegram build. Callers pass plain numbers and resolve their own book.
 */

/**
 * The multiple a winner is guaranteed when the pool can fund it — the engine
 * gives up house edge to reach it. It is a ceiling on that subsidy, not a floor
 * applied to a number: above ~95% concentration the pool cannot reach it even
 * at a zero edge and winners get less, so never clamp a quote up to this.
 */
export const PAYOUT_FLOOR = 1.05;

/**
 * The engine's default house edge (`fee.constants.ts`), for the rare caller
 * that has a market without one. It is 10 — a local fallback of 5 in My Bets
 * quoted every bet card better odds than the market actually offered.
 */
export const DEFAULT_HOUSE_EDGE_PCT = 10;

/**
 * Notional stake used to quote odds on a card, where there is no real stake yet.
 *
 * A quote has to include a stake because the stake changes the answer: your money
 * joins the pool you are about to divide. Quoting the pool as it stands shows a
 * multiple nobody can actually get. These are the values the two apps already
 * used (`ODDS_REFERENCE_STAKE`), kept so card numbers do not shift.
 */
export const ODDS_PROBE_BTN = 100;
export const ODDS_PROBE_USDT = 1;

export type PayoutQuote =
  /** A real, payable multiple. `payout` is `stake × multiple`. */
  | { kind: "quote"; multiple: number; payout: number }
  /** Nobody is on the other side, so there is nothing to win: every stake is
   *  refunded (the engine's thin-pool guard). */
  | { kind: "refund" }
  /** Nothing backs this outcome yet. Not a refund: a stake here creates a backer. */
  | { kind: "unbacked" }
  /** No money anywhere in this book yet. */
  | { kind: "no_pool" };

export function quotePayout(a: {
  /** A real stake in a bet form, or one of the probes above on a card. */
  stake: number;
  /** This outcome's pool, in the same book, BEFORE `stake`. */
  outcomePool: number;
  /** The market's pool, in the same book, BEFORE `stake`. */
  totalPool: number;
  houseEdgePct: number;
}): PayoutQuote {
  const stake = Number(a.stake) || 0;
  const edge = Number(a.houseEdgePct) || 0;
  const total = (Number(a.totalPool) || 0) + stake;
  const own = (Number(a.outcomePool) || 0) + stake;

  if (total <= 0) return { kind: "no_pool" };
  // Only reachable with a zero stake — a card quoting an outcome nobody has
  // backed. It is deliberately NOT a refund: the engine refunds a side with no
  // winning bets, but the moment this user stakes, the side has one. Calling it
  // a refund would be a fresh lie, and locally most open outcomes are unbacked.
  if (own <= 0) return { kind: "unbacked" };

  // All money on this side means nobody is on the other, so there is nothing to
  // win and the engine's thin-pool guard refunds every stake. This is now the
  // only refund a client can predict.
  if (own >= total) return { kind: "refund" };

  const raw = (total * (1 - edge / 100)) / own;
  if (!isFinite(raw) || raw <= 0) return { kind: "no_pool" };

  // Where the post-rake pool cannot fund the 1.05× floor, settlement gives up
  // house edge to fund it — and where even a zero edge cannot, winners split
  // the whole pool (`total / own`). Both are payable, so neither is a refund.
  // `total / own` is the ceiling on that: it is what a zero edge pays.
  const multiple = Math.max(raw, Math.min(PAYOUT_FLOOR, total / own));

  // No `Math.min(99, …)`. The stake probe already damps the extremes it was
  // there for — 100 into a 1-unit side quotes ~90×, not 9000× — so the cap only
  // understated multiples the engine would really pay.
  return { kind: "quote", multiple, payout: stake * multiple };
}

/** `~1.35x`, `refund`, or `—`. The one way a multiple reaches a screen. */
export function formatQuote(q: PayoutQuote): string {
  if (q.kind === "quote") return `~${q.multiple.toFixed(2)}x`;
  if (q.kind === "refund") return "refund";
  return "—";
}

/**
 * The sentence shown where a stake is confirmed, in place of an estimate.
 *
 * Present tense on purpose: it describes the pool right now, not a prediction.
 * A market weeks from closing will usually rebalance well before it settles.
 */
export const REFUND_NOTICE =
  "Every prediction so far is on this side, so there is nothing to win. Unless someone backs another outcome, this market refunds every stake instead of paying out — you would get your stake back, not a payout.";
