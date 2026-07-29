import React, { useState, useRef, useCallback, useLayoutEffect, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Trophy,
  CalendarDays,
  ListOrdered,
  BarChart3,
  Clock,
  Goal,
  Star,
  Handshake,
  Swords,
} from "lucide-react";
import { Page } from "@/components/Page";
import type {
  Market,
  UclStandings,
  UclStats,
  UclBracket,
  UclBracketRound,
  UclBracketMatch,
  UclBracketTeam,
} from "@shared/api/client";
import { getMarkets, getUclStandings, getUclStats, getUclBracket } from "@shared/api/client";

// Live-data row shapes fed into the tabs (from the API, with dummy fallback).
type StandRow = { short: string; crest: string; p: number; gd: number; pts: number };
type StatRow = { player: string; clubShort: string; crest: string; value: number };
type StatBoard = {
  id: StatCat;
  label: string;
  heading: string;
  icon: React.ReactNode;
  accent: string;
  rows: StatRow[];
  marketId?: string; // set when a bettable market exists for this stat
};

// Which market subcategory backs each stat board (matches the backend).
// Only goals & assists have a free-tier CL data source (no cards feed exists).
const STAT_SUBCAT: Record<StatCat, string> = {
  goals: "ucl-topscorer",
  assists: "ucl-assists",
};

// ── UEFA Champions League theme tokens ────────────────────────────────────────
const BG = "#070d29"; // deep navy backdrop
const NAVY = "#0c1746";
const PANEL = "#101d54";
const BLUE = "#2b6bff"; // bright UCL accent
const BLUE_DIM = "#12336f";
const SILVER = "#aab6d6";
const GOLD = "#e8c766";

// All hub data is live: standings/stats/bracket from /ucl/*, and markets
// (matches, stat markets, outrights) from the markets API.

type UclTab = "season" | "matches" | "bracket" | "standings" | "stats";

const TABS: { id: UclTab; label: string; icon: React.ReactNode }[] = [
  { id: "season", label: "Season", icon: <Trophy size={14} /> },
  { id: "matches", label: "Matches", icon: <CalendarDays size={14} /> },
  { id: "bracket", label: "Bracket", icon: <Swords size={14} /> },
  { id: "standings", label: "Table", icon: <ListOrdered size={14} /> },
  { id: "stats", label: "Stats", icon: <BarChart3 size={14} /> },
];

// Detection: a market belongs to the Champions League hub if it's tagged ucl /
// champions-league, or its title names the competition. Excludes gaming/politics.
export function isUclMarket(m: Market): boolean {
  if (m.category === "gaming" || m.category === "political") return false;
  const sub = (m.subcategory ?? "").toLowerCase();
  const cat = (m.category ?? "").toLowerCase();
  const title = m.title.toLowerCase();
  if (sub.includes("ucl") || sub.includes("champions")) return true;
  if (cat.includes("champions league")) return true;
  return /champions league/.test(title) || /\bucl\b/.test(title);
}

// ── Crest with initial fallback ───────────────────────────────────────────────
function Crest({ src, label, size }: { src: string; label: string; size: number }) {
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
        background: `linear-gradient(135deg, ${BLUE} 0%, ${BLUE_DIM} 100%)`,
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

// ── Section heading ───────────────────────────────────────────────────────────
function Heading({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        margin: "4px 0 12px",
      }}
    >
      <Star size={13} color={GOLD} fill={GOLD} />
      <span
        style={{
          fontSize: 12,
          fontWeight: 900,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: SILVER,
        }}
      >
        {children}
      </span>
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "22px 16px",
        borderRadius: 14,
        border: "1px dashed rgba(43,107,255,0.3)",
        background: "rgba(43,107,255,0.05)",
        textAlign: "center",
        fontSize: 12.5,
        color: SILVER,
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}

