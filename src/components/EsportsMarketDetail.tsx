import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Share2, Clock, ShieldAlert, Trophy } from "lucide-react";
import type { Market, Outcome } from "@shared/api/client";
import { isEsportsFinal } from "@shared/helpers/esportsKeywords";
import {
  EWC,
  notch,
  DISPLAY_FONT,
  NotchTile,
  TrophyStage,
  CornerMark,
} from "@shared/components/EsportsUi";
import { TmaBetModal } from "@/components/TmaBetModal";
import {
  DisputeContestFields,
  type DisputeContestControls,
} from "@/components/DisputeContestFields";
import { calcProb, calcOdds } from "@/pages/WorldCupHubPage";
import { isDrawOutcome } from "@/pages/BplHubPage";
import {
  TeamAvatar,
  isMatchMarket,
  esportsCategoryOf,
  categoryMeta,
  getSideImage,
  outcomeImage,
  parseVsNames,
  shortTeamName,
} from "@/pages/EsportsHubPage";

// ── Local micro-primitives (mirror the hub's, kept private to this view) ────────

function Label({
  children,
  color = EWC.textMuted,
  size = 9,
  style,
}: {
  children: React.ReactNode;
  color?: string;
  size?: number;
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={{
        fontSize: size,
        fontWeight: 700,
        letterSpacing: EWC.trackTiny,
        textTransform: "uppercase",
        color,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/** Live "Nd Nh" / "Nh Nm" countdown, refreshed each minute. */
function useCountdown(target: string | null | undefined): string {
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (!target) {
      setLabel("");
      return;
    }
    const tick = () => {
      const ms = new Date(target).getTime() - Date.now();
      if (ms <= 0) {
        setLabel("Closed");
        return;
      }
      const d = Math.floor(ms / 86_400_000);
      const h = Math.floor((ms % 86_400_000) / 3_600_000);
      const mn = Math.floor((ms % 3_600_000) / 60_000);
      if (d > 0) setLabel(`${d}d ${h}h`);
      else if (h > 0) setLabel(`${h}h ${mn}m`);
      else setLabel(`${mn}m`);
    };
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [target]);
  return label;
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <NotchTile radius={7} padding="9px 11px" style={{ flex: 1, minWidth: 0 }}>
      <Label size={8}>{label}</Label>
      <div
        style={{
          marginTop: 4,
          fontSize: 15,
          fontWeight: 900,
          color: EWC.text,
          fontFamily: DISPLAY_FONT,
          letterSpacing: "-0.01em",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </div>
    </NotchTile>
  );
}

// ── Component ───────────────────────────────────────────────────────────────

export interface EsportsMarketDetailProps {
  market: Market;
  onBetPlaced: () => void;
  isResolving: boolean;
  proposedOutcome?: Outcome | null;
  disputeTimeLeft?: string | null;
  disputeReason: string;
  setDisputeReason: (v: string) => void;
  handleSubmitDispute: () => void;
  disputeSubmitting: boolean;
  disputeError: string | null;
  disputeSuccess: boolean;
  disputeContest?: DisputeContestControls;
}

export function EsportsMarketDetail({
  market,
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
}: EsportsMarketDetailProps) {
  const navigate = useNavigate();
  const [activeBet, setActiveBet] = useState<string | null>(null);

  // Open the detail view at the top, not at the feed's scroll position
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [market.id]);

  const cat = categoryMeta(esportsCategoryOf(market));
  const CatIcon = cat.Icon;
  const isFinal = isEsportsFinal(market.title);

  const locked =
    market.status === "closed" ||
    market.status === "resolving" ||
    market.status === "resolved" ||
    market.status === "settled";
  const resolved =
    market.status === "resolved" || market.status === "settled";

  const closes = useCountdown(
    locked ? null : (market.bettingClosesAt ?? market.closesAt),
  );

  const outcomes = market.outcomes ?? [];
  const totalPool =
    Number(market.totalPool ?? 0) ||
    outcomes.reduce((s, o) => s + Number(o.totalBetAmount ?? 0), 0);

  const isMatch = isMatchMarket(market);
  const winnerId = market.resolvedOutcomeId ?? null;

  const statusText = resolved
    ? "Resolved"
    : isResolving
      ? "Resolving"
      : market.status === "closed"
        ? "Closed"
        : closes
          ? `Closes in ${closes}`
          : "Open";

  const onBet = (outcomeId: string) => setActiveBet(outcomeId);

  return (
    <div style={{ minHeight: "100vh", background: EWC.bg }}>
      <style>{`
        .ewc-btn-gold { background: ${EWC.goldButton}; }
        .ewc-btn-gold:hover:not(:disabled) { background: ${EWC.goldButtonHover}; }
        .ewc-btn-green { background: ${EWC.greenButton}; }
        .ewc-btn-green:hover:not(:disabled) { background: ${EWC.greenButtonHover}; }
      `}</style>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px 16px 120px" }}>
        {/* ── Top bar ── */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <button
            onClick={() => navigate(-1)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              background: "transparent",
              border: `1px solid ${EWC.border}`,
              clipPath: notch(7),
              padding: "8px 12px",
              color: EWC.textSecondary,
              cursor: "pointer",
            }}
          >
            <ArrowLeft size={15} />
            <Label color={EWC.textSecondary}>Back</Label>
          </button>
          <button
            onClick={() => {
              const url = window.location.href;
              if (navigator.share) {
                navigator
                  .share({ title: market.title, url })
                  .catch(() => {});
              } else {
                navigator.clipboard?.writeText(url);
              }
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              background: "transparent",
              border: `1px solid ${EWC.border}`,
              clipPath: notch(7),
              padding: "8px 12px",
              color: EWC.textSecondary,
              cursor: "pointer",
            }}
          >
            <Share2 size={15} />
            <Label color={EWC.textSecondary}>Share</Label>
          </button>
        </div>

        {/* ── Masthead ── */}
        <div
          style={{
            position: "relative",
            background: `linear-gradient(180deg, ${EWC.surface} 0%, ${EWC.bg} 100%)`,
            border: `1px solid ${EWC.goldLine}`,
            clipPath: notch(12),
            padding: "18px 18px 16px",
            overflow: "hidden",
          }}
        >
          <CornerMark v="top" h="left" />
          <CornerMark v="bottom" h="right" />
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.5,
              pointerEvents: "none",
            }}
          >
            <TrophyStage height="clamp(90px, 20vw, 150px)" showFloor={false} />
          </div>

          <div style={{ position: "relative" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                marginBottom: 12,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  color: EWC.goldBright,
                }}
              >
                <span
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <CatIcon size={13} />
                  <Label color={EWC.goldBright} size={10}>
                    {cat.label}
                  </Label>
                </span>
                {isFinal && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      border: `1px solid ${EWC.goldLine}`,
                      background: EWC.glass,
                      clipPath: notch(6),
                      padding: "3px 8px",
                      color: EWC.goldBright,
                    }}
                  >
                    <Trophy size={11} />
                    <Label color={EWC.goldBright} size={9}>
                      Grand Final
                    </Label>
                  </span>
                )}
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  border: `1px solid ${EWC.goldLine}`,
                  clipPath: notch(6),
                  padding: "3px 8px",
                  color: locked ? EWC.gold : EWC.text,
                }}
              >
                {!locked && <Clock size={11} color={EWC.textSecondary} />}
                <Label color={locked ? EWC.gold : EWC.text} size={9}>
                  {statusText}
                </Label>
              </span>
            </div>

            <h1
              style={{
                margin: 0,
                fontFamily: DISPLAY_FONT,
                fontSize: "clamp(20px, 5vw, 28px)",
                fontWeight: 700,
                lineHeight: 1.15,
                color: EWC.text,
                letterSpacing: "-0.01em",
              }}
            >
              {market.title}
            </h1>

            {market.description && (
              <p
                style={{
                  margin: "10px 0 0",
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: EWC.textSecondary,
                  maxWidth: 620,
                }}
              >
                {market.description}
              </p>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <StatTile label="Total pool" value={`Nu ${totalPool.toLocaleString()}`} />
              <StatTile label="Outcomes" value={String(outcomes.length)} />
              <StatTile
                label={locked ? "Status" : "Closes in"}
                value={locked ? (resolved ? "Resolved" : "Locked") : closes || "—"}
              />
            </div>
          </div>
        </div>

        {/* ── Locked banner ── */}
        {locked && (
          <div
            style={{
              marginTop: 14,
              border: `1px solid ${EWC.goldLine}`,
              background: EWC.glass,
              clipPath: notch(9),
              padding: "11px 14px",
              display: "flex",
              alignItems: "center",
              gap: 9,
            }}
          >
            <ShieldAlert size={15} color={EWC.gold} />
            <Label color={EWC.text} size={10}>
              {resolved
                ? "This market has been resolved"
                : isResolving
                  ? "Resolving — betting is closed"
                  : "Predictions are locked"}
            </Label>
          </div>
        )}

        {/* ── Outcomes ── */}
        <div style={{ marginTop: 14 }}>
          {isMatch ? (
            <MatchBlock
              market={market}
              locked={locked}
              winnerId={winnerId}
              onBet={onBet}
            />
          ) : (
            <FieldBlock
              market={market}
              locked={locked}
              winnerId={winnerId}
              onBet={onBet}
            />
          )}
        </div>

        {/* ── Resolution info ── */}
        {(market.resolutionCriteria || market.settlementSource) && (
          <div
            style={{
              marginTop: 14,
              border: `1px solid ${EWC.border}`,
              clipPath: notch(9),
              padding: "14px 15px",
              background: EWC.panel,
            }}
          >
            <Label color={EWC.gold} size={10}>
              How this resolves
            </Label>
            {market.resolutionCriteria && (
              <p
                style={{
                  margin: "9px 0 0",
                  fontSize: 12.5,
                  lineHeight: 1.55,
                  color: EWC.textSecondary,
                }}
              >
                {market.resolutionCriteria}
              </p>
            )}
            {market.settlementSource && (
              <div style={{ marginTop: 10 }}>
                <Label size={8}>Settlement source</Label>
                <div
                  style={{
                    marginTop: 3,
                    fontSize: 12,
                    fontWeight: 700,
                    color: EWC.text,
                  }}
                >
                  {market.settlementSource}
                </div>
              </div>
            )}
            {resolved && market.evidenceNote && (
              <div style={{ marginTop: 10 }}>
                <Label size={8}>Resolution note</Label>
                <p
                  style={{
                    margin: "3px 0 0",
                    fontSize: 12,
                    lineHeight: 1.5,
                    color: EWC.textSecondary,
                  }}
                >
                  {market.evidenceNote}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Dispute (resolving) ── */}
        {isResolving && (
          <div
            style={{
              marginTop: 14,
              border: `1px solid ${EWC.goldLine}`,
              clipPath: notch(9),
              padding: "14px 15px",
              background: EWC.panel,
            }}
          >
            <Label color={EWC.gold} size={10}>
              Proposed result
            </Label>
            {proposedOutcome && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 15,
                  fontWeight: 900,
                  color: EWC.text,
                  fontFamily: DISPLAY_FONT,
                }}
              >
                {proposedOutcome.label}
              </div>
            )}
            {disputeTimeLeft && (
              <div style={{ marginTop: 6 }}>
                <Label size={9}>{disputeTimeLeft}</Label>
              </div>
            )}

            {disputeSuccess ? (
              <div style={{ marginTop: 12 }}>
                <Label color={EWC.green} size={10}>
                  Dispute submitted — under review
                </Label>
              </div>
            ) : (
              <div style={{ marginTop: 12 }}>
                {disputeContest && (
                  <div style={{ marginBottom: 12 }}>
                    <DisputeContestFields {...disputeContest} accent="#22d3ee" />
                  </div>
                )}
                <textarea
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Explain why the proposed result is incorrect…"
                  rows={3}
                  style={{
                    width: "100%",
                    resize: "vertical",
                    background: EWC.bg,
                    border: `1px solid ${EWC.border}`,
                    clipPath: notch(7),
                    color: EWC.text,
                    padding: "10px 12px",
                    fontSize: 13,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                {disputeError && (
                  <div style={{ marginTop: 7 }}>
                    <Label color={EWC.danger} size={9}>
                      {disputeError}
                    </Label>
                  </div>
                )}
                <button
                  className="ewc-btn-gold"
                  disabled={disputeSubmitting}
                  onClick={handleSubmitDispute}
                  style={{
                    marginTop: 10,
                    border: "none",
                    clipPath: notch(8),
                    padding: "10px 16px",
                    color: "#1a1400",
                    fontSize: 11,
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: EWC.trackTiny,
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
}

// ── Match layout (two teams) ────────────────────────────────────────────────

function MatchBlock({
  market,
  locked,
  winnerId,
  onBet,
}: {
  market: Market;
  locked: boolean;
  winnerId: string | null;
  onBet: (outcomeId: string) => void;
}) {
  const sides = (market.outcomes ?? []).filter(
    (o) => !isDrawOutcome(o.label ?? ""),
  );
  const [sa, sb] = sides;
  const draw = (market.outcomes ?? []).find((o) => isDrawOutcome(o.label ?? ""));
  if (!sa || !sb) return null;

  const titleNames = parseVsNames(market.title);
  const nameOf = (label: string, idx: number) =>
    /^(yes|no)$/i.test(label.trim())
      ? idx === 0
        ? titleNames.a
        : titleNames.b
      : label;

  const pctA = Math.round(calcProb(market, sa.id) * 100);

  const side = (outcome: Outcome, idx: number, color: string, pct: number) => {
    const left = idx === 0;
    const name = shortTeamName(nameOf(outcome.label, idx));
    const won = winnerId === outcome.id;
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: left ? "flex-start" : "flex-end",
          minWidth: 0,
          opacity: locked && winnerId && !won ? 0.5 : 1,
        }}
      >
        <TeamAvatar
          src={getSideImage(market, idx)}
          label={name}
          size={52}
          color={color}
        />
        <div
          style={{
            marginTop: 10,
            fontSize: 17,
            fontWeight: 800,
            color: EWC.text,
            textTransform: "uppercase",
            letterSpacing: EWC.trackSmall,
            textAlign: left ? "left" : "right",
            width: "100%",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {name}
        </div>
        <div
          style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 8 }}
        >
          <span
            style={{
              fontSize: 40,
              fontWeight: 900,
              color,
              lineHeight: 1,
              letterSpacing: "-0.02em",
            }}
          >
            {pct}%
          </span>
          <Label>win</Label>
        </div>
        <div style={{ marginTop: 4 }}>
          <Label size={9}>
            Nu {Number(outcome.totalBetAmount ?? 0).toLocaleString()}
          </Label>
        </div>
        {won ? (
          <div
            style={{
              width: "100%",
              marginTop: 14,
              textAlign: "center",
              border: `1px solid ${EWC.goldLine}`,
              clipPath: notch(8),
              padding: "10px 0",
              color: EWC.goldBright,
              fontSize: 11,
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: EWC.trackTiny,
            }}
          >
            Winner
          </div>
        ) : (
          !locked && (
            <button
              className={idx === 0 ? "ewc-btn-gold" : "ewc-btn-green"}
              onClick={() => onBet(outcome.id)}
              style={{
                width: "100%",
                marginTop: 14,
                padding: "13px 0",
                border: "none",
                clipPath: notch(8),
                color: idx === 0 ? "#1a1400" : "#00160c",
                fontSize: 12,
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: EWC.trackTiny,
                cursor: "pointer",
              }}
            >
              Predict
            </button>
          )
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        border: `1px solid ${EWC.goldLine}`,
        clipPath: notch(12),
        background: EWC.surface,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
          padding: "20px 18px 18px",
        }}
      >
        {side(sa, 0, EWC.gold, pctA)}
        <div
          style={{
            width: 34,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            paddingTop: 14,
          }}
        >
          <Label color={EWC.textSecondary} size={12}>
            vs
          </Label>
          <div
            style={{
              width: 1,
              flex: 1,
              minHeight: 90,
              background: `linear-gradient(180deg, ${EWC.border} 0%, transparent 100%)`,
            }}
          />
        </div>
        {side(sb, 1, EWC.green, 100 - pctA)}
      </div>
      <div style={{ display: "flex", height: 4, background: EWC.control }}>
        <div style={{ width: `${pctA}%`, background: EWC.gold }} />
        <div style={{ width: `${100 - pctA}%`, background: EWC.green }} />
      </div>
      {draw && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "12px 16px",
            background: EWC.panel,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <Label color={EWC.textSecondary} size={10}>
              Draw
            </Label>
            <span style={{ fontSize: 15, fontWeight: 900, color: EWC.text }}>
              {Math.round(calcProb(market, draw.id) * 100)}%
            </span>
          </div>
          {winnerId === draw.id ? (
            <Label color={EWC.goldBright} size={10}>
              Winner
            </Label>
          ) : (
            !locked && (
              <button
                className="ewc-btn-gold"
                onClick={() => onBet(draw.id)}
                style={{
                  border: "none",
                  clipPath: notch(7),
                  padding: "8px 16px",
                  color: "#1a1400",
                  fontSize: 10,
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: EWC.trackTiny,
                  cursor: "pointer",
                }}
              >
                Predict
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ── Field layout (many outcomes) ────────────────────────────────────────────

function FieldBlock({
  market,
  locked,
  winnerId,
  onBet,
}: {
  market: Market;
  locked: boolean;
  winnerId: string | null;
  onBet: (outcomeId: string) => void;
}) {
  const ranked = useMemo(() => {
    const list = [...(market.outcomes ?? [])];
    return list.sort((a, b) => {
      const ea = Number(!!a.isEliminated);
      const eb = Number(!!b.isEliminated);
      if (ea !== eb) return ea - eb;
      return calcProb(market, b.id) - calcProb(market, a.id);
    });
  }, [market]);

  return (
    <div
      style={{
        border: `1px solid ${EWC.goldLine}`,
        clipPath: notch(12),
        background: EWC.surface,
        padding: "6px 14px 12px",
      }}
    >
      {ranked.map((outcome, idx) => {
        const pct = Math.round(calcProb(market, outcome.id) * 100);
        const odds = calcOdds(market, outcome.id);
        const eliminated = !!outcome.isEliminated;
        const won = winnerId === outcome.id;
        return (
          <div
            key={outcome.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 0",
              borderTop: idx === 0 ? "none" : `1px solid ${EWC.border}`,
              opacity: eliminated || (locked && winnerId && !won) ? 0.5 : 1,
            }}
          >
            <TeamAvatar
              src={outcomeImage(market, outcome)}
              label={outcome.label}
              size={36}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: EWC.text,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  textDecoration: eliminated ? "line-through" : "none",
                }}
              >
                {outcome.label}
              </div>
              <div
                style={{
                  marginTop: 6,
                  height: 3,
                  background: EWC.control,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: won
                      ? EWC.goldBright
                      : eliminated
                        ? EWC.textMuted
                        : EWC.gold,
                  }}
                />
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0, minWidth: 48 }}>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 900,
                  color: eliminated ? EWC.textMuted : EWC.gold,
                  lineHeight: 1,
                }}
              >
                {pct}%
              </div>
              <div style={{ marginTop: 3 }}>
                <Label size={8}>{odds ? `${odds.toFixed(2)}x` : "—"}</Label>
              </div>
            </div>
            {won ? (
              <Label color={EWC.goldBright} size={10}>
                Winner
              </Label>
            ) : eliminated ? (
              <Label color={EWC.danger} size={9}>
                Out
              </Label>
            ) : (
              !locked && (
                <button
                  className="ewc-btn-gold"
                  onClick={() => onBet(outcome.id)}
                  style={{
                    border: "none",
                    clipPath: notch(7),
                    padding: "9px 14px",
                    color: "#1a1400",
                    fontSize: 10,
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: EWC.trackTiny,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  Predict
                </button>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}
