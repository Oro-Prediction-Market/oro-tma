import { NbaBanner } from "@shared/components/NbaBanner";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Clock, ListOrdered, Star } from "lucide-react";
import { Page } from "@/components/Page";
import { TmaBetModal } from "@/components/TmaBetModal";
import { calcOdds, calcProb, formatOdds } from "@/lib/hubs/worldCup";
import {
  NBA_BLUE,
  NBA_RED,
  NbaLogo,
  isNbaMarket,
  nbaGameIdOf,
} from "@/lib/hubs/nba";
import type {
  Market,
  NbaGame,
  NbaStandings,
  NbaStandingRow,
} from "@shared/api/client";
import { getMarkets, getNbaGames, getNbaStandings } from "@shared/api/client";

/**
 * NBA hub: the schedule with live scores, and the conference standings.
 *
 * Unlike the football hubs, the match list is built from the SCHEDULE
 * (/nba/games, from ESPN), not from markets: every game shows, with its live
 * score, and the ones that have a market carry the prediction buttons. Markets
 * are joined to games by the ESPN id the backend stored on them
 * (`metadata.espnGameId`). Games further out than the market window show
 * without one until it opens.
 *
 * NBA convention throughout: away team on the left, "@", home on the right.
 */

// ── Theme ─────────────────────────────────────────────────────────────────────
const BG = "#070b1a";
const NAVY = "#0d1530";
const PANEL = "#121d3d";
const SILVER = "#a9b4cf";
const GOLD = "#e8c766";
const LIVE = "#ff4d5e";
const PLAYOFF = "#3ddc97";
const PLAYIN = GOLD;

type NbaTab = "matches" | "standings";
const TABS: { id: NbaTab; label: string; icon: React.ReactNode }[] = [
  { id: "matches", label: "Matches", icon: <CalendarDays size={14} /> },
  { id: "standings", label: "Standings", icon: <ListOrdered size={14} /> },
];

// ── Time, in Bhutan ───────────────────────────────────────────────────────────
const TZ = "Asia/Thimphu";
const dayKey = (iso: string | Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));
const timeOf = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));

