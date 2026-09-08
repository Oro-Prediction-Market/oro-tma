import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  MessageSquare,
  MoreHorizontal,
  ShieldAlert,
} from "lucide-react";
import {
  avatarFallback,
  deleteMarketComment,
  flagMarketComment,
  getCommentReplies,
  getMarketComments,
  postMarketComment,
  type CommentFlagReason,
  type MarketCommentView,
} from "@shared/api/client";
import { tierChip } from "@shared/reputation/tiers";
import { timeAgo } from "@shared/helpers/relativeTime";

const MAX_LENGTH = 500;
const PAGE_SIZE = 30;

/**
 * The pagination cursor: the last row you saw, identified by both its timestamp
 * and its id. The id half is what makes it exact when several comments share a
 * millisecond — the server compares the pair as a tuple.
 */
const cursorOf = (c: MarketCommentView) => `${c.createdAt}|${c.id}`;

type SortOrder = "newest" | "oldest";

/**
 * Lives in shared/ but is hand-copied between oro-tma and oro-pwa — the two
 * shared/ trees are duplicated directories, not a workspace package. Keep the
 * two files in step.
 *
 * Its imports are deliberately limited to modules that exist in BOTH repos'
 * shared/ dir: the two apps disagree on whether ui/, Page, BadgeGrid and
 * ProfileShareCard live in shared/ or src/, so importing any of those would
 * fail to resolve in one of them.
 *
 * Threading is one level deep, matching the server. A reply cannot be replied
 * to, so there is no recursion here and no indent that grows without bound.
 */
export interface MarketCommentsProps {
  marketId: string;
  /** Comments lock when the market settles; cancelled markets close entirely. */
  marketStatus?: string | null;
  /** Passed down rather than calling useAuth() — see the note in the mount. */
  currentUserId?: string | null;
  /** Opens the author's public profile. Omit to make authors non-tappable. */
  onOpenProfile?: (userId: string) => void;
  /**
   * Render to fill the container instead of as its own centred column.
   *
   * Use this when the thread sits inside a page's scrolling left column, next
   * to a sticky panel — the column already sets the width, and centring a
   * narrower block inside it would leave the thread floating away from the
   * content it belongs to. Standalone (the default) it keeps its own 760px
   * measure so it lines up under the themed detail views, which set the same.
   */
  embedded?: boolean;
  /**
   * Measure to match when standalone. Defaults to the 760px the themed detail
   * views use; the price view widens to 1080 on desktop, and a thread sitting
   * narrower than the market above it reads as a separate page rather than the
   * rest of the same one. Ignored when `embedded`.
   */
  maxWidth?: number;
}

const FLAG_REASONS: Array<{ value: CommentFlagReason; label: string }> = [
  { value: "spam", label: "Spam" },
  { value: "abuse", label: "Abuse or harassment" },
  { value: "misinformation", label: "Misinformation" },
  { value: "other", label: "Something else" },
];

