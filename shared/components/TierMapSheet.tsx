import { useEffect } from "react";
import { Check, Lock, Trophy, X } from "lucide-react";
import {
  TIERS,
  TIER_ORDER,
  tierMeta,
  tierProgress,
  tierRequirement,
} from "@shared/reputation/tiers";

/**
 * The whole reputation ladder, with what every rung actually costs.
 *
 * Until this existed a user could see their own rung and a one-line nudge
 * toward the next one, and nothing else — the seven rungs and their
 * requirements were written down only in a code comment in
 * `shared/reputation/tiers.tsx`.
 *
 * IMPORTANT — `shared/` is a duplicated directory, hand-copied into oro-tma and
 * oro-pwa. It is not a symlink and not a workspace package, and the two trees
 * have drifted: `components/ui/` (which holds BottomSheet), `Page.tsx`,
 * `BadgeGrid` and `ProfileShareCard` live under `shared/` in oro-pwa but under
 * `src/` in oro-tma. So this file may import only `react`, `lucide-react` and
 * `@shared/*`, and rolls its own overlay rather than reaching for a shell that
 * resolves in one repo and not the other. Edits must be applied to BOTH copies
 * and the two must stay byte-identical.
 */

export interface TierMapSheetProps {
  onClose: () => void;
  tier: string;
  totalPredictions: number;
  correctPredictions: number;
}

export function TierMapSheet({
  onClose,
  tier,
  totalPredictions,
  correctPredictions,
}: TierMapSheetProps) {
  // Telegram reads an unlocked body behind a sheet as a page swipe and
  // collapses the Mini App. The other hand-rolled overlays in this codebase
  // skip this; they get away with it because they are shorter than the viewport.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const currentOrder = tierMeta(tier).order;
  const accuracy =
    totalPredictions > 0 ? correctPredictions / totalPredictions : 0;
  const progress = tierProgress(tier, totalPredictions, accuracy);

  return (
    <div
      className="tier-map-scrim"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        // Above the 1000 bottom nav and the leaderboard's My Stats sheet
        // (1000/1001), which is one of the two places this opens from. Below
        // the 3000 badge-unlock popup, which should win over anything.
        zIndex: 2000,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        justifyContent: "center",
      }}
    >
      {/* The two apps have opposite conventions for an explainer — oro-tma's
          How It Works is a bottom sheet, oro-pwa's is a centred dialog — and
          one shared file has to satisfy both. Under 640px this is a sheet,
          which is all oro-tma ever renders inside Telegram; at desktop widths
          it becomes the centred dialog oro-pwa's siblings use. The breakpoint
          matches the one the profile page already switches its own layout on. */}
      <style>{`
        .tier-map-scrim { align-items: flex-end; }
        .tier-map-panel {
          width: 100%;
          max-height: 88vh;
          border-radius: 20px 20px 0 0;
          padding-bottom: calc(env(safe-area-inset-bottom) + 24px);
        }
        @media (min-width: 640px) {
          .tier-map-scrim { align-items: center; }
          .tier-map-panel {
            max-width: 440px;
            max-height: 84vh;
            border-radius: 20px;
            padding-bottom: 20px;
          }
          .tier-map-handle { display: none; }
        }
      `}</style>

      <div
        className="tier-map-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-card)",
          overflowY: "auto",
        }}
      >
        <Header onClose={onClose} />

        <div style={{ padding: "0 16px" }}>
          {TIER_ORDER.map((key) => {
            const meta = TIERS[key];
            const state =
              meta.order === currentOrder
                ? "current"
                : meta.order < currentOrder
                  ? "earned"
                  : "locked";
            return (
              <TierRow
                key={key}
                tierKey={key}
                state={state}
                progress={state === "current" ? progress : null}
              />
            );
          })}

          <Footnotes />
        </div>
      </div>
    </div>
  );
}

function Header({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        background: "var(--bg-card)",
        zIndex: 1,
        padding: "14px 16px 10px",
      }}
    >
      <div
        className="tier-map-handle"
        style={{
          width: 36,
          height: 4,
          borderRadius: 2,
          background: "var(--glass-border)",
          margin: "0 auto 14px",
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{ fontSize: 17, fontWeight: 900, color: "var(--text-main)" }}
        >
          Reputation Tiers
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            background: "var(--bg-secondary)",
            border: "none",
            borderRadius: 8,
            width: 30,
            height: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "var(--text-muted)",
          }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

/**
 * One rung. Rows are plain divs, not buttons — there is nothing to tap through
 * to, and a row that depresses would promise a screen that does not exist.
 */
