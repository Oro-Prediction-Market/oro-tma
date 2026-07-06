import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, BarChart3, Clock, CalendarDays, Network } from "lucide-react";
import { WorldCupBracket } from "@shared/components/WorldCupBracket";
import { getMarkets, getMyBets, type Market } from "@shared/api/client";
import { TmaBetModal } from "@/components/TmaBetModal";
import { Page } from "@/components/Page";
import { LoadingScreen } from "@shared/components/LoadingScreen";

// ── Country flag map ──────────────────────────────────────────────────────────

const SVG_MAP: Record<string, string> = {
  algeria: "Algeria", argentina: "Argentina", australia: "Australia",
  austria: "Austria", belgium: "Belgium",
  "bosnia and herzegovina": "BosniaAndHerzegovina", bosnia: "BosniaAndHerzegovina",
  brazil: "Brazil", canada: "Canada", "cape verde": "Cape Verde",
  colombia: "Colombia", croatia: "Croatia",
  "curaçao": "Curaçao", curacao: "Curaçao",
  czechia: "Czechia", "czech republic": "Czechia",
  "dr congo": "DR Congo", congo: "DR Congo",
  ecuador: "Ecuador", egypt: "Egypt", england: "England",
  france: "France", germany: "Germany", ghana: "Ghana", haiti: "Haiti",
  iran: "Iran", iraq: "Iraq",
  "ivory coast": "Ivory Coast", "côte d'ivoire": "Ivory Coast",
  japan: "Japan", jordan: "Jordan", mexico: "Mexico", morocco: "Morocco",
  netherlands: "Netherlands", holland: "Netherlands",
  "new zealand": "NewZealand", norway: "Norway",
  panama: "Panama", paraguay: "Paraguay", portugal: "Portugal", qatar: "Qatar",
  "saudi arabia": "Saudi Arabia", scotland: "Scotland", senegal: "Senegal",
  "south africa": "SouthAfrica",
  "south korea": "SouthKorea", korea: "SouthKorea",
  spain: "Spain", sweden: "Sweden", switzerland: "Switzerland", tunisia: "Tunisia",
  turkey: "Türkiye", "türkiye": "Türkiye",
  "united states": "USA", usa: "USA", america: "USA", us: "USA",
  uruguay: "Uruguay", uzbekistan: "Uzbekistan",
};

// Outcome labels that are answers/markers, not countries — must never map to a flag.
const NON_COUNTRY_LABELS = new Set([
  "yes", "no", "over", "under", "draw", "tie", "odd", "even",
  "none", "both", "neither", "other", "tbd",
]);

export function getWCFlag(country: string): string {
  const lower = country.toLowerCase().trim();
  // Generic prop/outcome labels are NOT teams — never resolve them to a flag,
  // e.g. "No" must not fuzzy-match "Norway", "Yes"/"Draw"/"Over" etc.
  if (!lower || NON_COUNTRY_LABELS.has(lower)) return "";
  if (SVG_MAP[lower]) return `/worldcup/${SVG_MAP[lower]}.svg`;
  for (const [key, file] of Object.entries(SVG_MAP)) {
    // Label contains a country name, OR (only for sufficiently long labels) the
    // country name contains the label. The length guard blocks short tokens
    // ("no", "us") from matching a longer country via the reverse direction.
    if (lower.includes(key) || (lower.length >= 4 && key.includes(lower)))
      return `/worldcup/${file}.svg`;
  }
  return "";
}

// ── Title parsers ─────────────────────────────────────────────────────────────

export function parseWinnerCountry(title: string): string {
  const m = title.match(/^will\s+(.+?)\s+win\b/i);
  if (m) return m[1].trim();
  const idx = title.toLowerCase().indexOf(" win ");
  if (idx > 0) return title.slice(0, idx).replace(/^will\s+/i, "").trim();
  return title.split(" ").slice(0, 2).join(" ");
}

export function parseGroupInfo(title: string): { team: string; group: string } {
  const teamM = title.match(/^will\s+(.+?)\s+(?:top|qualify|win group|advance)\b/i);
  const groupM = title.match(/\bgroup\s+([a-l])\b/i);
  return {
    team: teamM ? teamM[1].trim() : title.split(" ").slice(0, 2).join(" "),
    group: groupM ? groupM[1].toUpperCase() : "?",
  };
}