export default function MarketComments({
  marketId,
  marketStatus,
  currentUserId,
  onOpenProfile,
  embedded,
  maxWidth = 760,
}: MarketCommentsProps) {
  const [comments, setComments] = useState<MarketCommentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [order, setOrder] = useState<SortOrder>("newest");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  // Reply state, keyed by parent comment id.
  const [replies, setReplies] = useState<
    Record<string, MarketCommentView[] | undefined>
  >({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loadingReplies, setLoadingReplies] = useState<Record<string, boolean>>(
    {},
  );
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const settled = marketStatus === "settled";
  const cancelled = marketStatus === "cancelled";
  const locked = settled || cancelled;
  const signedIn = Boolean(currentUserId);

  // Refetches whenever the sort changes. Sorting is server-side, because
  // re-ordering only the loaded page would misplace everything not yet fetched.
  useEffect(() => {
    let stale = false;
    setLoading(true);
    getMarketComments(marketId, { limit: PAGE_SIZE, order })
      .then((rows) => {
        if (stale) return;
        setComments(rows);
        setExhausted(rows.length < PAGE_SIZE);
      })
      .catch(() => {
        if (!stale) setError("Couldn't load comments.");
      })
      .finally(() => {
        if (!stale) setLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [marketId, order]);

  const loadMore = useCallback(async () => {
    const last = comments[comments.length - 1];
    if (!last || loadingMore) return;
    setLoadingMore(true);
    try {
      const older = await getMarketComments(marketId, {
        limit: PAGE_SIZE,
        cursor: cursorOf(last),
        order,
      });
      setComments((prev) => {
        // Guard the page boundary — two comments can share a createdAt to the
        // millisecond under load.
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...older.filter((c) => !seen.has(c.id))];
      });
      setExhausted(older.length < PAGE_SIZE);
    } catch {
      setError("Couldn't load more comments.");
    } finally {
      setLoadingMore(false);
    }
  }, [comments, marketId, loadingMore, order]);

  const post = useCallback(
    async (body: string, parentId?: string) => {
      if (!body.trim() || submitting) return false;
      setSubmitting(true);
      setError(null);
      try {
        const created = await postMarketComment(marketId, body.trim(), parentId);
        if (parentId) {
          // Replies read oldest-first, so a new one goes on the end. Bump the
          // parent's count and open the thread so the author sees it land.
          setReplies((prev) => ({
            ...prev,
            [parentId]: [...(prev[parentId] ?? []), created],
          }));
          setComments((prev) =>
            prev.map((c) =>
              c.id === parentId ? { ...c, replyCount: c.replyCount + 1 } : c,
            ),
          );
          setExpanded((prev) => ({ ...prev, [parentId]: true }));
          setReplyingTo(null);
        } else {
          setComments((prev) =>
            order === "newest" ? [created, ...prev] : [...prev, created],
          );
        }
        return true;
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Couldn't post that. Try again.",
        );
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [marketId, submitting, order],
  );

  const toggleReplies = useCallback(
    async (id: string) => {
      const open = !expanded[id];
      setExpanded((prev) => ({ ...prev, [id]: open }));
      if (!open || replies[id]) return;
      setLoadingReplies((prev) => ({ ...prev, [id]: true }));
      try {
        const rows = await getCommentReplies(id);
        setReplies((prev) => ({ ...prev, [id]: rows }));
        // Trust the server's count over the stored one, which drifts if
        // someone else replied or a moderator removed one since page load.
        setComments((prev) =>
          prev.map((c) => (c.id === id ? { ...c, replyCount: rows.length } : c)),
        );
      } catch {
        setError("Couldn't load replies.");
        setExpanded((prev) => ({ ...prev, [id]: false }));
      } finally {
        setLoadingReplies((prev) => ({ ...prev, [id]: false }));
      }
    },
    [expanded, replies],
  );

  const remove = useCallback(
    async (id: string, parentId: string | null) => {
      setMenuFor(null);
      // Optimistic: drop it, put it back if the server disagrees.
      const snapshotComments = comments;
      const snapshotReplies = parentId ? replies[parentId] : undefined;

      if (parentId) {
        setReplies((prev) => ({
          ...prev,
          [parentId]: (prev[parentId] ?? []).filter((r) => r.id !== id),
        }));
        setComments((prev) =>
          prev.map((c) =>
            c.id === parentId
              ? { ...c, replyCount: Math.max(0, c.replyCount - 1) }
              : c,
          ),
        );
      } else {
        setComments((prev) => prev.filter((c) => c.id !== id));
      }

      try {
        await deleteMarketComment(id);
      } catch {
        setError("Couldn't delete that comment.");
        setComments(snapshotComments);
        if (parentId && snapshotReplies) {
          setReplies((prev) => ({ ...prev, [parentId]: snapshotReplies }));
        }
      }
    },
    [comments, replies],
  );

  const flag = useCallback(
    async (id: string, parentId: string | null, reason: CommentFlagReason) => {
      setMenuFor(null);
      const mark = (v: boolean) => {
        if (parentId) {
          setReplies((prev) => ({
            ...prev,
            [parentId]: (prev[parentId] ?? []).map((r) =>
              r.id === id ? { ...r, hasFlagged: v } : r,
            ),
          }));
        } else {
          setComments((prev) =>
            prev.map((c) => (c.id === id ? { ...c, hasFlagged: v } : c)),
          );
        }
      };
      mark(true);
      try {
        await flagMarketComment(id, reason);
      } catch {
        setError("Couldn't report that comment.");
        mark(false);
      }
    },
    [],
  );

  return (
    <div
      style={{
        maxWidth: embedded ? "none" : maxWidth,
        margin: embedded ? 0 : "0 auto",
        // No bottom clearance here either: the app shell already reserves
        // 80px below every route for the fixed nav.
        padding: embedded ? "14px 0 8px" : "16px 16px 16px",
        marginTop: embedded ? 14 : 0,
        boxSizing: "border-box",
        // A hairline instead of empty space: the thread is part of the same
        // page as the market, not a second screen stacked under it.
        borderTop: "1px solid var(--glass-border)",
      }}
    >
      {locked ? (
        <LockedNotice settled={settled} />
      ) : signedIn ? (
        <Composer
          placeholder="Add a comment..."
          submitting={submitting}
          onSubmit={(body) => post(body)}
        />
      ) : (
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
          Sign in to join the conversation.
        </p>
      )}

      {/* Controls: sort on the left, safety notice on the right. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
          margin: "14px 0 4px",
        }}
      >
        <button
          onClick={() => setOrder(order === "newest" ? "oldest" : "newest")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: 0,
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "inherit",
            color: "var(--text-main)",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          {order === "newest" ? "Newest" : "Oldest"}
          <ChevronDown size={14} />
        </button>

        {/* Comments are the one place a stranger can put a link in front of
            someone holding a balance. Say so where they will read it. */}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginLeft: "auto",
            padding: "5px 11px",
            borderRadius: 999,
            fontSize: 11.5,
            color: "var(--text-muted)",
            background: "var(--bg-secondary)",
            border: "1px solid var(--glass-border)",
          }}
        >
          <ShieldAlert size={12} />
          Beware of external links.
        </span>
      </div>

      {error && (
        <p style={{ fontSize: 12, color: "var(--color-danger)", marginTop: 8 }}>
          {error}
        </p>
      )}

      {loading ? (
        <p style={{ fontSize: 13, color: "var(--text-subtle)" }}>Loading…</p>
      ) : comments.length === 0 ? (
        <div
          style={{
            marginTop: 12,
            padding: "20px 16px",
            textAlign: "center",
            fontSize: 12.5,
            color: "var(--text-subtle)",
            border: "1px dashed var(--glass-border)",
            borderRadius: 12,
          }}
        >
          {locked
            ? "Nobody commented on this one."
            : "No comments yet — say why you're taking your side."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {comments.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              signedIn={signedIn}
              locked={locked}
              submitting={submitting}
              menuOpen={menuFor === c.id}
              onToggleMenu={() => setMenuFor(menuFor === c.id ? null : c.id)}
              onCloseMenu={() => setMenuFor(null)}
              onFlag={(reason) => flag(c.id, null, reason)}
              onDelete={() => remove(c.id, null)}
              onOpenProfile={onOpenProfile}
              // Reply wiring — top level only.
              repliesOpen={Boolean(expanded[c.id])}
              repliesLoading={Boolean(loadingReplies[c.id])}
              replies={replies[c.id]}
              onToggleReplies={() => toggleReplies(c.id)}
              replying={replyingTo === c.id}
              onStartReply={() =>
                setReplyingTo(replyingTo === c.id ? null : c.id)
              }
              onSubmitReply={(body) => post(body, c.id)}
              replyMenuFor={menuFor}
              onToggleReplyMenu={(rid) =>
                setMenuFor(menuFor === rid ? null : rid)
              }
              onFlagReply={(rid, reason) => flag(rid, c.id, reason)}
              onDeleteReply={(rid) => remove(rid, c.id)}
            />
          ))}
          {!exhausted && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              style={{
                alignSelf: "flex-start",
                marginTop: 10,
                padding: "8px 14px",
                fontSize: 12.5,
                fontWeight: 600,
                fontFamily: "inherit",
                color: "var(--text-muted)",
                background: "transparent",
                border: "1px solid var(--glass-border)",
                borderRadius: 10,
                cursor: "pointer",
              }}
            >
              {loadingMore ? "Loading…" : "Show more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The write box, shared by the main composer and every reply box.
 *
 * Grows with its content instead of scrolling inside a fixed row, and on focus
 * pulls itself back above the Telegram keyboard — the same two-stage scroll
 * OnboardingPage uses, because the keyboard animates in over ~350ms and a
 * single immediate scroll lands before the viewport has resized.
 */
function Composer({
  placeholder,
  submitting,
  autoFocus,
  compact,
  onSubmit,
  onCancel,
}: {
  placeholder: string;
  submitting: boolean;
  autoFocus?: boolean;
  compact?: boolean;
  onSubmit: (body: string) => Promise<boolean | void> | void;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const remaining = MAX_LENGTH - draft.length;

  const handleFocus = useCallback(() => {
    const scroll = () =>
      ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setTimeout(scroll, 100);
    setTimeout(scroll, 400);
  }, []);

  const send = async () => {
    const ok = await onSubmit(draft);
    if (ok !== false) setDraft("");
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: compact ? "6px 6px 6px 12px" : "8px 8px 8px 14px",
        // Transparent so it reads as part of the page rather than a slab laid
        // on top of it — the outline alone is enough to say "type here".
        background: "transparent",
        border: "1px solid var(--glass-border)",
        borderRadius: compact ? 12 : 14,
      }}
    >
      <textarea
        ref={ref}
        rows={1}
        autoFocus={autoFocus}
        value={draft}
        maxLength={MAX_LENGTH}
        onChange={(e) => {
          setDraft(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
        }}
        onFocus={handleFocus}
        placeholder={placeholder}
        style={{
          flex: 1,
          minWidth: 0,
          resize: "none",
          border: "none",
          outline: "none",
          background: "transparent",
          padding: 0,
          fontSize: compact ? 13 : 14,
          fontFamily: "inherit",
          lineHeight: 1.5,
          color: "var(--text-main)",
        }}
      />
      {remaining < 100 && (
        <span
          style={{
            fontSize: 11,
            color:
              remaining < 20 ? "var(--color-warning)" : "var(--text-subtle)",
          }}
        >
          {remaining}
        </span>
      )}
      {onCancel && (
        <button
          onClick={onCancel}
          style={{
            flexShrink: 0,
            padding: "6px 8px",
            fontSize: 12,
            fontFamily: "inherit",
            color: "var(--text-subtle)",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      )}
      <button
        onClick={send}
        disabled={!draft.trim() || submitting}
        style={{
          flexShrink: 0,
          padding: compact ? "6px 13px" : "7px 16px",
          fontSize: compact ? 12.5 : 13,
          fontWeight: 700,
          fontFamily: "inherit",
          color: draft.trim() ? "#000" : "var(--text-subtle)",
          // Against a transparent field, a --bg-main fill reads as a hole
          // punched in the page; the idle button takes a lighter tint instead.
          background: draft.trim()
            ? "var(--color-primary)"
            : "var(--bg-secondary)",
          border: "none",
          borderRadius: 10,
          cursor: draft.trim() && !submitting ? "pointer" : "default",
          opacity: submitting ? 0.6 : 1,
        }}
      >
        {submitting ? "…" : compact ? "Reply" : "Post"}
      </button>
    </div>
  );
}

function LockedNotice({ settled }: { settled: boolean }) {
  return (
    <div
      style={{
        padding: "10px 14px",
        fontSize: 12.5,
        color: "var(--text-muted)",
        background: "var(--bg-secondary)",
        border: "1px solid var(--glass-border)",
        borderRadius: 12,
      }}
    >
      {settled
        ? "This market has settled — the thread stays as a record, but it's closed to new comments."
        : "This market was cancelled, so its thread is closed."}
    </div>
  );
}

function CommentRow({
  comment,
  signedIn,
  locked,
  submitting,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  onFlag,
  onDelete,
  onOpenProfile,
  isReply,
  repliesOpen,
  repliesLoading,
  replies,
  onToggleReplies,
  replying,
  onStartReply,
  onSubmitReply,
  replyMenuFor,
  onToggleReplyMenu,
  onFlagReply,
  onDeleteReply,
}: {
  comment: MarketCommentView;
  signedIn: boolean;
  locked?: boolean;
  submitting?: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onFlag: (reason: CommentFlagReason) => void;
  onDelete: () => void;
  onOpenProfile?: (userId: string) => void;
  /** Replies render smaller and carry none of the threading controls. */
  isReply?: boolean;
  repliesOpen?: boolean;
  repliesLoading?: boolean;
  replies?: MarketCommentView[];
  onToggleReplies?: () => void;
  replying?: boolean;
  onStartReply?: () => void;
  onSubmitReply?: (body: string) => Promise<boolean | void> | void;
  replyMenuFor?: string | null;
  onToggleReplyMenu?: (id: string) => void;
  onFlagReply?: (id: string, reason: CommentFlagReason) => void;
  onDeleteReply?: (id: string) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on any outside tap — on a touch screen there is no other way out.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: Event) => {
      if (!menuRef.current?.contains(e.target as Node)) onCloseMenu();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [menuOpen, onCloseMenu]);

  const avatarSize = isReply ? 30 : 40;
  const gutter = avatarSize + 12;

  if (comment.deleted) {
    // Still rendered because something hangs off it — either replies, or the
    // fact that a moderator acted. Showing the gap is more honest than
    // silently reflowing the thread.
    return (
      <div style={{ padding: "14px 0" }}>
        <div
          style={{
            paddingLeft: gutter,
            fontSize: 12.5,
            fontStyle: "italic",
            color: "var(--text-subtle)",
          }}
        >
          {comment.deletedBy === "admin"
            ? "This comment was removed by a moderator."
            : "This comment was deleted."}
        </div>
        {(comment.replyCount ?? 0) > 0 && (
          <RepliesSection
            comment={comment}
            gutter={gutter}
            signedIn={signedIn}
            submitting={submitting}
            repliesOpen={repliesOpen}
            repliesLoading={repliesLoading}
            replies={replies}
            onToggleReplies={onToggleReplies}
            replyMenuFor={replyMenuFor}
            onToggleReplyMenu={onToggleReplyMenu}
            onFlagReply={onFlagReply}
            onDeleteReply={onDeleteReply}
            onOpenProfile={onOpenProfile}
          />
        )}
      </div>
    );
  }

  const a = comment.author;
  const chip = tierChip(a?.reputationTier);
  const name = a?.username
    ? a.username
    : [a?.firstName, a?.lastName].filter(Boolean).join(" ") || "Someone";
  const tappable = Boolean(onOpenProfile && a);
  const openProfile = tappable ? () => onOpenProfile!(a!.id) : undefined;

  return (
    <div style={{ display: "flex", gap: 12, padding: isReply ? "10px 0" : "14px 0" }}>
      <div
        onClick={openProfile}
        style={{
          width: avatarSize,
          height: avatarSize,
          flexShrink: 0,
          borderRadius: "50%",
          overflow: "hidden",
          background: "var(--bg-secondary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: isReply ? 12 : 15,
          fontWeight: 800,
          color: "var(--text-muted)",
          cursor: tappable ? "pointer" : "default",
        }}
      >
        {a?.photoUrl ? (
          <img
            src={a.photoUrl}
            alt=""
            onError={avatarFallback(a.id)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          name.charAt(0).toUpperCase()
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Name, position, and age all read as one line, the way the eye scans
            it — the timestamp belongs next to the name, not pushed to the far
            edge where it reads as a separate column. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span
            onClick={openProfile}
            style={{
              fontSize: isReply ? 13 : 14,
              fontWeight: 700,
              color: "var(--text-main)",
              cursor: tappable ? "pointer" : "default",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "50%",
            }}
          >
            {name}
          </span>

          {/* Side only, never the stake — what someone is backing is context
              for their argument; how much they staked is not anyone's business. */}
          {comment.side && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                flexShrink: 0,
                padding: "2px 8px",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
                color: "var(--color-info)",
                background: "var(--bg-secondary)",
              }}
            >
              {comment.side.label}
            </span>
          )}

          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              flexShrink: 0,
              fontSize: 11,
              fontWeight: 700,
              color: chip.color,
            }}
          >
            <chip.Icon size={10} />
            {chip.label}
          </span>

          <span style={{ fontSize: 12, color: "var(--text-subtle)" }}>
            {timeAgo(comment.createdAt)}
          </span>

          {signedIn && (
            <div
              ref={menuRef}
              style={{ position: "relative", marginLeft: "auto" }}
            >
              <button
                onClick={onToggleMenu}
                aria-label="Comment options"
                style={{
                  display: "flex",
                  padding: 2,
                  color: "var(--text-subtle)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <MoreHorizontal size={16} />
              </button>

              {menuOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    zIndex: 20,
                    minWidth: 190,
                    marginTop: 4,
                    padding: 4,
                    borderRadius: 10,
                    background: "var(--bg-card)",
                    border: "1px solid var(--glass-border)",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                  }}
                >
                  {comment.isMine ? (
                    <MenuItem label="Delete comment" danger onClick={onDelete} />
                  ) : comment.hasFlagged ? (
                    <div
                      style={{
                        padding: "8px 10px",
                        fontSize: 12,
                        color: "var(--text-subtle)",
                      }}
                    >
                      You reported this.
                    </div>
                  ) : (
                    <>
                      <div
                        style={{
                          padding: "6px 10px 4px",
                          fontSize: 10.5,
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          color: "var(--text-subtle)",
                        }}
                      >
                        Report for
                      </div>
                      {FLAG_REASONS.map((r) => (
                        <MenuItem
                          key={r.value}
                          label={r.label}
                          onClick={() => onFlag(r.value)}
                        />
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rendered as a text child, so React escapes it. This must never become
            dangerouslySetInnerHTML — bodies are stored raw. */}
        <p
          style={{
            margin: "5px 0 0",
            fontSize: isReply ? 13.5 : 14,
            lineHeight: 1.5,
            color: "var(--text-main)",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          }}
        >
          {comment.body}
        </p>

        {/* Replies hang off top-level comments only — depth is capped at one,
            so a reply shows no Reply button of its own. */}
        {!isReply && (
          <>
            {signedIn && !locked && (
              <button
                onClick={onStartReply}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  marginTop: 8,
                  padding: 0,
                  fontSize: 12.5,
                  fontFamily: "inherit",
                  color: replying ? "var(--text-main)" : "var(--text-subtle)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <MessageSquare size={13} />
                Reply
              </button>
            )}

            {replying && onSubmitReply && (
              <div style={{ marginTop: 8 }}>
                <Composer
                  compact
                  autoFocus
                  placeholder={`Reply to ${name}...`}
                  submitting={Boolean(submitting)}
                  onSubmit={onSubmitReply}
                  onCancel={onStartReply}
                />
              </div>
            )}

            <RepliesSection
              comment={comment}
              gutter={0}
              signedIn={signedIn}
              submitting={submitting}
              repliesOpen={repliesOpen}
              repliesLoading={repliesLoading}
              replies={replies}
              onToggleReplies={onToggleReplies}
              replyMenuFor={replyMenuFor}
              onToggleReplyMenu={onToggleReplyMenu}
              onFlagReply={onFlagReply}
              onDeleteReply={onDeleteReply}
              onOpenProfile={onOpenProfile}
            />
          </>
        )}
      </div>
    </div>
  );
}

/** The "N Replies" expander and, once open, the replies themselves. */
function RepliesSection({
  comment,
  gutter,
  signedIn,
  submitting,
  repliesOpen,
  repliesLoading,
  replies,
  onToggleReplies,
  replyMenuFor,
  onToggleReplyMenu,
  onFlagReply,
  onDeleteReply,
  onOpenProfile,
}: {
  comment: MarketCommentView;
  gutter: number;
  signedIn: boolean;
  submitting?: boolean;
  repliesOpen?: boolean;
  repliesLoading?: boolean;
  replies?: MarketCommentView[];
  onToggleReplies?: () => void;
  replyMenuFor?: string | null;
  onToggleReplyMenu?: (id: string) => void;
  onFlagReply?: (id: string, reason: CommentFlagReason) => void;
  onDeleteReply?: (id: string) => void;
  onOpenProfile?: (userId: string) => void;
}) {
  const count = comment.replyCount ?? 0;
  if (count === 0 || !onToggleReplies) return null;

  return (
    <div style={{ paddingLeft: gutter }}>
      <button
        onClick={onToggleReplies}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          marginTop: 8,
          padding: 0,
          fontSize: 12.5,
          fontWeight: 600,
          fontFamily: "inherit",
          color: "var(--text-muted)",
          background: "none",
          border: "none",
          cursor: "pointer",
        }}
      >
        {count} {count === 1 ? "Reply" : "Replies"}
        {repliesOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {repliesOpen && (
        <div
          style={{
            marginTop: 2,
            paddingLeft: 12,
            borderLeft: "1px solid var(--glass-border)",
          }}
        >
          {repliesLoading && !replies ? (
            <p
              style={{
                fontSize: 12.5,
                color: "var(--text-subtle)",
                margin: "8px 0",
              }}
            >
              Loading…
            </p>
          ) : (
            (replies ?? []).map((r) => (
              <CommentRow
                key={r.id}
                isReply
                comment={r}
                signedIn={signedIn}
                submitting={submitting}
                menuOpen={replyMenuFor === r.id}
                onToggleMenu={() => onToggleReplyMenu?.(r.id)}
                onCloseMenu={() => onToggleReplyMenu?.("")}
                onFlag={(reason) => onFlagReply?.(r.id, reason)}
                onDelete={() => onDeleteReply?.(r.id)}
                onOpenProfile={onOpenProfile}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  label,
  danger,
  onClick,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        padding: "8px 10px",
        fontSize: 12.5,
        fontFamily: "inherit",
        textAlign: "left",
        color: danger ? "var(--color-danger)" : "var(--text-main)",
        background: "none",
        border: "none",
        borderRadius: 7,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
