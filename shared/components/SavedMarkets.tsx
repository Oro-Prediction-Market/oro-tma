import { useEffect, useState, type FC } from "react";
import { Bookmark, ChevronRight } from "lucide-react";
import {
  getSavedMarkets,
  getUserSavedMarkets,
  type Market,
  type SavedMarket,
} from "../api/client";
import { getCategoryVisual } from "../helpers/visuals";
import { timeAgo } from "../helpers/relativeTime";
import { useSavedMarkets } from "../hooks/useSavedMarkets";
import { SAVED_ACCENT } from "./SaveMarketButton";

/**
 * The saved list — a watchlist, not a second feed.
 *
 * Deliberately compact rather than a wall of full market cards: the point is
 * to find the one market you came back for, so each row carries the title,
 * where the crowd currently stands, and the state of play, and nothing else.
 * Ordered by when it was saved, newest first, which is the order it was built
 * in.
 *
 * Serves two pages. Without `userId` it is your own list and every row can be
 * unsaved in place; with one it is someone else's, read-only — the bookmark
 * becomes a marker rather than a button, because tapping it would otherwise
 * suggest you could remove a market from a list that is not yours.
 *
 * Currency is passed in, not computed: `shared/currency/` exists only in the
 * web app, so anything importing it would fail the Telegram app's build. Each
 * app hands in its own probability and pool formatters.
 */

interface Props {
  /** The app's own `calcProb` — the web one is currency-aware, the TMA one is not. */
  probOf: (market: Market, outcomeId: string) => number;
  /** "Nu 12,400" — formatted by the caller for the same reason. */
  poolLabel: (market: Market) => string;
  /** Open a market. Routing differs between the two shells. */
  onOpen: (marketId: string) => void;
  /** Rendered when there is nothing saved yet. Own list only. */
  onBrowse?: () => void;
  /** Whose list. Omit for your own; pass an id to read another predictor's. */
  userId?: string;
  /** Their display name, for the empty state. */
  ownerName?: string;
}

const STATUS_CHIP: Record<string, { label: string; color: string }> = {
  upcoming: { label: "Upcoming", color: "var(--color-info)" },
  open: { label: "Open", color: "var(--color-success)" },
  closed: { label: "Closed", color: "var(--color-warning)" },
  resolving: { label: "Resolving", color: "var(--color-warning)" },
  resolved: { label: "Resolved", color: "var(--text-muted)" },
  settled: { label: "Settled", color: "var(--text-muted)" },
  cancelled: { label: "Cancelled", color: "var(--color-danger)" },
};

function leader(market: Market, probOf: Props["probOf"]) {
  const outcomes = market.outcomes ?? [];
  if (!outcomes.length) return null;
  let best = outcomes[0];
  let bestP = probOf(market, best.id);
  for (const o of outcomes.slice(1)) {
    const p = probOf(market, o.id);
    if (p > bestP) {
      best = o;
      bestP = p;
    }
  }
  return { label: best.label, pct: Math.round(bestP * 100) };
}

const SavedRow: FC<{
  market: SavedMarket;
  probOf: Props["probOf"];
  poolLabel: Props["poolLabel"];
  onOpen: (id: string) => void;
  /** Absent on someone else's list — the bookmark is then a marker, not a button. */
  onUnsave?: (id: string) => void;
}> = ({ market, probOf, poolLabel, onOpen, onUnsave }) => {
  const visual = getCategoryVisual(market.category);
  const chip = STATUS_CHIP[market.status] ?? STATUS_CHIP.open;
  const top = leader(market, probOf);
  const settled = market.status === "resolved" || market.status === "settled";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(market.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(market.id);
        }
      }}
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        padding: "12px 14px",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        cursor: "pointer",
        // A settled market you saved is still worth keeping; it just is not
        // live any more, and the row says so by standing back.
        opacity: settled ? 0.72 : 1,
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 10,
          flexShrink: 0,
          background: market.imageUrl ? "var(--bg-secondary)" : visual.gradient,
          backgroundImage: market.imageUrl
            ? `url(${market.imageUrl})`
            : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "0.82rem",
            fontWeight: 700,
            color: "var(--text-main)",
            lineHeight: 1.35,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {market.title}
        </div>

        <div
          style={{
            marginTop: 5,
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            fontSize: "0.68rem",
            fontWeight: 700,
            color: "var(--text-subtle)",
          }}
        >
          <span style={{ color: chip.color }}>{chip.label}</span>
          <span>·</span>
          <span>{poolLabel(market)}</span>
          {top && (
            <>
              <span>·</span>
              <span
                style={{ color: "var(--text-muted)", minWidth: 0 }}
                title={top.label}
              >
                {top.label} {top.pct}%
              </span>
            </>
          )}
        </div>

        <div
          style={{
            marginTop: 3,
            fontSize: "0.63rem",
            fontWeight: 600,
            color: "var(--text-subtle)",
          }}
        >
          Saved {timeAgo(market.savedAt)}
        </div>
      </div>

      {onUnsave ? (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onUnsave(market.id);
          }}
          aria-label="Remove from saved"
          title="Remove from saved"
          style={{
            background: "transparent",
            border: "none",
            padding: 6,
            lineHeight: 0,
            cursor: "pointer",
            color: SAVED_ACCENT,
            flexShrink: 0,
          }}
        >
          <Bookmark size={16} fill="currentColor" strokeWidth={2.2} />
        </button>
      ) : (
        <span
          aria-hidden="true"
          style={{
            padding: 6,
            lineHeight: 0,
            color: SAVED_ACCENT,
            opacity: 0.55,
            flexShrink: 0,
          }}
        >
          <Bookmark size={16} fill="currentColor" strokeWidth={2.2} />
        </span>
      )}

      <ChevronRight size={15} color="var(--text-subtle)" style={{ flexShrink: 0 }} />
    </div>
  );
};

