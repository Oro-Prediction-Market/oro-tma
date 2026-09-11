import { useState, type CSSProperties, type FC, type MouseEvent } from "react";
import { Bookmark } from "lucide-react";
import { useSavedMarkets } from "../hooks/useSavedMarkets";

/**
 * The bookmark toggle.
 *
 * It lives on market pages only — deliberately not on feed cards, where a
 * bookmark on every tile competed with the thing the card is for, which is
 * picking an outcome.
 *
 * Four shapes, because each market page has its own header: `pill` is the flat
 * chip the Telegram page sits Share in, `outline` is the bordered button the
 * web page sits Share in, `inherit` takes its whole appearance from the caller
 * — which is how it joins the UFC, UCL, EPL, esports and price headers, each
 * with its own local button style and accent — and `icon` is the bare glyph,
 * kept for a surface that has room for nothing else.
 *
 * Whatever the shape, the saved state is applied last: the caller's style wins
 * everywhere except the one colour that has to say "saved", or a themed header
 * would render a bookmark that never visibly fills.
 *
 * Saving costs nothing and commits nothing, so the button asks for no
 * confirmation in either direction — the undo is the same tap.
 */

/**
 * The colour "saved" is drawn in, everywhere it appears.
 *
 * Cyan because the profile's other shortcuts have already claimed the obvious
 * ones — blue is the wallet, green is results, amber is collectibles and tier,
 * indigo is referrals — and a fifth row in a colour already carrying a meaning
 * reads as a relative of whichever row it borrowed from. Themed market
 * headers override it with their own accent.
 */
export const SAVED_ACCENT = "#06b6d4";

export type SaveButtonVariant = "icon" | "pill" | "outline" | "inherit";

interface Props {
  marketId: string;
  variant?: SaveButtonVariant;
  /** Match a themed surface (UFC red, UCL navy) instead of the card default. */
  tone?: "default" | "onDark";
  /** Drop the word and render a square — what the web header does on mobile. */
  compact?: boolean;
  /** The colour "saved" is drawn in. Themed headers pass their own. */
  accent?: string;
  /** Glyph size. `inherit` callers match whatever their Share icon uses. */
  size?: number;
  style?: CSSProperties;
}

export const SaveMarketButton: FC<Props> = ({
  marketId,
  variant = "icon",
  tone = "default",
  compact = false,
  accent = SAVED_ACCENT,
  size,
  style,
}) => {
  const { isSaved, toggle } = useSavedMarkets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saved = isSaved(marketId);

  const onClick = async (e: MouseEvent) => {
    // Every one of these sits inside something clickable — a card that opens
    // the market, a header that does not want the tap.
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;

    setBusy(true);
    setError(null);
    try {
      await toggle(marketId);
    } catch (err) {
      setError(
        err instanceof Error && /sign in/i.test(err.message)
          ? "Sign in to save"
          : "Could not save",
      );
      window.setTimeout(() => setError(null), 2200);
    } finally {
      setBusy(false);
    }
  };

  const idle = tone === "onDark" ? "rgba(255,255,255,0.72)" : "var(--text-muted)";
  const label = error ?? (saved ? "Saved" : "Save");
  const title = saved ? "Remove from saved" : "Save this market";

  /**
   * The colour the state demands, applied over the caller's style. Error beats
   * saved: a bookmark that silently failed must not sit there looking like it
   * worked.
   *
   * Colour only, deliberately. Overriding `borderColor` on a caller whose
   * style sets the `border` shorthand mixes the two forms — React warns about
   * it, and unsaving leaves the longhand behind, so the button came back with
   * a white border instead of its theme's. The filled glyph and the accent
   * text already say "saved" on their own.
   */
  const stateStyle: CSSProperties = error
    ? { color: "var(--color-danger)" }
    : saved
      ? { color: accent }
      : {};

  const common = {
    onClick,
    "aria-pressed": saved,
    "aria-label": title,
    title: error ?? title,
    disabled: busy,
  } as const;

  const glyph = (px: number, stroke = 2.2) => (
    <Bookmark
      size={px}
      fill={saved ? "currentColor" : "none"}
      strokeWidth={stroke}
    />
  );

  if (variant === "inherit") {
    return (
      <button
        {...common}
        style={{
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.6 : 1,
          transition: "color 140ms ease",
          ...style,
          ...stateStyle,
        }}
      >
        {glyph(size ?? 15, 2.4)}
        {!compact && label}
      </button>
    );
  }

  if (variant === "outline") {
    return (
      <button
        {...common}
        style={{
          background: "var(--bg-card)",
          border: `1px solid ${saved ? accent : "var(--border)"}`,
          borderRadius: "var(--radius-sm)",
          padding: compact ? "8px" : "8px 16px",
          fontSize: "0.85rem",
          fontWeight: 800,
          color: "var(--text-main)",
          cursor: busy ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          boxShadow: "var(--shadow-sm)",
          transition: "all 0.2s",
          width: compact ? 36 : "auto",
          height: compact ? 36 : "auto",
          justifyContent: "center",
          opacity: busy ? 0.6 : 1,
          ...style,
          ...stateStyle,
        }}
      >
        {glyph(size ?? 16, 2.6)}
        {!compact && label}
      </button>
    );
  }

  if (variant === "pill") {
    return (
      <button
        {...common}
        style={{
          background:
            tone === "onDark"
              ? "rgba(255,255,255,0.12)"
              : "var(--bg-secondary)",
          border: "none",
          padding: "4px 12px",
          borderRadius: 8,
          fontSize: "0.75rem",
          fontWeight: 800,
          color: tone === "onDark" ? "#fff" : "var(--text-main)",
          cursor: busy ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          opacity: busy ? 0.6 : 1,
          transition: "color 140ms ease, opacity 140ms ease",
          ...style,
          ...stateStyle,
        }}
      >
        {glyph(size ?? 13)}
        {label}
      </button>
    );
  }

  return (
    <button
      {...common}
      style={{
        background: "transparent",
        border: "none",
        padding: 4,
        margin: -4,
        lineHeight: 0,
        cursor: busy ? "default" : "pointer",
        color: idle,
        opacity: busy ? 0.5 : 1,
        transition: "color 140ms ease, opacity 140ms ease",
        flexShrink: 0,
        ...style,
        ...stateStyle,
      }}
    >
      {glyph(size ?? 16)}
    </button>
  );
};

export default SaveMarketButton;
