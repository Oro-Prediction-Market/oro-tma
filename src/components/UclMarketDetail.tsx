import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Share2, Clock, ShieldAlert, Star } from "lucide-react";
import type { Market, Outcome } from "@shared/api/client";
import { TmaBetModal } from "@/components/TmaBetModal";
import {
  DisputeContestFields,
  type DisputeContestControls,
} from "@/components/DisputeContestFields";
import { calcProb, calcOdds } from "@/pages/WorldCupHubPage";
import { isDrawOutcome } from "@/pages/BplHubPage";

// ── UEFA Champions League theme tokens ────────────────────────────────────────
const ACCENT = "#2b6bff"; // UCL blue (home)
const NAVY = "#0c1746";
const AWAY = "#e0457b"; // magenta (away)
const GOLD = "#e8c766";
const SILVER = "#aab6d6";
const BG = "#070d29";

// ── Self-contained crest + name helpers ───────────────────────────────────────
function UclCrest({ src, label, size }: { src: string | null; label: string; size: number }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <img
        src={src}
        alt={label}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          flexShrink: 0,
          background: "rgba(255,255,255,0.06)",
          borderRadius: "50%",
          padding: Math.round(size * 0.1),
          boxSizing: "border-box",
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        background: `linear-gradient(135deg, ${ACCENT} 0%, ${NAVY} 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.4,
        fontWeight: 900,
        color: "#fff",
      }}
    >
      {label.trim().charAt(0).toUpperCase()}
    </div>
  );
}

// Per-outcome image, then the market-level images (index 0 = first team).
function crestFor(market: Market, teamIdx: number): string | null {
  const teams = (market.outcomes ?? []).filter((o) => !isDrawOutcome(o.label ?? ""));
  const o = teams[teamIdx];
  if (o?.imageUrl) return o.imageUrl;
  if (teamIdx === 0) return market.imageUrl ?? null;
  if (teamIdx === 1) return market.imageUrlAlt ?? null;
  return null;
}

function shortName(label: string): string {
  return label
    .replace(/\b(fc|cf|afc|sc|ac)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMatchTeams(title: string): { a: string; b: string } {
  const m = title.match(
    /^(.+?)\s+vs\.?\s+(.+?)(?:\s*[–—\-:?]|\s*\(|\s+(?:who|which|will)\b|$)/i,
  );
  if (m) return { a: m[1].trim(), b: m[2].trim() };
  return { a: "Team A", b: "Team B" };
}

function isMatchLayout(market: Market): boolean {
  if (!/\bvs\b/i.test(market.title)) return false;
  const outs = market.outcomes ?? [];
  const nonDraw = outs.filter((o) => !isDrawOutcome(o.label ?? ""));
  return outs.some((o) => isDrawOutcome(o.label ?? "")) || nonDraw.length === 2;
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

export interface UclMarketDetailProps {
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

export function UclMarketDetail({
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
}: UclMarketDetailProps) {
  const navigate = useNavigate();
  const [activeBet, setActiveBet] = useState<string | null>(null);

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

  const isMatch = isMatchLayout(market);
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

  const iconBtn: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(43,107,255,0.4)",
    borderRadius: 10,
    padding: "8px 12px",
    color: "rgba(255,255,255,0.8)",
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
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
            border: "1px solid rgba(43,107,255,0.3)",
            background: `linear-gradient(135deg, ${NAVY} 0%, #0a1235 55%, ${BG} 100%)`,
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse at 100% 0%, rgba(43,107,255,0.4) 0%, transparent 48%), radial-gradient(ellipse at 0% 100%, rgba(232,199,102,0.14) 0%, transparent 50%)",
              pointerEvents: "none",
            }}
          />
          <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.5 }}>
            <Star size={9} color="#cfe0ff" fill="#cfe0ff" style={{ position: "absolute", right: "12%", top: "22%" }} />
            <Star size={7} color={GOLD} fill={GOLD} style={{ position: "absolute", right: "26%", top: "60%" }} />
            <Star size={6} color="#cfe0ff" fill="#cfe0ff" style={{ position: "absolute", right: "6%", top: "54%" }} />
          </div>

          <div style={{ position: "relative", padding: "18px 18px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "rgba(43,107,255,0.14)",
                  border: "1px solid rgba(43,107,255,0.5)",
                  borderRadius: 20,
                  padding: "4px 11px",
                  color: "#cfe0ff",
                  fontSize: 10,
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                <Star size={12} color={GOLD} fill={GOLD} />
                Champions League
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  background: "rgba(0,0,0,0.35)",
                  border: `1px solid ${locked ? "rgba(232,199,102,0.4)" : "rgba(43,107,255,0.4)"}`,
                  borderRadius: 20,
                  padding: "4px 10px",
                  color: locked ? GOLD : "#7fa8ff",
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
                margin: 0,
                fontSize: "clamp(20px, 5vw, 28px)",
                fontWeight: 900,
                lineHeight: 1.14,
                color: "#fff",
                letterSpacing: "-0.01em",
                textShadow: "0 2px 12px rgba(0,0,0,0.5)",
              }}
            >
              {market.title}
            </h1>

            {market.description && (
              <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.5, color: "rgba(255,255,255,0.72)", maxWidth: 620 }}>
                {market.description}
              </p>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <StatTile label="Total pool" value={`Nu ${totalPool.toLocaleString()}`} />
              <StatTile label="Outcomes" value={String(outcomes.length)} />
              <StatTile label={locked ? "Status" : "Closes in"} value={locked ? (resolved ? "Resolved" : "Locked") : closes || "—"} />
            </div>
          </div>
        </div>

        {/* ── Locked banner ── */}
        {locked && (
          <div
            style={{
              marginTop: 14,
              border: "1px solid rgba(232,199,102,0.35)",
              background: "rgba(232,199,102,0.06)",
              borderRadius: 12,
              padding: "11px 14px",
              display: "flex",
              alignItems: "center",
              gap: 9,
            }}
          >
            <ShieldAlert size={15} color={GOLD} />
            <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {resolved ? "This market has been settled" : isResolving ? "Resolving — betting is closed" : "Predictions are locked"}
            </span>
          </div>
        )}

        {/* ── Outcomes ── */}
        <div style={{ marginTop: 14 }}>
          {isMatch ? (
            <MatchBlock market={market} locked={locked} winnerId={winnerId} onBet={onBet} />
          ) : (
            <FieldBlock market={market} locked={locked} winnerId={winnerId} onBet={onBet} />
          )}
        </div>

        {/* ── Resolution info ── */}
        {(market.resolutionCriteria || market.settlementSource) && (
          <div
            style={{
              marginTop: 14,
              border: "1px solid rgba(43,107,255,0.25)",
              borderRadius: 12,
              padding: "14px 15px",
              background: "rgba(43,107,255,0.05)",
            }}
          >
            <SectionLabel>How this resolves</SectionLabel>
            {market.resolutionCriteria && (
              <p style={{ margin: "9px 0 0", fontSize: 12.5, lineHeight: 1.55, color: "rgba(255,255,255,0.72)" }}>
                {market.resolutionCriteria}
              </p>
            )}
            {market.settlementSource && (
              <div style={{ marginTop: 10 }}>
                <MutedLabel>Settlement source</MutedLabel>
                <div style={{ marginTop: 3, fontSize: 12, fontWeight: 700, color: "#fff" }}>{market.settlementSource}</div>
              </div>
            )}
            {resolved && market.evidenceNote && (
              <div style={{ marginTop: 10 }}>
                <MutedLabel>Resolution note</MutedLabel>
                <p style={{ margin: "3px 0 0", fontSize: 12, lineHeight: 1.5, color: "rgba(255,255,255,0.72)" }}>
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
              border: "1px solid rgba(232,199,102,0.35)",
              borderRadius: 12,
              padding: "14px 15px",
              background: "rgba(232,199,102,0.05)",
            }}
          >
            <SectionLabel color={GOLD}>Proposed result</SectionLabel>
            {proposedOutcome && (
              <div style={{ marginTop: 8, fontSize: 16, fontWeight: 900, color: "#fff" }}>{shortName(proposedOutcome.label)}</div>
            )}
            {disputeTimeLeft && (
              <div style={{ marginTop: 6 }}>
                <MutedLabel>{disputeTimeLeft}</MutedLabel>
              </div>
            )}
            {disputeSuccess ? (
              <div style={{ marginTop: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#3ddc97" }}>Dispute submitted — under review</span>
              </div>
            ) : (
              <div style={{ marginTop: 12 }}>
                {disputeContest && (
                  <div style={{ marginBottom: 12 }}>
                    <DisputeContestFields {...disputeContest} accent="#3ddc97" />
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
                    <span style={{ fontSize: 11, fontWeight: 700, color: AWAY }}>{disputeError}</span>
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
                    background: `linear-gradient(180deg, ${GOLD} 0%, #c9a53a 100%)`,
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

function SectionLabel({ children, color = "#7fa8ff" }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 800, color, textTransform: "uppercase", letterSpacing: "0.08em" }}>{children}</span>
  );
}

function MutedLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 8.5, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
      {children}
    </span>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0, background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "9px 11px" }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 15, fontWeight: 900, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
    </div>
  );
}

// ── Match layout (Home / Draw / Away) ─────────────────────────────────────────

const outcomeColor = (label: string, idx: number) =>
  isDrawOutcome(label) ? "#9ca3af" : idx === 0 ? ACCENT : AWAY;

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
  const outcomes = market.outcomes ?? [];
  const teams = outcomes.filter((o) => !isDrawOutcome(o.label ?? ""));
  const [t1, t2] = teams;
  if (!t1 || !t2) return null;

  const titleTeams = parseMatchTeams(market.title);
  const name1 = shortName(/^(yes|no)$/i.test(t1.label.trim()) ? titleTeams.a : t1.label);
  const name2 = shortName(/^(yes|no)$/i.test(t2.label.trim()) ? titleTeams.b : t2.label);

  const segs = outcomes.map((o, i) => ({
    id: o.id,
    pct: Math.round(calcProb(market, o.id) * 100),
    color: outcomeColor(o.label ?? "", teams.indexOf(o) === -1 ? i : teams.indexOf(o)),
  }));

  return (
    <div style={{ border: "1px solid rgba(43,107,255,0.25)", borderRadius: 16, overflow: "hidden", background: "#0a1130" }}>
      {/* Crest header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          gap: 10,
          padding: "22px 16px 16px",
          background: `linear-gradient(135deg, ${NAVY} 0%, rgba(43,107,255,0.16) 100%)`,
        }}
      >
        <div style={{ textAlign: "center", flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <UclCrest src={crestFor(market, 0)} label={name1} size={58} />
          </div>
          <div style={{ marginTop: 8, fontSize: 14, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name1}</div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 900, color: "#fff", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 8, padding: "5px 11px", flexShrink: 0 }}>VS</div>
        <div style={{ textAlign: "center", flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <UclCrest src={crestFor(market, 1)} label={name2} size={58} />
          </div>
          <div style={{ marginTop: 8, fontSize: 14, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name2}</div>
        </div>
      </div>

      {/* Probability bar */}
      <div style={{ display: "flex", height: 5 }}>
        {segs.map((s) => (
          <div key={s.id} style={{ width: `${s.pct}%`, background: s.color }} />
        ))}
      </div>

      {/* Outcome buttons */}
      <div style={{ display: "flex", gap: 8, padding: "14px 14px 16px" }}>
        {outcomes.map((outcome, idx) => {
          const draw = isDrawOutcome(outcome.label ?? "");
          const teamIdx = teams.indexOf(outcome);
          const color = outcomeColor(outcome.label ?? "", teamIdx === -1 ? idx : teamIdx);
          const pct = Math.round(calcProb(market, outcome.id) * 100);
          const odds = calcOdds(market, outcome.id);
          const won = winnerId === outcome.id;
          const label = draw ? "Draw" : shortName(idx === 0 ? name1 : idx === outcomes.length - 1 ? name2 : outcome.label);
          return (
            <button
              key={outcome.id}
              disabled={locked}
              onClick={() => !locked && onBet(outcome.id)}
              style={{
                flex: 1,
                minWidth: 0,
                padding: "12px 6px",
                background: won ? "rgba(232,199,102,0.14)" : `${color}14`,
                border: `1px solid ${won ? GOLD : color}55`,
                borderRadius: 12,
                cursor: locked ? "default" : "pointer",
                textAlign: "center",
                opacity: locked && winnerId && !won ? 0.5 : 1,
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 900, color: won ? GOLD : color, lineHeight: 1 }}>{pct}%</div>
              <div style={{ marginTop: 5, fontSize: 12, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
              <div style={{ marginTop: 3, fontSize: 10, fontWeight: 800, color: GOLD }}>{won ? "WON" : odds ? `${odds.toFixed(2)}x` : "—"}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Field layout (winner, top scorer, ranked list) ────────────────────────────

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
              background: "linear-gradient(135deg, rgba(43,107,255,0.07) 0%, #0b1230 65%)",
              border: `1px solid ${won ? "rgba(232,199,102,0.5)" : "rgba(43,107,255,0.2)"}`,
              opacity: eliminated || (locked && winnerId && !won) ? 0.5 : 1,
            }}
          >
            <div style={{ width: 20, fontSize: 13, fontWeight: 900, color: SILVER, flexShrink: 0, textAlign: "center" }}>{idx + 1}</div>
            <UclCrest src={outcome.imageUrl ?? crestFor(market, idx)} label={outcome.label} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: eliminated ? "line-through" : "none" }}>{outcome.label}</div>
              <div style={{ marginTop: 6, height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: won ? GOLD : eliminated ? "#555" : ACCENT }} />
              </div>
              <div style={{ marginTop: 5, fontSize: 10.5, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>
                Nu {Number(outcome.totalBetAmount ?? 0).toLocaleString()} pool
              </div>
            </div>
            <div style={{ textAlign: "center", flexShrink: 0, minWidth: 46 }}>
              <div style={{ fontSize: 17, fontWeight: 900, color: eliminated ? "#777" : "#7fa8ff", lineHeight: 1 }}>{pct}%</div>
              <div style={{ marginTop: 3, fontSize: 11, fontWeight: 900, color: GOLD }}>{odds ? `${odds.toFixed(2)}x` : "—"}</div>
            </div>
            {won ? (
              <span style={{ fontSize: 10, fontWeight: 900, color: GOLD, flexShrink: 0 }}>Winner</span>
            ) : eliminated ? (
              <span style={{ fontSize: 9, fontWeight: 800, color: AWAY, flexShrink: 0 }}>Out</span>
            ) : (
              !locked && (
                <button
                  onClick={() => onBet(outcome.id)}
                  style={{
                    border: "none",
                    borderRadius: 9,
                    padding: "9px 14px",
                    background: ACCENT,
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
