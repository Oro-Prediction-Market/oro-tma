import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getMarkets,
  getEplStandings,
  getEplStats,
  getEplSeason,
  type Market,
  type Outcome,
  type EplStandings,
  type EplStats,
  type EplSeason,
} from "@shared/api/client";
import { Clock, Trophy, CalendarDays, ListOrdered, BarChart3, Goal, Handshake, RectangleVertical } from "lucide-react";
import { TmaBetModal } from "@/components/TmaBetModal";
import { Page } from "@/components/Page";
import { LoadingScreen } from "@shared/components/LoadingScreen";
import { isWCMarket, calcProb, calcOdds } from "./WorldCupHubPage";
import { isBplMarket, isDrawOutcome } from "./BplHubPage";

// ── Helpers (mirrored from PWA — keep in sync) ────────────────────────────────

const ACCENT = "#00ff85"; // Premier League green
const PURPLE = "#38003c"; // Premier League purple
const PINK = "#e90052"; // Premier League pink

// 2026-27 season clubs — update after each season's promotions/relegations.
// `name` matches football-data.org naming; `keys` are lowercase title-match tokens;
// `crest` is football-data.org's public crest CDN (no auth needed to load the image).
export const EPL_CLUBS = [
  { name: "AFC Bournemouth", short: "Bournemouth", crest: "https://crests.football-data.org/1044.png", keys: ["bournemouth"] },
  { name: "Arsenal FC", short: "Arsenal", crest: "https://crests.football-data.org/57.png", keys: ["arsenal"] },
  { name: "Aston Villa FC", short: "Aston Villa", crest: "https://crests.football-data.org/58.png", keys: ["aston villa"] },
  { name: "Brentford FC", short: "Brentford", crest: "https://crests.football-data.org/402.png", keys: ["brentford"] },
  { name: "Brighton & Hove Albion FC", short: "Brighton", crest: "https://crests.football-data.org/397.png", keys: ["brighton"] },
  { name: "Chelsea FC", short: "Chelsea", crest: "https://crests.football-data.org/61.png", keys: ["chelsea"] },
  { name: "Coventry City FC", short: "Coventry", crest: "https://crests.football-data.org/1076.png", keys: ["coventry"] },
  { name: "Crystal Palace FC", short: "Palace", crest: "https://crests.football-data.org/354.png", keys: ["crystal palace"] },
  { name: "Everton FC", short: "Everton", crest: "https://crests.football-data.org/62.png", keys: ["everton"] },
  { name: "Fulham FC", short: "Fulham", crest: "https://crests.football-data.org/63.png", keys: ["fulham"] },
  { name: "Hull City AFC", short: "Hull", crest: "https://crests.football-data.org/322.png", keys: ["hull city", "hull"] },
  { name: "Ipswich Town FC", short: "Ipswich Town", crest: "https://crests.football-data.org/349.png", keys: ["ipswich"] },
  { name: "Leeds United FC", short: "Leeds", crest: "https://crests.football-data.org/341.png", keys: ["leeds"] },
  { name: "Liverpool FC", short: "Liverpool", crest: "https://crests.football-data.org/64.png", keys: ["liverpool"] },
  { name: "Manchester City FC", short: "Man City", crest: "https://crests.football-data.org/65.png", keys: ["manchester city", "man city"] },
  { name: "Manchester United FC", short: "Man United", crest: "https://crests.football-data.org/66.png", keys: ["manchester united", "man united", "man utd"] },
  { name: "Newcastle United FC", short: "Newcastle", crest: "https://crests.football-data.org/67.png", keys: ["newcastle"] },
  { name: "Nottingham Forest FC", short: "Nottm Forest", crest: "https://crests.football-data.org/351.png", keys: ["nottingham forest"] },
  { name: "Sunderland AFC", short: "Sunderland", crest: "https://crests.football-data.org/71.png", keys: ["sunderland"] },
  { name: "Tottenham Hotspur FC", short: "Spurs", crest: "https://crests.football-data.org/73.png", keys: ["tottenham"] },
];

// Competitions that share clubs with the EPL — never claim a market tagged to
// one of these, even if an EPL club is named (e.g. a Champions League tie).
const OTHER_COMPETITIONS = [
  "champions league", "europa", "fa cup", "efl", "carabao",
  "bundesliga", "serie a", "la liga", "ligue 1", "world cup",
];