function TierRow({
  tierKey,
  state,
  progress,
}: {
  tierKey: string;
  state: "earned" | "current" | "locked";
  progress: ReturnType<typeof tierProgress>;
}) {
  const meta = TIERS[tierKey];
  const { Icon, color, label } = meta;
  const locked = state === "locked";
  const current = state === "current";

  return (
    <div
      style={
        current
          ? {
              // Detached card so the eye finds "you are here" without reading.
              margin: "8px 0",
              padding: 12,
              borderRadius: 14,
              background: `${color}1f`,
              border: `1px solid ${color}66`,
            }
          : {
              padding: "11px 2px",
              borderBottom: "1px solid var(--glass-border)",
            }
      }
    >
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            background: locked ? "var(--bg-secondary)" : `${color}26`,
          }}
        >
          <Icon size={17} color={locked ? "var(--text-subtle)" : color} />
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: current ? 14 : 13,
                fontWeight: current ? 800 : 700,
                // Colour is the reward — a locked rung stays neutral.
                color: locked ? "var(--text-muted)" : color,
              }}
            >
              {label}
            </span>
            {current && (
              <span
                style={{
                  padding: "2px 6px",
                  borderRadius: 5,
                  background: color,
                  color: "#0b1020",
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: 0.4,
                  textTransform: "uppercase",
                }}
              >
                You are here
              </span>
            )}
          </div>
          <div
            style={{
              marginTop: 2,
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-subtle)",
            }}
          >
            {tierRequirement(tierKey)}
          </div>
        </div>

        {state === "earned" && <Check size={14} color={color} />}
        {locked && <Lock size={13} color="var(--text-subtle)" />}
      </div>

      {current && <CurrentProgress progress={progress} />}
    </div>
  );
}

/**
 * The live bar, shown only under the current rung — it describes a transition,
 * so it belongs between two rungs rather than beside a static requirement.
 * Styled to match the profile card it is opened from, so the sheet reads as
 * that card expanding rather than as a second, differently-shaped widget.
 *
 * A null `progress` means Legend: the top of the ladder, with nothing above it
 * to describe. Keyed off the null rather than off `tier === "legend"` so the
 * two can never disagree.
 */
function CurrentProgress({
  progress,
}: {
  progress: ReturnType<typeof tierProgress>;
}) {
  if (!progress) {
    return (
      <div
        style={{
          marginTop: 11,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Trophy size={14} color="#f59e0b" />
        <span style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b" }}>
          You've reached the top — Legend tier!
        </span>
      </div>
    );
  }

  const pct = Math.round(progress.progress * 100);
  return (
    <div style={{ marginTop: 11 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <span
          style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}
        >
          {progress.label}
        </span>
        <span
          style={{ fontSize: 11, fontWeight: 800, color: progress.nextColor }}
        >
          {pct}%
        </span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 99,
          background: "var(--bg-card)",
          overflow: "hidden",
          marginBottom: 7,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: 99,
            background: `linear-gradient(90deg, ${progress.nextColor}99, ${progress.nextColor})`,
            transition: "width 0.6s ease",
          }}
        />
      </div>
      <span
        style={{ fontSize: 11, color: "var(--text-subtle)", fontWeight: 600 }}
      >
        {progress.hint}
      </span>
    </div>
  );
}

/**
 * Three things a user cannot discover anywhere else and will otherwise
 * misread. The middle one is the bug report this screen is meant to prevent:
 * tiers and leaderboard position are computed from different numbers.
 */
function Footnotes() {
  const notes = [
    <>
      A <b style={{ color: "var(--text-muted)" }}>pick</b> is one settled market
      you predicted on. Several predictions on the same market still count as
      one.
    </>,
    <>
      Tiers are a career record, not a ranking. The leaderboard sorts on
      reputation score, so a Scout can sit above a Hot Hand.
    </>,
    <>Your tier updates when a market you predicted on settles.</>,
  ];

  return (
    <div
      style={{
        margin: "14px 0 4px",
        padding: 12,
        borderRadius: 12,
        background: "var(--bg-secondary)",
        display: "grid",
        gap: 7,
      }}
    >
      {notes.map((note, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            gap: 7,
            fontSize: 11,
            lineHeight: 1.45,
            color: "var(--text-subtle)",
          }}
        >
          <span aria-hidden style={{ flexShrink: 0 }}>
            •
          </span>
          <span>{note}</span>
        </div>
      ))}
    </div>
  );
}
