import React from "react";
import type { MyDispute } from "@shared/api/client";

/**
 * Shows the signed-in user's OWN dispute result on a settled market — what they
 * won (bond returned + reward) or lost (bond forfeited). Renders nothing when
 * the user never objected. Safe to mount on any market detail view; it simply
 * stays empty until a settled dispute exists for this user.
 */
export const DisputeResultBanner: React.FC<{ dispute: MyDispute | null }> = ({
  dispute,
}) => {
  if (!dispute) return null;

  const bond = Number(dispute.bondAmount) || 0;
  const reward = Number(dispute.rewardAmount) || 0;
  const verb = dispute.side === "object" ? "challenged" : "defended";

  const won = dispute.bondStatus === "rewarded" || dispute.upheld === true;
  const lost = dispute.bondStatus === "forfeited" || dispute.upheld === false;
  const pending = !won && !lost; // outcome not finalised yet

  const accent = won ? "#22c55e" : lost ? "#ef4444" : "#f59e0b";
  const title = won
    ? `You ${verb} this outcome and won`
    : lost
      ? `You ${verb} this outcome and lost`
      : "Your objection is under review";

  return (
    <div
      style={{
        marginTop: 12,
        padding: "12px 14px",
        borderRadius: 12,
        background: `${accent}1a`,
        border: `1px solid ${accent}`,
        textAlign: "left",
      }}
    >
      <div style={{ fontSize: "0.8rem", fontWeight: 800, color: accent }}>
        {title}
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: "0.78rem",
          fontWeight: 500,
          color: "var(--text-muted)",
          lineHeight: 1.5,
        }}
      >
        {won && (
          <>
            Bond Nu {bond.toLocaleString()} returned
            {reward > 0 ? ` + Nu ${reward.toLocaleString()} reward` : ""}.
          </>
        )}
        {lost && <>Your Nu {bond.toLocaleString()} bond was forfeited.</>}
        {pending && (
          <>Your Nu {bond.toLocaleString()} bond is locked until this resolves.</>
        )}
      </div>
    </div>
  );
};