export function isEplMarket(m: Market): boolean {
  if (m.category === "political") return false;
  if (isWCMarket(m)) return false;
  // BPL owns "Bhutan Premier League" titles, bpl-* subcategories and local clubs
  if (isBplMarket(m)) return false;
  const sub = (m.subcategory ?? "").toLowerCase();
  const cat = (m.category ?? "").toLowerCase();
  const title = m.title.toLowerCase();
  // Reject anything belonging to another competition (checked in title OR category)
  if (OTHER_COMPETITIONS.some((c) => cat.includes(c) || title.includes(c)))
    return false;
  // Only recognise markets EXPLICITLY tagged EPL: an epl-* subcategory from the
  // admin form, or the "Premier League" category set by the fixtures import.
  // Loose club-name title matching was removed — it swept in old/settled markets
  // like "Who Will Lift Premier League Trophy" and Champions League ties.
  if (sub.includes("epl")) return true;
  if (cat.includes("premier league")) return true;
  return false;
}

// Crest priority: per-outcome imageUrl (set in the admin form), then the
// market-level images (imageUrl = first outcome, imageUrlAlt = second).
// Skips Draw outcomes so index 0/1 always refer to the two playing teams.
export function getEplCrest(market: Market, teamIdx: number): string | null {
  const teamOutcomes = (market.outcomes ?? []).filter(
    (o) => !isDrawOutcome(o.label ?? ""),
  );
  const outcome = teamOutcomes[teamIdx];
  if (outcome?.imageUrl) return outcome.imageUrl;
  if (teamIdx === 0) return market.imageUrl;
  if (teamIdx === 1) return market.imageUrlAlt;
  return null;
}

export function shortEplName(label: string): string {
  const t = label.toLowerCase().trim();
  const known = EPL_CLUBS.find(
    (c) => c.name.toLowerCase() === t || c.keys.some((k) => t.includes(k)),
  );
  if (known) return known.short;
  return label
    .replace(/\b(fc|afc)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMatchTeams(title: string): { team1: string; team2: string } {
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
      const mn = Math.floor((ms % 3_600_000) / 60_000);
      if (d > 0) setLabel(`${d}d ${h}h`);
      else if (h > 0) setLabel(`${h}h ${mn}m`);
      else setLabel(`${mn}m`);
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [closesAt]);
  return label;
}

const kickoffOf = (m: Market) => {
  const t = m.bettingClosesAt ?? m.closesAt;
  return t ? new Date(t).getTime() : Infinity;
};

export function EplCrest({
  src,
  label,
  size,
}: {
  src: string | null;
  label: string;
  size: number;
}) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <img
        src={src}
        alt={label}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, background: "rgba(255,255,255,0.06)" }}
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
        background: "linear-gradient(135deg, #963cff 0%, #38003c 100%)",
        border: "1.5px solid rgba(255,255,255,0.15)",
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

// Player head-shot with a photo-first fallback chain: primary photo (FPL) →
// secondary photo (TheSportsDB) → club crest (EplCrest, which itself falls back
// to initials). FPL portraits are top-weighted, so crop to the top.
export function PlayerFace({
  face,
  faceBackup,
  badge,
  label,
  size,
}: {
  face: string | null;
  faceBackup: string | null;
  badge: string | null;
  label: string;
  size: number;
}) {
  const [failedFace, setFailedFace] = useState(false);
  const [failedBackup, setFailedBackup] = useState(false);
  const showFace = !!face && !failedFace;
  const showBackup = !showFace && !!faceBackup && !failedBackup;
  if (showFace || showBackup) {
    return (
      <img
        src={showFace ? (face as string) : (faceBackup as string)}
        alt={label}
        loading="lazy"
        decoding="async"
        onError={() => (showFace ? setFailedFace(true) : setFailedBackup(true))}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", objectPosition: "center top", flexShrink: 0, background: "rgba(255,255,255,0.08)" }}
      />
    );
  }
  return <EplCrest src={badge} label={label} size={size} />;
}

// ── Stats & standings data ────────────────────────────────────────────────────

type StatCategory = "goals" | "assists" | "yellow" | "red";

