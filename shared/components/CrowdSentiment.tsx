/**
 * How much weight to put on the crowd's number.
 *
 * A market's percentage says what the money thinks; this says how much money,
 * from how many people, and for how long — the difference between a price set
 * by two friends this morning and one set by four hundred people over a week.
 *
 * It used to sit above the outcome rows under a "Crowd Sentiment" heading. It
 * belongs with the prediction panel instead: it is context for the decision to
 * stake, not a label for the list.
 *
 * Props are primitive on purpose — this file is hand-copied into both apps, and
 * the two clients' `Market` types have drifted.
 */
export function CrowdSentiment({
  composite,
  participantCount,
  reputationDepth,
  maturityScore,
}: {
  /** Confidence 0–1, or null/0 when the market has no signal yet. */
  composite: number | null | undefined;
  participantCount?: number;
  reputationDepth?: number;
  maturityScore?: number;
}) {
  if (composite == null || composite === 0) return null;

  const pct = Math.round(composite * 100);
  const color =
    composite >= 0.6
      ? "var(--color-success)"
      : composite >= 0.3
        ? "var(--color-warning)"
        : "var(--color-danger)";
  const label =
    composite >= 0.6 ? "Strong" : composite >= 0.3 ? "Balanced" : "Low";

  // An arc rather than a bar: this is a fraction of a whole, and it has to sit
  // inline beside a heading without taking a row of its own.
  const r = 7;
  const circ = 2 * Math.PI * r;
  const dash = (composite * circ).toFixed(2);

  const detail = [
    participantCount != null ? `Participants: ${participantCount}` : null,
    reputationDepth != null
      ? `Reputation depth: ${Math.round(reputationDepth * 100)}%`
      : null,
    maturityScore != null
      ? `Maturity: ${Math.round(maturityScore * 100)}%`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 6 }}
      title={detail || undefined}
    >
      <svg width="18" height="18" viewBox="0 0 18 18">
        <circle
          cx="9"
          cy="9"
          r={r}
          fill="none"
          stroke="var(--bg-secondary)"
          strokeWidth="2.5"
        />
        <circle
          cx="9"
          cy="9"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 9 9)"
        />
      </svg>
      <span
        style={{
          fontSize: "0.68rem",
          fontWeight: 800,
          color,
          letterSpacing: "0.02em",
          whiteSpace: "nowrap",
        }}
      >
        {label} confidence · {pct}%
      </span>
    </div>
  );
}
