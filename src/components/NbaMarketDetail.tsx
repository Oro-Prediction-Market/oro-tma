import React, { useEffect, useMemo, useState } from "react";
import { MarketShareSheet } from "@/components/MarketShareSheet";
import { SaveMarketButton } from "@shared/components/SaveMarketButton";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Coins, Share2, Clock, ShieldAlert, Zap } from "lucide-react";
import type { Market, Outcome, MyDispute } from "@shared/api/client";
import { DisputeResultBanner } from "@shared/components/DisputeResultBanner";
import { TmaBetModal } from "@/components/TmaBetModal";
import {
  DisputeContestFields,
  type DisputeContestControls,
} from "@/components/DisputeContestFields";
import { calcProb, calcOdds, formatOdds } from "@/lib/hubs/worldCup";
import { NBA_THEME, NbaLogo } from "@/lib/hubs/nba";
// The hub's buttons and chips, shared so a market reads as part of the hub.
import "../pages/NbaHubPage.css";
import "./NbaMarketDetail.css";
import { SegmentDisplay } from "@shared/components/SegmentDisplay";
import {
  ProbabilityChart,
  type ChartOutcome,
} from "@shared/components/ProbabilityChart";

/**
 * NBA market detail, dressed as the court banner that leads here: the same
 * floor behind the header, amber from its Predict button, teal from the
 * painted key, Impact for the numbers.
 *
 * Built from the UCL detail and behaves the same: the bet modal, the odds
 * chart, the locked and settled states, and the objection form while a result
 * is proposed. Only the dress and the NBA conventions differ: away team on the
 * left, "@", home on the right; no draw.
 */

// ── Theme ─────────────────────────────────────────────────────────────────────
const T = NBA_THEME;
const HOME = T.amber;
/** The away side, purple as on the hub's Featured Game buttons. */
const AWAY = "#8b7cf0";
const DISPLAY: React.CSSProperties = {
  fontFamily: T.display,
  fontStyle: "italic",
  letterSpacing: "-0.02em",
};

const CHART_THEME = {
  surface: T.card,
  border: T.line,
  axis: "rgba(255,255,255,0.45)",
  muted: "rgba(255,255,255,0.7)",
  text: "#fff",
  tooltipBg: T.ink,
  accent: T.amber,
  radius: 16,
};

/** Five distinguishable lines for a field market, all from the banner. */
const FIELD_RAMP = [T.amber, T.teal, T.amberSoft, T.muted, "#e07a3f"];

// ── Helpers ───────────────────────────────────────────────────────────────────
const TZ = "Asia/Thimphu";
const tipoffLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));

/**
 * The two sides in NBA order. The backend builds outcomes as [home, away], to
 * match the "Home vs Away" title; the screen shows away first.
 */