function SeasonTab({
  outrightMarkets,
  topScorer,
  onOpen,
}: {
  outrightMarkets: Market[];
  topScorer: StatRow | null;
  onOpen: (id: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Outright season markets (admin-created) */}
      <div>
        <Heading>Season Outrights</Heading>
        {outrightMarkets.length === 0 ? (
          <EmptyState>
            No outright markets open yet.
            <br />
            Season markets (e.g. “Who lifts the trophy?”) appear here once created.
          </EmptyState>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {outrightMarkets.map((m) => {
              const pool = Number(m.totalPool) || 0;
              return (
                <div
                  key={m.id}
                  onClick={() => onOpen(m.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && onOpen(m.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 11,
                    padding: "13px 14px",
                    borderRadius: 14,
                    cursor: "pointer",
                    background: `linear-gradient(135deg, rgba(43,107,255,0.08) 0%, ${NAVY} 65%)`,
                    border: "1px solid rgba(232,199,102,0.35)",
                  }}
                >
                  <Trophy size={20} color={GOLD} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {m.title}
                    </div>
                    <div style={{ fontSize: 11, color: SILVER, marginTop: 2 }}>
                      {(m.outcomes ?? []).length} contenders · Nu {pool.toLocaleString()} pool
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 900, color: BLUE, flexShrink: 0 }}>Predict »</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Top scorer (live) */}
      <div>
        <Heading>Top Scorer</Heading>
        {topScorer ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "13px 14px",
              borderRadius: 14,
              background: NAVY,
              border: "1px solid rgba(232,199,102,0.35)",
            }}
          >
            <Crest src={topScorer.crest} label={topScorer.clubShort} size={42} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{topScorer.player}</div>
              <div style={{ fontSize: 11.5, color: SILVER, marginTop: 1 }}>{topScorer.clubShort}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: GOLD, flexShrink: 0 }}>
              <Goal size={16} />
              <span style={{ fontSize: 20, fontWeight: 900 }}>{topScorer.value}</span>
            </div>
          </div>
        ) : (
          <EmptyState>Leaderboard loads once the competition is underway.</EmptyState>
        )}
      </div>
    </div>
  );
}

// Laplace-smoothed share of the pool → a 0–100 win-probability per outcome.
function outcomeShares(m: Market): number[] {
  const outs = m.outcomes ?? [];
  const prior = 300;
  const n = outs.length || 1;
  const pool = Number(m.totalPool) || outs.reduce((s, o) => s + Number(o.totalBetAmount ?? 0), 0);
  return outs.map((o) =>
    Math.round((100 * (Number(o.totalBetAmount ?? 0) + prior / n)) / (pool + prior)),
  );
}

