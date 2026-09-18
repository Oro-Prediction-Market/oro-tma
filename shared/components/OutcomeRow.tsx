/**
 * One outcome on a market detail page — the row a user taps to predict.
 *
 * Replaces a three-band stack (header row, then a 20px bar with the percentage
 * inside it, then a right-aligned total) that cost ~83px per outcome. Everything
 * it showed is still here; the bar is now the row's background rather than a
 * band beneath it, and the total sits under the name. A four-outcome market no
 * longer fills a phone screen before the user can act.
 *
 * Props are primitive on purpose — no `Market`, no currency helpers. This file
 * is hand-copied into both frontends and `shared/currency/` exists in only one
 * of them, so anything richer would fail `tsc` in the Telegram app and break its
 * build. Each page maps its own data in.
 *
 * It exists at all because the two pages had already drifted: the same row was
 * duplicated in both, and only one of them applied the payout floor, so the two
 * apps quoted different odds for the same market.
 */

export interface OutcomeRowProps {
  label: string;
  /** Flag, outcome image, or market image — already resolved by the page. */
  avatarUrl: string | null;
  /** Shown when there is no image. Usually the label's first letter. */
  fallbackInitial: string;
  /** Category gradient behind the fallback initial. */
  gradient: string;
  /** World Cup flags are square-ish and unbordered; everything else is a disc. */
  isFlag?: boolean;
  /** Share of the pool, 0–100. Drives the background fill and the pill. */
  pct: number;
  /**
   * Payout multiple, or null when there is nothing to quote.
   *
   * Null hides the pill entirely rather than printing a placeholder. An empty
   * market has no price — a dash read as missing data, and a number derived
   * from the prior was worse, because it looked like a real quote.
   */
  /**
   * The multiple, already formatted — `~1.35x`, `refund`, or `—`. A string, not
   * a number, because a market too lopsided to fund a payout has no multiple to
   * print: it refunds. Two different upstream formulas used to feed this prop,
   * and the component applied a cap of its own on top; formatting upstream via
   * `formatQuote` is what stops the same outcome reading differently on two
   * pages. Null hides the pill entirely.
   */
  odds: string | null;
  /** Staked on this outcome, already in the viewer's currency. */
  totalStaked: number;
  /** Currency symbol or short code, e.g. "Nu" or "$". */
  currencyLabel: string;
  /** Row accent: the outcome's colour, or muted once the market resolves. */
  color: string;
  /** Open, not eliminated — shows the PREDICT chip and enables the tap. */
  pickable?: boolean;
  eliminated?: boolean;
  /** Show the OUT chip. Only meaningful while the market is still open. */
  showOutChip?: boolean;
  onPick?: () => void;
  onImageError?: () => void;
}

export function OutcomeRow({
  label,
  avatarUrl,
  fallbackInitial,
  gradient,
  isFlag = false,
  pct,
  odds,
  totalStaked,
  currencyLabel,
  color,
  pickable = false,
  eliminated = false,
  showOutChip = false,
  onPick,
  onImageError,
}: OutcomeRowProps) {
  // Never let the fill vanish completely — a 0% outcome with no sliver at all
  // reads as a rendering fault rather than as "nobody backed this".
  const fillWidth = Math.max(2, Math.min(100, pct));

  return (
    <div
      role={pickable ? "button" : undefined}
      tabIndex={pickable ? 0 : undefined}
      onClick={() => pickable && onPick?.()}
      onKeyDown={(e) => {
        if (!pickable) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPick?.();
        }
      }}
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "var(--radius-md)",
        background: "var(--bg-secondary)",
        opacity: eliminated ? 0.5 : 1,
        cursor: pickable ? "pointer" : "default",
      }}
    >
      {/* The probability bar, as the row's background. Costs no vertical space,
          which is the whole point — it used to be a 20px band of its own. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: `${fillWidth}%`,
          background: `linear-gradient(90deg, ${color}38, ${color}18)`,
          transition: "width 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          padding: "8px 10px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            flexShrink: 0,
            width: 30,
            height: 30,
            borderRadius: isFlag ? 5 : "var(--radius-full)",
            overflow: "hidden",
            background: isFlag ? "transparent" : gradient,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: isFlag ? "none" : "2px solid #fff",
            boxShadow: isFlag ? "none" : "var(--shadow-sm)",
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              onError={onImageError}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          ) : (
            <span style={{ fontSize: 12, fontWeight: 900, color: "#fff" }}>
              {fallbackInitial}
            </span>
          )}
        </div>

        {/* Name over the staked total. `minWidth: 0` is what lets the name
            ellipsise instead of pushing the pill off the row. */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 800,
              color: "var(--text-main)",
              fontSize: "0.9rem",
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: "0.68rem",
              fontWeight: 700,
              color: "var(--text-subtle)",
              lineHeight: 1.3,
            }}
          >
            {currencyLabel} {totalStaked.toLocaleString()}
          </div>
        </div>

        {/* Odds over percentage. The percentage used to live inside the bar;
            moving it here is what frees the bar to be pure background.

            The pill is keyed on the percentage, not on the odds. A share of the
            pool always exists, while a multiple does not — an empty book has no
            price, and a one-sided one refunds rather than paying. Gating the
            whole pill on `odds` took the percentage down with it and left the
            row with nothing at all on exactly the outcomes worth looking at. */}
        <div
          style={{
            flexShrink: 0,
            background: `${color}15`,
            color,
            padding: "3px 8px",
            borderRadius: "var(--radius-full)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            lineHeight: 1.1,
          }}
        >
          {odds !== null && (
            <span style={{ fontSize: "0.78rem", fontWeight: 900 }}>
              {odds}
            </span>
          )}
          {/* Carries the pill on its own when there is no multiple, so it takes
              the prominent size rather than sitting there as a 0.58rem orphan. */}
          <span
            style={
              odds === null
                ? { fontSize: "0.78rem", fontWeight: 900 }
                : { fontSize: "0.58rem", fontWeight: 700, opacity: 0.75 }
            }
          >
            {pct.toFixed(0)}%
          </span>
        </div>

        {pickable && (
          <div
            style={{
              flexShrink: 0,
              background: color,
              color: "#fff",
              fontSize: "0.62rem",
              fontWeight: 800,
              padding: "4px 10px",
              borderRadius: "var(--radius-full)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Predict
          </div>
        )}

        {eliminated && showOutChip && (
          <div
            style={{
              flexShrink: 0,
              background: "rgba(239,68,68,0.15)",
              color: "#ef4444",
              border: "1px solid rgba(239,68,68,0.35)",
              fontSize: "0.62rem",
              fontWeight: 800,
              padding: "4px 10px",
              borderRadius: "var(--radius-full)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Out
          </div>
        )}
      </div>
    </div>
  );
}
