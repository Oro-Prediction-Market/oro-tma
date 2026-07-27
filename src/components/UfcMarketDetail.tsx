import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Share2, Clock, ShieldAlert } from "lucide-react";
import type { Market, Outcome } from "@shared/api/client";
import { TmaBetModal } from "@/components/TmaBetModal";
import { calcProb, calcOdds } from "@/pages/WorldCupHubPage";
import { isDrawOutcome } from "@/pages/BplHubPage";
import {
  getUfcAvatar,
  shortFighterName,
  FighterAvatar,
} from "@/pages/UfcHubPage";

// ── UFC theme tokens (mirror the hub) ─────────────────────────────────────────
const RED = "#d20a0a";
const RED_DIM = "#8f0707";
const BLUE = "#2563eb";
const BLUE_DIM = "#173e9e";
const GOLD = "#fbbf24";
const BG = "#0d0b0c";

// "Jon Jones vs Charles Oliveira" → { a, b } (strips a leading "UFC 315:" etc.)
function parseFightNames(title: string): { a: string; b: string } {
  const m = title.match(
    /^(?:ufc\s*\d*\s*[:\-–—]?\s*)?(.+?)\s+vs\.?\s+(.+?)(?:\s*[–—\-:?]|\s*\(|\s+(?:who|which|will)\b|$)/i,
  );
  if (m) return { a: m[1].trim(), b: m[2].trim() };
  return { a: "Fighter A", b: "Fighter B" };
}

function eventLabelOf(title: string): string {
  return (
    title.match(/^\s*UFC\s+([^:–—-]{1,14})\s*[:–—-]/i)?.[1] ?? "FIGHT NIGHT"
  ).toUpperCase();
}

// A fight-card layout applies to exactly two non-draw fighters. Yes/No props
// only count as a fight when the title is itself a "X vs Y" matchup.
function isFightLayout(market: Market): boolean {
  const nd = (market.outcomes ?? []).filter((o) => !isDrawOutcome(o.label ?? ""));
  if (nd.length !== 2) return false;
  const binary = nd.every((o) => /^(yes|no)$/i.test((o.label ?? "").trim()));
  if (binary) return /\bvs\b/i.test(market.title);
  return true;
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

// The UFC cage octagon + oncoming fist, used as the center VS motif.
function OctagonFist({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <polygon
        points="31,6 69,6 94,31 94,69 69,94 31,94 6,69 6,31"
        fill="rgba(0,0,0,0.55)"
        stroke="#ffffff"
        strokeWidth="4.5"
        strokeLinejoin="miter"
      />
      <g transform="translate(50,50) scale(1.55) translate(-18,-18.5)">
        <path
          fill="#ffffff"
          d="M32.942 11.244c-.041-.609-.284-1.18-.674-1.644l-.357-2.057c-.376-2.006-2.232-3.386-4.262-3.169L4.259 8.11C2.377 8.312.909 9.833.774 11.721l1.761 11.147c.305 2.169 2.151 3.788 4.341 3.813.677.008 1.238.017 1.463.027l9.483.463c-.363.483-.822 1.08-.822 1.718v.052c0 1.581 1.771 3.06 3.353 3.06h7.282c.76 0 1.488-.4 2.025-.938l4.424-4.472c.583-.584.887-1.416.832-2.24l-1.974-13.107z"
        />
        <path
          fill={BG}
          d="M8.217 26.623c-.474 0-.895-.338-.983-.821L5.174 14.47c-.099-.543.262-1.064.805-1.163.546-.097 1.064.262 1.163.805l2.06 11.332c.099.543-.262 1.063-.805 1.162-.061.012-.121.017-.18.017zm6.181 0c-.517 0-.955-.398-.996-.923l-1.03-13.393c-.043-.551.37-1.031.92-1.074.549-.044 1.031.371 1.074.92l1.03 13.392c.043.551-.37 1.032-.92 1.074-.026.003-.053.004-.078.004zm7.207 1.106c-.508 0-.757-.001-.951-1.062l-.044-.003c.001-.055.007-.108.017-.161-.174-1.068-.309-3.069-.561-6.817-.235-3.49-.486-7.552-.486-8.485 0-.552.447-1 1-1 .553 0 1 .448 1 1 0 1.533.795 13.324.981 15.145.032.097.049.2.049.308 0 .266-.108.557-.295.744s-.444.331-.71.331z"
        />
        <path
          fill={BG}
          d="M25.178 28.684H18.52c-.552 0-1-.447-1-1s.448-1 1-1h6.658c1.458 0 2.644-1.186 2.644-2.644V11.201c0-.552.447-1 1-1s1 .448 1 1V24.04c-.001 2.561-2.084 4.644-4.644 4.644z"
        />
      </g>
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface UfcMarketDetailProps {
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
}

export function UfcMarketDetail({
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
}: UfcMarketDetailProps) {
  const navigate = useNavigate();
  const [activeBet, setActiveBet] = useState<string | null>(null);

  // Open the detail view at the top, not at the feed's scroll position
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [market.id]);

  const locked =
    market.status === "closed" ||
    market.status === "resolving" ||
    market.status === "resolved" ||
    market.status === "settled";
  const resolved = market.status === "resolved" || market.status === "settled";

  const closes = useCountdown(
    locked ? null : (market.bettingClosesAt ?? market.closesAt),
  );

  const outcomes = market.outcomes ?? [];
  const totalPool =
    Number(market.totalPool ?? 0) ||
    outcomes.reduce((s, o) => s + Number(o.totalBetAmount ?? 0), 0);

  const isFight = isFightLayout(market);
  const winnerId = market.resolvedOutcomeId ?? null;
  const eventLabel = eventLabelOf(market.title);

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

  const iconBtn: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(210,10,10,0.4)",
    borderRadius: 10,
    padding: "8px 12px",
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    cursor: "pointer",
  };

  return (
    <div style={{ minHeight: "100vh", background: BG }}>
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
          <button onClick={() => navigate(-1)} style={iconBtn}>
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
            style={iconBtn}
          >
            <Share2 size={15} />
            Share
          </button>
        </div>

        {/* ── Masthead ── */}
        <div
          style={{
            position: "relative",
            borderRadius: 18,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.1)",
            background: "#0d0b0c",
          }}
        >
          {/* Arena background */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: "url('/ufc-card-bg.jpg')",
              backgroundSize: "cover",
              backgroundPosition: "center",
              opacity: 0.55,
            }}
          />
          {/* Octagon watermark */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              right: -40,
              top: -30,
              opacity: 0.12,
              pointerEvents: "none",
            }}
          >
            <svg width="220" height="220" viewBox="0 0 100 100">
              <polygon
                points="31,6 69,6 94,31 94,69 69,94 31,94 6,69 6,31"
                fill="none"
                stroke="#fff"
                strokeWidth="2"
                strokeLinejoin="miter"
              />
            </svg>
          </div>
          {/* Readability gradient */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(13,11,12,0.35) 0%, rgba(13,11,12,0.75) 55%, #0d0b0c 100%)",
            }}
          />

          {/* UFC badge */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              background: `linear-gradient(180deg, ${RED} 0%, ${RED_DIM} 100%)`,
              padding: "8px 16px 12px",
              borderBottomRightRadius: 16,
              zIndex: 5,
            }}
          >
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                fontStyle: "italic",
                color: "#fff",
                lineHeight: 1,
                letterSpacing: "-1px",
              }}
            >
              UFC
            </div>
            <div
              style={{
                fontSize: 9,
                fontWeight: 800,
                color: "#fff",
                fontStyle: "italic",
                letterSpacing: "0.05em",
                marginTop: 2,
              }}
            >
              {eventLabel}
            </div>
          </div>

          <div
            style={{
              position: "relative",
              zIndex: 6,
              padding: "58px 18px 18px",
            }}
          >
            {/* Status pill */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  background: "rgba(0,0,0,0.55)",
                  border: `1px solid ${locked ? "rgba(251,191,36,0.4)" : "rgba(210,10,10,0.5)"}`,
                  borderRadius: 20,
                  padding: "5px 11px",
                  color: locked ? GOLD : "#ff6b6b",
                  fontSize: 10,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {!locked && <Clock size={11} />}
                {statusText}
              </span>
            </div>

            <h1
              style={{
                margin: "12px 0 0",
                fontSize: "clamp(21px, 5.5vw, 30px)",
                fontWeight: 900,
                fontStyle: "italic",
                lineHeight: 1.12,
                color: "#fff",
                textTransform: "uppercase",
                letterSpacing: "-0.5px",
                textShadow: "0 2px 12px rgba(0,0,0,0.6)",
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
                  color: "rgba(255,255,255,0.7)",
                  maxWidth: 620,
                }}
              >
                {market.description}
              </p>
            )}

            {/* Stat tiles */}
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
              border: "1px solid rgba(251,191,36,0.35)",
              background: "rgba(251,191,36,0.06)",
              borderRadius: 12,
              padding: "11px 14px",
              display: "flex",
              alignItems: "center",
              gap: 9,
            }}
          >
            <ShieldAlert size={15} color={GOLD} />
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
                ? "This fight has been settled"
                : isResolving
                  ? "Resolving — betting is closed"
                  : "Predictions are locked"}
            </span>
          </div>
        )}

        {/* ── Outcomes ── */}
        <div style={{ marginTop: 14 }}>
          {isFight ? (
            <FightBlock
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
              border: "1px solid rgba(210,10,10,0.25)",
              borderRadius: 12,
              padding: "14px 15px",
              background: "rgba(210,10,10,0.05)",
            }}
          >
            <SectionLabel>How this resolves</SectionLabel>
            {market.resolutionCriteria && (
              <p
                style={{
                  margin: "9px 0 0",
                  fontSize: 12.5,
                  lineHeight: 1.55,
                  color: "rgba(255,255,255,0.72)",
                }}
              >
                {market.resolutionCriteria}
              </p>
            )}
            {market.settlementSource && (
              <div style={{ marginTop: 10 }}>
                <MutedLabel>Settlement source</MutedLabel>
                <div
                  style={{
                    marginTop: 3,
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#fff",
                  }}
                >
                  {market.settlementSource}
                </div>
              </div>
            )}
            {resolved && market.evidenceNote && (
              <div style={{ marginTop: 10 }}>
                <MutedLabel>Resolution note</MutedLabel>
                <p
                  style={{
                    margin: "3px 0 0",
                    fontSize: 12,
                    lineHeight: 1.5,
                    color: "rgba(255,255,255,0.72)",
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
              border: "1px solid rgba(251,191,36,0.35)",
              borderRadius: 12,
              padding: "14px 15px",
              background: "rgba(251,191,36,0.05)",
            }}
          >
            <SectionLabel color={GOLD}>Proposed result</SectionLabel>
            {proposedOutcome && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 16,
                  fontWeight: 900,
                  fontStyle: "italic",
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
                <span style={{ fontSize: 11, fontWeight: 800, color: "#22c55e" }}>
                  Dispute submitted — under review
                </span>
              </div>
            ) : (
              <div style={{ marginTop: 12 }}>
                <textarea
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Explain why the proposed result is incorrect…"
                  rows={3}
                  style={{
                    width: "100%",
                    resize: "vertical",
                    background: BG,
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
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#ff6b6b" }}>
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
                    borderRadius: 9,
                    padding: "10px 16px",
                    background: `linear-gradient(180deg, ${GOLD} 0%, #d99e00 100%)`,
                    color: "#1a1400",
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

function SectionLabel({
  children,
  color = "#ff6b6b",
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 800,
        color,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
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
        color: "rgba(255,255,255,0.4)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
      }}
    >
      {children}
    </span>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: "rgba(0,0,0,0.5)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        padding: "9px 11px",
      }}
    >
      <div
        style={{
          fontSize: 8,
          fontWeight: 700,
          color: "rgba(255,255,255,0.45)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 15,
          fontWeight: 900,
          color: "#fff",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ── Fight layout (two fighters, red vs blue corners) ──────────────────────────

function FightBlock({
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
  const fighters = (market.outcomes ?? []).filter(
    (o) => !isDrawOutcome(o.label ?? ""),
  );
  const [fa, fb] = fighters;
  const draw = (market.outcomes ?? []).find((o) => isDrawOutcome(o.label ?? ""));
  if (!fa || !fb) return null;

  const titleNames = parseFightNames(market.title);
  const nameOf = (label: string, idx: number) =>
    /^(yes|no)$/i.test(label.trim())
      ? idx === 0
        ? titleNames.a
        : titleNames.b
      : label;

  const pctA = Math.round(calcProb(market, fa.id) * 100);

  const corner = (
    outcome: Outcome,
    idx: number,
    color: string,
    colorDim: string,
    pct: number,
  ) => {
    const left = idx === 0;
    const name = shortFighterName(nameOf(outcome.label, idx));
    const won = winnerId === outcome.id;
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          minWidth: 0,
          opacity: locked && winnerId && !won ? 0.45 : 1,
        }}
      >
        {/* Corner tag */}
        <div
          style={{
            fontSize: 9,
            fontWeight: 900,
            color,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            marginBottom: 8,
          }}
        >
          {left ? "Red corner" : "Blue corner"}
        </div>
        <div style={{ position: "relative" }}>
          <div
            style={{
              padding: 3,
              borderRadius: "50%",
              background: `linear-gradient(180deg, ${color} 0%, ${colorDim} 100%)`,
              boxShadow: `0 6px 20px ${color}55`,
            }}
          >
            <FighterAvatar
              src={getUfcAvatar(market, idx)}
              label={name}
              size={68}
            />
          </div>
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: 16,
            fontWeight: 900,
            fontStyle: "italic",
            color: "#fff",
            textTransform: "uppercase",
            letterSpacing: "-0.3px",
            textAlign: "center",
            width: "100%",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {name}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 6 }}>
          <span
            style={{
              fontSize: 34,
              fontWeight: 900,
              color,
              lineHeight: 1,
              letterSpacing: "-0.02em",
            }}
          >
            {pct}%
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "rgba(255,255,255,0.55)",
            }}
          >
            win
          </span>
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 11,
            fontWeight: 600,
            color: "rgba(255,255,255,0.5)",
          }}
        >
          <span style={{ color: GOLD, fontWeight: 800 }}>Nu</span>{" "}
          {Number(outcome.totalBetAmount ?? 0).toLocaleString()} pool
        </div>
        {won ? (
          <div
            style={{
              width: "100%",
              marginTop: 14,
              textAlign: "center",
              border: `1px solid ${GOLD}`,
              borderRadius: 9,
              padding: "10px 0",
              color: GOLD,
              fontSize: 11,
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Winner
          </div>
        ) : (
          !locked && (
            <button
              onClick={() => onBet(outcome.id)}
              style={{
                width: "100%",
                marginTop: 14,
                padding: "13px 0",
                background: `linear-gradient(180deg, ${color} 0%, ${colorDim} 100%)`,
                border: "none",
                borderRadius: 10,
                color: "#fff",
                fontSize: 13,
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
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
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 16,
        overflow: "hidden",
        background: "#131013",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: "22px 16px 18px",
        }}
      >
        {corner(fa, 0, RED, RED_DIM, pctA)}
        {/* Center VS + octagon */}
        <div
          style={{
            width: 46,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            paddingTop: 26,
          }}
        >
          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%) rotate(15deg)",
                width: 3,
                height: 44,
                background: "rgba(255,50,50,0.8)",
                boxShadow: "0 0 16px 6px rgba(255,0,0,0.6)",
              }}
            />
            <span
              style={{
                position: "relative",
                display: "inline-block",
                padding: 5,
                lineHeight: 1.2,
                fontSize: 26,
                fontWeight: 900,
                transform: "skewX(-15deg)",
                background: "linear-gradient(180deg, #ffffff 0%, #a0a0a0 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                letterSpacing: "-1px",
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
              }}
            >
              VS
            </span>
          </div>
          <OctagonFist size={34} />
        </div>
        {corner(fb, 1, BLUE, BLUE_DIM, 100 - pctA)}
      </div>
      {/* Probability bar */}
      <div style={{ display: "flex", height: 5 }}>
        <div style={{ width: `${pctA}%`, background: RED }} />
        <div style={{ width: `${100 - pctA}%`, background: BLUE }} />
      </div>
      {draw && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "12px 16px",
            background: "rgba(0,0,0,0.35)",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: "rgba(255,255,255,0.55)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Draw
            </span>
            <span style={{ fontSize: 15, fontWeight: 900, color: "#fff" }}>
              {Math.round(calcProb(market, draw.id) * 100)}%
            </span>
          </div>
          {winnerId === draw.id ? (
            <span style={{ fontSize: 10, fontWeight: 900, color: GOLD }}>Winner</span>
          ) : (
            !locked && (
              <button
                onClick={() => onBet(draw.id)}
                style={{
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 16px",
                  background: GOLD,
                  color: "#1a1400",
                  fontSize: 10,
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
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

// ── Field layout (event predictions, ranked list) ────────────────────────────

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
              background:
                "linear-gradient(135deg, rgba(210,10,10,0.06) 0%, #1a1416 65%)",
              border: `1px solid ${won ? "rgba(251,191,36,0.5)" : "rgba(210,10,10,0.18)"}`,
              opacity: eliminated || (locked && winnerId && !won) ? 0.5 : 1,
            }}
          >
            <div
              style={{
                width: 22,
                fontSize: 13,
                fontWeight: 900,
                color: "rgba(255,255,255,0.35)",
                flexShrink: 0,
                textAlign: "center",
              }}
            >
              {idx + 1}
            </div>
            <FighterAvatar
              src={getUfcAvatar(market, idx)}
              label={outcome.label}
              size={40}
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
                    background: won ? GOLD : eliminated ? "#555" : RED,
                  }}
                />
              </div>
              <div
                style={{
                  marginTop: 5,
                  fontSize: 10.5,
                  color: "rgba(255,255,255,0.4)",
                  fontWeight: 600,
                }}
              >
                Nu {Number(outcome.totalBetAmount ?? 0).toLocaleString()} pool
              </div>
            </div>
            <div style={{ textAlign: "center", flexShrink: 0, minWidth: 46 }}>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 900,
                  color: eliminated ? "#777" : "#ff6b6b",
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
                  color: GOLD,
                }}
              >
                {odds ? `${odds.toFixed(2)}x` : "—"}
              </div>
            </div>
            {won ? (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 900,
                  color: GOLD,
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
                  color: "#ff6b6b",
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
                    borderRadius: 9,
                    padding: "9px 14px",
                    background: RED,
                    color: "#fff",
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
