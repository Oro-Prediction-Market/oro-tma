import { useCallback, useEffect, useRef, useState } from "react";
import { Flag, MessageSquare, Send, Trash2 } from "lucide-react";
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
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flagging, setFlagging] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const settled = marketStatus === "settled";
  const cancelled = marketStatus === "cancelled";
  const locked = settled || cancelled;
  const signedIn = Boolean(currentUserId);

  useEffect(() => {
    let cancelledLoad = false;
    setLoading(true);
    getMarketComments(marketId, { limit: PAGE_SIZE })
      .then((rows) => {
        if (cancelledLoad) return;
        setComments(rows);
        setExhausted(rows.length < PAGE_SIZE);
      })
      .catch(() => {
        if (!cancelledLoad) setError("Couldn't load comments.");
      })
      .finally(() => {
        if (!cancelledLoad) setLoading(false);
      });
    return () => {
      cancelledLoad = true;
    };
  }, [marketId]);

  const loadMore = useCallback(async () => {
    const oldest = comments[comments.length - 1];
    if (!oldest || loadingMore) return;
    setLoadingMore(true);
    try {
      const older = await getMarketComments(marketId, {
        limit: PAGE_SIZE,
        before: oldest.createdAt,
      });
      setComments((prev) => {
        // Guard against a duplicate arriving on the boundary — two comments can
        // share a createdAt to the millisecond under load.
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...older.filter((c) => !seen.has(c.id))];
      });
      setExhausted(older.length < PAGE_SIZE);
    } catch {
      setError("Couldn't load older comments.");
    } finally {
      setLoadingMore(false);
    }
  }, [comments, marketId, loadingMore]);

  const submit = useCallback(async () => {
    const body = draft.trim();
    if (!body || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await postMarketComment(marketId, body);
      setComments((prev) => [created, ...prev]);
      setDraft("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Couldn't post that. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [draft, marketId, submitting]);

  const remove = useCallback(async (id: string) => {
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

  const flag = useCallback(
    async (id: string, reason: CommentFlagReason) => {
      setFlagging(null);
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
    },
    [],
  );

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
        padding: "24px 16px 8px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <MessageSquare size={15} style={{ color: "var(--text-muted)" }} />
        <span
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "var(--text-subtle)",
          }}
        >
          Comments
          {comments.length > 0 ? ` · ${comments.length}` : ""}
        </span>
      </div>

      {/* Composer. Above the list so posting does not require scrolling past
          every existing comment first. */}
      {locked ? (
        <LockedNotice settled={settled} />
      ) : signedIn ? (
        <div style={{ marginBottom: 16 }}>
          <textarea
            ref={composerRef}
            rows={3}
            value={draft}
            maxLength={MAX_LENGTH}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={handleFocus}
            placeholder="Why are you taking this side?"
            style={{
              width: "100%",
              boxSizing: "border-box",
              resize: "vertical",
              padding: "10px 12px",
              fontSize: 14,
              fontFamily: "inherit",
              lineHeight: 1.45,
              color: "var(--text-main)",
              background: "var(--bg-secondary)",
              border: "1px solid var(--glass-border)",
              borderRadius: 12,
              outline: "none",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 8,
              gap: 12,
            }}
          >
            <span
              style={{
                fontSize: 11,
                color:
                  remaining < 50 ? "var(--color-warning)" : "var(--text-subtle)",
              }}
            >
              {remaining < 100 ? `${remaining} left` : ""}
            </span>
            <button
              onClick={submit}
              disabled={!draft.trim() || submitting}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "inherit",
                color: draft.trim() ? "#000" : "var(--text-subtle)",
                background: draft.trim()
                  ? "var(--color-primary)"
                  : "var(--bg-secondary)",
                border: "1px solid var(--glass-border)",
                borderRadius: 10,
                cursor: draft.trim() && !submitting ? "pointer" : "default",
                opacity: submitting ? 0.6 : 1,
              }}
            >
              <Send size={13} />
              {submitting ? "Posting…" : "Post"}
            </button>
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
          Sign in to join the conversation.
        </p>
      )}

      {error && (
        <p
          style={{
            fontSize: 12,
            color: "var(--color-danger)",
            marginBottom: 12,
          }}
        >
          {error}
        </p>
      )}

      {loading ? (
        <p style={{ fontSize: 13, color: "var(--text-subtle)" }}>Loading…</p>
      ) : comments.length === 0 ? (
        <div
          style={{
            padding: "20px 16px",
            textAlign: "center",
            fontSize: 12.5,
            color: "var(--text-subtle)",
            border: "1px dashed var(--glass-border)",
            borderRadius: 12,
            background: "var(--bg-secondary)",
          }}
        >
          {locked
            ? "Nobody commented on this one."
            : "No comments yet — say why you're taking your side."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {comments.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              signedIn={signedIn}
              flagOpen={flagging === c.id}
              onOpenFlag={() => setFlagging(flagging === c.id ? null : c.id)}
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
                marginTop: 8,
                padding: "8px 12px",
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
              {loadingMore ? "Loading…" : "Older comments"}
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
        padding: "10px 12px",
        marginBottom: 16,
        fontSize: 12.5,
        color: "var(--text-muted)",
        background: "var(--bg-secondary)",
        border: "1px solid var(--glass-border)",
        borderRadius: 10,
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
  flagOpen,
  onOpenFlag,
  onFlag,
  onDelete,
  onOpenProfile,
}: {
  comment: MarketCommentView;
  signedIn: boolean;
  flagOpen: boolean;
  onOpenFlag: () => void;
  onFlag: (reason: CommentFlagReason) => void;
  onDelete: () => void;
  onOpenProfile?: (userId: string) => void;
}) {
  if (comment.deleted) {
    return (
      <div
        style={{
          padding: "10px 0",
          fontSize: 12.5,
          fontStyle: "italic",
          color: "var(--text-subtle)",
          borderTop: "1px solid var(--glass-border)",
        }}
      >
        This comment was removed by a moderator.
      </div>
    );
  }

  const a = comment.author;
  const chip = tierChip(a?.reputationTier);
  const name = a?.username
    ? `@${a.username}`
    : [a?.firstName, a?.lastName].filter(Boolean).join(" ") || "Someone";
  const tappable = Boolean(onOpenProfile && a);

  return (
    <div
      style={{
        padding: "12px 0",
        borderTop: "1px solid var(--glass-border)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          onClick={tappable ? () => onOpenProfile!(a!.id) : undefined}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            minWidth: 0,
            flex: 1,
            cursor: tappable ? "pointer" : "default",
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              flexShrink: 0,
              borderRadius: "50%",
              overflow: "hidden",
              background: "var(--bg-secondary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 800,
              color: "var(--text-muted)",
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
              name.replace("@", "").charAt(0).toUpperCase()
            )}
          </div>

          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--text-main)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {name}
          </span>

          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              flexShrink: 0,
              padding: "1px 6px",
              borderRadius: 999,
              fontSize: 9.5,
              fontWeight: 700,
              color: chip.color,
              background: chip.bg,
              border: `1px solid ${chip.border}`,
            }}
          >
            <chip.Icon size={9} />
            {chip.label}
          </span>
        </div>

        <span
          style={{
            fontSize: 11,
            color: "var(--text-subtle)",
            flexShrink: 0,
          }}
        >
          {timeAgo(comment.createdAt)}
        </span>
      </div>

      {/* The author's position. Side only, never the stake — what someone is
          backing is context for their argument; how much they staked is not
          anyone else's business. */}
      {comment.side && (
        <div
          style={{
            marginTop: 6,
            marginLeft: 32,
            display: "inline-block",
            padding: "2px 8px",
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 700,
            color: "var(--color-info)",
            background: "var(--bg-secondary)",
            border: "1px solid var(--glass-border)",
          }}
        >
          Backing {comment.side.label}
        </div>
      )}

      {/* Rendered as a text child, so React escapes it. This must never become
          dangerouslySetInnerHTML — bodies are stored raw. */}
      <p
        style={{
          margin: "6px 0 0 32px",
          fontSize: 13.5,
          lineHeight: 1.5,
          color: "var(--text-main)",
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
        }}
      >
        {comment.body}
      </p>

      {signedIn && (
        <div
          style={{
            display: "flex",
            gap: 14,
            margin: "8px 0 0 32px",
            alignItems: "center",
          }}
        >
          {comment.isMine ? (
            <IconAction icon={Trash2} label="Delete" onClick={onDelete} />
          ) : comment.hasFlagged ? (
            <span style={{ fontSize: 11, color: "var(--text-subtle)" }}>
              Reported
            </span>
          ) : (
            <IconAction icon={Flag} label="Report" onClick={onOpenFlag} />
          )}
        </div>
      )}

      {flagOpen && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            margin: "8px 0 0 32px",
          }}
        >
          {FLAG_REASONS.map((r) => (
            <button
              key={r.value}
              onClick={() => onFlag(r.value)}
              style={{
                padding: "4px 10px",
                fontSize: 11,
                fontWeight: 600,
                fontFamily: "inherit",
                color: "var(--text-muted)",
                background: "var(--bg-secondary)",
                border: "1px solid var(--glass-border)",
                borderRadius: 999,
                cursor: "pointer",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function IconAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Flag;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: 0,
        fontSize: 11,
        fontFamily: "inherit",
        color: "var(--text-subtle)",
        background: "none",
        border: "none",
        cursor: "pointer",
      }}
    >
      <Icon size={11} />
      {label}
    </button>
  );
}
