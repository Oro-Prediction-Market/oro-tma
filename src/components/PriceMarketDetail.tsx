import { FC, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Share2,
  AlertCircle,
  Clock,
  Users,
  Activity,
  Coins,
  Trophy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Market, Outcome } from "@shared/api/client";
import { TmaBetModal } from "@/components/TmaBetModal";
import {
  DisputeContestFields,
  type DisputeContestControls,
} from "@/components/DisputeContestFields";
import { TerMarketCard } from "@/components/TerMarketCard";
import { BtcMarketCard } from "@/components/BtcMarketCard";
import { ShareCTA } from "@shared/components/ShareCTA";

// Shared "trading" palette lifted straight from the TER / BTC price cards so the
// whole detail page reads as one surface with the chart card.
const FONT =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const C = {
  text: "#f8fafc",
  sub: "#64748b",
  faint: "#c3cad6",
  green: "#10b981",
  red: "#f43f5e",
  divider: "rgba(255,255,255,0.06)",
};

interface Props {
  market: Market;
  userPickedOutcomeId?: string;
  hasWon?: boolean;
  wonTotalPayout?: number;
  userHasBets?: boolean;
  onBetPlaced: () => void;
  isResolving: boolean;
  proposedOutcome: Outcome | null | undefined;
  disputeTimeLeft: string | null;
  disputeReason: string;
  setDisputeReason: (v: string) => void;
  handleSubmitDispute: () => void;
  disputeSubmitting: boolean;
  disputeError: string | null;
  disputeSuccess: boolean;
  disputeContest?: DisputeContestControls;
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleString("en-BT", {
    timeZone: "Asia/Thimphu",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const fmtLeft = (iso: string) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Closed";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h >= 1) return `${h}h ${m}m`;
  return `${Math.max(m, 1)}m`;
};

const SectionHead: FC<{ icon: LucideIcon; label: string; color?: string }> = ({
  icon: Icon,
  label,
  color,
}) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
    <Icon size={14} color={color ?? C.sub} />
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: color ?? C.sub,
        letterSpacing: "0.09em",
        textTransform: "uppercase",
      }}
    >
      {label}
    </span>
  </div>
);