function sidesOf(market: Market): { away: Outcome; home: Outcome } | null {
  const outs = market.outcomes ?? [];
  if (outs.length !== 2 || !/\bvs\b/i.test(market.title)) return null;
  return { home: outs[0], away: outs[1] };
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

// ── Component ─────────────────────────────────────────────────────────────────

export interface NbaMarketDetailProps {
  /** The probability curves, uncoloured; this view paints them. */
  chartData?: ChartOutcome[] | null;
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
  myDispute?: MyDispute | null;
  referralId?: string;
}

export function NbaMarketDetail({
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
  myDispute,
  referralId,
  chartData,
}: NbaMarketDetailProps) {
  const navigate = useNavigate();
  const [activeBet, setActiveBet] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [market.id]);

  const locked =
    market.status === "closed" ||
    market.status === "resolving" ||
    market.status === "resolved" ||
    market.status === "settled";
  const resolved = market.status === "resolved" || market.status === "settled";

  const tipoff = market.bettingClosesAt ?? market.closesAt;
  const closes = useCountdown(locked ? null : tipoff);

  const outcomes = market.outcomes ?? [];
  const totalPool =
    Number(market.totalPool ?? 0) ||
    outcomes.reduce((s, o) => s + Number(o.totalBetAmount ?? 0), 0);

  const poolText = `Nu ${totalPool.toLocaleString()}`;

  const sides = sidesOf(market);
  const winnerId = market.resolvedOutcomeId ?? null;
  const stage =
    (market.metadata as Record<string, unknown> | null)?.matchLabel ?? null;

  const statusText = resolved
    ? "Final"
    : isResolving
      ? "Result proposed"
      : market.status === "closed"
        ? "Tipped off"
        : closes
          ? `Tip-off in ${closes}`
          : "Open";

  const onBet = (outcomeId: string) => setActiveBet(outcomeId);

  const colorOf = (o: Outcome) =>
    sides ? (o.id === sides.home.id ? HOME : AWAY) : T.amber;

  const chartCard = chartData?.length ? (
    <div style={{ marginTop: 14 }}>
      <ProbabilityChart
        title={sides ? "How the odds moved" : "Road to the title"}
        theme={CHART_THEME}
        fit
        height={236}
        series={chartData.map((h, i) => {
          const o = outcomes.find((x) => x.id === h.outcomeId);
          return {
            label: h.label,
            color: sides && o ? colorOf(o) : FIELD_RAMP[i % FIELD_RAMP.length],
            points: h.points,
          };
        })}
      />
    </div>
  ) : null;

  const iconBtn: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    background: "#0e141d",
    border: "1px solid rgba(255,182,109,0.22)",
    borderRadius: 12,
    padding: "8px 12px",
    color: "#fff",
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    cursor: "pointer",
  };

  return (
    <div style={{ minHeight: "100vh", background: T.ink }}>
      <div
        style={{ maxWidth: 760, margin: "0 auto", padding: "16px 16px 4px" }}
      >
        {/* ── Top bar ── */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <button onClick={() => navigate(-1)} style={iconBtn}>
            <ArrowLeft size={15} />
            Back
          </button>
          <SaveMarketButton
            marketId={market.id}
            variant="inherit"
            accent={T.amber}
            style={{ ...iconBtn, marginLeft: "auto", marginRight: 8 }}
          />
          <button onClick={() => setShareOpen(true)} style={iconBtn}>
            <Share2 size={15} />
            Share
          </button>
          <MarketShareSheet
            open={shareOpen}
            onClose={() => setShareOpen(false)}
            market={market}
            accentColor={T.amber}
            referralId={referralId}
          />
        </div>

        {/* ── Masthead: the hub's arena, as on its Featured Game card ── */}
        <div className="nbad-hero">
          <div className="nbad-hero__top">
            <span className="nbad-pill">
              <span />
              {typeof stage === "string" && stage
                ? `NBA · ${stage}`
                : "NBA · 2026/27 Season"}
            </span>
            <span
              className={`nbah-chip${locked ? "" : " nbah-chip--open"}`}
            >
              {locked ? <ShieldAlert size={14} /> : <Clock size={14} />}
              <span>{statusText}</span>
            </span>
          </div>

          {tipoff && (
            <div className="nbad-hero__eyebrow">
              Tip-off · {tipoffLabel(tipoff)}
            </div>
          )}
          {/* A game's teams are on the matchup card right below, so the
              heading stays for screen readers only. Field markets (champion,
              MVP) have no card and keep it on screen. */}
          <h1 className={sides ? "nbad-sr" : "nbad-hero__title"}>
            {sides
              ? `${sides.away.label} at ${sides.home.label}`
              : market.title}
          </h1>
          {market.description && (
            <p className="nbad-hero__desc">{market.description}</p>
          )}

          <div className="nbad-stats">
            <StatTile icon={<Coins />} label="Total pool" value={poolText} />
            <StatTile
              icon={<Clock />}
              label={locked ? "Status" : "Tip-off in"}
              value={
                locked
                  ? resolved
                    ? "Final"
                    : isResolving
                      ? "Proposed"
                      : "Locked"
                  : closes || "—"
              }
            />
            <StatTile
              icon={<Zap />}
              label="Predictions"
              value={locked ? "Closed" : "Open"}
            />
          </div>
        </div>

        {/* ── Locked banner ── */}
        {locked && (
          <div
            style={{
              marginTop: 14,
              border: "1px solid rgba(255,182,109,0.35)",
              background: "rgba(255,182,109,0.06)",
              borderRadius: 12,
              padding: "11px 14px",
              display: "flex",
              alignItems: "center",
              gap: 9,
            }}
          >
            <ShieldAlert size={15} color={T.amber} />
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: "#fff",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {resolved
                ? "This market has been settled"
                : isResolving
                  ? "Result proposed — predictions are closed"
                  : "Tipped off — predictions are locked"}
            </span>
          </div>
        )}

        {chartCard}

        {/* ── Outcomes ── */}
        <div style={{ marginTop: 14 }}>
          {sides ? (
            <MatchBlock
              market={market}
              tipoff={tipoff}
              away={sides.away}
              home={sides.home}
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

        <DisputeResultBanner dispute={myDispute ?? null} />

        {/* ── Dispute (resolving) ── */}
        {isResolving && (
          <div
            style={{
              marginTop: 14,
              border: "1px solid rgba(255,182,109,0.35)",
              borderRadius: 12,
              padding: "14px 15px",
              background: "rgba(255,182,109,0.05)",
            }}
          >
            <SectionLabel>Proposed result</SectionLabel>
            {proposedOutcome && (
              <div
                style={{
                  ...DISPLAY,
                  marginTop: 8,
                  fontSize: 22,
                  color: "#fff",
                }}
              >
                {proposedOutcome.label}
              </div>
            )}
            {disputeTimeLeft && (
              <div style={{ marginTop: 6 }}>
                <MutedLabel>{disputeTimeLeft}</MutedLabel>
              </div>
            )}
            {disputeSuccess ? (
              <div style={{ marginTop: 12 }}>
                <span
                  style={{ fontSize: 11, fontWeight: 800, color: "#3ddc97" }}
                >
                  Dispute submitted — under review
                </span>
              </div>
            ) : (
              <div style={{ marginTop: 12 }}>
                {disputeContest && (
                  <div style={{ marginBottom: 12 }}>
                    <DisputeContestFields
                      {...disputeContest}
                      accent={T.amber}
                    />
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
                    background: T.ink,
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 8,
                    color: "#fff",
                    padding: "10px 12px",
                    fontSize: 13,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                {disputeError && (
                  <div style={{ marginTop: 7 }}>
                    <span
                      style={{ fontSize: 11, fontWeight: 700, color: T.live }}
                    >
                      {disputeError}
                    </span>
                  </div>
                )}
                <button
                  disabled={disputeSubmitting}
                  onClick={handleSubmitDispute}
                  style={{
                    marginTop: 10,
                    border: "none",
                    borderRadius: 7,
                    padding: "10px 16px",
                    background: T.amber,
                    color: T.onAmber,
                    fontSize: 11,
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
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

// ── Small text primitives ─────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 9.5,
        fontWeight: 900,
        color: T.amberSoft,
        textTransform: "uppercase",
        letterSpacing: "0.2em",
      }}
    >
      {children}
    </span>
  );
}

function MutedLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 8.5,
        fontWeight: 700,
        color: "rgba(255,255,255,0.45)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
      }}
    >
      {children}
    </span>
  );
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="nbad-stat">
      <span className="nbad-stat__icon" aria-hidden>
        {icon}
      </span>
      <span className="nbad-stat__text">
        <span className="nbad-stat__label">{label}</span>
        <span className="nbad-stat__value">{value}</span>
      </span>
    </div>
  );
}

// ── Match layout: away @ home ─────────────────────────────────────────────────

const timeOnly = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
const dayOnly = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));

/** The hub's Featured Game card, for one market: crests, VS, and the two picks. */
function MatchBlock({
  market,
  away,
  home,
  locked,
  winnerId,
  onBet,
  tipoff,
  part,
}: {
  market: Market;
  away: Outcome;
  home: Outcome;
  locked: boolean;
  winnerId: string | null;
  onBet: (outcomeId: string) => void;
  tipoff?: string | null;
  /** Which half to draw; omitted draws the whole card. */
  part?: "header" | "actions";
}) {
  const sides = [
    { o: away, tone: "away" as const, tag: "Away" },
    { o: home, tone: "home" as const, tag: "Home" },
  ];
  const pct = (o: Outcome) => Math.round(calcProb(market, o.id) * 100);
  const odds = (o: Outcome) => {
    const text = formatOdds(calcOdds(market, o.id));
    return text === "—" ? null : text;
  };

  return (
    <div className={`nbad-match${part === "actions" ? " nbad-match--actions" : ""}`}>
      {part !== "actions" && (
        <>
          <div className="nbad-match__teams">
            {sides.map(({ o, tag }, i) => (
              <React.Fragment key={o.id}>
                {i === 1 && (
                  <div className="nbad-match__center">
                    <div className="nbah-feat__vs">VS</div>
                    {tipoff && market.status === "open" && (
                      <>
                        <div className="nbah-feat__time">
                          <SegmentDisplay value={timeOnly(tipoff).split(/\s/)[0]} />
                          <span className="nbah-feat__ampm">
                            {timeOnly(tipoff).split(/\s/).slice(1).join(" ")}
                          </span>
                        </div>
                        <div className="nbah-feat__when">{dayOnly(tipoff)}</div>
                      </>
                    )}
                  </div>
                )}
                <div
                  className={`nbad-match__team${winnerId && winnerId !== o.id ? " nbad-match__team--lost" : ""}`}
                >
                  <NbaLogo
                    src={o.imageUrl}
                    abbr={o.label.split(" ").pop() ?? o.label}
                    size={64}
                  />
                  <div className="nbad-match__name">{o.label}</div>
                  <div className="nbad-match__tag">{tag}</div>
                </div>
              </React.Fragment>
            ))}
          </div>
          <div className="nbad-match__bar" aria-hidden>
            {sides.map(({ o, tone }) => (
              <div
                key={o.id}
                className={`nbad-match__bar--${tone}`}
                style={{ width: `${pct(o)}%` }}
              />
            ))}
          </div>
        </>
      )}

      {part !== "header" && (
        <div className="nbad-match__bets">
          {sides.map(({ o, tone }) => {
            const won = winnerId === o.id;
            return (
              <button
                key={o.id}
                type="button"
                disabled={locked}
                onClick={() => !locked && onBet(o.id)}
                className={[
                  "nbah-bet",
                  `nbah-bet--${tone}`,
                  "nbah-bet--filled",
                  "nbah-bet--stacked",
                  "nbad-bet",
                  won && "nbad-bet--won",
                  locked && winnerId && !won && "nbad-bet--lost",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className="nbah-bet__name">{o.label}</span>
                <span className="nbah-bet__meta">
                  {won ? (
                    "Won"
                  ) : (
                    <>
                      <span>{pct(o)}%</span>
                      <i aria-hidden />
                      <span>{odds(o) ?? "—"}</span>
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Field layout (champion, MVP, any ranked list) ─────────────────────────────

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
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
              gap: 11,
              padding: "12px 13px",
              borderRadius: 14,
              background: T.card,
              border: `1px solid ${won ? T.amber : T.line}`,
              opacity: eliminated || (locked && winnerId && !won) ? 0.5 : 1,
            }}
          >
            <div
              style={{
                ...DISPLAY,
                width: 22,
                fontSize: 16,
                color: T.muted,
                flexShrink: 0,
                textAlign: "center",
              }}
            >
              {idx + 1}
            </div>
            <NbaLogo
              src={outcome.imageUrl}
              abbr={outcome.label.split(" ").pop() ?? outcome.label}
              size={38}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 800,
                  color: "#fff",
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
                  background: "rgba(255,255,255,0.1)",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: won ? T.amber : eliminated ? "#555" : T.teal,
                  }}
                />
              </div>
              <div
                style={{
                  marginTop: 5,
                  fontSize: 10.5,
                  color: "rgba(255,255,255,0.45)",
                  fontWeight: 600,
                }}
              >
                Nu {Number(outcome.totalBetAmount ?? 0).toLocaleString()} pool
              </div>
            </div>
            <div style={{ textAlign: "center", flexShrink: 0, minWidth: 46 }}>
              <div
                style={{
                  ...DISPLAY,
                  fontSize: 19,
                  color: eliminated ? "#777" : "#fff",
                  lineHeight: 1,
                }}
              >
                {pct}%
              </div>
              <div
                style={{
                  marginTop: 3,
                  fontSize: 11,
                  fontWeight: 900,
                  color: T.amberSoft,
                }}
              >
                {formatOdds(odds)}
              </div>
            </div>
            {won ? (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 900,
                  color: T.amber,
                  flexShrink: 0,
                }}
              >
                Winner
              </span>
            ) : eliminated ? (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: T.live,
                  flexShrink: 0,
                }}
              >
                Out
              </span>
            ) : (
              !locked && (
                <button
                  onClick={() => onBet(outcome.id)}
                  style={{
                    border: "none",
                    borderRadius: 7,
                    padding: "9px 14px",
                    background: T.amber,
                    color: T.onAmber,
                    fontSize: 11,
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
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
