/**
 * The one place a payout quote is calculated.
 *
 * Before this file the same number was worked out in about thirty places across
 * the two apps, under three different clamping policies — some floored at 1.05×,
 * some capped at 99×, some neither — and from two different formulas. The same
 * outcome could read `0.91x` on a feed card and `1.05×` in the bet sheet, and
 * `OutcomeRow` was fed by whichever formula the mounting page happened to use.
 *
 * ── Why a quote can be "no quote" ──────────────────────────────────────────────
 *
 * A parimutuel market does not always pay out. `parimutuel.engine.ts` refunds
 * every stake when the winning side is too large to fund the 1.05× floor:
 *
 *     payoutPool = totalPool × (1 − houseEdgePct/100)
 *     refund when   1.05 × winnerPool > payoutPool
 *
 * Divide through and that is exactly `multiple < 1.05`. So a quoted multiple
 * below 1.05 is not a poor payout — it is a payout that cannot happen, and the
 * user gets their stake back instead. Quoting `0.91x` promised a loss the engine
 * has no branch to deliver.
 *
 * The bet forms used to apply `Math.max(parimutuel, stake × 1.05)`, commented
 * "funded by the house edge at settlement". That describes a subsidy path in the
 * engine which the refund guard makes unreachable — the floor is never paid, the
 * market refunds. Flooring the display promised 1.05× where the engine pays 1.00×,
 * so the floor is gone from here: below it, the answer is `refund`.
 *
 * ── If the engine changes ─────────────────────────────────────────────────────
 *
 * Two engine tests assert the *other* behaviour (pay 1.05×, funded by waiving the
 * house edge). If that is restored, this file is the only thing that changes:
 * return a `quote` with `multiple: PAYOUT_FLOOR` instead of `refund`. That is why
 * the rule lives here and not in thirty components.
 *
 * Imports nothing on purpose — hand-copied byte-identical into both frontends,
 * and `shared/currency/` exists only in the PWA, so anything richer fails `tsc`
 * in the Telegram build. Callers pass plain numbers and resolve their own book.
 */

/**
 * The engine's minimum winning multiple. Below this the market refunds rather
 * than paying out, so it is a threshold here, never a floor applied to a number.
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
  /** The winning side is too big to fund the floor — every stake is refunded. */
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

  const multiple = (total * (1 - edge / 100)) / own;
  if (!isFinite(multiple) || multiple <= 0) return { kind: "no_pool" };
  if (multiple < PAYOUT_FLOOR) return { kind: "refund" };

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
  "Too much money is on this side. At the current pool this market refunds every stake instead of paying out — you would get your stake back, not a payout.";