function dayLabel(key: string): string {
  const today = dayKey(new Date());
  const tomorrow = dayKey(new Date(Date.now() + 86_400_000));
  const yesterday = dayKey(new Date(Date.now() - 86_400_000));
  if (key === today) return "Today";
  if (key === tomorrow) return "Tomorrow";
  if (key === yesterday) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${key}T00:00:00Z`));
}

const seasonLabel = (t: number) =>
  t === 1
    ? "Preseason"
    : t === 5
      ? "Play-In"
      : t === 3
        ? "Playoffs"
        : "Regular Season";

const dateTimeOf = (iso: string) => `${dayLabel(dayKey(iso))} · ${timeOf(iso)}`;

/**
 * "3d 5h" / "5h 12m" / "12m" until tip-off, refreshed each minute. Same hook
 * and shape as the EPL and UCL hubs' (kept private there too).
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

// Two-up on wide screens, one-up on phones: the EPL and UCL match grid.
const GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))",
  gap: 12,
};

// ── Small pieces ──────────────────────────────────────────────────────────────
function Heading({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        margin: "18px 0 10px",
      }}
    >
      <Star size={13} color={NBA_RED} fill={NBA_RED} />
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
      <div
        style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }}
      />
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "22px 16px",
        borderRadius: 14,
        border: `1px dashed ${SILVER}55`,
        background: "rgba(255,255,255,0.03)",
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

function Skeletons() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            height: 150,
            borderRadius: 16,
            background: NAVY,
            border: "1px solid rgba(255,255,255,0.06)",
            opacity: 0.6,
          }}
        />
      ))}
    </div>
  );
}

// ── Game card ─────────────────────────────────────────────────────────────────
function TeamBlock({
  team,
  showScore,
  dim,
  big = false,
}: {
  team: NbaGame["home"];
  showScore: boolean;
  dim: boolean;
  big?: boolean;
}) {
  return (
    <div
      style={{
        textAlign: "center",
        flex: 1,
        minWidth: 0,
        opacity: dim ? 0.55 : 1,
      }}
    >
      <div style={{ display: "flex", justifyContent: "center" }}>
        <NbaLogo src={team.logo} abbr={team.abbr} size={big ? 56 : 44} />
      </div>
      <div
        style={{
          fontSize: big ? 15 : 12.5,
          fontWeight: 800,
          color: "#fff",
          marginTop: 6,
          // The featured card has room for two lines, so long names
          // ("Golden State Warriors") wrap there instead of being cut off.
          ...(big
            ? { lineHeight: 1.2 }
            : {
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }),
        }}
      >
        {team.name}
      </div>
      {showScore && (
        <div
          style={{
            fontSize: 26,
            fontWeight: 900,
            color: "#fff",
            marginTop: 2,
            lineHeight: 1.1,
          }}
        >
          {team.score ?? "–"}
        </div>
      )}
    </div>
  );
}

function GameCard({
  game,
  market,
  onOpen,
  onBet,
  featured = false,
}: {
  game: NbaGame;
  market: Market | null;
  onOpen: (id: string) => void;
  onBet: (marketId: string, outcomeId: string) => void;
  /** Admin-pinned: full width, gold accent, bigger crests, date and countdown. */
  featured?: boolean;
}) {
  const countdown = useClosesAt(featured ? game.tipoff : null);
  const live = game.state === "in";
  const final = game.state === "post";
  const showScore = live || final;
  const awayWon = final && game.away.winner;
  const homeWon = final && game.home.winner;

  // Buttons follow the on-screen order (away, home), matched to outcomes by name.
  const outs = market?.outcomes ?? [];
  const byName = (name: string) =>
    outs.find(
      (o) => o.label.trim().toLowerCase() === name.trim().toLowerCase(),
    );
  const sides = [
    { team: game.away, outcome: byName(game.away.name), color: NBA_BLUE },
    { team: game.home, outcome: byName(game.home.name), color: NBA_RED },
  ];
  const canBet = market?.status === "open";
  const pool =
    Number(market?.totalPool) ||
    outs.reduce((sum, o) => sum + Number(o.totalBetAmount ?? 0), 0);

  const status = live ? (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        color: LIVE,
      }}
    >
      <span
        style={{ width: 6, height: 6, borderRadius: "50%", background: LIVE }}
        aria-hidden
      />
      LIVE · {game.statusDetail}
    </span>
  ) : final ? (
    <span style={{ color: SILVER }}>{game.statusDetail || "Final"}</span>
  ) : game.statusName !== "STATUS_SCHEDULED" ? (
    <span style={{ color: GOLD }}>{game.statusDetail}</span>
  ) : (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        color: featured ? GOLD : SILVER,
      }}
    >
      <Clock size={11} /> {featured ? countdown : timeOf(game.tipoff)}
    </span>
  );

  return (
    <div
      onClick={market ? () => onOpen(market.id) : undefined}
      role={market ? "button" : undefined}
      tabIndex={market ? 0 : undefined}
      onKeyDown={
        market
          ? (e) => {
              if (e.key === "Enter" && e.target === e.currentTarget)
                onOpen(market.id);
            }
          : undefined
      }
      style={{
        borderRadius: 16,
        overflow: "hidden",
        border: `1px solid ${live ? `${LIVE}66` : featured ? "rgba(232,199,102,0.45)" : "rgba(255,255,255,0.1)"}`,
        background: featured
          ? `radial-gradient(ellipse at 85% 0%, ${NBA_RED}55 0%, transparent 55%), radial-gradient(ellipse at 10% 100%, ${NBA_BLUE}aa 0%, transparent 60%), ${NAVY}`
          : NAVY,
        cursor: market ? "pointer" : "default",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "8px 14px",
          background: featured
            ? "rgba(232,199,102,0.12)"
            : "rgba(255,255,255,0.04)",
          fontSize: 10.5,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        <span style={{ color: featured ? GOLD : SILVER, whiteSpace: "nowrap" }}>
          {featured ? "★ Featured Match" : seasonLabel(game.seasonType)}
        </span>
        <span style={{ whiteSpace: "nowrap" }}>{status}</span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          gap: 10,
          padding: featured ? "18px 16px 14px" : "14px 16px 12px",
        }}
      >
        <TeamBlock
          team={game.away}
          showScore={showScore}
          dim={homeWon}
          big={featured}
        />
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <div
            style={{
              display: "inline-block",
              fontSize: featured ? 18 : 13,
              fontWeight: 900,
              color: featured ? "#fff" : SILVER,
              background: "rgba(255,255,255,0.06)",
              borderRadius: 8,
              padding: "4px 10px",
            }}
          >
            @
          </div>
          {featured && !showScore && (
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "rgba(255,255,255,0.6)",
                marginTop: 6,
                whiteSpace: "nowrap",
              }}
            >
              {dateTimeOf(game.tipoff)}
            </div>
          )}
        </div>
        <TeamBlock
          team={game.home}
          showScore={showScore}
          dim={awayWon}
          big={featured}
        />
      </div>

      {market && outs.length > 0 && !final && (
        <div style={{ display: "flex", gap: 8, padding: "0 12px 12px" }}>
          {sides.map(({ team, outcome, color }) => {
            if (!outcome) return <div key={team.id} style={{ flex: 1 }} />;
            const pct = Math.round(calcProb(market, outcome.id) * 100);
            const od = calcOdds(market, outcome.id);
            return (
              <button
                key={team.id}
                type="button"
                disabled={!canBet}
                onClick={(e) => {
                  e.stopPropagation();
                  if (canBet) onBet(market.id, outcome.id);
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "9px 4px",
                  background: `${color}26`,
                  border: `1px solid ${color}88`,
                  borderRadius: 11,
                  textAlign: "center",
                  cursor: canBet ? "pointer" : "default",
                  opacity: canBet ? 1 : 0.6,
                  font: "inherit",
                }}
              >
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 900,
                    color: "#fff",
                    lineHeight: 1,
                  }}
                >
                  {pct}%
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 9.5,
                    fontWeight: 800,
                    color: GOLD,
                  }}
                >
                  {team.abbr} ·{" "}
                  {od.kind === "quote"
                    ? `${od.multiple.toFixed(2)}x`
                    : formatOdds(od)}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div
        style={{
          marginTop: "auto",
          padding: "0 14px 12px",
          fontSize: 10.5,
          fontWeight: 700,
          color: SILVER,
        }}
      >
        {market
          ? market.status === "open"
            ? `Nu ${pool.toLocaleString()} pool`
            : market.status === "closed" || market.status === "resolving"
              ? `Nu ${pool.toLocaleString()} pool · awaiting result`
              : `Nu ${pool.toLocaleString()} pool`
          : game.state === "pre"
              ? "Prediction opens closer to tip-off"
              : ""}
      </div>
    </div>
  );
}

// ── Matches tab ───────────────────────────────────────────────────────────────
function MatchesTab({
  games,
  loading,
  marketFor,
  onOpen,
  onBet,
}: {
  games: NbaGame[];
  loading: boolean;
  marketFor: (g: NbaGame) => Market | null;
  onOpen: (id: string) => void;
  onBet: (marketId: string, outcomeId: string) => void;
}) {
  const [view, setView] = useState<"upcoming" | "results">("upcoming");
  // Pinned by an admin (the same flag the football hubs use for their
  // featured slot): shown first as a full-width card, kept there while the
  // game is live, and not repeated under Live or its day.
  const isFeatured = (g: NbaGame) =>
    g.state !== "post" && !!marketFor(g)?.isFeatured;
  const featured = games.filter(isFeatured);
  const live = games.filter((g) => g.state === "in" && !isFeatured(g));
  const upcoming = games.filter((g) => g.state === "pre" && !isFeatured(g));
  const results = games.filter((g) => g.state === "post").reverse();

  const byDay = (list: NbaGame[]) => {
    const groups = new Map<string, NbaGame[]>();
    for (const g of list) {
      const k = dayKey(g.tipoff);
      groups.set(k, [...(groups.get(k) ?? []), g]);
    }
    return [...groups.entries()];
  };

  const card = (g: NbaGame) => (
    <GameCard
      key={g.id}
      game={g}
      market={marketFor(g)}
      onOpen={onOpen}
      onBet={onBet}
    />
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
        {(["upcoming", "results"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            style={{
              padding: "7px 14px",
              borderRadius: 20,
              border: `1px solid ${view === v ? NBA_RED : "rgba(255,255,255,0.12)"}`,
              background: view === v ? `${NBA_RED}33` : "transparent",
              color: view === v ? "#fff" : SILVER,
              fontSize: 11.5,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {v === "upcoming" ? "Upcoming" : "Results"}
          </button>
        ))}
      </div>

      {loading && games.length === 0 ? (
        <div style={{ marginTop: 14 }}>
          <Skeletons />
        </div>
      ) : view === "upcoming" ? (
        <>
          {featured.length > 0 && (
            <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
              {featured.map((g) => (
                <GameCard
                  key={g.id}
                  game={g}
                  market={marketFor(g)}
                  onOpen={onOpen}
                  onBet={onBet}
                  featured
                />
              ))}
            </div>
          )}
          {live.length > 0 && (
            <>
              <Heading>Live now</Heading>
              <div style={GRID}>{live.map(card)}</div>
            </>
          )}
          {byDay(upcoming).map(([day, list]) => (
            <div key={day}>
              <Heading>{dayLabel(day)}</Heading>
              <div style={GRID}>{list.map(card)}</div>
            </div>
          ))}
          {live.length === 0 &&
            upcoming.length === 0 &&
            featured.length === 0 && (
              <div style={{ marginTop: 14 }}>
                <EmptyState>No games in the next week.</EmptyState>
              </div>
            )}
        </>
      ) : results.length > 0 ? (
        byDay(results).map(([day, list]) => (
          <div key={day}>
            <Heading>{dayLabel(day)}</Heading>
            <div style={GRID}>{list.map(card)}</div>
          </div>
        ))
      ) : (
        <div style={{ marginTop: 14 }}>
          <EmptyState>No finished games since yesterday.</EmptyState>
        </div>
      )}
    </div>
  );
}

// ── Standings tab ─────────────────────────────────────────────────────────────
function StandingsTable({
  rows,
  seeded,
}: {
  rows: NbaStandingRow[];
  seeded: boolean;
}) {
  return (
    <div
      style={{
        overflowX: "auto",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.1)",
        background: NAVY,
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 12,
          minWidth: 440,
        }}
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
            <th
              style={{
                textAlign: "left",
                padding: "10px 6px 10px 12px",
                fontWeight: 800,
              }}
            >
              #
            </th>
            <th
              style={{
                textAlign: "left",
                padding: "10px 6px",
                fontWeight: 800,
              }}
            >
              Team
            </th>
            {["W", "L", "PCT", "GB", "L10", "STRK"].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: "center",
                  padding: "10px 4px",
                  fontWeight: 800,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const seed = row.seed || i + 1;
            // 1-6 go straight to the playoffs, 7-10 to the play-in. Before
            // the season there are no seeds, and no stripes: they would claim
            // a ranking that does not exist yet.
            const stripe = !seeded
              ? "transparent"
              : seed <= 6
                ? PLAYOFF
                : seed <= 10
                  ? PLAYIN
                  : "transparent";
            return (
              <tr
                key={row.teamId}
                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
              >
                <td
                  style={{
                    padding: "9px 6px 9px 0",
                    borderLeft: `3px solid ${stripe}`,
                  }}
                >
                  <span
                    style={{
                      paddingLeft: 9,
                      fontWeight: 800,
                      color: "rgba(255,255,255,0.7)",
                    }}
                  >
                    {seeded ? seed : "–"}
                  </span>
                </td>
                <td style={{ padding: "9px 6px" }}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <NbaLogo src={row.logo} abbr={row.abbr} size={22} />
                    <span
                      style={{
                        fontWeight: 700,
                        color: "#fff",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.team}
                    </span>
                  </div>
                </td>
                {[row.w, row.l, row.pct, row.gb, row.l10, row.streak].map(
                  (v, j) => (
                    <td
                      key={j}
                      style={{
                        textAlign: "center",
                        padding: "9px 4px",
                        color: j < 2 ? "#fff" : "rgba(255,255,255,0.6)",
                        fontWeight: j < 2 ? 800 : 600,
                      }}
                    >
                      {v}
                    </td>
                  ),
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StandingsTab({ standings }: { standings: NbaStandings | null }) {
  const [conf, setConf] = useState(0);
  if (!standings) return <Skeletons />;
  if (!standings.conferences.length)
    return <EmptyState>Standings are not available right now.</EmptyState>;
  const shown =
    standings.conferences[Math.min(conf, standings.conferences.length - 1)];
  const seeded = shown.table.some((r) => r.seed > 0);
  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 4,
          padding: 4,
          background: PANEL,
          borderRadius: 12,
          marginBottom: 14,
        }}
      >
        {standings.conferences.map((c, i) => (
          <button
            key={c.name}
            type="button"
            onClick={() => setConf(i)}
            style={{
              flex: 1,
              padding: "8px 4px",
              borderRadius: 9,
              border: "none",
              cursor: "pointer",
              background:
                conf === i ? (i === 0 ? NBA_BLUE : NBA_RED) : "transparent",
              color: conf === i ? "#fff" : SILVER,
              fontSize: 11.5,
              fontWeight: 800,
            }}
          >
            {c.name.replace(" Conference", "")}
          </button>
        ))}
      </div>
      <StandingsTable rows={shown.table} seeded={seeded} />
      {!seeded && (
        <div
          style={{
            marginTop: 10,
            fontSize: 11.5,
            color: SILVER,
            lineHeight: 1.5,
          }}
        >
          The regular season tips off on 20 October. Seeds and the playoff
          picture fill in as games are played.
        </div>
      )}
      <div
        style={{
          display: seeded ? "flex" : "none",
          gap: 16,
          marginTop: 10,
          fontSize: 10.5,
          color: SILVER,
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 10,
              height: 10,
              background: PLAYOFF,
              borderRadius: 2,
            }}
          />
          Playoffs
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 10,
              height: 10,
              background: PLAYIN,
              borderRadius: 2,
            }}
          />
          Play-In
        </span>
      </div>
    </div>
  );
}

// ── Hub ───────────────────────────────────────────────────────────────────────
export function NbaHubPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<NbaTab>("matches");
  const [games, setGames] = useState<NbaGame[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [standings, setStandings] = useState<NbaStandings | null>(null);
  const [activeBet, setActiveBet] = useState<{
    marketId: string;
    outcomeId: string;
  } | null>(null);

  const loadGames = useCallback(
    () =>
      getNbaGames()
        .then(setGames)
        .catch(() => {})
        .finally(() => setGamesLoading(false)),
    [],
  );
  const loadMarkets = useCallback(
    () =>
      getMarkets(undefined, { scope: "live" })
        .then((d) =>
          setMarkets(
            d.filter((m) => isNbaMarket(m) && m.status !== "cancelled"),
          ),
        )
        .catch(() => {}),
    [],
  );

  useEffect(() => {
    loadGames();
    loadMarkets();
    getNbaStandings()
      .then(setStandings)
      .catch(() => setStandings({ updatedAt: "", season: 0, conferences: [] }));
  }, [loadGames, loadMarkets]);

  // Live scores: refresh every minute while a game is on and the app is visible.
  const anyLive = games.some((g) => g.state === "in");
  useEffect(() => {
    if (!anyLive) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") loadGames();
    }, 60_000);
    return () => clearInterval(id);
  }, [anyLive, loadGames]);

  const marketByGame = useMemo(() => {
    const map = new Map<string, Market>();
    for (const m of markets) {
      const id = nbaGameIdOf(m);
      if (id) map.set(id, m);
    }
    return map;
  }, [markets]);
  const marketFor = useCallback(
    (g: NbaGame) => marketByGame.get(g.id) ?? null,
    [marketByGame],
  );

  const today = dayKey(new Date());
  const todayCount = games.filter((g) => dayKey(g.tipoff) === today).length;
  const liveCount = games.filter((g) => g.state === "in").length;
  const openCount = markets.filter((m) => m.status === "open").length;

  const activeBetMarket = activeBet
    ? (markets.find((m) => m.id === activeBet.marketId) ?? null)
    : null;

  return (
    <Page>
      <div style={{ minHeight: "100vh", background: BG }}>
        <NbaBanner variant="hub" showCta={false} onBack={() => navigate(-1)} />

        <div
          style={{ maxWidth: 860, margin: "0 auto", padding: "14px 16px 0" }}
        >
          <div style={{ display: "flex", gap: 12 }}>
            {[
              { v: String(todayCount), l: "Games today" },
              { v: String(liveCount), l: "Live now" },
              { v: String(openCount), l: "Open markets" },
            ].map((s) => (
              <div
                key={s.l}
                style={{
                  flex: 1,
                  textAlign: "center",
                  background: NAVY,
                  borderRadius: 12,
                  padding: "10px 4px",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>
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

        <div
          style={{
            maxWidth: 860,
            margin: "0 auto",
            padding: "18px 16px 120px",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 4,
              padding: 4,
              background: PANEL,
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 14,
              marginBottom: 14,
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
                      ? `linear-gradient(180deg, ${NBA_RED} 0%, #8f0b21 100%)`
                      : "transparent",
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

          {tab === "matches" && (
            <MatchesTab
              games={games}
              loading={gamesLoading}
              marketFor={marketFor}
              onOpen={(id) => navigate(`/market/${id}`)}
              onBet={(marketId, outcomeId) =>
                setActiveBet({ marketId, outcomeId })
              }
            />
          )}
          {tab === "standings" && <StandingsTab standings={standings} />}
        </div>

        {activeBetMarket && activeBet && (
          <TmaBetModal
            isOpen={true}
            onClose={() => setActiveBet(null)}
            market={activeBetMarket}
            outcomeId={activeBet.outcomeId}
            onSuccess={() => {
              setActiveBet(null);
              loadMarkets(); // refresh pools and percentages after a stake
            }}
            onFailure={(e: string) => console.error(e)}
            onGoToWallet={() => navigate("/wallet")}
          />
        )}
      </div>
    </Page>
  );
}
