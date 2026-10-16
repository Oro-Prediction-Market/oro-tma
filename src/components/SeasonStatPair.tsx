import React from "react";
import { Goal, Handshake } from "lucide-react";
import type { Market } from "@shared/api/client";
import { calcProb } from "@/lib/hubs/worldCup";

/**
 * The season's two player awards, Top Scorer and Most Assists, side by side in
 * one row on a competition's Season tab, so the season-long predictions are in
 * one place. The full boards with live stats stay on the Stats tab.
 *
 * Kept compact so two fit across a phone: the top five, a rank, a name and a
 * chance. Tapping a player opens the bet; "All players" opens the market.
 * Each hub passes its own colours.
 */

export interface StatPairTheme {
  /** Card fill. */
  surface: string;
  border: string;
  /** Headings, the leader's bar, the "All players" link. */
  accent: string;
  /** Secondary text. */
  muted: string;
}

const TOP = 5;

function StatCard({
  market,
  title,
  icon,
  theme,
  onOpen,
  onBet,
}: {
  market: Market | undefined;
  title: string;
  icon: React.ReactNode;
  theme: StatPairTheme;
  onOpen: (id: string) => void;
  onBet: (marketId: string, outcomeId: string) => void;
}) {
  const outcomes = market
    ? [...(market.outcomes ?? [])]
        .filter((o) => !o.isEliminated)
        .sort(
          (a, b) =>
            Number(b.totalBetAmount ?? 0) - Number(a.totalBetAmount ?? 0) ||
            calcProb(market, b.id) - calcProb(market, a.id),
        )
    : [];
  const open = market?.status === "open";
  const pool = market
    ? Number(market.totalPool) ||
      (market.outcomes ?? []).reduce(
        (s, o) => s + Number(o.totalBetAmount ?? 0),
        0,
      )
    : 0;

  return (
    <div
      style={{
        minWidth: 0,
        borderRadius: 14,
        border: `1px solid ${theme.border}`,
        background: theme.surface,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "10px 11px 8px",
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        <span style={{ color: theme.accent, display: "inline-flex" }}>
          {icon}
        </span>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 900,
              color: "#fff",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: theme.muted }}>
            {market
              ? `Nu ${pool.toLocaleString()} pool${open ? "" : " · closed"}`
              : "Opens soon"}
          </div>
        </div>
      </div>

      {market ? (
        <>
          {outcomes.slice(0, TOP).map((o, i) => {
            const pct = Math.round(calcProb(market, o.id) * 100);
            return (
              <button
                key={o.id}
                type="button"
                disabled={!open}
                onClick={() => open && onBet(market.id, o.id)}
                title={open ? `Predict ${o.label}` : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  width: "100%",
                  padding: "8px 11px",
                  border: "none",
                  borderTop: i ? `1px solid ${theme.border}` : "none",
                  background: "transparent",
                  cursor: open ? "pointer" : "default",
                  textAlign: "left",
                  font: "inherit",
                  color: "inherit",
                }}
              >
                <span
                  style={{
                    width: 14,
                    flexShrink: 0,
                    fontSize: 10.5,
                    fontWeight: 900,
                    color: theme.muted,
                    textAlign: "center",
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#fff",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {o.label}
                  </span>
                  <span
                    style={{
                      display: "block",
                      marginTop: 4,
                      height: 2,
                      borderRadius: 1,
                      background: "rgba(255,255,255,0.08)",
                      overflow: "hidden",
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        width: `${pct}%`,
                        height: "100%",
                        background: i === 0 ? theme.accent : theme.muted,
                        opacity: i === 0 ? 1 : 0.5,
                      }}
                    />
                  </span>
                </span>
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: 12.5,
                    fontWeight: 900,
                    color: i === 0 ? theme.accent : "#fff",
                  }}
                >
                  {pct}%
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => onOpen(market.id)}
            style={{
              marginTop: "auto",
              padding: "8px 0",
              border: "none",
              borderTop: `1px solid ${theme.border}`,
              background: "rgba(255,255,255,0.03)",
              color: theme.accent,
              fontSize: 10.5,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            All {outcomes.length} players →
          </button>
        </>
      ) : (
        <div
          style={{
            padding: "18px 11px",
            fontSize: 11,
            color: theme.muted,
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          The {title.toLowerCase()} market opens closer to the season.
        </div>
      )}
    </div>
  );
}

export function SeasonStatPair({
  topScorer,
  assists,
  theme,
  onOpen,
  onBet,
}: {
  topScorer: Market | undefined;
  assists: Market | undefined;
  theme: StatPairTheme;
  onOpen: (id: string) => void;
  onBet: (marketId: string, outcomeId: string) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        // Side by side at every width, as one row of the season's awards.
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
        gap: 10,
      }}
    >
      <StatCard
        market={topScorer}
        title="Top Scorer"
        icon={<Goal size={15} />}
        theme={theme}
        onOpen={onOpen}
        onBet={onBet}
      />
      <StatCard
        market={assists}
        title="Most Assists"
        icon={<Handshake size={15} />}
        theme={theme}
        onOpen={onOpen}
        onBet={onBet}
      />
    </div>
  );
}
