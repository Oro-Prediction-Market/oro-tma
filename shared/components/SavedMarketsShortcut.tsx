import { type CSSProperties, type FC } from "react";
import { Bookmark, ChevronRight } from "lucide-react";
import { SAVED_ACCENT } from "./SaveMarketButton";

/**
 * The "Saved Markets" row on a profile.
 *
 * One component for both profiles — your own and anyone else's — because the
 * row is the same object either way: a labelled door to a list, sitting in a
 * column of identical doors (Wallet, Results, Collectibles). Rendering
 * somebody else's saved markets as an inline list instead would have made
 * their profile read differently from your own for no reason.
 *
 * The count is passed in rather than fetched: your own comes live from the
 * store the Save buttons write to, and another predictor's arrives with their
 * profile, so neither costs a request of its own.
 */

interface Props {
  count: number;
  onOpen: () => void;
  /** Whose row. Changes only the subtitle. */
  owner?: "you" | "them";
  /** Their name, for the empty subtitle on someone else's profile. */
  ownerName?: string;
  style?: CSSProperties;
}

export const SavedMarketsShortcut: FC<Props> = ({
  count,
  onOpen,
  owner = "you",
  ownerName,
  style,
}) => {
  const plural = `market${count === 1 ? "" : "s"}`;
  const subtitle =
    owner === "you"
      ? count
        ? `${count} ${plural} you bookmarked`
        : "Bookmark a market to come back to it"
      : count
        ? `${count} ${plural} they are watching`
        : `${ownerName ?? "This predictor"} hasn't saved any markets`;

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
