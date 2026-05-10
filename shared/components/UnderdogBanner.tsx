/**
 * Shows an amber banner when one outcome holds >85% of the pool.
 * Informs users that the underdog guarantees a profit (1.05× floor) if it wins.
 */

interface OutcomeAmount {
  label: string;
  totalBetAmount?: string | number | null;
}

/**
 * Returns the label of the underdog outcome when the pool is lopsided (>85% on
 * one side), otherwise null. Uses raw pool ratios — not Laplace-smoothed —
 * because we want to detect real imbalance.
 */
export function getUnderdogLabel(
  outcomes: OutcomeAmount[],
  totalPool: number,
): string | null {
  if (totalPool <= 0 || outcomes.length < 2) return null;
  const maxPct = Math.max(
    ...outcomes.map((o) => (Number(o.totalBetAmount || 0) / totalPool) * 100),
  );
  if (maxPct <= 85) return null;
  const underdog = outcomes.reduce((min, o) =>
    Number(o.totalBetAmount || 0) < Number(min.totalBetAmount || 0) ? o : min,
  );
  return underdog.label;
}

export function UnderdogBanner({ underdogLabel }: { underdogLabel: string }) {
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
        <b>{underdogLabel}</b> is the underdog right now. Picking{" "}
        {underdogLabel} guarantees a profit if it wins.
      </span>
    </div>
  );
}