export const PriceMarketDetail: FC<Props> = ({
  market,
  userPickedOutcomeId,
  hasWon,
  wonTotalPayout,
  userHasBets,
  onBetPlaced,
  isResolving,
  proposedOutcome,
  disputeTimeLeft,
  disputeReason,
  setDisputeReason,
  handleSubmitDispute,
  disputeSubmitting,
  disputeError,
  disputeSuccess,
  disputeContest,
}) => {
  const navigate = useNavigate();
  const [activeBet, setActiveBet] = useState<string | null>(null);
  const isBtc = market.externalSource === "btc";

  // Open the detail view at the top, not at the feed's scroll position
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [market.id]);

  // Asset-specific surface, matching each card's own gradient + border.
  const P = isBtc
    ? {
        pageBg: "#0c0c14",
        panelBg: "linear-gradient(175deg, #14141f 0%, #0c0c14 100%)",
        border: "rgba(255,255,255,0.08)",
        accent: "#f7931a",
      }
    : {
        pageBg: "#0e0b06",
        panelBg: "linear-gradient(175deg, #1a150b 0%, #0e0b06 100%)",
        border: "rgba(244,175,57,0.16)",
        accent: "#F4AF39",
      };

  const panel: React.CSSProperties = {
    background: P.panelBg,
    border: `1px solid ${P.border}`,
    borderRadius: 16,
    padding: 16,
  };
  const tile: React.CSSProperties = {
    background: "rgba(255,255,255,0.03)",
    border: `1px solid ${C.divider}`,
    borderRadius: 12,
    padding: "11px 12px",
  };
  const barBtn: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    background: "rgba(255,255,255,0.04)",
    border: `1px solid ${P.border}`,
    borderRadius: 10,
    padding: "9px 14px",
    color: C.text,
    cursor: "pointer",
    fontSize: 12.5,
    fontWeight: 700,
  };

  const assetSym = isBtc ? "BTC" : "TER";

  const resolvedOutcome = market.resolvedOutcomeId
    ? market.outcomes.find((o) => o.id === market.resolvedOutcomeId)
    : null;

  // Crowd sentiment (Higher vs Lower)
  const outs = market.outcomes ?? [];
  const up = outs.find((o) => /(high|up|yes|above|over)/i.test(o.label)) ?? outs[0];
  const down = outs.find((o) => o?.id !== up?.id) ?? outs[1];
  const upRaw = up?.lmsrProbability;
  const downRaw = down?.lmsrProbability;
  let upProb = upRaw ?? (downRaw != null ? 1 - downRaw : 0.5);
  if (upProb < 0 || upProb > 1 || Number.isNaN(upProb)) upProb = 0.5;
  const upPct = Math.round(upProb * 100);
  const downPct = 100 - upPct;
  const upLabel = up?.label ?? "Higher";
  const downLabel = down?.label ?? "Lower";
  const upStake = Number(up?.totalBetAmount) || 0;
  const downStake = Number(down?.totalBetAmount) || 0;

  const pool = Number(market.totalPool) || 0;
  const closeAt = market.bettingClosesAt ?? market.closesAt;

  const timeline = [
    { label: "Opens", date: market.opensAt },
    { label: "Closes", date: market.closesAt },
    ...(market.resolvedAt
      ? [{ label: "Resolved", date: market.resolvedAt }]
      : []),
  ].filter((r) => r.date);

  return (
    <div style={{ minHeight: "100vh", background: P.pageBg, fontFamily: FONT }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px 16px 120px" }}>
        {/* ── Top bar ── */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 18,
          }}
        >
          <button onClick={() => navigate(-1)} style={barBtn}>
            <ArrowLeft size={15} />
            Back
          </button>
          <button
            onClick={() => {
              const url = window.location.href;
              if (navigator.share) {
                navigator.share({ title: market.title, url }).catch(() => {});
              } else {
                navigator.clipboard?.writeText(url);
              }
            }}
            style={barBtn}
          >
            <Share2 size={15} />
            Share
          </button>
        </div>

        {/* ── Title block ── */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: `${P.accent}1f`,
              border: `1px solid ${P.accent}55`,
              color: P.accent,
              borderRadius: 99,
              padding: "4px 10px",
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            <Activity size={12} />
            {assetSym} · Live price round
          </div>
          <h1
            style={{
              fontSize: 19,
              fontWeight: 900,
              color: C.text,
              lineHeight: 1.28,
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            {market.title}
          </h1>
        </div>

        {/* ── Live price card (chart + price-to-beat + Higher/Lower) ── */}
        {isBtc ? (
          <BtcMarketCard
            market={market}
            onBet={setActiveBet}
            userPickedOutcomeId={userPickedOutcomeId}
          />
        ) : (
          <TerMarketCard
            market={market}
            onBet={setActiveBet}
            userPickedOutcomeId={userPickedOutcomeId}
          />
        )}

        {/* ── Stacked info cards ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
          {/* Resolved winner */}
          {resolvedOutcome && (
            <div
              style={{
                background: "rgba(16,185,129,0.12)",
                border: `1px solid ${C.green}`,
                borderRadius: 16,
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <Trophy size={20} color={C.green} />
              <div>
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    color: C.green,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  Resolved · Winner
                </div>
                <div style={{ fontSize: 17, fontWeight: 900, color: C.text }}>
                  {resolvedOutcome.label}
                </div>
              </div>
            </div>
          )}

          {/* Share CTA */}
          {resolvedOutcome && hasWon && (
            <ShareCTA type="win" amount={wonTotalPayout} marketTitle={market.title} />
          )}
          {resolvedOutcome && !hasWon && userHasBets && (
            <ShareCTA type="lose" marketTitle={market.title} />
          )}

          {/* Dispute (resolving) */}
          {isResolving && (
            <div style={{ ...panel, border: `1px solid ${P.accent}55` }}>
              <SectionHead icon={AlertCircle} label="Proposed result" color={P.accent} />
              {proposedOutcome && (
                <div style={{ fontSize: 16, fontWeight: 900, color: C.text }}>
                  {proposedOutcome.label}
                </div>
              )}
              {disputeTimeLeft && (
                <div style={{ marginTop: 6, fontSize: 11.5, color: C.sub, fontWeight: 600 }}>
                  {disputeTimeLeft}
                </div>
              )}
              {disputeSuccess ? (
                <div style={{ marginTop: 12, color: C.green, fontSize: 12.5, fontWeight: 700 }}>
                  Dispute submitted — under review
                </div>
              ) : (
                <div style={{ marginTop: 12 }}>
                  {disputeContest && (
                    <div style={{ marginBottom: 12 }}>
                      <DisputeContestFields
                        {...disputeContest}
                        accent={P.accent}
                      />
                    </div>
                  )}
                  <textarea
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    placeholder={
                      disputeContest?.side === "support"
                        ? "Explain why the proposed result is correct…"
                        : "Explain why the proposed result is incorrect…"
                    }
                    rows={3}
                    style={{
                      width: "100%",
                      resize: "vertical",
                      background: P.pageBg,
                      border: `1px solid ${P.border}`,
                      borderRadius: 10,
                      color: C.text,
                      padding: "10px 12px",
                      fontSize: 13,
                      outline: "none",
                      boxSizing: "border-box",
                      fontFamily: FONT,
                    }}
                  />
                  {disputeError && (
                    <div style={{ marginTop: 7, color: C.red, fontSize: 11.5, fontWeight: 600 }}>
                      {disputeError}
                    </div>
                  )}
                  <button
                    disabled={disputeSubmitting}
                    onClick={handleSubmitDispute}
                    style={{
                      marginTop: 10,
                      border: "none",
                      borderRadius: 10,
                      padding: "10px 16px",
                      background: P.accent,
                      color: "#1a1400",
                      fontSize: 11,
                      fontWeight: 900,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      cursor: disputeSubmitting ? "default" : "pointer",
                      opacity: disputeSubmitting ? 0.5 : 1,
                    }}
                  >
                    {disputeSubmitting ? "Submitting…" : "Submit dispute"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* This round — pool + status */}
          <div style={panel}>
            <SectionHead icon={Activity} label="This round" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div style={tile}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                  <Coins size={12} color={C.sub} />
                  <span style={{ fontSize: 10, color: C.sub, fontWeight: 700 }}>Pool</span>
                </div>
                <div style={{ fontSize: 15.5, fontWeight: 800, color: C.text }}>
                  Nu {pool.toLocaleString()}
                </div>
              </div>
              <div style={tile}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                  <Clock size={12} color={C.sub} />
                  <span style={{ fontSize: 10, color: C.sub, fontWeight: 700 }}>
                    {isResolving || resolvedOutcome ? "Status" : "Closes in"}
                  </span>
                </div>
                <div style={{ fontSize: 15.5, fontWeight: 800, color: C.text }}>
                  {resolvedOutcome
                    ? "Settled"
                    : isResolving
                      ? "Resolving"
                      : closeAt
                        ? fmtLeft(closeAt)
                        : "—"}
                </div>
              </div>
            </div>
          </div>

          {/* Crowd sentiment */}
          <div style={panel}>
            <SectionHead icon={Users} label="Crowd sentiment" />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                marginBottom: 9,
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.green }}>{upLabel}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: C.green, lineHeight: 1 }}>
                  {upPct}%
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.red }}>{downLabel}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: C.red, lineHeight: 1 }}>
                  {downPct}%
                </div>
              </div>
            </div>
            <div
              style={{
                height: 10,
                borderRadius: 99,
                overflow: "hidden",
                display: "flex",
                background: "rgba(255,255,255,0.06)",
              }}
            >
              <div style={{ width: `${upPct}%`, background: C.green }} />
              <div style={{ width: `${downPct}%`, background: C.red }} />
            </div>
            <div
              style={{
                marginTop: 10,
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11,
                color: C.sub,
                fontWeight: 600,
              }}
            >
              <span>Nu {upStake.toLocaleString()} on {upLabel.toLowerCase()}</span>
              <span>Nu {downStake.toLocaleString()} on {downLabel.toLowerCase()}</span>
            </div>
          </div>

          {/* Timeline */}
          <div style={panel}>
            <SectionHead icon={Clock} label="Timeline" />
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {timeline.map(({ label, date }) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: C.sub }}>
                    {label}
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: C.text }}>
                    {fmtDate(date!)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {activeBet && (
        <TmaBetModal
          isOpen={true}
          onClose={() => setActiveBet(null)}
          market={market}
          outcomeId={activeBet}
          onSuccess={() => {
            setActiveBet(null);
            onBetPlaced();
          }}
          onFailure={(e: string) => console.error(e)}
          onGoToWallet={() => navigate("/wallet")}
        />
      )}
    </div>
  );
};
