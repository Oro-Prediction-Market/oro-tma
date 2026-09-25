import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Page } from "@/components/Page";
import { TmaBetModal } from "@/components/TmaBetModal";
import { groupByMatchday } from "../lib/matchday";
import {
  Trophy,
  CalendarDays,
  LayoutGrid,
  BarChart3,
  Clock,
  Goal,
  Handshake,
  Star,
} from "lucide-react";
import { calcProb, calcOdds, formatOdds } from "./WorldCupHubPage";
import type {
  Market,
  Outcome,
  UnlStandings,
  UnlStandingRow,
  UnlStats,
  UnlSeason,
} from "@shared/api/client";
import {
  getMarkets,
  getUnlStandings,
  getUnlStats,
  getUnlSeason,
} from "@shared/api/client";


/**
 * UEFA Nations League hub.
 *
 * Structurally the Champions League hub with the bracket swapped for group
 * tables, which is the shape of this competition: fourteen groups across four
 * leagues, no single table, and a knockout stage that involves four teams the
 * following June.
 *
 * Two things here are NOT copies of the UCL hub, both because this competition
 * has no data provider behind it:
 *
 *  - **The group tables come from results we typed in**, not a feed. They are
 *    computed server-side by `computeGroupTable`, which applies UEFA's
 *    head-to-head rule rather than a plain points → GD sort.
 *  - **The Stats tab falls back to the market's own outcomes** when the
 *    leaderboard is empty. On the UCL hub an empty board just says "loads once
 *    the competition is underway", because a provider will eventually fill it.
 *    Here nobody fills it until an admin does, and a live stat market that is
 *    invisible until then is a market nobody can bet on.
 */

// ── Theme ─────────────────────────────────────────────────────────────────────
const BG = "#050f1f";
const NAVY = "#0a1a33";
const PANEL = "#0e2140";
const TEAL = "#19c4a6";
const TEAL_DIM = "#0d6b5c";
const SILVER = "#9fb3cd";
const GOLD = "#e8c766";
const PINK = "#e0457b";
const WIN_GREEN = "#3ddc97";

/**
 * The four leagues, and which groups sit in each.
 *
 * Not decoration — it is how the competition is organised, and it turns a flat
 * list of fourteen tables into four readable sections. A → D is the ladder:
 * League A is the top tier, League D the bottom, and teams are promoted and
 * relegated between them.
 */
const TIERS: { label: string; color: string; groups: string[] }[] = [
  { label: "League A", color: GOLD, groups: ["A", "B", "C", "D"] },
  { label: "League B", color: "#c0c9d8", groups: ["E", "F", "G", "H"] },
  { label: "League C", color: "#cd8b52", groups: ["I", "J", "K", "L"] },
  { label: "League D", color: "#7d8aa0", groups: ["M", "N"] },
];

// Which market subcategory backs each stat board (matches the backend).
type StatCat = "goals" | "assists";
const STAT_SUBCAT: Record<StatCat, string> = {
  goals: "unl-topscorer",
  assists: "unl-assists",
};

const MATCH_SUB = "unl-match";

type UnlTab = "matches" | "groups" | "stats";

/**
 * Three tabs, not four.
 *
 * The other hubs open on a Season tab because their competition has a headline
 * outright — "who lifts the trophy?" — that is a reason to visit on its own.
 * This one does not: the Nations League final is four teams the following
 * June, so a Season tab here is an empty state sitting next to two counters
 * the masthead already shows. Outright markets, if an admin ever creates one,
 * render at the top of Matches instead, so nothing becomes unreachable.
 */
const TABS: { id: UnlTab; label: string; icon: React.ReactNode }[] = [
  { id: "matches", label: "Matches", icon: <CalendarDays size={14} /> },
  { id: "groups", label: "Groups", icon: <LayoutGrid size={14} /> },
  { id: "stats", label: "Stats", icon: <BarChart3 size={14} /> },
];

/**
 * Whether a market belongs to this hub.
 *
 * The subcategory check is the reliable one — everything the keeper and the
 * seeder create is tagged `unl-*`. The title fallback catches markets an admin
 * typed by hand, and deliberately does NOT match a bare "nations": far too
 * many things are called that.
 */
export function isUnlMarket(m: Market): boolean {
  if (m.category === "gaming" || m.category === "political") return false;
  const sub = (m.subcategory ?? "").toLowerCase();
  if (sub.startsWith("unl-")) return true;
  if ((m.externalSource ?? "").toLowerCase() === "unl-manual") return true;
  return /nations league/i.test(m.title);
}

// ── Small shared pieces ───────────────────────────────────────────────────────