function MatchesTab({ matches, onOpen }: { matches: Market[]; onOpen: (id: string) => void }) {
  // Live match markets when the keeper has created them; otherwise a dummy
  // preview so the tab is never blank in the off-season.
  if (matches.length > 0) {
    const colors = [BLUE, SILVER, "#e0457b"];
    return (
      <div>
        <Heading>Upcoming Matches</Heading>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {matches.map((m) => {
            const outs = m.outcomes ?? [];
            const home = outs[0];
            const away = outs[outs.length - 1];
            const probs = outcomeShares(m);
            const labels = outs.map((o) => o.label);
            const kickoff = m.bettingClosesAt ?? m.closesAt;
            const when = kickoff
              ? new Date(kickoff).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
              : "";
            const locked = m.status === "closed" || m.status === "resolving" || m.status === "resolved" || m.status === "settled";
            return (
              <div
                key={m.id}
                onClick={() => onOpen(m.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onOpen(m.id)}
                style={{
                  borderRadius: 16,
                  overflow: "hidden",
                  border: "1px solid rgba(43,107,255,0.22)",
                  background: NAVY,
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", background: "rgba(43,107,255,0.08)" }}>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: SILVER, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {locked ? "Closed" : "Champions League"}
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, color: SILVER }}>
                    <Clock size={11} /> {when}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", gap: 10, padding: "16px 16px 12px" }}>
                  <div style={{ textAlign: "center", flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <Crest src={home?.imageUrl ?? ""} label={home?.label ?? ""} size={46} />
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: "#fff", marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{home?.label}</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: SILVER, background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: "4px 10px", flexShrink: 0 }}>VS</div>
                  <div style={{ textAlign: "center", flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <Crest src={away?.imageUrl ?? ""} label={away?.label ?? ""} size={46} />
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: "#fff", marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{away?.label}</div>
                  </div>
                </div>
                <div style={{ display: "flex", height: 4 }}>
                  {probs.map((p, i) => (
                    <div key={i} style={{ width: `${p}%`, background: i === 1 ? "rgba(170,182,214,0.5)" : colors[Math.min(i, 2)] }} />
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, padding: "12px 12px 14px" }}>
                  {outs.map((o, i) => (
                    <div
                      key={o.id}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        padding: "10px 4px",
                        background: `${colors[Math.min(i, 2)]}14`,
                        border: `1px solid ${colors[Math.min(i, 2)]}55`,
                        borderRadius: 11,
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: 18, fontWeight: 900, color: i === 1 ? "#c8d2e0" : colors[Math.min(i, 2)], lineHeight: 1 }}>{probs[i]}%</div>
                      <div style={{ marginTop: 4, fontSize: 11, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{labels[i]}</div>
                    </div>
                  ))}
                </div>
                <div style={{ textAlign: "center", fontSize: 10.5, fontWeight: 800, color: BLUE, padding: "0 0 12px" }}>
                  {locked ? "View market »" : "Tap to predict »"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Heading>Upcoming Matches</Heading>
      <EmptyState>
        No live match markets right now.
        <br />
        Match markets are created automatically as Champions League fixtures are
        announced — check back when the next round is scheduled.
      </EmptyState>
    </div>
  );
}

function StandingsTab({ rows }: { rows: StandRow[] }) {
  if (rows.length === 0) {
    return (
      <div>
        <Heading>League Phase</Heading>
        <EmptyState>The league-phase table loads once the competition is underway.</EmptyState>
      </div>
    );
  }
  return (
    <div>
      <Heading>League Phase</Heading>
      <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(43,107,255,0.2)" }}>
        {/* Header row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "9px 12px",
            background: "rgba(43,107,255,0.1)",
            fontSize: 10,
            fontWeight: 800,
            color: SILVER,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          <span style={{ width: 22, flexShrink: 0 }}>#</span>
          <span style={{ flex: 1 }}>Club</span>
          <span style={{ width: 26, textAlign: "center" }}>P</span>
          <span style={{ width: 32, textAlign: "center" }}>GD</span>
          <span style={{ width: 34, textAlign: "center" }}>Pts</span>
        </div>
        {rows.map((row, i) => {
          // Top 8 auto-advance, 9–24 play-off, else out — colored left rail.
          const rail = i < 8 ? BLUE : i < 24 ? GOLD : "#e0457b";
          return (
            <div
              key={`${row.short}-${i}`}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "10px 12px",
                borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.05)",
                background: i % 2 ? "rgba(255,255,255,0.015)" : "transparent",
              }}
            >
              <span style={{ width: 22, flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 3, height: 18, borderRadius: 2, background: rail }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>{i + 1}</span>
              </span>
              <span style={{ flex: 1, display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                <Crest src={row.crest} label={row.short} size={26} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {row.short}
                </span>
              </span>
              <span style={{ width: 26, textAlign: "center", fontSize: 12, color: SILVER }}>{row.p}</span>
              <span style={{ width: 32, textAlign: "center", fontSize: 12, color: SILVER }}>
                {row.gd > 0 ? `+${row.gd}` : row.gd}
              </span>
              <span style={{ width: 34, textAlign: "center", fontSize: 14, fontWeight: 900, color: "#fff" }}>{row.pts}</span>
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
        {[
          { c: BLUE, t: "Round of 16" },
          { c: GOLD, t: "Play-off" },
          { c: "#e0457b", t: "Eliminated" },
        ].map((l) => (
          <span key={l.t} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, color: SILVER, fontWeight: 600 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: l.c }} />
            {l.t}
          </span>
        ))}
      </div>
    </div>
  );
}

type StatCat = "goals" | "assists";

// Board metadata (goals & assists only — the CL free tier has no card data).
const STAT_DEFS: {
  id: StatCat;
  label: string;
  heading: string;
  icon: React.ReactNode;
  accent: string;
}[] = [
  { id: "goals", label: "Goals", heading: "Top Scorers", icon: <Goal size={14} />, accent: BLUE },
  { id: "assists", label: "Assists", heading: "Most Assists", icon: <Handshake size={14} />, accent: "#3ddc97" },
];

function StatsTab({ boards, onBet }: { boards: StatBoard[]; onBet: (id: StatCat) => void }) {
  const [cat, setCat] = useState<StatCat>("goals");
  const active = boards.find((c) => c.id === cat) ?? boards[0];
  const max = Math.max(...active.rows.map((r) => r.value), 1);

  return (
    <div>
      {/* Stat category selector */}
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: 4,
          background: PANEL,
          border: "1px solid rgba(43,107,255,0.2)",
          borderRadius: 12,
          marginBottom: 14,
        }}
      >
        {boards.map((c) => {
          const on = c.id === cat;
          return (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              style={{
                flex: 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                padding: "8px 4px",
                borderRadius: 9,
                border: "none",
                cursor: "pointer",
                background: on ? `${c.accent}22` : "transparent",
                color: on ? "#fff" : SILVER,
                fontSize: 11.5,
                fontWeight: 800,
              }}
            >
              {c.icon}
              <span style={{ whiteSpace: "nowrap" }}>{c.label}</span>
            </button>
          );
        })}
      </div>

      <Heading>{active.heading}</Heading>

      {/* Bet CTA — shown when a bettable market exists for this stat */}
      {active.marketId ? (
        <button
          onClick={() => onBet(active.id)}
          style={{
            width: "100%",
            marginBottom: 12,
            padding: "12px 14px",
            borderRadius: 12,
            border: `1px solid ${active.accent}66`,
            background: `linear-gradient(180deg, ${active.accent}26, ${active.accent}0d)`,
            color: "#fff",
            fontSize: 12.5,
            fontWeight: 900,
            letterSpacing: "0.03em",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
          }}
        >
          <Star size={13} color={GOLD} fill={GOLD} />
          Predict the {active.label} winner »
        </button>
      ) : (
        <div style={{ fontSize: 11, color: SILVER, marginTop: -4, marginBottom: 12 }}>
          Live leaderboard — betting opens once the market is live.
        </div>
      )}

      {active.rows.length === 0 ? (
        <EmptyState>Leaderboard loads once the competition is underway.</EmptyState>
      ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {active.rows.map((s, i) => (
          <div
            key={`${s.player}-${i}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 11,
              padding: "11px 13px",
              borderRadius: 12,
              background: NAVY,
              border: "1px solid rgba(43,107,255,0.16)",
            }}
          >
            <span style={{ width: 18, fontSize: 13, fontWeight: 900, color: i === 0 ? active.accent : SILVER, textAlign: "center" }}>{i + 1}</span>
            <Crest src={s.crest} label={s.clubShort} size={34} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: "#fff" }}>{s.player}</div>
              <div style={{ fontSize: 11, color: SILVER, marginTop: 1 }}>{s.clubShort}</div>
              <div
                style={{
                  marginTop: 6,
                  height: 3,
                  background: "rgba(255,255,255,0.1)",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <div style={{ width: `${(s.value / max) * 100}%`, height: "100%", background: active.accent }} />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, color: active.accent, flexShrink: 0 }}>
              <span style={{ display: "inline-flex" }}>{active.icon}</span>
              <span style={{ fontSize: 16, fontWeight: 900 }}>{s.value}</span>
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}

// ── Two-sided knockout tree (from live /ucl/bracket data) ────────────────────
// A crest "medallion" per slot, branching inward from both edges toward the
// trophy at the centre. Winners advance; knocked-out teams fade back.
interface BNode {
  club: UclBracketTeam | null;
  out: boolean; // knocked out (loser of its tie), or an empty/TBD slot
}
interface BracketCol {
  key: string;
  label: string;
  center?: boolean;
  nodes: BNode[];
}

const winnerTeam = (m?: UclBracketMatch): UclBracketTeam | null =>
  m && m.winner ? (m.winner === "a" ? m.a : m.b) : null;

// Build the 9 display columns from the 4 API rounds (r16/qf/sf/final). The
// backend already orders ties so r16[2j],r16[2j+1] feed qf[j], etc., which is
// exactly what the connector geometry (node i → floor(i/2)) expects.
function buildColumns(rounds: UclBracketRound[]): BracketCol[] {
  const byKey: Record<string, UclBracketMatch[]> = {};
  for (const r of rounds) byKey[r.key] = r.matches;
  const r16 = byKey.r16 ?? [];
  const qf = byKey.qf ?? [];
  const sf = byKey.sf ?? [];
  const at = (arr: UclBracketMatch[], i: number): UclBracketMatch | undefined => arr[i];

  const leaf = (matches: UclBracketMatch[]): BNode[] => {
    const nodes: BNode[] = [];
    for (const m of matches) {
      nodes.push({ club: m.a, out: m.winner === "b" });
      nodes.push({ club: m.b, out: m.winner === "a" });
    }
    return nodes;
  };
  const wins = (matches: (UclBracketMatch | undefined)[]): BNode[] =>
    matches.map((m) => ({ club: winnerTeam(m), out: false }));

  return [
    { key: "lR16", label: "R16", nodes: leaf(r16.slice(0, 4)) },
    { key: "lQF", label: "QF", nodes: wins([at(r16, 0), at(r16, 1), at(r16, 2), at(r16, 3)]) },
    { key: "lSF", label: "SF", nodes: wins([at(qf, 0), at(qf, 1)]) },
    { key: "lF", label: "", nodes: wins([at(sf, 0)]) },
    { key: "center", label: "", center: true, nodes: [] },
    { key: "rF", label: "", nodes: wins([at(sf, 1)]) },
    { key: "rSF", label: "SF", nodes: wins([at(qf, 2), at(qf, 3)]) },
    { key: "rQF", label: "QF", nodes: wins([at(r16, 4), at(r16, 5), at(r16, 6), at(r16, 7)]) },
    { key: "rR16", label: "R16", nodes: leaf(r16.slice(4, 8)) },
  ];
}

const NODE = 44;
const NODE_COL_W = 72;
const CENTER_W = 128;
const KO_GAP = 16;
const KO_BODY_H = 640;
const KO_HEADER_H = 22;

type PathKind = "dim" | "blue" | "gold";

function BracketTab({ bracket }: { bracket: UclBracket | null }) {
  const columns = React.useMemo(() => buildColumns(bracket?.rounds ?? []), [bracket]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const refs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [paths, setPaths] = useState<{ d: string; kind: PathKind }[]>([]);

  const setRef = (key: string) => (el: HTMLDivElement | null) => {
    if (el) refs.current.set(key, el);
    else refs.current.delete(key);
  };

  // Draw elbow connectors from each slot to the slot it feeds. offset* keeps the
  // maths in `inner`'s own coordinate space (transform-safe). A connector fed by
  // a knocked-out team dims; the finalists' link to the trophy is gold.
  const computePaths = useCallback(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const box = (key: string) => {
      const el = refs.current.get(key);
      return el ? { l: el.offsetLeft, t: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight } : null;
    };
    const out: { d: string; kind: PathKind }[] = [];
    const elbow = (x1: number, y1: number, x2: number, y2: number, kind: PathKind) => {
      const mx = (x1 + x2) / 2;
      out.push({ d: `M ${x1} ${y1} H ${mx} V ${y2} H ${x2}`, kind });
    };
    for (const ci of [0, 1, 2]) {
      columns[ci].nodes.forEach((n, i) => {
        const f = box(`${ci}-${i}`);
        const t = box(`${ci + 1}-${Math.floor(i / 2)}`);
        if (f && t) elbow(f.l + f.w, f.t + f.h / 2, t.l, t.t + t.h / 2, n.out ? "dim" : "blue");
      });
    }
    const lf = box("3-0"), c = box("center"), rf = box("5-0");
    if (lf && c) elbow(lf.l + lf.w, lf.t + lf.h / 2, c.l, c.t + c.h / 2, "gold");
    if (c && rf) elbow(c.l + c.w, c.t + c.h / 2, rf.l, rf.t + rf.h / 2, "gold");
    for (const ci of [8, 7, 6]) {
      columns[ci].nodes.forEach((n, i) => {
        const f = box(`${ci}-${i}`);
        const t = box(`${ci - 1}-${Math.floor(i / 2)}`);
        if (f && t) elbow(f.l, f.t + f.h / 2, t.l + t.w, t.t + t.h / 2, n.out ? "dim" : "blue");
      });
    }
    setPaths(out);
  }, []);

  useLayoutEffect(() => {
    computePaths();
    const ro = new ResizeObserver(computePaths);
    if (innerRef.current) ro.observe(innerRef.current);
    window.addEventListener("resize", computePaths);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", computePaths);
    };
  }, [computePaths]);

  // Start scrolled to the centre so the trophy is what you see first.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2);
  }, []);

  const strokeFor = (kind: PathKind) =>
    kind === "gold" ? "url(#koGold)" : kind === "blue" ? "url(#koBlue)" : "rgba(140,155,190,0.14)";

  const medallion = (n: BNode, key: string, finalist: boolean) => {
    const club = n.club;
    const advancing = !n.out;
    const ringGrad = finalist
      ? "linear-gradient(145deg, #f7e6a6 0%, #e8c766 42%, #a9812f 100%)"
      : advancing
        ? "linear-gradient(145deg, #7ad4ff 0%, #2b6bff 55%, #123a86 100%)"
        : "linear-gradient(145deg, rgba(186,196,220,0.55), rgba(110,124,158,0.28))";
    const glow = finalist
      ? "0 0 20px rgba(232,199,102,0.5), 0 5px 12px rgba(0,0,0,0.45)"
      : advancing
        ? "0 0 13px rgba(43,107,255,0.4), 0 5px 12px rgba(0,0,0,0.4)"
        : "0 3px 8px rgba(0,0,0,0.35)";
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, width: "100%", opacity: n.out ? 0.55 : 1 }}>
        <div
          ref={setRef(key)}
          style={{
            position: "relative",
            zIndex: 1,
            width: NODE,
            height: NODE,
            borderRadius: "50%",
            flexShrink: 0,
            padding: 2,
            background: ringGrad,
            boxShadow: glow,
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              background: "radial-gradient(circle at 50% 26%, #1b2d68 0%, #0a1338 80%)",
              boxShadow: "inset 0 1px 2px rgba(255,255,255,0.14), inset 0 -3px 7px rgba(0,0,0,0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {club ? (
              <div style={{ display: "flex", filter: n.out ? "grayscale(0.7) brightness(0.9)" : "none" }}>
                <Crest src={club.crest} label={club.short} size={NODE - 16} />
              </div>
            ) : (
              <span style={{ fontSize: 16, opacity: 0.5 }}>🛡️</span>
            )}
          </div>
        </div>
        <span
          style={{
            width: "100%",
            height: 24,
            fontSize: 9.5,
            lineHeight: 1.2,
            textAlign: "center",
            overflow: "hidden",
            fontWeight: finalist ? 800 : 700,
            letterSpacing: "0.02em",
            color: finalist ? GOLD : advancing ? "#eaf1ff" : "rgba(170,182,214,0.6)",
            textShadow: "0 1px 3px rgba(0,0,0,0.5)",
          }}
        >
          {club ? club.short : "TBD"}
        </span>
      </div>
    );
  };

  if (!bracket || !bracket.hasData) {
    return (
      <div>
        <Heading>Knockout Bracket</Heading>
        <EmptyState>
          The knockout bracket appears here once the Round of 16 is drawn.
          <br />
          It fills in automatically from the official results as ties are played.
        </EmptyState>
      </div>
    );
  }

  return (
    <div>
      <Heading>Knockout Bracket</Heading>
      <div style={{ fontSize: 11, color: SILVER, marginTop: -6, marginBottom: 12 }}>
        {bracket.decided ? "The road to Munich" : "The road to Munich · swipe to explore"}
      </div>
      {/* Modern stage: layered navy, centre glow, a light beam and a faint grid. */}
      <div
        style={{
          position: "relative",
          borderRadius: 20,
          overflow: "hidden",
          border: "1px solid rgba(43,107,255,0.28)",
          background: "linear-gradient(180deg, #0b1750 0%, #081130 55%, #060b22 100%)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        {/* faint grid */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            backgroundImage:
              "linear-gradient(rgba(90,120,200,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(90,120,200,0.06) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            WebkitMaskImage: "radial-gradient(120% 100% at 50% 40%, #000 38%, transparent 82%)",
            maskImage: "radial-gradient(120% 100% at 50% 40%, #000 38%, transparent 82%)",
          }}
        />
        {/* light beam */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "-25%",
            left: "50%",
            width: 300,
            height: "150%",
            transform: "translateX(-50%) rotate(8deg)",
            pointerEvents: "none",
            background: "radial-gradient(closest-side, rgba(43,107,255,0.16), transparent)",
          }}
        />
        {/* centre glow */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(50% 60% at 50% 40%, rgba(232,199,102,0.1), transparent 60%), radial-gradient(60% 70% at 50% 44%, rgba(43,107,255,0.16), transparent 72%)",
          }}
        />
        <div
          ref={scrollRef}
          style={{
            position: "relative",
            overflowX: "auto",
            overflowY: "hidden",
            padding: "16px 10px 14px",
            display: "flex",
            justifyContent: "safe center",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div ref={innerRef} style={{ position: "relative", display: "flex", gap: KO_GAP, width: "min-content" }}>
            {/* Connector elbows (behind the medallions) */}
            <svg
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                overflow: "visible",
                zIndex: 0,
              }}
            >
              <defs>
                <linearGradient id="koBlue" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#2b6bff" stopOpacity="0.22" />
                  <stop offset="0.5" stopColor="#6a97ff" stopOpacity="0.75" />
                  <stop offset="1" stopColor="#2b6bff" stopOpacity="0.22" />
                </linearGradient>
                <linearGradient id="koGold" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#e8c766" stopOpacity="0.55" />
                  <stop offset="0.5" stopColor="#ffe9a8" stopOpacity="1" />
                  <stop offset="1" stopColor="#e8c766" stopOpacity="0.55" />
                </linearGradient>
              </defs>
              {/* gold glow underlay */}
              {paths
                .filter((p) => p.kind === "gold")
                .map((p, i) => (
                  <path key={`glow${i}`} d={p.d} fill="none" stroke="rgba(232,199,102,0.28)" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
                ))}
              {paths.map((p, i) => (
                <path
                  key={i}
                  d={p.d}
                  fill="none"
                  stroke={strokeFor(p.kind)}
                  strokeWidth={p.kind === "gold" ? 2.2 : 1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </svg>
            {columns.map((col, ci) => {
              const finalist = col.key === "lF" || col.key === "rF";
              return (
                <div
                  key={col.key}
                  style={{ width: col.center ? CENTER_W : NODE_COL_W, flexShrink: 0, display: "flex", flexDirection: "column" }}
                >
                  {/* Round label (pill) */}
                  <div style={{ height: KO_HEADER_H, marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {col.label && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 900,
                          color: "#bcd2ff",
                          letterSpacing: "0.16em",
                          textTransform: "uppercase",
                          background: "linear-gradient(180deg, rgba(43,107,255,0.22), rgba(43,107,255,0.08))",
                          border: "1px solid rgba(97,140,255,0.4)",
                          borderRadius: 20,
                          padding: "4px 11px",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                        }}
                      >
                        {col.label}
                      </span>
                    )}
                  </div>
                  {col.center ? (
                    <div style={{ height: KO_BODY_H, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div
                        ref={setRef("center")}
                        style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}
                      >
                        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <div
                            aria-hidden
                            style={{
                              position: "absolute",
                              width: 176,
                              height: 176,
                              borderRadius: "50%",
                              background: "radial-gradient(circle, rgba(232,199,102,0.4), rgba(43,107,255,0.12) 44%, transparent 68%)",
                            }}
                          />
                          <img
                            src="/ucl-trophy.webp"
                            alt="Champions League trophy"
                            decoding="async"
                            style={{ position: "relative", height: 168, width: "auto", filter: "drop-shadow(0 12px 24px rgba(0,0,0,0.55))" }}
                          />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 20, height: 1, background: "linear-gradient(90deg, transparent, rgba(232,199,102,0.8))" }} />
                            <span style={{ fontSize: 11, fontWeight: 900, color: GOLD, letterSpacing: "0.28em", textTransform: "uppercase" }}>Final</span>
                            <span style={{ width: 20, height: 1, background: "linear-gradient(90deg, rgba(232,199,102,0.8), transparent)" }} />
                          </div>
                          <span style={{ fontSize: 9, fontWeight: 700, color: SILVER, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                            Munich · 2027
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // flex:1 cells spread evenly, so each round centres on its
                    // feeder pair — forming the bracket tree automatically.
                    <div style={{ height: KO_BODY_H, display: "flex", flexDirection: "column" }}>
                      {col.nodes.map((n, i) => (
                        <div key={i} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {medallion(n, `${ci}-${i}`, finalist)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Hub ───────────────────────────────────────────────────────────────────────

export function UclHubPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<UclTab>("season");
  const [markets, setMarkets] = useState<Market[]>([]);
  const [liveStandings, setLiveStandings] = useState<UclStandings | null>(null);
  const [liveStats, setLiveStats] = useState<UclStats | null>(null);
  const [bracket, setBracket] = useState<UclBracket | null>(null);

  useEffect(() => {
    getMarkets()
      .then((d) => setMarkets(d.filter((m) => m.status !== "cancelled")))
      .catch(() => {});
    getUclStandings().then(setLiveStandings).catch(() => {});
    getUclStats().then(setLiveStats).catch(() => {});
    getUclBracket().then(setBracket).catch(() => {});
  }, []);

  // Standings — live league-phase table (empty state when the API has none).
  const standRows: StandRow[] = (liveStandings?.table ?? []).map((r) => ({
    short: r.teamName,
    crest: r.teamBadge,
    p: r.played,
    gd: r.gd,
    pts: r.points,
  }));

  // A bettable stat market for this board (auto-created by the keeper).
  const statMarketId = (cat: StatCat): string | undefined =>
    markets.find((m) => (m.subcategory ?? "").toLowerCase() === STAT_SUBCAT[cat])?.id;

  // Live leaderboard rows for a stat board (goals/assists only).
  const rowsFor = (cat: StatCat): StatRow[] =>
    (liveStats?.[cat] ?? []).map((e) => ({
      player: e.player,
      clubShort: e.club,
      crest: e.face || e.faceBackup || e.clubBadge,
      value: e.value,
    }));

  const boards: StatBoard[] = STAT_DEFS.map((c) => ({
    id: c.id,
    label: c.label,
    heading: c.heading,
    icon: c.icon,
    accent: c.accent,
    rows: rowsFor(c.id),
    marketId: statMarketId(c.id),
  }));

  const sub = (m: Market) => (m.subcategory ?? "").toLowerCase();
  const STAT_SUBS = Object.values(STAT_SUBCAT);

  // UCL match markets (auto-created by the keeper), soonest kickoff first.
  const matchMarkets = markets
    .filter((m) => sub(m) === "ucl-match")
    .sort((a, b) => {
      const ka = new Date(a.bettingClosesAt ?? a.closesAt ?? 0).getTime();
      const kb = new Date(b.bettingClosesAt ?? b.closesAt ?? 0).getTime();
      return ka - kb;
    });

  // Admin-created outright/season markets: UCL markets that aren't a match, a
  // stat board, or a bracket tie. Only show ones still open for betting.
  const outrightMarkets = markets.filter(
    (m) =>
      isUclMarket(m) &&
      sub(m) !== "ucl-match" &&
      sub(m) !== "ucl-bracket" &&
      !STAT_SUBS.includes(sub(m)) &&
      (m.status === "open" || m.status === "upcoming"),
  );

  const topScorer = boards.find((b) => b.id === "goals")?.rows[0] ?? null;

  const openMarket = (id: string) => navigate(`/market/${id}`);

  return (
    <Page>
      <div style={{ minHeight: "100vh", background: BG }}>
        {/* ── Masthead — full-bleed, poster image beneath the text ── */}
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            minHeight: "clamp(170px, 27vw, 240px)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            backgroundImage: "url('/ucl-banner-wide.webp')",
            backgroundSize: "cover",
            backgroundPosition: "center 28%",
            backgroundColor: NAVY,
            borderBottom: "1px solid rgba(43,107,255,0.25)",
          }}
        >
          {/* Readability veil — covers the whole image with an even navy tint,
              a touch deeper at top and bottom so the corners and stat strip read. */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(7,13,41,0.58) 0%, rgba(7,13,41,0.42) 45%, rgba(7,13,41,0.5) 78%, rgba(7,13,41,0.66) 100%)",
              pointerEvents: "none",
            }}
          />

          {/* Back button */}
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            style={{
              position: "absolute",
              left: 12,
              top: 12,
              zIndex: 2,
              background: "rgba(0,0,0,0.4)",
              border: "1px solid rgba(255,255,255,0.35)",
              borderRadius: "50%",
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#fff",
              fontSize: 17,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ←
          </button>

          {/* Lockup — image carries the branding; only the stat strip sits on top */}
          <div style={{ position: "relative", maxWidth: 860, margin: "0 auto", padding: "16px 16px 14px", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              {[
                { v: "36", l: "Teams" },
                { v: "189", l: "Matches" },
                { v: "Munich", l: "Final 2027" },
              ].map((s, i) => (
                <React.Fragment key={s.l}>
                  {i > 0 && <span style={{ width: 1, background: "rgba(255,255,255,0.14)", margin: "2px 0" }} />}
                  <div style={{ padding: "0 16px" }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", textShadow: "0 2px 10px rgba(0,0,0,0.7)" }}>{s.v}</div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: SILVER, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2, textShadow: "0 1px 6px rgba(0,0,0,0.7)" }}>
                      {s.l}
                    </div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 860, margin: "0 auto", padding: "18px 16px 120px" }}>

          {/* Tab bar */}
          <div
            style={{
              display: "flex",
              gap: 4,
              padding: 4,
              background: PANEL,
              border: "1px solid rgba(43,107,255,0.2)",
              borderRadius: 14,
              marginBottom: 18,
            }}
          >
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    padding: "9px 2px",
                    borderRadius: 10,
                    border: "none",
                    cursor: "pointer",
                    background: active ? `linear-gradient(180deg, ${BLUE} 0%, ${BLUE_DIM} 100%)` : "transparent",
                    color: active ? "#fff" : SILVER,
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  {t.icon}
                  <span style={{ whiteSpace: "nowrap" }}>{t.label}</span>
                </button>
              );
            })}
          </div>

          {tab === "season" && (
            <SeasonTab outrightMarkets={outrightMarkets} topScorer={topScorer} onOpen={openMarket} />
          )}
          {tab === "matches" && <MatchesTab matches={matchMarkets} onOpen={openMarket} />}
          {tab === "bracket" && <BracketTab bracket={bracket} />}
          {tab === "standings" && <StandingsTab rows={standRows} />}
          {tab === "stats" && (
            <StatsTab
              boards={boards}
              onBet={(cat) => {
                const id = statMarketId(cat);
                if (id) openMarket(id);
              }}
            />
          )}
        </div>
      </div>
    </Page>
  );
}