export const SavedMarketsPanel: FC<Props> = ({
  probOf,
  poolLabel,
  onOpen,
  onBrowse,
  userId,
  ownerName,
}) => {
  const [markets, setMarkets] = useState<SavedMarket[] | null>(null);
  const [error, setError] = useState(false);
  const { toggle } = useSavedMarkets();
  const isOwn = !userId;

  useEffect(() => {
    setMarkets(null);
    setError(false);
    (userId ? getUserSavedMarkets(userId) : getSavedMarkets())
      .then(setMarkets)
      .catch(() => setError(true));
  }, [userId]);

  /**
   * Removed from the list on the spot rather than after a refetch: the row is
   * gone because the user just said so, and waiting on the network to admit it
   * makes the tap feel broken.
   */
  const unsave = async (id: string) => {
    const before = markets;
    setMarkets((m) => (m ? m.filter((x) => x.id !== id) : m));
    try {
      await toggle(id);
    } catch {
      setMarkets(before ?? null);
    }
  };

  if (error) {
    return (
      <div
        style={{
          padding: "14px 16px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border)",
          background: "var(--bg-card)",
          fontSize: "0.8rem",
          color: "var(--text-muted)",
        }}
      >
        Could not load {isOwn ? "your saved markets" : "this list"} just now.
        Please try again shortly.
      </div>
    );
  }

  if (!markets) {
    return (
      <div
        style={{
          padding: "28px 16px",
          textAlign: "center",
          fontSize: "0.8rem",
          color: "var(--text-subtle)",
        }}
      >
        Loading…
      </div>
    );
  }

  if (!markets.length) {
    return (
      <div
        style={{
          padding: "34px 20px",
          textAlign: "center",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
        }}
      >
        <Bookmark
          size={26}
          color="var(--text-subtle)"
          strokeWidth={2}
          style={{ marginBottom: 10 }}
        />
        <div
          style={{
            fontSize: "0.88rem",
            fontWeight: 800,
            color: "var(--text-main)",
          }}
        >
          {isOwn ? "Nothing saved yet" : "No saved markets"}
        </div>
        <p
          style={{
            margin: "6px auto 0",
            maxWidth: 300,
            fontSize: "0.76rem",
            lineHeight: 1.55,
            color: "var(--text-muted)",
          }}
        >
          {isOwn
            ? "Open any market and tap Save to keep it here. Saving costs nothing and does not place a prediction."
            : `${ownerName ?? "This predictor"} has not saved any markets yet.`}
        </p>
        {isOwn && onBrowse && (
          <button
            onClick={onBrowse}
            style={{
              marginTop: 14,
              padding: "9px 18px",
              borderRadius: 10,
              border: "none",
              background: SAVED_ACCENT,
              color: "#04212a",
              fontSize: "0.78rem",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Browse markets
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          fontSize: "0.62rem",
          fontWeight: 800,
          color: "var(--text-subtle)",
          textTransform: "uppercase",
          letterSpacing: "0.07em",
        }}
      >
        {markets.length} saved
      </div>
      {markets.map((m) => (
        <SavedRow
          key={m.id}
          market={m}
          probOf={probOf}
          poolLabel={poolLabel}
          onOpen={onOpen}
          onUnsave={isOwn ? unsave : undefined}
        />
      ))}
    </div>
  );
};