/** A flag (or crest), falling back to the nation's initial when the image fails. */
function Flag({ src, label, size }: { src: string; label: string; size: number }) {
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
          objectFit: "cover",
          flexShrink: 0,
          background: "rgba(255,255,255,0.06)",
          borderRadius: "50%",
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
        background: `linear-gradient(135deg, ${TEAL} 0%, ${TEAL_DIM} 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.4,
        fontWeight: 900,
        color: "#04211c",
      }}
    >
      {label.trim().charAt(0).toUpperCase()}
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 12px" }}>
      <Star size={13} color={TEAL} fill={TEAL} />
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

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "22px 16px",
        borderRadius: 14,
        border: `1px dashed ${TEAL}4d`,
        background: `${TEAL}0d`,
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

/**
 * "3d 5h" / "5h 12m" / "12m" until betting closes, refreshed each minute.
 *
 * A card is being asked "have I still got time to predict this?", and a
 * timestamp makes the reader do the subtraction themselves.
 */
function useClosesAt(closesAt: string | null | undefined): string {
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (!closesAt) {
      setLabel("");
      return;
    }
    const tick = () => {
      const ms = new Date(closesAt).getTime() - Date.now();
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
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [closesAt]);
  return label;
}

/** A 0–100 win-probability per outcome, via the shared calcProb. */
function outcomeShares(m: Market): number[] {
  return (m.outcomes ?? []).map((o) => Math.round(calcProb(m, o.id) * 100));
}

/**
 * A match leaves "Upcoming" only once its result is FINAL.
 *
 * Closed and resolving both stay in the active list. That matters more here
 * than on the other hubs: nothing settles a Nations League market
 * automatically, so a match can sit closed for as long as it takes an admin to
 * propose and resolve it, and dropping it out of view in the meantime would
 * hide a market people hold positions in.
 */
const isMatchFinal = (m: Market) => m.status === "resolved" || m.status === "settled";

function RoundHeading({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 10px" }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: TEAL,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: `${TEAL}38` }} />
    </div>
  );
}

/** "Group A · Matchday 3", from the metadata the market was created with. */
function matchLabelOf(m: Market): string | null {
  const raw = (m.metadata as Record<string, unknown> | null)?.matchLabel;
  return typeof raw === "string" && raw ? raw : null;
}

// ── Matches ───────────────────────────────────────────────────────────────────

function MatchCard({
  m,
  onOpen,
  onBet,
  featured,
}: {
  m: Market;
  onOpen: (id: string) => void;
  onBet: (marketId: string, outcomeId: string) => void;
  featured?: boolean;
}) {
  const colors = [TEAL, SILVER, PINK];
  const outs = m.outcomes ?? [];
  const home = outs[0];
  const away = outs[outs.length - 1];
  const probs = outcomeShares(m);
  const pool =
    Number(m.totalPool) || outs.reduce((sum, o) => sum + Number(o.totalBetAmount ?? 0), 0);
  const closes = useClosesAt(m.bettingClosesAt ?? m.closesAt);
  const locked = m.status === "closed" || m.status === "resolving";
  const badge = featured
    ? "★ Featured"
    : m.status === "resolving"
      ? "Resolving…"
      : m.status === "closed"
        ? "Awaiting result"
        : (matchLabelOf(m) ?? "Nations League");

  return (
    <div
      onClick={() => onOpen(m.id)}
      role="button"
      tabIndex={0}
      // Only the card itself opens the market on Enter — a keyboard Enter on an
      // outcome button must place that bet, not also navigate away.
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) onOpen(m.id);
      }}
      style={{
        borderRadius: 16,
        overflow: "hidden",
        border: `1px solid ${featured ? `${GOLD}66` : `${TEAL}38`}`,
        background: NAVY,
        cursor: "pointer",
        height: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "8px 14px",
          background: featured ? `${GOLD}1f` : `${TEAL}14`,
        }}
      >
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 800,
            color: featured ? GOLD : SILVER,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {badge}
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 10.5,
            fontWeight: 700,
            color: SILVER,
            flexShrink: 0,
          }}
        >
          <Clock size={11} /> {closes}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          gap: 10,
          padding: "16px 16px 12px",
        }}
      >
        <div style={{ textAlign: "center", flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Flag src={home?.imageUrl ?? ""} label={home?.label ?? ""} size={46} />
          </div>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 800,
              color: "#fff",
              marginTop: 6,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {home?.label}
          </div>
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 900,
            color: SILVER,
            background: "rgba(255,255,255,0.06)",
            borderRadius: 8,
            padding: "4px 10px",
            flexShrink: 0,
          }}
        >
          VS
        </div>
        <div style={{ textAlign: "center", flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Flag src={away?.imageUrl ?? ""} label={away?.label ?? ""} size={46} />
          </div>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 800,
              color: "#fff",
              marginTop: 6,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {away?.label}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", height: 4 }}>
        {probs.map((p, i) => (
          <div
            key={i}
            style={{
              width: `${p}%`,
              background: i === 1 ? "rgba(159,179,205,0.5)" : colors[Math.min(i, 2)],
            }}
          />
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, padding: "12px 12px 14px" }}>
        {outs.map((o, i) => (
          <button
            key={o.id}
            type="button"
            disabled={locked}
            // Tapping a side stakes on that side directly; the surrounding card
            // still opens the full market.
            onClick={(e) => {
              e.stopPropagation();
              if (!locked) onBet(m.id, o.id);
            }}
            style={{
              flex: 1,
              minWidth: 0,
              padding: "10px 4px",
              background: `${colors[Math.min(i, 2)]}14`,
              border: `1px solid ${colors[Math.min(i, 2)]}55`,
              borderRadius: 11,
              textAlign: "center",
              cursor: locked ? "default" : "pointer",
              opacity: locked ? 0.6 : 1,
              font: "inherit",
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 900,
                color: i === 1 ? "#c8d2e0" : colors[Math.min(i, 2)],
                lineHeight: 1,
              }}
            >
              {probs[i]}%
            </div>
            <div style={{ marginTop: 4, fontSize: 9, fontWeight: 800, color: GOLD }}>
              {(() => {
                const od = calcOdds(m, o.id);
                return od.kind === "quote" ? `${od.multiple.toFixed(2)}x` : formatOdds(od);
              })()}
            </div>
          </button>
        ))}
      </div>

      <div style={{ padding: "0 14px 12px" }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: SILVER }}>
          Nu {pool.toLocaleString()} pool
        </span>
      </div>
    </div>
  );
}

function ResultCard({ m, onOpen }: { m: Market; onOpen: (id: string) => void }) {
  const outs = m.outcomes ?? [];
  const home = outs[0];
  const away = outs[outs.length - 1];
  const winner = outs.find(
    (o) => o.isWinner || (m.resolvedOutcomeId != null && o.id === m.resolvedOutcomeId),
  );
  const resultLabel = winner
    ? /draw/i.test(winner.label ?? "")
      ? "Draw"
      : `${winner.label} won`
    : "Awaiting result";
  const when = m.resolvedAt ?? m.bettingClosesAt ?? m.closesAt;
  const whenLabel = when
    ? new Date(when).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "";
  return (
    <div
      onClick={() => onOpen(m.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onOpen(m.id)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: NAVY,
        border: `1px solid ${TEAL}38`,
        borderRadius: 14,
        padding: "10px 12px",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
        <Flag src={home?.imageUrl ?? ""} label={home?.label ?? ""} size={30} />
        <div style={{ marginLeft: -8 }}>
          <Flag src={away?.imageUrl ?? ""} label={away?.label ?? ""} size={30} />
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#fff",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {home?.label} vs {away?.label}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(159,179,205,0.6)", marginTop: 2 }}>
          {whenLabel}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0, maxWidth: 130 }}>
        <div
          style={{
            display: "inline-block",
            fontSize: 9,
            fontWeight: 800,
            color: NAVY,
            background: WIN_GREEN,
            borderRadius: 6,
            padding: "3px 8px",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          FT
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: WIN_GREEN,
            marginTop: 3,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {resultLabel}
        </div>
      </div>
    </div>
  );
}

/**
 * Placeholder cards shown while the markets are still in flight.
 *
 * An empty list and a list that has not arrived yet look identical to a
 * component, and this hub reached for the same empty state for both — so a
 * full matchday read as "no upcoming matches" for as long as the request took.
 * A skeleton says "something is coming" without claiming how much.
 */
function MatchSkeletons({ count = 4 }: { count?: number }) {
  return (
    <div>
      <style>{`
        @keyframes unlSkel { 0%,100% { opacity: 0.35 } 50% { opacity: 0.6 } }
        @media (prefers-reduced-motion: reduce) { .unl-skel { animation: none !important } }
      `}</style>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))",
          gap: 12,
        }}
      >
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="unl-skel"
            aria-hidden
            style={{
              height: 168,
              borderRadius: 14,
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${TEAL}22`,
              animation: "unlSkel 1.4s ease-in-out infinite",
            }}
          />
        ))}
      </div>
      <span
        // Screen readers get the status; sighted users get the shapes.
        role="status"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
        }}
      >
        Loading matches
      </span>
    </div>
  );
}