// hex → rgba string so one accent hex drives all its tinted backgrounds/borders
function hexA(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// Normalises player names so a live API name ("E. Haaland") can match a mock
// betting-market outcome ("Erling Haaland") — by full name or last name.
// NFD + the [^a-z ] strip removes accents, so no separate diacritics pass needed.
const normName = (s: string) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const lastToken = (s: string) => {
  const p = normName(s).split(" ");
  return p[p.length - 1] ?? "";
};
function findStatOutcome(market: Market, player: string): Outcome | undefined {
  const full = normName(player);
  const ln = lastToken(player);
  return (market.outcomes ?? []).find((o) => {
    const on = normName(o.label);
    return on === full || (ln.length > 2 && lastToken(o.label) === ln);
  });
}

const STAT_TABS: {
  id: StatCategory;
  label: string; // full heading, e.g. "Top Scorers"
  short: string; // tile label
  unit: string;
  color: string;
  renderIcon: (size: number) => React.ReactNode;
}[] = [
  { id: "goals", label: "Top Scorers", short: "Goals", unit: "Goals", color: "#00ff85", renderIcon: (n) => <Goal size={n} /> },
  { id: "assists", label: "Top Assists", short: "Assists", unit: "Assists", color: "#38bdf8", renderIcon: (n) => <Handshake size={n} /> },
  { id: "yellow", label: "Yellow Cards", short: "Yellow", unit: "Cards", color: "#facc15", renderIcon: (n) => <RectangleVertical size={n} fill="currentColor" strokeWidth={1.5} /> },
  { id: "red", label: "Red Cards", short: "Red", unit: "Cards", color: "#ef4444", renderIcon: (n) => <RectangleVertical size={n} fill="currentColor" strokeWidth={1.5} /> },
];

const STAT_META: Record<StatCategory, { subcategory: string; title: string }> = {
  goals: { subcategory: "epl-topscorer", title: "Premier League — Top Scorer 2026/27" },
  assists: { subcategory: "epl-assists", title: "Premier League — Most Assists 2026/27" },
  yellow: { subcategory: "epl-yellowcards", title: "Premier League — Most Yellow Cards 2026/27" },
  red: { subcategory: "epl-redcards", title: "Premier League — Most Red Cards 2026/27" },
};

const STAT_SUBCATS = Object.values(STAT_META).map((m) => m.subcategory);
const isEplStatMarket = (m: Market) =>
  STAT_SUBCATS.includes((m.subcategory ?? "").toLowerCase());


// ── Cards ─────────────────────────────────────────────────────────────────────

function FeaturedMatchCard({
  market,
  onBet,
}: {
  market: Market;
  onBet: (marketId: string, outcomeId: string) => void;
}) {
  const navigate = useNavigate();
  const closes = useClosesAt(market.bettingClosesAt ?? market.closesAt);
  const locked = market.status === "closed" || market.status === "resolving";
  const { team1, team2 } = parseMatchTeams(market.title);
  const kickoff = market.bettingClosesAt ?? market.closesAt;
  const kickoffLabel = kickoff
    ? new Date(kickoff).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";
  const totalPool = Number(market.totalPool ?? 0) ||
    (market.outcomes ?? []).reduce((s, o) => s + Number(o.totalBetAmount ?? 0), 0);
  return (
    <div
      onClick={() => navigate(`/market/${market.id}`)}
      style={{
        position: "relative",
        borderRadius: 16,
        overflow: "hidden",
        cursor: "pointer",
        marginBottom: 20,
        border: "1px solid rgba(0,255,133,0.3)",
        background:
          "radial-gradient(ellipse at 80% 0%, rgba(247,37,133,0.38) 0%, transparent 50%), radial-gradient(ellipse at 8% 100%, rgba(0,255,133,0.18) 0%, transparent 55%), linear-gradient(125deg, #16082e 0%, #3d1080 42%, #7b1fd4 100%)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px 0" }}>
        <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.14em", color: PURPLE, background: ACCENT, borderRadius: 6, padding: "3px 8px" }}>
          ★ FEATURED MATCH
        </span>
        {closes && (
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 800, color: ACCENT }}>
            <Clock size={11} />
            {closes}
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", padding: "18px 16px 8px" }}>
        <div style={{ textAlign: "center", flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <EplCrest src={getEplCrest(market, 0)} label={team1} size={56} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {shortEplName(team1)}
          </div>
        </div>
        <div style={{ textAlign: "center", flexShrink: 0, padding: "0 8px" }}>
          <div style={{ fontSize: 22, fontWeight: 900, fontStyle: "italic", color: "rgba(255,255,255,0.9)" }}>VS</div>
          {kickoffLabel && (
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{kickoffLabel}</div>
          )}
        </div>
        <div style={{ textAlign: "center", flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <EplCrest src={getEplCrest(market, 1)} label={team2} size={56} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {shortEplName(team2)}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, padding: "8px 12px 0" }}>
        {market.outcomes?.map((outcome) => {
          const prob = calcProb(market, outcome.id);
          const odds = calcOdds(market, outcome.id);
          return (
            <button
              key={outcome.id}
              disabled={locked}
              onClick={(e) => { e.stopPropagation(); onBet(market.id, outcome.id); }}
              style={{ flex: 1, padding: "10px 4px", background: "rgba(0,0,0,0.35)", border: "1px solid rgba(0,255,133,0.3)", borderRadius: 10, cursor: locked ? "default" : "pointer", textAlign: "center" }}
            >
              <div style={{ fontSize: 15, fontWeight: 900, color: ACCENT }}>{Math.round(prob * 100)}%</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 600, marginTop: 2 }}>{shortEplName(outcome.label)}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#fbbf24", marginTop: 2 }}>
                {odds ? `${odds.toFixed(2)}x` : "—"}
              </div>
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "10px 12px 12px" }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>
          Nu {totalPool.toLocaleString()} pool
        </span>
      </div>
    </div>
  );
}

function EplMatchCard({
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
  const { team1, team2 } = parseMatchTeams(market.title);
  return (
    <div onClick={() => navigate(`/market/${market.id}`)} style={{ background: "var(--bg-card, #1a1a1a)", border: "1px solid var(--glass-border, rgba(255,255,255,0.08))", borderRadius: 16, overflow: "hidden", cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px 0" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main, #fff)", lineHeight: 1.35, flex: 1, minWidth: 0, marginRight: 8 }}>
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", padding: "18px 16px 12px", background: "linear-gradient(135deg, rgba(56,0,60,0.65) 0%, rgba(0,255,133,0.12) 100%)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <EplCrest src={getEplCrest(market, 0)} label={team1} size={44} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main, #fff)", marginTop: 4 }}>{shortEplName(team1)}</div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 900, color: "var(--text-muted, #888)", background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: "4px 10px" }}>VS</div>
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <EplCrest src={getEplCrest(market, 1)} label={team2} size={44} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main, #fff)", marginTop: 4 }}>{shortEplName(team2)}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, padding: "10px 12px 0" }}>
        {market.outcomes?.map((outcome) => {
          const prob = calcProb(market, outcome.id);
          const odds = calcOdds(market, outcome.id);
          return (
            <button
              key={outcome.id}
              disabled={locked}
              onClick={(e) => { e.stopPropagation(); onBet(market.id, outcome.id); }}
              style={{ flex: 1, padding: "9px 4px", background: "rgba(0,255,133,0.06)", border: "1px solid rgba(0,255,133,0.22)", borderRadius: 10, cursor: locked ? "default" : "pointer", textAlign: "center" }}
            >
              <div style={{ fontSize: 14, fontWeight: 900, color: ACCENT }}>{Math.round(prob * 100)}%</div>
              <div style={{ fontSize: 11, color: "var(--text-muted, #888)", fontWeight: 600, marginTop: 2 }}>{shortEplName(outcome.label)}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#fbbf24", marginTop: 2 }}>
                  {odds ? `${odds.toFixed(2)}x` : "—"}
                </div>
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "8px 12px 12px" }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>
          Nu {totalPool.toLocaleString()} pool
        </span>
      </div>
    </div>
  );
}

// Compact row for finished matches — shows the settled winner (or Draw)
function EplResultCard({ market }: { market: Market }) {
  const navigate = useNavigate();
  const { team1, team2 } = parseMatchTeams(market.title);
  const done = market.status === "resolved" || market.status === "settled";
  const winner = (market.outcomes ?? []).find(
    (o) => o.isWinner || (market.resolvedOutcomeId !== null && o.id === market.resolvedOutcomeId),
  );
  const resultLabel = winner
    ? isDrawOutcome(winner.label ?? "")
      ? "Draw"
      : `${shortEplName(winner.label)} won`
    : market.status === "resolving"
      ? "Resolving…"
      : "Awaiting result";
  const when = market.resolvedAt ?? market.bettingClosesAt ?? market.closesAt;
  const whenLabel = when
    ? new Date(when).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "";
  return (
    <div
      onClick={() => navigate(`/market/${market.id}`)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "var(--bg-card, #1a1a1a)",
        border: "1px solid var(--glass-border, rgba(255,255,255,0.08))",
        borderRadius: 14,
        padding: "10px 12px",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
        <EplCrest src={getEplCrest(market, 0)} label={team1} size={30} />
        <div style={{ marginLeft: -8 }}>
          <EplCrest src={getEplCrest(market, 1)} label={team2} size={30} />
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main, #fff)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {shortEplName(team1)} vs {shortEplName(team2)}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
          {whenLabel}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div
          style={{
            display: "inline-block",
            fontSize: 9,
            fontWeight: 800,
            color: done ? PURPLE : "#fbbf24",
            background: done ? ACCENT : "rgba(251,191,36,0.12)",
            border: done ? "none" : "1px solid rgba(251,191,36,0.3)",
            borderRadius: 6,
            padding: "3px 8px",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {done ? "FT" : "Pending"}
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, color: done ? ACCENT : "rgba(255,255,255,0.5)", marginTop: 3 }}>
          {resultLabel}
        </div>
      </div>
    </div>
  );
}

function EplSeasonMarket({
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
  const [expanded, setExpanded] = useState(false);
  const VISIBLE = 5;
  const outcomes = market.outcomes ?? [];
  const shown = expanded ? outcomes : outcomes.slice(0, VISIBLE);
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
        {shown.map((outcome, idx) => {
          const prob = calcProb(market, outcome.id);
          const odds = calcOdds(market, outcome.id);
          return (
            <div
              key={outcome.id}
              onClick={() => navigate(`/market/${market.id}`)}
              style={{
                background: "linear-gradient(135deg, rgba(0,255,133,0.04) 0%, var(--bg-card, #1a1a1a) 60%)",
                border: "1px solid rgba(0,255,133,0.14)",
                borderRadius: 14,
                padding: "11px 12px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                cursor: "pointer",
              }}
            >
              <EplCrest src={getEplCrest(market, idx)} label={outcome.label} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-main, #fff)", marginBottom: 2 }}>{outcome.label}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>
                  Nu {Number(outcome.totalBetAmount).toLocaleString()} pool
                </div>
              </div>
              <div style={{ background: "rgba(0,255,133,0.08)", border: "1px solid rgba(0,255,133,0.22)", borderRadius: 9, padding: "5px 9px", textAlign: "center", flexShrink: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: ACCENT, lineHeight: 1 }}>{Math.round(prob * 100)}%</div>
                <div style={{ fontSize: 9, color: "rgba(0,255,133,0.6)", fontWeight: 700, textTransform: "uppercase", marginTop: 2 }}>win</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <div style={{ textAlign: "center", minWidth: 52 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#fbbf24", lineHeight: 1 }}>
                    {odds ? `${odds.toFixed(2)}x` : "—"}
                  </div>
                </div>
                {!locked && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onBet(market.id, outcome.id); }}
                    style={{ background: ACCENT, color: "#000", border: "none", borderRadius: 9, padding: "7px 12px", fontSize: 12, fontWeight: 900, cursor: "pointer", flexShrink: 0 }}
                  >
                    Predict
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {outcomes.length > VISIBLE && (
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              marginTop: 2,
              padding: "9px 0",
              background: "rgba(0,255,133,0.08)",
              border: "1px solid rgba(0,255,133,0.2)",
              borderRadius: 12,
              color: ACCENT,
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {expanded ? "Show less" : `Show all ${outcomes.length} teams`}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

type ActiveBet = { marketId: string; outcomeId: string };
type HubTab = "season" | "matches" | "standings" | "stats";

const HUB_TABS: { id: HubTab; label: string; icon: React.ReactNode }[] = [
  { id: "season", label: "Season", icon: <Trophy size={15} /> },
  { id: "matches", label: "Matches", icon: <CalendarDays size={15} /> },
  { id: "standings", label: "Standings", icon: <ListOrdered size={15} /> },
  { id: "stats", label: "Stats", icon: <BarChart3 size={15} /> },
];

export function EplHubPage() {
  const navigate = useNavigate();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBet, setActiveBet] = useState<ActiveBet | null>(null);
  const [tab, setTab] = useState<HubTab>("season");
  const [matchView, setMatchView] = useState<"upcoming" | "previous">("upcoming");
  const [statCat, setStatCat] = useState<StatCategory>("goals");
  const [liveStandings, setLiveStandings] = useState<EplStandings | null>(null);
  const [liveStats, setLiveStats] = useState<EplStats | null>(null);
  const [liveSeason, setLiveSeason] = useState<EplSeason | null>(null);

  useEffect(() => {
    getMarkets()
      .then((d) => setMarkets(d.filter((m) => m.status !== "cancelled")))
      .catch(console.error)
      .finally(() => setLoading(false));
    // Live league data — falls back to the static/mock arrays if the API is down
    getEplStandings().then(setLiveStandings).catch(() => {});
    getEplStats().then(setLiveStats).catch(() => {});
    getEplSeason().then(setLiveSeason).catch(() => {});
  }, []);

  const eplMarkets = markets.filter(isEplMarket);
  const matchMarkets = eplMarkets
    .filter((m) => /\bvs\b/i.test(m.title))
    .sort((a, b) => kickoffOf(a) - kickoffOf(b));
  const seasonMarkets = eplMarkets.filter(
    (m) => !/\bvs\b/i.test(m.title) && !isEplStatMarket(m),
  );

  const upcomingMatches = matchMarkets.filter(
    (m) => m.status === "open" || m.status === "upcoming",
  );
  const previousMatches = matchMarkets
    .filter((m) => ["closed", "resolving", "resolved", "settled"].includes(m.status))
    .sort((a, b) => kickoffOf(b) - kickoffOf(a));

  // Featured matches are admin-pinned only — there is NO automatic fallback.
  // Zero, one, or many matches can be featured; if an admin has pinned none,
  // the featured section is simply empty. Shown in kickoff order.
  const featuredMatches = upcomingMatches
    .filter((m) => m.isFeatured)
    .sort((a, b) => kickoffOf(a) - kickoffOf(b));
  const featuredIds = new Set(featuredMatches.map((m) => m.id));
  const upcomingRest = upcomingMatches.filter((m) => !featuredIds.has(m.id));

  const activeMarket = activeBet ? markets.find((m) => m.id === activeBet.marketId) : null;
  const openBet = (marketId: string, outcomeId: string) =>
    setActiveBet({ marketId, outcomeId });

  // Live table if the API returned one, otherwise the static pre-season table
  const standingsRows =
    liveStandings && liveStandings.table.length
      ? liveStandings.table.map((r) => ({
          pos: r.position,
          club: r.teamName,
          crest: r.teamBadge,
          mp: r.played,
          w: r.won,
          d: r.draw,
          l: r.lost,
          gf: r.gf,
          ga: r.ga,
          gd: r.gd,
          pts: r.points,
        }))
      : [];

  // Header "league pulse" — always-populated live facts (replaces the
  // betting-count tiles that read 0/0/Nu 0 before there's any activity).
  const lastName = (n: string) => {
    const p = (n ?? "").trim().split(" ");
    return p[p.length - 1] || n;
  };
  const leaderRow = standingsRows[0];
  const topScorer = liveStats?.goals?.[0];
  const daysToKickoff = liveSeason?.seasonStart
    ? Math.max(0, Math.ceil((new Date(liveSeason.seasonStart).getTime() - Date.now()) / 86_400_000))
    : null;
  const pulseTiles: { val: string; label: string }[] = [
    { val: leaderRow ? shortEplName(leaderRow.club) : "—", label: "League leader" },
    {
      val: topScorer ? lastName(topScorer.player) : "—",
      label: topScorer ? `${topScorer.value} goals` : "Top scorer",
    },
    liveSeason?.started
      ? { val: `GW ${liveSeason.maxPlayed}`, label: "Gameweek" }
      : { val: daysToKickoff != null ? `${daysToKickoff}d` : "—", label: "to kickoff" },
  ];

  if (loading) return <LoadingScreen message="Loading Premier League…" />;

  const emptyState = (icon: string, title: string, sub: string) => (
    <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
      <div style={{ fontSize: 12, marginTop: 4, color: "rgba(255,255,255,0.35)" }}>{sub}</div>
    </div>
  );

  return (
    <Page>
      <div style={{ minHeight: "100vh", background: "var(--bg-main, #0f0f0f)" }}>
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div
          style={{
            background:
              "radial-gradient(ellipse at 85% 8%, rgba(247,37,133,0.4) 0%, transparent 46%), radial-gradient(ellipse at 8% 96%, rgba(0,255,133,0.2) 0%, transparent 50%), radial-gradient(ellipse at 55% 125%, rgba(123,31,212,0.5) 0%, transparent 60%), linear-gradient(125deg, #16082e 0%, #3d1080 38%, #7b1fd4 72%, #b81f95 100%)",
            padding: "20px 24px 22px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative", maxWidth: 860, margin: "0 auto", textShadow: "0 2px 10px rgba(0,0,0,0.7)" }}>
            <button
              onClick={() => navigate(-1)}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "none",
                borderRadius: "50%",
                width: 36,
                height: 36,
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
              <img
                src="/premier-league-logo.svg"
                alt="Premier League"
                style={{ height: 36, display: "block", marginBottom: 6, filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.6))" }}
              />
              <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", lineHeight: 1.1, fontFamily: "var(--font-display, sans-serif)" }}>
                Prediction Hub
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, position: "relative", maxWidth: 860, margin: "18px auto 0" }}>
            {pulseTiles.map(({ label, val }) => (
              <div
                key={label}
                style={{
                  flex: 1,
                  textAlign: "center",
                  background: "rgba(20,0,24,0.72)",
                  borderRadius: 10,
                  padding: "8px 4px",
                  border: "1px solid rgba(0,255,133,0.35)",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.35)",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{val}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Section tabs (WC-hub style: full-width, underlined) ─────── */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--glass-border, rgba(255,255,255,0.08))",
            background: "var(--bg-card, #1a1a1a)",
          }}
        >
          {HUB_TABS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                flex: 1,
                padding: "13px 0",
                background: "none",
                border: "none",
                borderBottom:
                  tab === id ? `2.5px solid ${ACCENT}` : "2.5px solid transparent",
                color: tab === id ? ACCENT : "var(--text-muted, #888)",
                fontWeight: tab === id ? 800 : 600,
                fontSize: 13,
                cursor: "pointer",
                transition: "all 0.15s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* ── Content ────────────────────────────────────────────────── */}
        <div style={{ padding: "16px 16px 100px", maxWidth: 860, margin: "0 auto" }}>

          {/* ── Matches ── */}
          {tab === "matches" && (
            <>
              {featuredMatches.map((m) => (
                <FeaturedMatchCard key={m.id} market={m} onBet={openBet} />
              ))}

              {/* Upcoming / Previous toggle */}
              <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                {(
                  [
                    ["upcoming", `Upcoming (${upcomingMatches.length})`],
                    ["previous", `Previous (${previousMatches.length})`],
                  ] as ["upcoming" | "previous", string][]
                ).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setMatchView(id)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 20,
                      border: `1px solid ${matchView === id ? "rgba(0,255,133,0.5)" : "rgba(255,255,255,0.12)"}`,
                      background: matchView === id ? "rgba(0,255,133,0.12)" : "transparent",
                      color: matchView === id ? ACCENT : "rgba(255,255,255,0.6)",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {matchView === "upcoming" ? (
                upcomingMatches.length === 0 ? (
                  emptyState("⚽", "No upcoming fixtures yet", "Check back when the 2026/27 fixtures are announced")
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14, marginTop: 12 }}>
                    {upcomingRest.map((market) => (
                      <EplMatchCard key={market.id} market={market} onBet={openBet} />
                    ))}
                  </div>
                )
              ) : previousMatches.length === 0 ? (
                emptyState("🏁", "No finished matches yet", "Results will show here after the first matchday")
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                  {previousMatches.map((market) => (
                    <EplResultCard key={market.id} market={market} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Stats ── */}
          {tab === "stats" &&
            (() => {
              const cat = STAT_TABS.find((s) => s.id === statCat)!;
              // A real outright market for this category enables betting (none yet → display only)
              const market = markets.find(
                (m) => isEplMarket(m) && (m.subcategory ?? "").toLowerCase() === STAT_META[statCat].subcategory,
              );
              const live = liveStats?.[statCat];
              const rows = live && live.length
                ? live.map((e) => ({ player: e.player, club: e.club, badge: e.clubBadge, face: e.face, faceBackup: e.faceBackup, value: e.value }))
                : [];
              return (
                <>
                  {/* Category selector — four icon tiles */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 16 }}>
                    {STAT_TABS.map((s) => {
                      const active = statCat === s.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => setStatCat(s.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            padding: "8px 6px",
                            borderRadius: 10,
                            border: `1px solid ${active ? s.color : "rgba(255,255,255,0.08)"}`,
                            background: active ? hexA(s.color, 0.14) : "var(--bg-card, #1a1a1a)",
                            boxShadow: active ? `0 3px 12px ${hexA(s.color, 0.2)}` : "none",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            minWidth: 0,
                          }}
                        >
                          <span style={{ display: "flex", alignItems: "center", color: s.color, flexShrink: 0 }}>
                            {s.renderIcon(15)}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 800, color: active ? "#fff" : "rgba(255,255,255,0.6)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {s.short}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Market heading */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ display: "flex", color: cat.color }}>{cat.renderIcon(17)}</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{cat.label}</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>
                      {market ? `Nu ${Number(market.totalPool).toLocaleString()} pool` : "Live · this season"}
                    </span>
                  </div>

                  {/* Live player leaderboard — betting shown where a real market exists */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {rows.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "40px 0" }}>
                        <div style={{ width: 56, height: 56, borderRadius: 16, margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center", background: hexA(cat.color, 0.12), color: cat.color }}>
                          {cat.renderIcon(26)}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>
                          {statCat === "yellow" || statCat === "red" ? `${cat.label} coming soon` : `No ${cat.label.toLowerCase()} yet`}
                        </div>
                        <div style={{ fontSize: 12, marginTop: 4, color: "rgba(255,255,255,0.35)" }}>
                          {statCat === "yellow" || statCat === "red" ? "Disciplinary stats will be added soon" : "Live stats appear once the season is underway"}
                        </div>
                      </div>
                    ) : (
                      rows.map((row, i) => {
                      const outcome = market ? findStatOutcome(market, row.player) : undefined;
                      const prob = outcome ? calcProb(market!, outcome.id) : null;
                      const odds = outcome ? calcOdds(market!, outcome.id) : null;
                      return (
                        <div
                          key={`${row.player}-${i}`}
                          onClick={outcome ? () => openBet(market!.id, outcome.id) : undefined}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 12px",
                            borderRadius: 14,
                            cursor: outcome ? "pointer" : "default",
                            border: `1px solid ${hexA(cat.color, 0.16)}`,
                            background: `linear-gradient(135deg, ${hexA(cat.color, 0.05)} 0%, var(--bg-card, #1a1a1a) 60%)`,
                          }}
                        >
                          <span
                            style={{
                              width: 24,
                              height: 24,
                              flexShrink: 0,
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 12,
                              fontWeight: 900,
                              background: i < 3 ? hexA(cat.color, 0.16) : "rgba(255,255,255,0.05)",
                              color: i < 3 ? cat.color : "rgba(255,255,255,0.4)",
                            }}
                          >
                            {i + 1}
                          </span>
                          <PlayerFace face={row.face} faceBackup={row.faceBackup} badge={row.badge} label={row.player} size={34} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-main, #fff)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {row.player}
                            </div>
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{shortEplName(row.club)}</div>
                          </div>
                          <div style={{ textAlign: "center", minWidth: 34, flexShrink: 0 }}>
                            <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{row.value}</div>
                            <div style={{ fontSize: 8, fontWeight: 800, color: cat.color, textTransform: "uppercase", letterSpacing: "0.03em", marginTop: 3 }}>{cat.short}</div>
                          </div>
                          {outcome && (
                            <>
                              <div style={{ textAlign: "center", minWidth: 46, flexShrink: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 900, color: cat.color, lineHeight: 1 }}>{Math.round((prob ?? 0) * 100)}%</div>
                                <div style={{ fontSize: 12, fontWeight: 800, color: "#fbbf24", marginTop: 3 }}>{odds ? `${odds.toFixed(2)}x` : "—"}</div>
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); openBet(market!.id, outcome.id); }}
                                style={{ background: cat.color, color: "#0b0b0b", border: "none", borderRadius: 9, padding: "8px 13px", fontSize: 12, fontWeight: 900, cursor: "pointer", flexShrink: 0 }}
                              >
                                Predict
                              </button>
                            </>
                          )}
                        </div>
                      );
                      })
                    )}
                  </div>
                </>
              );
            })()}

          {/* ── Standings ── */}
          {tab === "standings" &&
            (standingsRows.length === 0 ? (
              emptyState("📊", "Standings unavailable", "The live league table will appear here shortly")
            ) : (
            <>
              <div style={{ overflowX: "auto", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "var(--bg-card, #1a1a1a)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 460 }}>
                  <thead>
                    <tr style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      <th style={{ textAlign: "left", padding: "10px 6px 10px 12px", fontWeight: 800 }}>#</th>
                      <th style={{ textAlign: "left", padding: "10px 6px", fontWeight: 800 }}>Club</th>
                      {["MP", "W", "D", "L", "GF", "GA", "GD"].map((h) => (
                        <th key={h} style={{ textAlign: "center", padding: "10px 4px", fontWeight: 800 }}>{h}</th>
                      ))}
                      <th style={{ textAlign: "center", padding: "10px 12px 10px 4px", fontWeight: 900, color: "rgba(255,255,255,0.7)" }}>Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standingsRows.map((row) => {
                      // Zone stripe: 1-4 UCL (green), 5 UEL (amber), 18-20 relegation (pink)
                      const stripe =
                        row.pos <= 4 ? ACCENT : row.pos === 5 ? "#fbbf24" : row.pos >= 18 ? PINK : "transparent";
                      return (
                        <tr key={row.club} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                          <td style={{ padding: "9px 6px 9px 0", borderLeft: `3px solid ${stripe}` }}>
                            <span style={{ paddingLeft: 9, fontWeight: 800, color: "rgba(255,255,255,0.7)" }}>{row.pos}</span>
                          </td>
                          <td style={{ padding: "9px 6px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <EplCrest src={row.crest} label={row.club} size={22} />
                              <span style={{ fontWeight: 700, color: "var(--text-main, #fff)", whiteSpace: "nowrap" }}>{shortEplName(row.club)}</span>
                            </div>
                          </td>
                          {[row.mp, row.w, row.d, row.l, row.gf, row.ga, row.gd].map((v, i) => (
                            <td key={i} style={{ textAlign: "center", padding: "9px 4px", color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>{v}</td>
                          ))}
                          <td style={{ textAlign: "center", padding: "9px 12px 9px 4px", fontWeight: 900, color: "#fff" }}>{row.pts}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 10, fontSize: 10, color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>
                <span><span style={{ color: ACCENT }}>▎</span> Champions League</span>
                <span><span style={{ color: "#fbbf24" }}>▎</span> Europa League</span>
                <span><span style={{ color: PINK }}>▎</span> Relegation</span>
                <span style={{ marginLeft: "auto" }}>
                  {liveStandings && liveStandings.table.length ? "Live · updates hourly" : "Updates once the season kicks off"}
                </span>
              </div>
            </>
            ))}

          {/* ── Season markets ── */}
          {tab === "season" &&
            (seasonMarkets.length === 0 ? (
              emptyState("🏆", "Season markets coming soon", "Title Winner · Top 4 · Relegation · Golden Boot")
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {seasonMarkets.map((market) => (
                  <EplSeasonMarket key={market.id} market={market} onBet={openBet} />
                ))}
              </div>
            ))}
        </div>

        {/* ── Bet modal ────────────────────────────────────────────────── */}
        {activeMarket && activeBet && (
          <TmaBetModal
            isOpen={true}
            onClose={() => setActiveBet(null)}
            market={activeMarket}
            outcomeId={activeBet.outcomeId}
            onSuccess={() => setActiveBet(null)}
            onFailure={(e: string) => console.error(e)}
            onGoToWallet={() => navigate("/wallet")}
          />
        )}
      </div>
    </Page>
  );
}
