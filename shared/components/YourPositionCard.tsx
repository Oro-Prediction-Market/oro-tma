import React from "react";
import type { Bet } from "@shared/api/client";

/**
 * "Your position" on a market — the signed-in user's own bets and their result
 * (stake + won/lost/refunded), plus a net line once the market is resolved.
 * Renders nothing when the user has no bets here. Pairs with DisputeResultBanner,
 * which covers any dispute bond separately.
 */
export const YourPositionCard: React.FC<{
  bets: Bet[];
  resolved: boolean;
}> = ({ bets, resolved }) => {
  if (!bets.length) return null;

  const GREEN = "#22c55e";
  const RED = "#ef4444";

  const totalStaked = bets.reduce((s, b) => s + Number(b.amount), 0);
  const totalReturned = bets.reduce((s, b) => {
    if (b.status === "won") return s + Number(b.payout || 0);
    if (b.status === "refunded") return s + Number(b.amount);
    return s;
  }, 0);
  const net = totalReturned - totalStaked;
  const anySettled = bets.some((b) => b.status !== "pending");

  const nu = (n: number) => `Nu ${Math.round(n).toLocaleString()}`;

  return (
    <div
      style={{
        marginTop: 12,
        padding: "12px 14px",
        borderRadius: 12,
        background: "var(--bg-card)",
        border: "1px solid var(--glass-border)",
        textAlign: "left",
      }}
    >
      <div
        style={{
          fontSize: "0.7rem",
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-subtle)",
          marginBottom: 10,
        }}
      >
        Your position
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {bets.map((b) => {
          const won = b.status === "won";
          const lost = b.status === "lost";
          const refunded = b.status === "refunded";
          const accent = won ? GREEN : lost ? RED : "var(--text-muted)";
          const result = won
            ? `Won +${nu(Number(b.payout || 0))}`
            : lost
              ? "Lost"
              : refunded
                ? "Refunded"
                : "Active";
          return (
            <div
              key={b.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                fontSize: "0.8rem",
              }}
            >
              <span
                style={{
                  fontWeight: 700,
                  color: "var(--text-main)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  minWidth: 0,
                }}
              >
                {b.outcome?.label ?? "Your pick"}
              </span>
              <span
                style={{
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>
                  staked {nu(Number(b.amount))}
                </span>
                <span style={{ color: accent, fontWeight: 800 }}>{result}</span>
              </span>
            </div>
          );
        })}
      </div>

      {resolved && anySettled && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: "1px solid var(--glass-border)",
            fontSize: "0.78rem",
            color: "var(--text-muted)",
            fontWeight: 600,
          }}
        >
          Net from bets:{" "}
          <b style={{ color: net >= 0 ? GREEN : RED }}>
            {net >= 0 ? "+" : "−"}
            {nu(Math.abs(net))}
          </b>{" "}
          (staked {nu(totalStaked)}, returned {nu(totalReturned)})
        </div>
      )}
    </div>
  );
};
