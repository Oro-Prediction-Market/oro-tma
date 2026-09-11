import { type CSSProperties, type FC } from "react";
import { Bookmark, ChevronRight } from "lucide-react";
import { SAVED_ACCENT } from "./SaveMarketButton";

/**
 * The "Saved Markets" row on your own profile.
 *
 * A labelled door to a list, matching the column of identical doors beside it
 * (Wallet, Results, Collectibles). Another predictor's profile has no row like
 * this — it is a grid of stat tiles — so their saved markets are a tile in
 * that grid instead, and each profile keeps the shape it already had.
 *
 * The count is passed in, live from the store the Save buttons write to, so
 * the subtitle moves the moment one is tapped anywhere in the app.
 */

interface Props {
  count: number;
  onOpen: () => void;
  style?: CSSProperties;
}

export const SavedMarketsShortcut: FC<Props> = ({ count, onOpen, style }) => {
  const subtitle = count
    ? `${count} market${count === 1 ? "" : "s"} you bookmarked`
    : "Bookmark a market to come back to it";

  return (
    <button
      onClick={onOpen}
      style={{
        borderRadius: 14,
        padding: "14px 16px",
        background: "var(--bg-card)",
        border: "1px solid var(--glass-border)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        cursor: "pointer",
        boxShadow: "var(--shadow-sm)",
        width: "100%",
        ...style,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: "rgba(6,182,212,0.14)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Bookmark size={20} color={SAVED_ACCENT} />
      </div>
      <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
        <div
          style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)" }}
        >
          Saved Markets
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-subtle)",
            marginTop: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {subtitle}
        </div>
      </div>
      <ChevronRight size={16} color="var(--text-muted)" />
    </button>
  );
};

export default SavedMarketsShortcut;