// Milliseconds until a market's betting closes — drives soonest-first sorting.
// Mirrors the field the countdown timer uses (bettingClosesAt ?? closesAt).
function wcCloseMs(m: Market): number {
  const t = m.bettingClosesAt ?? m.closesAt ?? m.opensAt;
  return t ? new Date(t).getTime() : Infinity;
}

export function parseMatchTeams(title: string): { team1: string; team2: string } {
  const m = title.match(/^(.+?)\s+vs\.?\s+(.+?)(?:\s*[–—\-:?]|\s*\(|\s+(?:who|which|will)\b|$)/i);
  if (m) return { team1: m[1].trim(), team2: m[2].trim() };
  return { team1: "Team A", team2: "Team B" };
}

function useClosesAt(closesAt: string | null | undefined): string {
  const [label, setLabel] = React.useState("");
  React.useEffect(() => {
    if (!closesAt) return;
    const tick = () => {
      const ms = new Date(closesAt).getTime() - Date.now();
      if (ms <= 0) { setLabel("Closed"); return; }
      const d = Math.floor(ms / 86_400_000);
      const h = Math.floor((ms % 86_400_000) / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      if (d > 0) setLabel(`${d}d ${h}h`);
      else if (h > 0) setLabel(`${h}h ${m}m`);
      else setLabel(`${m}m`);
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [closesAt]);
  return label;
}

function WinnerMarketGroup({
  market,
  onBet,
}: {
  market: Market;
  onBet: (marketId: string, outcomeId: string) => void;
}) {
  const navigate = useNavigate();
  const closes = useClosesAt(market.bettingClosesAt ?? market.closesAt);
  const resolving = market.status === "resolving";
  const locked = resolving || market.status === "closed";
  const settleEta = useClosesAt(resolving ? market.disputeDeadlineAt : null);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {market.title}
        </div>
        {locked ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {settleEta && settleEta !== "Closed" && (
              <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>
                <Clock size={10} />
                <span>{settleEta}</span>
              </div>
            )}
            <div style={{ fontSize: 9, fontWeight: 800, color: "#fbbf24", background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 6, padding: "3px 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {resolving ? "Resolving" : "Closed"}
            </div>
          </div>
        ) : closes && (
          <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", flexShrink: 0 }}>
            <Clock size={10} />
            <span>{closes}</span>
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {(market.outcomes ?? []).map((outcome) => {
          const flag = outcome.imageUrl || getWCFlag(outcome.label);
          const prob = calcProb(market, outcome.id);
          const odds = calcOdds(market, outcome.id);
          const eliminated = !!outcome.isEliminated;
          return (
            <div
              key={outcome.id}
              onClick={() => navigate(`/market/${market.id}`)}
              style={{
                background: "linear-gradient(135deg, rgba(167,139,250,0.04) 0%, var(--bg-card) 60%)",
                border: "1px solid rgba(167,139,250,0.12)",
                borderRadius: 14,
                padding: "11px 12px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                cursor: "pointer",
                opacity: eliminated ? 0.5 : 1,
              }}
            >
              {flag
                ? <img src={flag} alt={outcome.label} loading="lazy" decoding="async" style={{ width: 38, height: 38, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                : <span style={{ fontSize: 32, lineHeight: 1, flexShrink: 0 }}>⚽</span>
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-main)", marginBottom: 2 }}>{outcome.label}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>
                  Nu {Number(outcome.totalBetAmount).toLocaleString()} pool
                </div>
              </div>
              <div style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.22)", borderRadius: 9, padding: "5px 9px", textAlign: "center", flexShrink: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: "#A78BFA", lineHeight: 1 }}>{Math.round(prob * 100)}%</div>
                <div style={{ fontSize: 9, color: "rgba(167,139,250,0.6)", fontWeight: 700, textTransform: "uppercase", marginTop: 2 }}>win</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <div style={{ textAlign: "center", minWidth: 52 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#fbbf24", lineHeight: 1 }}>
                    {(odds ?? 1 / Math.max(prob, 0.01)).toFixed(2)}x
                  </div>
                </div>
                {eliminated ? (
                  <div style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 9, padding: "7px 10px", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.04em", flexShrink: 0 }}>
                    Out
                  </div>
                ) : !locked && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onBet(market.id, outcome.id); }}
                    style={{ background: "#A78BFA", color: "#000", border: "none", borderRadius: 9, padding: "7px 12px", fontSize: 12, fontWeight: 900, cursor: "pointer", flexShrink: 0 }}
                  >
                    Predict
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function isWCMarket(m: Market): boolean {
  return (
    !!m.subcategory?.startsWith("wc-") ||
    m.title.toLowerCase().includes("world cup")
  );
}

// ── Probability helpers ───────────────────────────────────────────────────────

export function calcProb(market: Market, outcomeId: string): number {
  const o = market.outcomes?.find((x) => x.id === outcomeId);
  if (!o) return 0;
  const n = market.outcomes.length || 1;
  const prior = 1000;
  const tPool = Number(market.totalPool);
  if ((o.lmsrProbability ?? 0) > 0) return o.lmsrProbability!;
  return (Number(o.totalBetAmount) + prior / n) / (tPool + prior);
}

// Parimutuel payout multiplier — same math as the bet modal's estimated payout
export function calcOdds(market: Market, outcomeId: string): number | null {
  const o = market.outcomes?.find((x) => x.id === outcomeId);
  if (!o) return null;
  const totalPool = Number(market.totalPool) || 0;
  const outcomePool = Number(o.totalBetAmount) || 0;
  const houseEdge = Number(market.houseEdgePct) || 0;
  if (totalPool <= 0 || outcomePool <= 0) return null;
  return (totalPool * (1 - houseEdge / 100)) / outcomePool;
}


function GroupMarketSection({
  market,
  onBet,
}: {
  market: Market;
  onBet: (marketId: string, outcomeId: string) => void;
}) {
  const navigate = useNavigate();
  const closes = useClosesAt(market.bettingClosesAt ?? market.closesAt);
  const resolving = market.status === "resolving";
  const locked = resolving || market.status === "closed";
  const settleEta = useClosesAt(resolving ? market.disputeDeadlineAt : null);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", flex: 1, minWidth: 0, marginRight: 8 }}>
          {market.title}
        </div>
        {locked ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {settleEta && settleEta !== "Closed" && (
              <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>
                <Clock size={10} />
                <span>{settleEta}</span>
              </div>
            )}
            <div style={{ fontSize: 9, fontWeight: 800, color: "#fbbf24", background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 6, padding: "3px 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {resolving ? "Resolving" : "Closed"}
            </div>
          </div>
        ) : closes && (
          <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", flexShrink: 0 }}>
            <Clock size={10} />
            <span>{closes}</span>
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {(market.outcomes ?? []).map((outcome) => {
        const flag = outcome.imageUrl || getWCFlag(outcome.label);
        const prob = calcProb(market, outcome.id);
        const odds = calcOdds(market, outcome.id);
        const eliminated = !!outcome.isEliminated;
        return (
          <div
            key={outcome.id}
            onClick={() => navigate(`/market/${market.id}`)}
            style={{
              background: "linear-gradient(135deg, rgba(167,139,250,0.04) 0%, var(--bg-card) 60%)",
              border: "1px solid rgba(167,139,250,0.12)",
              borderRadius: 14,
              padding: "11px 12px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              opacity: eliminated ? 0.5 : 1,
            }}
          >
            {flag
              ? <img src={flag} alt={outcome.label} loading="lazy" decoding="async" style={{ width: 38, height: 38, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
              : <span style={{ fontSize: 32, lineHeight: 1, flexShrink: 0 }}>⚽</span>
            }
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-main)", marginBottom: 2 }}>{outcome.label}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>
                Nu {Number(outcome.totalBetAmount).toLocaleString()} pool
              </div>
            </div>
            <div style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.22)", borderRadius: 8, padding: "4px 10px", textAlign: "center", flexShrink: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: "#A78BFA", lineHeight: 1 }}>{Math.round(prob * 100)}%</div>
              <div style={{ fontSize: 9, color: "rgba(167,139,250,0.6)", fontWeight: 700, textTransform: "uppercase", marginTop: 1 }}>win</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <div style={{ textAlign: "center", minWidth: 52 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#fbbf24", lineHeight: 1 }}>
                    {(odds ?? 1 / Math.max(prob, 0.01)).toFixed(2)}x
                  </div>
                </div>
                {eliminated ? (
                  <div style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "7px 10px", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.04em", flexShrink: 0 }}>
                    Out
                  </div>
                ) : !locked && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onBet(market.id, outcome.id); }}
                    style={{ background: "#A78BFA", color: "#000", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 900, cursor: "pointer", flexShrink: 0 }}
                  >
                    Predict
                  </button>
                )}
              </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}

// Compact, tappable chip layout for prop markets (e.g. "How many goals will
// Ronaldo score?" → 1 / 2 / 3, or "Which team scores first?" → two teams).
// Each outcome is a single tappable card laid out in a row.
function PropMarketSection({
  market,
  onBet,
}: {
  market: Market;
  onBet: (marketId: string, outcomeId: string) => void;
}) {
  const closes = useClosesAt(market.bettingClosesAt ?? market.closesAt);
  const resolving = market.status === "resolving";
  const locked = resolving || market.status === "closed";
  const settleEta = useClosesAt(resolving ? market.disputeDeadlineAt : null);
  const totalPool =
    Number(market.totalPool ?? 0) ||
    (market.outcomes ?? []).reduce((s, o) => s + Number(o.totalBetAmount ?? 0), 0);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", flex: 1, minWidth: 0, marginRight: 8 }}>
          {market.title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>
            Nu {totalPool.toLocaleString()} pool
          </span>
          {locked ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {settleEta && settleEta !== "Closed" && (
                <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>
                  <Clock size={10} />
                  <span>{settleEta}</span>
                </div>
              )}
              <div style={{ fontSize: 9, fontWeight: 800, color: "#fbbf24", background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 6, padding: "3px 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {resolving ? "Resolving" : "Closed"}
              </div>
            </div>
          ) : closes ? (
            <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>
              <Clock size={10} />
              <span>{closes}</span>
            </div>
          ) : null}
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {(market.outcomes ?? []).map((outcome) => {
          const img = outcome.imageUrl || getWCFlag(outcome.label);
          const prob = calcProb(market, outcome.id);
          const odds = calcOdds(market, outcome.id);
          const eliminated = !!outcome.isEliminated;
          return (
            <button
              key={outcome.id}
              disabled={locked || eliminated}
              onClick={() => { if (!locked && !eliminated) onBet(market.id, outcome.id); }}
              style={{
                flex: "1 1 88px",
                minWidth: 88,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 5,
                background: "linear-gradient(135deg, rgba(167,139,250,0.08) 0%, var(--bg-card) 70%)",
                border: "1px solid rgba(167,139,250,0.2)",
                borderRadius: 12,
                padding: "10px 10px 9px",
                cursor: locked || eliminated ? "default" : "pointer",
                opacity: locked || eliminated ? 0.45 : 1,
              }}
            >
              {img && (
                <img
                  src={img}
                  alt={outcome.label}
                  loading="lazy"
                  decoding="async"
                  style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }}
                />
              )}
              <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-main)", textAlign: "center", lineHeight: 1.15 }}>
                {outcome.label}
              </span>
              <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#A78BFA" }}>{Math.round(prob * 100)}%</span>
                <span style={{ fontSize: 12, fontWeight: 900, color: "#fbbf24" }}>
                  {(odds ?? 1 / Math.max(prob, 0.01)).toFixed(2)}x
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MatchMarketCard({
  market,
  onBet,
}: {
  market: Market;
  onBet: (marketId: string, outcomeId: string) => void;
}) {
  const navigate = useNavigate();
  const closes = useClosesAt(market.bettingClosesAt ?? market.closesAt);
  const resolving = market.status === "resolving";
  const locked = resolving || market.status === "closed";
  const settleEta = useClosesAt(resolving ? market.disputeDeadlineAt : null);
  const totalPool = Number(market.totalPool ?? 0) ||
    (market.outcomes ?? []).reduce((s, o) => s + Number(o.totalBetAmount ?? 0), 0);
  // Prefer the title ("Argentina vs Austria"); if it has no "vs", fall back to
  // the actual outcome labels (ignoring a Draw) so we never show "Team A/Team B".
  const parsed = parseMatchTeams(market.title);
  const namedOutcomes = (market.outcomes ?? []).filter(
    (o) => o.label.trim().toLowerCase() !== "draw",
  );
  const team1 =
    parsed.team1 === "Team A" ? (namedOutcomes[0]?.label ?? "Team A") : parsed.team1;
  const team2 =
    parsed.team2 === "Team B" ? (namedOutcomes[1]?.label ?? "Team B") : parsed.team2;
  const flag1 = getWCFlag(team1);
  const flag2 = getWCFlag(team2);
  return (
    <div onClick={() => navigate(`/market/${market.id}`)} style={{ background: "var(--bg-card)", border: "1px solid var(--glass-border)", borderRadius: 16, overflow: "hidden", cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px 0" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main)", lineHeight: 1.35, flex: 1, minWidth: 0, marginRight: 8 }}>
          {market.title}
        </div>
        {locked ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {settleEta && settleEta !== "Closed" && (
              <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>
                <Clock size={10} />
                <span>{settleEta}</span>
              </div>
            )}
            <div style={{ fontSize: 9, fontWeight: 800, color: "#fbbf24", background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 6, padding: "3px 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {resolving ? "Resolving" : "Closed"}
            </div>
          </div>
        ) : closes && (
          <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", flexShrink: 0 }}>
            <Clock size={10} />
            <span>{closes}</span>
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", padding: "16px 16px 10px", background: "linear-gradient(135deg, rgba(13,31,13,0.5) 0%, rgba(30,44,10,0.5) 100%)" }}>
        <div style={{ textAlign: "center" }}>
          {flag1
            ? <img src={flag1} alt={team1} loading="lazy" decoding="async" style={{ width: 42, height: 42, borderRadius: 6, objectFit: "cover" }} />
            : <div style={{ fontSize: 36 }}>🏳️</div>
          }
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main)", marginTop: 4 }}>{team1}</div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 900, color: "var(--text-muted)", background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: "4px 10px" }}>VS</div>
        <div style={{ textAlign: "center" }}>
          {flag2
            ? <img src={flag2} alt={team2} loading="lazy" decoding="async" style={{ width: 42, height: 42, borderRadius: 6, objectFit: "cover" }} />
            : <div style={{ fontSize: 36 }}>🏳️</div>
          }
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main)", marginTop: 4 }}>{team2}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, padding: "10px 12px 0" }}>
        {market.outcomes?.map((outcome) => {
          const prob = calcProb(market, outcome.id);
          const odds = calcOdds(market, outcome.id);
          const eliminated = !!outcome.isEliminated;
          return (
            <button
              key={outcome.id}
              disabled={locked || eliminated}
              onClick={(e) => { e.stopPropagation(); if (!locked && !eliminated) onBet(market.id, outcome.id); }}
              style={{ flex: 1, padding: "9px 4px", background: "rgba(167,139,250,0.07)", border: "1px solid rgba(167,139,250,0.22)", borderRadius: 10, cursor: locked || eliminated ? "default" : "pointer", opacity: eliminated ? 0.45 : 1, textAlign: "center" }}
            >
              <div style={{ fontSize: 14, fontWeight: 900, color: "#A78BFA" }}>{Math.round(prob * 100)}%</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginTop: 2 }}>{outcome.label}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#fbbf24", marginTop: 2 }}>
                  {(odds ?? 1 / Math.max(prob, 0.01)).toFixed(2)}x
                </div>
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "8px 12px 12px" }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>
          Nu {totalPool.toLocaleString()} pool
        </span>
      </div>
    </div>
  );
}

// ── WorldCupHubPage ───────────────────────────────────────────────────────────

type ActiveBet = { marketId: string; outcomeId: string };
type Tab = "countries" | "groups" | "games" | "knockout";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "countries", label: "Countries", icon: <Trophy size={15} /> },
  { key: "groups", label: "Stats", icon: <BarChart3 size={15} /> },
  // { key: "games", label: "Games", icon: <Swords size={15} /> },
  { key: "knockout", label: "Knockout", icon: <Network size={15} /> },
];

export function WorldCupHubPage() {
  const navigate = useNavigate();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("countries");
  const [activeBet, setActiveBet] = useState<ActiveBet | null>(null);
  const [timeFilter, setTimeFilter] = useState<"all" | "today" | "tomorrow">("all");
  // Outcomes this user has backed this session — shown as "your pick" on the
  // knockout bars. (The bet endpoint returns no position list, so track locally.)
  const [pickedOutcomeIds, setPickedOutcomeIds] = useState<Set<string>>(new Set());

  const loadMarkets = useCallback(() => {
    return getMarkets()
      .then((d) =>
        setMarkets(
          d.filter(
            (m) =>
              m.status === "open" ||
              m.status === "upcoming" ||
              m.status === "closed" ||
              m.status === "resolving" ||
              m.status === "resolved" ||
              m.status === "settled",
          ),
        ),
      )
      .catch(console.error);
  }, []);

  useEffect(() => {
    loadMarkets().finally(() => setLoading(false));
    // Refresh periodically so the knockout poll bars track others' bets while
    // the hub is open. Backend caches markets ~30s, so poll on that beat.
    const id = setInterval(loadMarkets, 30_000);
    return () => clearInterval(id);
  }, [loadMarkets]);

  // Seed picks from the user's real bets so the revealed percentages persist
  // across refreshes (in-session state alone would reset on reload).
  useEffect(() => {
    getMyBets()
      .then((bets) => setPickedOutcomeIds(new Set(bets.map((b) => b.outcomeId))))
      .catch(() => {}); // signed-out / no bets — leave the poll bars hidden
  }, []);

  const wcMarkets = markets.filter(isWCMarket);

  const visibleInHub = (m: Market) =>
    ((m.status === "open" || m.status === "upcoming") && wcCloseMs(m) > Date.now()) ||
    m.status === "closed" ||
    m.status === "resolving";
  const winnerMarkets = wcMarkets.filter((m) => m.subcategory === "wc-winner" && visibleInHub(m));
  const groupMarkets = wcMarkets.filter((m) => m.subcategory === "wc-group" && visibleInHub(m));
  const playerMarkets = wcMarkets.filter((m) => m.subcategory === "wc-player" && visibleInHub(m));
  const matchMarkets = wcMarkets
    .filter(
      (m) =>
        m.subcategory === "wc-match" ||
        (isWCMarket(m) &&
          m.subcategory !== "wc-winner" &&
          m.subcategory !== "wc-group" &&
          m.subcategory !== "wc-player"),
    )
    .sort((a, b) => {
      const ta = a.closesAt ? new Date(a.closesAt).getTime() : a.opensAt ? new Date(a.opensAt).getTime() : Infinity;
      const tb = b.closesAt ? new Date(b.closesAt).getTime() : b.opensAt ? new Date(b.opensAt).getTime() : Infinity;
      return ta - tb;
    });

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);
  const dayAfterTomorrow = new Date(tomorrowStart.getTime() + 86_400_000);

  // Matches assigned to a knockout bracket slot live in the Knockout tab, so
  // exclude them from the Games tab to avoid showing the same fixture twice.
  const gamesMarkets = matchMarkets.filter((m) => !m.metadata?.bracketSlot);

  const filteredMatchMarkets = gamesMarkets.filter((m) => {
    if (timeFilter === "all") return true;
    const ref = m.closesAt
      ? new Date(m.closesAt)
      : m.opensAt
        ? new Date(m.opensAt)
        : null;
    if (!ref) return false;
    if (timeFilter === "today") return ref >= todayStart && ref < tomorrowStart;
    return ref >= tomorrowStart && ref < dayAfterTomorrow;
  });

  // wc-group markets that don't map to a real group letter (e.g. "Which team
  // scores first?", "Highest assist") are props, not standings — route them to
  // the Player Props section instead of a "Specials" bucket under Groups.
  const byGroup: Record<string, Market[]> = {};
  const groupPropMarkets: Market[] = [];
  groupMarkets.forEach((m) => {
    const { group } = parseGroupInfo(m.title);
    if (group === "?") groupPropMarkets.push(m);
    else (byGroup[group] ??= []).push(m);
  });
  // Sort everything in the Stats tab by soonest-closing.
  Object.values(byGroup).forEach((arr) => arr.sort((a, b) => wcCloseMs(a) - wcCloseMs(b)));
  const propMarkets = [...groupPropMarkets, ...playerMarkets].sort(
    (a, b) => wcCloseMs(a) - wcCloseMs(b),
  );

  // ── Pool & volume stats (header) ──────────────────────────────────
  // Aggregate across every WC market regardless of status so the figures
  // reflect total tournament volume, not just what's currently bettable.
  const poolValues = wcMarkets.map((m) => Number(m.totalPool) || 0);
  const biggestPool = poolValues.length ? Math.max(...poolValues) : 0;
  const activeMarkets = wcMarkets.filter(
    (m) => m.status === "open" || m.status === "upcoming",
  ).length;
  const fmtNu = (n: number) =>
    n >= 1_000_000
      ? (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + "M"
      : n >= 10_000
        ? Math.round(n / 1_000) + "K"
        : Math.round(n).toLocaleString();

  // Title favorite = most-backed outcome across the winner market(s).
  const winnerOutcomes = wcMarkets
    .filter((m) => m.subcategory === "wc-winner")
    .flatMap((m) => m.outcomes ?? []);
  let favorite = winnerOutcomes[0] ?? null;
  for (const o of winnerOutcomes) {
    if (Number(o.totalBetAmount || 0) > Number(favorite?.totalBetAmount || 0)) favorite = o;
  }

  const headerStats = [
    { label: "Title favorite", val: favorite?.label ?? "—" },
    { label: "Biggest pool", val: `Nu ${fmtNu(biggestPool)}` },
    { label: "Active markets", val: String(activeMarkets) },
  ];

  const activeMarket = activeBet
    ? markets.find((m) => m.id === activeBet.marketId)
    : null;

  if (loading) return <LoadingScreen message="Loading World Cup…" />;

  const EmptyState = ({ msg }: { msg: string }) => (
    <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>⚽</div>
      <div style={{ fontWeight: 700, fontSize: 15 }}>{msg}</div>
    </div>
  );

  return (
    <Page>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div
        style={{
          backgroundImage: "url('/background.svg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          padding: "16px 16px 18px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Dim overlay */}
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)", pointerEvents: "none" }} />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            position: "relative",
          }}
        >
          <button
            onClick={() => navigate(-1)}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: "50%",
              width: 34,
              height: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#fff",
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            ←
          </button>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: "#ffffffff",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 2,
              }}
            >
              FIFA World Cup 2026
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: "#fff",
                lineHeight: 1.1,
                fontFamily: "var(--font-display, sans-serif)",
              }}
            >
              Prediction Hub
            </div>
          </div>
          <img src="/worldcup.svg" alt="FIFA World Cup 2026" style={{ width: 64, height: 64, objectFit: "contain", flexShrink: 0 }} />
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 16,
            position: "relative",
          }}
        >
          {headerStats.map(({ label, val }) => (
            <div
              key={label}
              style={{
                flex: 1,
                textAlign: "center",
                background: "rgba(255,255,255,0.06)",
                borderRadius: 10,
                padding: "8px 4px",
                border: "1px solid rgba(167,139,250,0.15)",
              }}
            >
              <div
                style={{ fontSize: 18, fontWeight: 900, color: "#ffffffff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
              >
                {val}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.45)",
                  fontWeight: 600,
                }}
              >
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--glass-border)",
          background: "var(--bg-card)",
          flexShrink: 0,
        }}
      >
        {TABS.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              flex: 1,
              padding: "13px 0",
              background: "none",
              border: "none",
              borderBottom:
                tab === key ? "2.5px solid #A78BFA" : "2.5px solid transparent",
              color: tab === key ? "#A78BFA" : "var(--text-muted)",
              fontWeight: tab === key ? 800 : 600,
              fontSize: 13,
              cursor: "pointer",
              transition: "all 0.15s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            {icon}{label}
          </button>
        ))}
      </div>

      {/* ── Tab content ────────────────────────────────────────────── */}
      <div
        style={{
          padding: "16px",
          overflowY: "auto",
          flex: 1,
          paddingBottom: 80,
        }}
      >
        {/* Countries */}
        {tab === "countries" &&
          (winnerMarkets.length === 0 ? (
            <EmptyState msg="No winner markets yet" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {winnerMarkets.map((market) => (
                <WinnerMarketGroup
                  key={market.id}
                  market={market}
                  onBet={(marketId, outcomeId) => setActiveBet({ marketId, outcomeId })}
                />
              ))}
            </div>
          ))}

        {/* Groups */}
        {tab === "groups" &&
          (Object.keys(byGroup).length === 0 && propMarkets.length === 0 ? (
            <EmptyState msg="No stats markets yet" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
              {Object.keys(byGroup).length > 0 && (
              <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 900,
                  color: "var(--text-main, #fff)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 14,
                  paddingBottom: 8,
                  borderBottom: "1px solid rgba(167,139,250,0.18)",
                }}
              >
                Groups
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              {Object.entries(byGroup)
                .sort(([, am], [, bm]) => wcCloseMs(am[0]) - wcCloseMs(bm[0]))
                .map(([group, gMarkets]) => (
                  <div key={group}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 10,
                      }}
                    >
                      <span
                        style={{
                          background: "#A78BFA",
                          color: "#000",
                          borderRadius: 6,
                          padding: "2px 8px",
                          fontSize: 12,
                          fontWeight: 900,
                        }}
                      >
                        {group}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: "#A78BFA",
                          textTransform: "uppercase",
                          letterSpacing: "0.07em",
                        }}
                      >
                        Group {group}
                      </span>
                    </div>

                    {gMarkets.map((market) => (
                      <GroupMarketSection
                        key={market.id}
                        market={market}
                        onBet={(marketId, outcomeId) => setActiveBet({ marketId, outcomeId })}
                      />
                    ))}
                  </div>
                ))}
              </div>
              </div>
              )}

              {/* Player props sub-section */}
              {propMarkets.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 900,
                    color: "var(--text-main, #fff)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 14,
                    paddingBottom: 8,
                    borderBottom: "1px solid rgba(167,139,250,0.18)",
                  }}
                >
                  Player &amp; Team Props
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  {propMarkets.map((market) => (
                    <PropMarketSection
                      key={market.id}
                      market={market}
                      onBet={(marketId, outcomeId) => setActiveBet({ marketId, outcomeId })}
                    />
                  ))}
                </div>
              </div>
              )}
            </div>
          ))}

        {/* Games */}
        {tab === "games" &&
          (gamesMarkets.length === 0 ? (
            <EmptyState msg="No match markets yet" />
          ) : (
            <>
              {/* Time filter chips */}
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                {(["all", "today", "tomorrow"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setTimeFilter(f)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "6px 14px",
                      borderRadius: 20,
                      border: "none",
                      background: timeFilter === f ? "#A78BFA" : "rgba(167,139,250,0.12)",
                      color: timeFilter === f ? "#000" : "rgba(255,255,255,0.7)",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <CalendarDays size={12} />
                    {f === "all" ? "All" : f === "today" ? "Today" : "Tomorrow"}
                  </button>
                ))}
              </div>

              {filteredMatchMarkets.length === 0 ? (
                <EmptyState msg="No matches scheduled for this day" />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {filteredMatchMarkets.map((market) => (
                    <MatchMarketCard
                      key={market.id}
                      market={market}
                      onBet={(marketId, outcomeId) => setActiveBet({ marketId, outcomeId })}
                    />
                  ))}
                </div>
              )}
            </>
          ))}

        {/* Knockout */}
        {tab === "knockout" && (
          <>
            <div style={{ fontSize: 11, color: "var(--text-muted, #888)", marginBottom: 14, lineHeight: 1.5 }}>
              Tap a team to back it — slots without an open market are display-only.
            </div>
            <WorldCupBracket
              markets={matchMarkets}
              getFlag={getWCFlag}
              onBet={(marketId, outcomeId) => setActiveBet({ marketId, outcomeId })}
              pickedOutcomeIds={pickedOutcomeIds}
            />
          </>
        )}
      </div>

      {/* ── Bet modal ────────────────────────────────────────────────── */}
      {activeMarket && activeBet && (
        <TmaBetModal
          isOpen={true}
          onClose={() => setActiveBet(null)}
          market={activeMarket}
          outcomeId={activeBet.outcomeId}
          onSuccess={() => {
            setPickedOutcomeIds((prev) => new Set(prev).add(activeBet.outcomeId));
            setActiveBet(null);
            loadMarkets(); // pull fresh pools so the bars reflect the new bet
          }}
          onFailure={(e: string) => console.error(e)}
          onGoToWallet={() => navigate("/wallet")}
        />
      )}
    </Page>
  );
}
