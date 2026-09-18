/**
 * An amber banner for a lopsided pool: one outcome holds more than 85% of the
 * money, so every other outcome is priced generously.
 *
 * It used to name "the underdog" — and that only means something on a binary
 * market. On a fifteen-school market with a single Nu 100 prediction it picked
 * whichever zero-pool outcome happened to sit first in the array and announced
 * "most picks are against Ugyen Academy", which was true of thirteen other
 * schools in exactly the same way, and described one prediction as "most picks".
 *
 * Naming the favourite instead is unambiguous at any outcome count: there is
 * only ever one outcome holding 85% of a pool.
 */

interface OutcomeAmount {
  label: string;
  totalBetAmount?: string | number | null;
}

/** A pool this concentrated is the point of the banner. */
const LOPSIDED_PCT = 85;

/**
 * The label of the outcome holding more than 85% of the pool, or null when no
 * outcome does.
 *
 * Raw pool ratios, not the Laplace-smoothed probabilities shown on the rows:
 * this is about where the money actually is, and smoothing would drag a genuine
 * 100% concentration below the threshold.
 */
export function getLopsidedFavourite(
  outcomes: OutcomeAmount[],
  totalPool: number,
): string | null {
  if (totalPool <= 0 || outcomes.length < 2) return null;
  let favourite: OutcomeAmount | null = null;
  let best = -1;
  for (const o of outcomes) {
    const amount = Number(o.totalBetAmount || 0);
    if (amount > best) {
      best = amount;
      favourite = o;
    }
  }
  if (!favourite || (best / totalPool) * 100 <= LOPSIDED_PCT) return null;
  return favourite.label;
}

export function UnderdogBanner({ favouriteLabel }: { favouriteLabel: string }) {
  return (
    <div
      style={{
        background: "rgba(245,158,11,0.1)",
        border: "1px solid rgba(245,158,11,0.3)",
        borderRadius: 10,
        padding: "8px 12px",
        fontSize: 11,
        fontWeight: 700,
        color: "#f59e0b",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span>⚡</span>
      <span>
        Nearly all the pool is on <b>{favouriteLabel}</b>. Any other outcome pays
        more if it wins.
      </span>
    </div>
  );
}
