import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, MoreHorizontal, ShieldAlert } from "lucide-react";
import {
  avatarFallback,
  deleteMarketComment,
  flagMarketComment,
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
 */
export interface MarketCommentsProps {
  marketId: string;
  /** Comments lock when the market settles; cancelled markets close entirely. */
  marketStatus?: string | null;
  /** Passed down rather than calling useAuth() — see the note in the mount. */
  currentUserId?: string | null;
  /** Opens the author's public profile. Omit to make authors non-tappable. */
  onOpenProfile?: (userId: string) => void;
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
}: MarketCommentsProps) {
  const [comments, setComments] = useState<MarketCommentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [order, setOrder] = useState<SortOrder>("newest");
  const [holdersOnly, setHoldersOnly] = useState(false);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const settled = marketStatus === "settled";
  const cancelled = marketStatus === "cancelled";
  const locked = settled || cancelled;
  const signedIn = Boolean(currentUserId);

  // Refetches whenever the sort or the holders filter changes — both are
  // server-side, because paging a client-side filter would skip rows.
  useEffect(() => {
    let stale = false;
    setLoading(true);
    getMarketComments(marketId, {
      limit: PAGE_SIZE,
      order,
      holders: holdersOnly,
    })
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
  }, [marketId, order, holdersOnly]);

  const loadMore = useCallback(async () => {
    const last = comments[comments.length - 1];
    if (!last || loadingMore) return;
    setLoadingMore(true);
    try {
      const older = await getMarketComments(marketId, {
        limit: PAGE_SIZE,
        cursor: cursorOf(last),
        order,
        holders: holdersOnly,
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
  }, [comments, marketId, loadingMore, order, holdersOnly]);

  const submit = useCallback(async () => {
    const body = draft.trim();
    if (!body || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await postMarketComment(marketId, body);
      // A new comment belongs at the top only when the newest is on top.
      setComments((prev) =>
        order === "newest" ? [created, ...prev] : [...prev, created],
      );
      setDraft("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Couldn't post that. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [draft, marketId, submitting, order]);

  const remove = useCallback(async (id: string) => {
    setMenuFor(null);
    // Optimistic: drop it, put it back if the server disagrees.
    let removed: MarketCommentView | undefined;
    setComments((prev) => {
      removed = prev.find((c) => c.id === id);
      return prev.filter((c) => c.id !== id);
    });
    try {
      await deleteMarketComment(id);
    } catch {
      setError("Couldn't delete that comment.");
      if (removed) {
        setComments((prev) =>
          [...prev, removed as MarketCommentView].sort(
            (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
          ),
        );
      }
    }
  }, []);

  const flag = useCallback(async (id: string, reason: CommentFlagReason) => {
    setMenuFor(null);
    setComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, hasFlagged: true } : c)),
    );
    try {
      await flagMarketComment(id, reason);
    } catch {
      setError("Couldn't report that comment.");
      setComments((prev) =>
        prev.map((c) => (c.id === id ? { ...c, hasFlagged: false } : c)),
      );
    }
  }, []);

  // The composer sits inline at the end of a long page, so on focus it can be
  // under the Telegram keyboard. Same approach as OnboardingPage: wait out the
  // ~350ms iOS keyboard animation, then bring it back into view.
  const handleFocus = useCallback(() => {
    const scroll = () =>
      composerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    setTimeout(scroll, 100);
    setTimeout(scroll, 400);
  }, []);

  const remaining = MAX_LENGTH - draft.length;

  return (
    <div
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "20px 16px 8px",
        boxSizing: "border-box",
      }}
    >
      {/* Composer — one rounded field with the action inside it. */}
      {locked ? (
        <LockedNotice settled={settled} />
      ) : signedIn ? (
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 8,
            padding: "8px 8px 8px 14px",
            background: "var(--bg-secondary)",
            border: "1px solid var(--glass-border)",
            borderRadius: 14,
          }}
        >
          <textarea
            ref={composerRef}
            rows={1}
            value={draft}
            maxLength={MAX_LENGTH}
            onChange={(e) => {
              setDraft(e.target.value);
              // Grow with the text instead of showing a scrollbar in a 1-row box.
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
            }}
            onFocus={handleFocus}
            placeholder="Add a comment..."
            style={{
              flex: 1,
              minWidth: 0,
              alignSelf: "center",
              resize: "none",
              border: "none",
              outline: "none",
              background: "transparent",
              padding: 0,
              fontSize: 14,
              fontFamily: "inherit",
              lineHeight: 1.5,
              color: "var(--text-main)",
            }}
          />
          {remaining < 100 && (
            <span
              style={{
                alignSelf: "center",
                fontSize: 11,
                color:
                  remaining < 20
                    ? "var(--color-warning)"
                    : "var(--text-subtle)",
              }}
            >
              {remaining}
            </span>
          )}
          <button
            onClick={submit}
            disabled={!draft.trim() || submitting}
            style={{
              flexShrink: 0,
              padding: "7px 16px",
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "inherit",
              color: draft.trim() ? "#000" : "var(--text-subtle)",
              background: draft.trim()
                ? "var(--color-primary)"
                : "var(--bg-main)",
              border: "none",
              borderRadius: 10,
              cursor: draft.trim() && !submitting ? "pointer" : "default",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? "Posting…" : "Post"}
          </button>
        </div>
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

        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={holdersOnly}
            onChange={(e) => setHoldersOnly(e.target.checked)}
            style={{ accentColor: "var(--color-primary)" }}
          />
          Holders
        </label>

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
          {holdersOnly
            ? "No comments from anyone holding a position yet."
            : locked
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
              menuOpen={menuFor === c.id}
              onToggleMenu={() => setMenuFor(menuFor === c.id ? null : c.id)}
              onCloseMenu={() => setMenuFor(null)}
              onFlag={(reason) => flag(c.id, reason)}
              onDelete={() => remove(c.id)}
              onOpenProfile={onOpenProfile}
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
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  onFlag,
  onDelete,
  onOpenProfile,
}: {
  comment: MarketCommentView;
  signedIn: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onFlag: (reason: CommentFlagReason) => void;
  onDelete: () => void;
  onOpenProfile?: (userId: string) => void;
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

  if (comment.deleted) {
    return (
      <div
        style={{
          padding: "14px 0 14px 52px",
          fontSize: 12.5,
          fontStyle: "italic",
          color: "var(--text-subtle)",
        }}
      >
        This comment was removed by a moderator.
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
    <div style={{ display: "flex", gap: 12, padding: "14px 0" }}>
      <div
        onClick={openProfile}
        style={{
          width: 40,
          height: 40,
          flexShrink: 0,
          borderRadius: "50%",
          overflow: "hidden",
          background: "var(--bg-secondary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 15,
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
              fontSize: 14,
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
                    <MenuItem
                      label="Delete comment"
                      danger
                      onClick={onDelete}
                    />
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
            fontSize: 14,
            lineHeight: 1.5,
            color: "var(--text-main)",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          }}
        >
          {comment.body}
        </p>
      </div>
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