function MatchesTab({
  matches,
  outrights,
  loading,
  previousLoaded,
  onShowPrevious,
  onOpen,
  onBet,
}: {
  matches: Market[];
  /** Admin-created season markets. Normally none — see TABS. */
  outrights: Market[];
  /** True until the first markets response lands — see {@link MatchSkeletons}. */
  loading: boolean;
  /** Whether the finished matches have been fetched yet. */
  previousLoaded: boolean;
  /** Asks the hub to fetch them. Called when Previous is opened. */
  onShowPrevious: () => void;
  onOpen: (id: string) => void;
  onBet: (marketId: string, outcomeId: string) => void;
}) {
  const [matchView, setMatchView] = useState<"upcoming" | "previous">("upcoming");
  const upcoming = matches.filter((m) => !isMatchFinal(m));
  const kickoffMs = (m: Market) => new Date(m.bettingClosesAt ?? m.closesAt ?? 0).getTime();
  const previous = matches.filter(isMatchFinal).sort((a, b) => kickoffMs(b) - kickoffMs(a));

  // Outrights lead when they exist, and take up no room at all when they do
  // not — which is the usual case, and the reason there is no Season tab.
  const outrightSection =
    outrights.length > 0 ? (
      <div style={{ marginBottom: 22 }}>
        <Heading>Season Outrights</Heading>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {outrights.map((m) => (
            <OutrightMarket key={m.id} market={m} onOpen={onOpen} onBet={onBet} />
          ))}
        </div>
      </div>
    ) : null;

  // Nothing has arrived yet. Deliberately checked BEFORE the empty state: the
  // two are indistinguishable from here, and guessing "empty" tells a viewer
  // the competition is not running when it is simply still loading.
  if (loading && upcoming.length === 0 && previous.length === 0) {
    return (
      <div>
        <Heading>Matches</Heading>
        <MatchSkeletons />
      </div>
    );
  }

  // Only once the history is in. Between international windows there are no
  // upcoming matches and `previous` is empty purely because nobody has asked
  // for it — returning here would hide the toggle and strand the results.
  if (previousLoaded && upcoming.length === 0 && previous.length === 0) {
    return (
      <div>
        {outrightSection}
        <Heading>Matches</Heading>
        <EmptyState>
          No Nations League match markets yet.
          <br />
          Markets are created from the fixture list as each international window
          approaches.
        </EmptyState>
      </div>
    );
  }

  return (
    <div>
      {outrightSection}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {(
          [
            ["upcoming", `Upcoming (${upcoming.length})`],
            // No count until they have been fetched. "Previous (0)" on a
            // competition with a played matchday is the same wrong answer the
            // skeletons were added to stop giving.
            ["previous", previousLoaded ? `Previous (${previous.length})` : "Previous"],
          ] as ["upcoming" | "previous", string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => {
              setMatchView(id);
              // Finished matches are the whole market history — 10.6MB against
              // 109KB for the live ones — so they are fetched here rather than
              // on every hub open, when most visits never ask for them.
              if (id === "previous") onShowPrevious();
            }}
            style={{
              padding: "6px 14px",
              borderRadius: 20,
              border: `1px solid ${matchView === id ? `${TEAL}80` : "rgba(255,255,255,0.12)"}`,
              background: matchView === id ? `${TEAL}24` : "transparent",
              color: matchView === id ? "#fff" : SILVER,
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
        upcoming.length === 0 ? (
          <EmptyState>
            No upcoming matches right now — check back when the next international
            window is scheduled.
          </EmptyState>
        ) : (
          (() => {
            const featured = upcoming.filter((m) => m.isFeatured);
            const featuredIds = new Set(featured.map((m) => m.id));
            const rest = upcoming.filter((m) => !featuredIds.has(m.id));
            return (
              <>
                {featured.length > 0 && (
                  <div style={{ display: "grid", gap: 12, marginBottom: 4 }}>
                    {featured.map((m) => (
                      <MatchCard key={m.id} m={m} onOpen={onOpen} onBet={onBet} featured />
                    ))}
                  </div>
                )}
                {groupByMatchday(rest, "Matchday").map((g) => (
                  <div key={g.key}>
                    <RoundHeading label={g.label} />
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))",
                        gap: 12,
                      }}
                    >
                      {g.markets.map((m) => (
                        <MatchCard key={m.id} m={m} onOpen={onOpen} onBet={onBet} />
                      ))}
                    </div>
                  </div>
                ))}
              </>
            );
          })()
        )
      ) : !previousLoaded ? (
        // The history is fetched on the tap that got us here, so the first
        // render of this view is always mid-request.
        <MatchSkeletons count={3} />
      ) : previous.length === 0 ? (
        <EmptyState>
          No finished matches yet.
          <br />
          Results appear here once an admin has resolved them.
        </EmptyState>
      ) : (
        groupByMatchday(previous, "Matchday").map((g) => (
          <div key={g.key}>
            <RoundHeading label={g.label} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {g.markets.map((m) => (
                <ResultCard key={m.id} m={m} onOpen={onOpen} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Groups ────────────────────────────────────────────────────────────────────

/**
 * One group's table.
 *
 * The zone stripe is indexed by ROW, never by the `position` field: positions
 * can repeat when teams are genuinely level, and a repeated position would
 * otherwise shift every band below it. Same rule as the EPL and UCL tables.
 */
function GroupTable({
  groupKey,
  rows,
  accent,
}: {
  groupKey: string;
  rows: UnlStandingRow[];
  accent: string;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 22,
            height: 22,
            borderRadius: 7,
            background: `${accent}24`,
            border: `1px solid ${accent}66`,
            color: accent,
            fontSize: 11,
            fontWeight: 900,
          }}
        >
          {groupKey}
        </span>
        <span style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>
          Group {groupKey}
        </span>
      </div>
      <div
        style={{
          overflowX: "auto",
          borderRadius: 14,
          border: `1px solid ${TEAL}33`,
          background: NAVY,
        }}
      >
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 460 }}
        >
          <thead>
            <tr
              style={{
                color: SILVER,
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              <th style={{ textAlign: "left", padding: "10px 6px 10px 12px", fontWeight: 800 }}>
                #
              </th>
              <th style={{ textAlign: "left", padding: "10px 6px", fontWeight: 800 }}>Team</th>
              {["MP", "W", "D", "L", "GF", "GA", "GD"].map((h) => (
                <th key={h} style={{ textAlign: "center", padding: "10px 4px", fontWeight: 800 }}>
                  {h}
                </th>
              ))}
              <th
                style={{
                  textAlign: "center",
                  padding: "10px 12px 10px 4px",
                  fontWeight: 900,
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                Pts
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              // Top of the group goes up (the finals in League A, promotion
              // below it); bottom of the group goes down. Everyone between
              // stays where they are.
              const stripe =
                i === 0 ? TEAL : i === rows.length - 1 && rows.length > 2 ? PINK : "transparent";
              return (
                <tr
                  key={`${row.teamName}-${i}`}
                  style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <td style={{ padding: "9px 6px 9px 0", borderLeft: `3px solid ${stripe}` }}>
                    <span style={{ paddingLeft: 9, fontWeight: 800, color: "rgba(255,255,255,0.7)" }}>
                      {i + 1}
                    </span>
                  </td>
                  <td style={{ padding: "9px 6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Flag src={row.teamBadge} label={row.teamName} size={22} />
                      <span style={{ fontWeight: 700, color: "#fff", whiteSpace: "nowrap" }}>
                        {row.teamName}
                      </span>
                    </div>
                  </td>
                  {[row.played, row.won, row.draw, row.lost, row.gf, row.ga, row.gd].map((v, j) => (
                    <td
                      key={j}
                      style={{
                        textAlign: "center",
                        padding: "9px 4px",
                        color: "rgba(255,255,255,0.6)",
                        fontWeight: 600,
                      }}
                    >
                      {v}
                    </td>
                  ))}
                  <td
                    style={{
                      textAlign: "center",
                      padding: "9px 12px 9px 4px",
                      fontWeight: 900,
                      color: "#fff",
                    }}
                  >
                    {row.points}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GroupsTab({ standings }: { standings: UnlStandings | null }) {
  const groups = standings?.groups ?? [];

  if (groups.length === 0) {
    return (
      <div>
        <Heading>Groups</Heading>
        <EmptyState>
          The group tables appear once the draw has been entered.
        </EmptyState>
      </div>
    );
  }

  const byKey = new Map(groups.map((g) => [g.groupKey.toUpperCase(), g]));
  // Anything outside A–N still gets shown, under its own heading, rather than
  // silently dropped — a group that exists in the database and nowhere on the
  // screen is the harder bug to notice.
  const placed = new Set(TIERS.flatMap((t) => t.groups));
  const strays = groups.filter((g) => !placed.has(g.groupKey.toUpperCase()));

  return (
    <div>
      {TIERS.map((tier) => {
        const present = tier.groups.filter((k) => byKey.has(k));
        if (present.length === 0) return null;
        return (
          <div key={tier.label} style={{ marginBottom: 6 }}>
            <div
              style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0 12px" }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: tier.color,
                  whiteSpace: "nowrap",
                }}
              >
                {tier.label}
              </span>
              <div style={{ flex: 1, height: 1, background: `${tier.color}44` }} />
            </div>
            {present.map((k) => (
              <GroupTable
                key={k}
                groupKey={k}
                rows={byKey.get(k)!.table}
                accent={tier.color}
              />
            ))}
          </div>
        );
      })}

      {strays.map((g) => (
        <GroupTable key={g.groupKey} groupKey={g.groupKey} rows={g.table} accent={SILVER} />
      ))}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 14,
          marginTop: 4,
          fontSize: 10,
          color: SILVER,
          fontWeight: 600,
        }}
      >
        <span>
          <span style={{ color: TEAL }}>▎</span> Group winner
        </span>
        <span>
          <span style={{ color: PINK }}>▎</span> Relegation
        </span>
        {standings?.updatedAt && (
          <span style={{ marginLeft: "auto" }}>
            Updated{" "}
            {new Date(standings.updatedAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Stats ─────────────────────────────────────────────────────────────────────

type StatRow = {
  player: string;
  clubShort: string;
  crest: string;
  /** Null when the row came from a market outcome rather than a leaderboard. */
  value: number | null;
};

type StatBoard = {
  id: StatCat;
  label: string;
  heading: string;
  icon: React.ReactNode;
  accent: string;
  rows: StatRow[];
  market?: Market;
  /** True when `rows` were derived from the market because no board exists yet. */
  fromMarket: boolean;
};

const STAT_DEFS: {
  id: StatCat;
  label: string;
  heading: string;
  icon: React.ReactNode;
  accent: string;
}[] = [
  {
    id: "goals",
    label: "Goals",
    heading: "Top Scorer This Campaign?",
    icon: <Goal size={14} />,
    accent: TEAL,
  },
  {
    id: "assists",
    label: "Assists",
    heading: "Most Assists This Campaign?",
    icon: <Handshake size={14} />,
    accent: GOLD,
  },
];

// Normalises player names so a leaderboard name can match a market outcome —
// by full name or last name. Same pair the EPL and UCL hubs use.
const normName = (s: string) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
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

function StatsTab({
  boards,
  onBet,
}: {
  boards: StatBoard[];
  onBet: (marketId: string, outcomeId: string) => void;
}) {
  const [cat, setCat] = useState<StatCat>("goals");
  const active = boards.find((c) => c.id === cat) ?? boards[0];

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: 4,
          background: PANEL,
          border: `1px solid ${TEAL}33`,
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

      {active.market ? (
        <div style={{ fontSize: 11, color: SILVER, marginTop: -4, marginBottom: 12 }}>
          Tap a player to predict · Nu {Number(active.market.totalPool).toLocaleString()} pool
        </div>
      ) : (
        <div style={{ fontSize: 11, color: SILVER, marginTop: -4, marginBottom: 12 }}>
          Betting opens once the market is live.
        </div>
      )}

      {active.rows.length === 0 ? (
        <EmptyState>
          No leaderboard yet.
          <br />
          The Nations League has no live stats feed — these boards are published by
          hand once the campaign is underway.
        </EmptyState>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {active.rows.map((s, i) => {
            const market = active.market;
            const outcome = market ? findStatOutcome(market, s.player) : undefined;
            const odds = market && outcome ? calcOdds(market, outcome.id) : null;
            const bettable = !!(market && outcome);
            return (
              <div
                key={`${s.player}-${i}`}
                onClick={bettable ? () => onBet(market!.id, outcome!.id) : undefined}
                role={bettable ? "button" : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  padding: "11px 13px",
                  borderRadius: 12,
                  background: NAVY,
                  border: `1px solid ${bettable ? `${active.accent}44` : `${TEAL}29`}`,
                  cursor: bettable ? "pointer" : "default",
                }}
              >
                <span
                  style={{
                    width: 18,
                    fontSize: 13,
                    fontWeight: 900,
                    color: i === 0 ? active.accent : SILVER,
                    textAlign: "center",
                  }}
                >
                  {i + 1}
                </span>
                <Flag src={s.crest} label={s.player} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: "#fff" }}>{s.player}</div>
                  {s.clubShort && (
                    <div style={{ fontSize: 11, color: SILVER, marginTop: 1 }}>{s.clubShort}</div>
                  )}
                </div>
                {s.value !== null && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      color: active.accent,
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ display: "inline-flex" }}>{active.icon}</span>
                    <span style={{ fontSize: 16, fontWeight: 900 }}>{s.value}</span>
                  </div>
                )}
                {odds !== null && odds.kind === "quote" && (
                  <span
                    style={{
                      flexShrink: 0,
                      padding: "4px 8px",
                      borderRadius: 8,
                      background: `${active.accent}1f`,
                      color: active.accent,
                      fontSize: 11.5,
                      fontWeight: 900,
                    }}
                  >
                    {odds.multiple.toFixed(2)}x
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {active.fromMarket && (
        <div style={{ marginTop: 10, fontSize: 10.5, color: SILVER, lineHeight: 1.5 }}>
          Showing the market's contenders — the live leaderboard is published
          separately once the campaign is underway.
        </div>
      )}
    </div>
  );
}

// ── Outrights ────────────────────────────────────────────────────────────────

/** An outright market with its contenders inline, favourite first. */
function OutrightMarket({
  market,
  onOpen,
  onBet,
}: {
  market: Market;
  onOpen: (id: string) => void;
  onBet: (marketId: string, outcomeId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const VISIBLE = 5;
  const locked = market.status === "closed" || market.status === "resolving";
  const when = useClosesAt(market.bettingClosesAt ?? market.closesAt);

  // Share is computed off the ORIGINAL outcome order, so resolve each row's
  // win% by id after sorting the display list by pool.
  const shareByIndex = outcomeShares(market);
  const originalOrder = market.outcomes ?? [];
  const shareOf = (id: string) => {
    const idx = originalOrder.findIndex((o) => o.id === id);
    return idx >= 0 ? shareByIndex[idx] : 0;
  };
  const outcomes = [...originalOrder].sort(
    (a, b) => Number(b.totalBetAmount ?? 0) - Number(a.totalBetAmount ?? 0),
  );
  const shown = expanded ? outcomes : outcomes.slice(0, VISIBLE);

  return (
    <div
      style={{
        background: NAVY,
        border: `1px solid ${GOLD}47`,
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      <div
        onClick={() => onOpen(market.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onOpen(market.id)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "11px 14px",
          background: `${GOLD}1a`,
          cursor: "pointer",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, minWidth: 0 }}>
          <Trophy size={15} color={GOLD} style={{ flexShrink: 0 }} />
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 800,
              color: "#fff",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {market.title}
          </span>
        </span>
        {locked ? (
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              color: GOLD,
              background: `${GOLD}24`,
              border: `1px solid ${GOLD}4d`,
              borderRadius: 6,
              padding: "3px 8px",
              textTransform: "uppercase",
              flexShrink: 0,
            }}
          >
            {market.status === "resolving" ? "Resolving" : "Closed"}
          </span>
        ) : when ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              fontSize: 10,
              fontWeight: 700,
              color: SILVER,
              flexShrink: 0,
            }}
          >
            <Clock size={10} /> {when}
          </span>
        ) : null}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 12 }}>
        {shown.map((o) => (
          <div
            key={o.id}
            onClick={() => onOpen(market.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 10px",
              borderRadius: 12,
              background: `${TEAL}0f`,
              border: `1px solid ${TEAL}2b`,
              cursor: "pointer",
            }}
          >
            <Flag src={o.imageUrl ?? ""} label={o.label} size={34} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 800,
                  color: "#fff",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {o.label}
              </div>
              <div style={{ fontSize: 10.5, color: SILVER, fontWeight: 600, marginTop: 1 }}>
                Nu {Number(o.totalBetAmount ?? 0).toLocaleString()} pool
              </div>
            </div>
            <div style={{ textAlign: "center", minWidth: 46, flexShrink: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: TEAL, lineHeight: 1 }}>
                {shareOf(o.id)}%
              </div>
              <div
                style={{
                  fontSize: 8.5,
                  color: SILVER,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  marginTop: 2,
                }}
              >
                win
              </div>
              {(() => {
                const od = calcOdds(market, o.id);
                return od.kind === "quote" ? (
                  <div style={{ fontSize: 9, fontWeight: 800, color: GOLD, marginTop: 3 }}>
                    {od.multiple.toFixed(2)}x
                  </div>
                ) : null;
              })()}
            </div>
            {!locked && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onBet(market.id, o.id);
                }}
                style={{
                  background: TEAL,
                  color: "#04211c",
                  border: "none",
                  borderRadius: 9,
                  padding: "7px 12px",
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                Predict
              </button>
            )}
          </div>
        ))}
        {outcomes.length > VISIBLE && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            style={{
              marginTop: 2,
              padding: "9px 0",
              background: `${TEAL}1a`,
              border: `1px solid ${TEAL}40`,
              borderRadius: 12,
              color: TEAL,
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {expanded ? "Show less" : `Show all ${outcomes.length} contenders`}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Hub ───────────────────────────────────────────────────────────────────────

export function NationsLeagueHubPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<UnlTab>("matches");
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  /** Finished matches — null until someone opens Previous. */
  const [finished, setFinished] = useState<Market[] | null>(null);
  const finishedReq = useRef(false);
  const [standings, setStandings] = useState<UnlStandings | null>(null);
  const [liveStats, setLiveStats] = useState<UnlStats | null>(null);
  const [season, setSeason] = useState<UnlSeason | null>(null);
  const [activeBet, setActiveBet] = useState<{ marketId: string; outcomeId: string } | null>(
    null,
  );

  const loadMarkets = useCallback(() => {
    // Live markets only. Everything this hub shows by default is a match that
    // has not finished, and the live list is ~109KB against 10.6MB for the
    // whole table — a finished market is never deleted, so the rest is years
    // of history that only the Previous tab ever renders.
    return getMarkets(undefined, { scope: "live" })
      .then((d) => setMarkets(d.filter((m) => m.status !== "cancelled")))
      .catch(() => {})
      // Cleared on failure too: a request that errored is not still loading,
      // and leaving the skeletons up forever is a worse lie than the empty
      // state they were added to prevent.
      .finally(() => setLoading(false));
  }, []);

  /** Finished matches, fetched once, the first time Previous is opened. */
  const loadFinished = useCallback(() => {
    if (finishedReq.current) return;
    // Latched before the request so a double-tap cannot start it twice.
    finishedReq.current = true;
    getMarkets()
      .then((d) =>
        setFinished(
          d.filter((m) => m.status === "resolved" || m.status === "settled"),
        ),
      )
      .catch(() => {
        finishedReq.current = false;
      });
  }, []);


  useEffect(() => {
    loadMarkets();
    getUnlStandings().then(setStandings).catch(() => {});
    getUnlStats().then(setLiveStats).catch(() => {});
    getUnlSeason().then(setSeason).catch(() => {});
  }, [loadMarkets]);

  const sub = (m: Market) => (m.subcategory ?? "").toLowerCase();
  const STAT_SUBS = Object.values(STAT_SUBCAT);

  // Live markets, plus the finished ones once they have been asked for.
  const allMarkets = useMemo(
    () => (finished ? [...markets, ...finished] : markets),
    [markets, finished],
  );

  // Match markets, soonest kickoff first.
  const matchMarkets = allMarkets
    .filter((m) => sub(m) === MATCH_SUB)
    .sort((a, b) => {
      const ka = new Date(a.bettingClosesAt ?? a.closesAt ?? 0).getTime();
      const kb = new Date(b.bettingClosesAt ?? b.closesAt ?? 0).getTime();
      return ka - kb;
    });

  const statMarket = (cat: StatCat): Market | undefined =>
    allMarkets.find((m) => sub(m) === STAT_SUBCAT[cat]);

  /**
   * Board rows: the published leaderboard where one exists, the market's own
   * contenders otherwise.
   *
   * The fallback is the difference from the EPL and UCL hubs, and it exists
   * because this competition has no feed to eventually fill the board in. With
   * a strict leaderboard-only rule a live stat market would render as an empty
   * state — a market taking bets that nobody could see, let alone place one on.
   */
  const boardFor = (cat: StatCat): { rows: StatRow[]; fromMarket: boolean } => {
    const live = liveStats?.[cat] ?? [];
    if (live.length > 0) {
      return {
        rows: live.map((e) => ({
          player: e.player,
          clubShort: e.club,
          crest: e.face || e.faceBackup || e.clubBadge,
          value: e.value,
        })),
        fromMarket: false,
      };
    }
    const market = statMarket(cat);
    if (!market) return { rows: [], fromMarket: false };
    return {
      rows: [...(market.outcomes ?? [])]
        .sort((a, b) => Number(b.totalBetAmount ?? 0) - Number(a.totalBetAmount ?? 0))
        .map((o) => ({
          player: o.label,
          clubShort: "",
          crest: o.imageUrl ?? "",
          // No number, rather than a zero: nobody has scored nil goals, and
          // printing "0" next to a name would read as a published stat.
          value: null,
        })),
      fromMarket: true,
    };
  };

  const boards: StatBoard[] = STAT_DEFS.map((c) => {
    const { rows, fromMarket } = boardFor(c.id);
    return { ...c, rows, market: statMarket(c.id), fromMarket };
  });

  // Anything else in this competition: an admin-created outright, still open.
  const outrightMarkets = allMarkets.filter(
    (m) =>
      isUnlMarket(m) &&
      sub(m) !== MATCH_SUB &&
      !STAT_SUBS.includes(sub(m)) &&
      (m.status === "open" || m.status === "upcoming"),
  );

  const openMarket = (id: string) => navigate(`/market/${id}`);
  const openBet = (marketId: string, outcomeId: string) =>
    setActiveBet({ marketId, outcomeId });
  const activeBetMarket = activeBet
    ? (allMarkets.find((m) => m.id === activeBet.marketId) ?? null)
    : null;

  return (
    <Page>
      <div style={{ minHeight: "100vh", background: BG }}>
        {/* ── Masthead ── */}
        <div
          style={{
            position: "relative",
            background: BG,
            borderBottom: `1px solid ${TEAL}40`,
          }}
        >
          {/*
            The thin banner, at its own aspect ratio so none of it is cropped —
            it is 8.9:1, and forcing it into a tall masthead would cut the
            wordmark in half. `minHeight` takes over on narrow screens, where
            the natural height would fall under 80px and the lettering would be
            unreadable; there it crops the side colour blocks instead, which the
            centred artwork survives.
          */}
          <img
            src="/unl-hub-banner.webp"
            alt="UEFA Nations League"
            decoding="async"
            style={{
              display: "block",
              width: "100%",
              height: "auto",
              minHeight: 86,
              objectFit: "cover",
              objectPosition: "center",
            }}
          />

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

        </div>

        {/* Stat strip — below the banner rather than over it, because the strip
            artwork has no dead space to sit on. Counts come from the API rather
            than being hardcoded: this competition's field is entered by hand and
            can change. */}
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "14px 16px 0" }}>
          <div
            style={{
              display: "flex",
              gap: 12,
            }}
          >
            {[
              { v: season ? String(season.teamCount) : "—", l: "Nations" },
              { v: season ? String(season.groupCount) : "—", l: "Groups" },
              { v: String(matchMarkets.length), l: "Markets" },
            ].map((s) => (
              <div
                key={s.l}
                style={{
                  flex: 1,
                  textAlign: "center",
                  background: "rgba(5,15,31,0.72)",
                  backdropFilter: "blur(4px)",
                  borderRadius: 12,
                  padding: "10px 4px",
                  border: "1px solid rgba(255,255,255,0.06)",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: "#fff",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {s.v}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.55)",
                    fontWeight: 600,
                    marginTop: 2,
                  }}
                >
                  {s.l}
                </div>
              </div>
            ))}
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
              border: `1px solid ${TEAL}33`,
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
                    background: active
                      ? `linear-gradient(180deg, ${TEAL} 0%, ${TEAL_DIM} 100%)`
                      : "transparent",
                    color: active ? "#04211c" : SILVER,
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

          {tab === "matches" && (
            <MatchesTab
              matches={matchMarkets}
              outrights={outrightMarkets}
              loading={loading}
              previousLoaded={finished !== null}
              onShowPrevious={loadFinished}
              onOpen={openMarket}
              onBet={openBet}
            />
          )}
          {tab === "groups" && <GroupsTab standings={standings} />}
          {tab === "stats" && <StatsTab boards={boards} onBet={openBet} />}
        </div>

        {/* ── Bet sheet — opened by tapping an outcome ── */}
        {activeBetMarket && activeBet && (
          <TmaBetModal
            isOpen={true}
            onClose={() => setActiveBet(null)}
            market={activeBetMarket}
            outcomeId={activeBet.outcomeId}
            onSuccess={() => {
              setActiveBet(null);
              loadMarkets(); // refresh pools/percentages after a stake
            }}
            onFailure={(e: string) => console.error(e)}
            onGoToWallet={() => navigate("/wallet")}
          />
        )}
      </div>
    </Page>
  );
}
