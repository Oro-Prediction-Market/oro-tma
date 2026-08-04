import { useLocation } from "react-router-dom";
import type { ChallengePreview } from "@shared/api/client";

/**
 * Slim banner shown at the top of a market page when the user arrived from a
 * `challenge_<id>` deep link. Gives the context the old flow threw away —
 * "Sonam challenges you: Arsenal to win" — so the recipient knows why they're
 * here. Reads the challenge off router state (set by DeepLinkRedirect) and
 * renders nothing anywhere else.
 */
export function ChallengeContextBanner() {
  const location = useLocation();
  const challenge = (location.state as { challenge?: ChallengePreview } | null)
    ?.challenge;

  if (!location.pathname.startsWith("/market/") || !challenge) return null;

  const { creatorName, outcomeLabel, wagerAmount } = challenge;

  return (
    <div
      style={{
        margin: "8px 12px 0",
        padding: "10px 14px",
        borderRadius: 12,
        background:
          "linear-gradient(135deg, rgba(99,102,241,0.16), rgba(168,85,247,0.16))",
        border: "1px solid rgba(129,140,248,0.35)",
        color: "var(--text, #e2e8f0)",
        fontSize: 14,
        lineHeight: 1.35,
      }}
    >
      <span style={{ marginRight: 6 }}>⚔️</span>
      <strong>{creatorName}</strong> challenges you
      {outcomeLabel ? (
        <>
          {": "}
          <strong>{outcomeLabel}</strong>
        </>
      ) : null}
      {typeof wagerAmount === "number" && wagerAmount > 0 ? (
        <span style={{ opacity: 0.85 }}> · Nu {wagerAmount.toLocaleString()}</span>
      ) : null}
      <div style={{ opacity: 0.75, fontSize: 12, marginTop: 2 }}>
        Prove them wrong — pick your side below.
      </div>
    </div>
  );
}
