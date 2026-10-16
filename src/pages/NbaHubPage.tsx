import { NbaHubCover } from "@shared/components/NbaBanner";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  ChevronRight,
  Clock,
  ListOrdered,
  Radio,
  Star,
  Trophy,
  Zap,
} from "lucide-react";
import "./NbaHubPage.css";
import { SegmentDisplay } from "@shared/components/SegmentDisplay";
import { Page } from "@/components/Page";
import { TmaBetModal } from "@/components/TmaBetModal";
import { calcOdds, calcProb, formatOdds } from "@/lib/hubs/worldCup";
import {
  candidateName,
  chanceOf,
  findOutcome,
} from "@/components/GroupedMarketCard";
import { NBA_THEME, NbaLogo, isNbaMarket, nbaGameIdOf } from "@/lib/hubs/nba";
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

// ── Theme: the court banner's palette ─────────────────────────────────────────
const BG = NBA_THEME.ink;
const NAVY = NBA_THEME.card;
const PANEL = NBA_THEME.panel;
const SILVER = NBA_THEME.muted;
const GOLD = NBA_THEME.amber;
const AMBER = NBA_THEME.amber;
const TEAL = NBA_THEME.teal;
const PLAYOFF = AMBER;
const PLAYIN = TEAL;
const DISPLAY: React.CSSProperties = {
  fontFamily: NBA_THEME.display,
  fontStyle: "italic",
  letterSpacing: "-0.02em",
};

type NbaTab = "season" | "matches" | "standings";
const TABS: { id: NbaTab; label: string; icon: React.ReactNode }[] = [
  { id: "matches", label: "Matches", icon: <BasketballIcon /> },
  { id: "season", label: "Season", icon: <Trophy size={16} /> },
  { id: "standings", label: "Standings", icon: <ListOrdered size={16} /> },
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

// ── Small pieces ──────────────────────────────────────────────────────────────
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

// ── Matches tab ───────────────────────────────────────────────────────────────
/** "Lakers" from "Los Angeles Lakers", for an older backend without short names. */
const shortOf = (t: NbaGame["home"]) =>
  t.shortName || t.name.split(" ").slice(-1)[0] || t.abbr;

type Outcome = NonNullable<Market["outcomes"]>[number];
interface Side {
  team: NbaGame["home"];
  outcome: Outcome | undefined;
  pct: number;
  /** Null while the pool is too thin to quote a multiple. */
  odds: string | null;
}

/** formatOdds' "—" (nothing to quote yet) as null, so it can be left out. */
const quoted = (text: string) => (text === "—" ? null : text);

/** The two prediction sides, away first, matched to outcomes by team name. */
function sidesOf(game: NbaGame, market: Market | null): Side[] | null {
  const outs = market?.outcomes ?? [];
  if (!market || outs.length === 0) return null;
  const byName = (name: string) =>
    outs.find(
      (o) => o.label.trim().toLowerCase() === name.trim().toLowerCase(),
    );
  return [game.away, game.home].map((team) => {
    const outcome = byName(team.name);
    return {
      team,
      outcome,
      pct: outcome ? Math.round(calcProb(market, outcome.id) * 100) : 0,
      odds:
        (outcome && quoted(formatOdds(calcOdds(market, outcome.id)))) || null,
    };
  });
}

/** Enter or Space on a focused card opens it, as a click does. */
const openKeys = (open: () => void) => (e: React.KeyboardEvent) => {
  if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
    e.preventDefault();
    open();
  }
};

function BasketballIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 2.5v19M2.5 12h19" />
      <path d="M5.3 5.3a9.5 9.5 0 0 1 0 13.4M18.7 5.3a9.5 9.5 0 0 0 0 13.4" />
    </svg>
  );
}

function Section({
  icon,
  title,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  action?: { label: string; onClick: () => void } | null;
  children: React.ReactNode;
}) {
  return (
    <section className="nbah-section">
      <div className="nbah-section__head">
        <span className="nbah-section__icon">{icon}</span>
        <h2 className="nbah-section__title">{title}</h2>
        {action && (
          <button
            type="button"
            className="nbah-section__action"
            onClick={action.onClick}
          >
            {action.label} <ChevronRight size={15} aria-hidden />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function BetButton({
  side,
  tone,
  filled = false,
  stacked = false,
  showPct = true,
  canBet,
  onBet,
}: {
  side: Side;
  tone: "away" | "home";
  filled?: boolean;
  stacked?: boolean;
  showPct?: boolean;
  canBet: boolean;
  onBet: (outcomeId: string) => void;
}) {
  const { outcome } = side;
  if (!outcome) return <span className="nbah-bet nbah-bet--empty" />;
  return (
    <button
      type="button"
      className={[
        "nbah-bet",
        `nbah-bet--${tone}`,
        filled && "nbah-bet--filled",
        stacked && "nbah-bet--stacked",
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={!canBet}
      onClick={(e) => {
        e.stopPropagation();
        if (canBet) onBet(outcome.id);
      }}
    >
      <span className="nbah-bet__name">{shortOf(side.team)}</span>
      <span className="nbah-bet__meta">
        {showPct ? (
          <>
            <span>{side.pct}%</span>
            <i aria-hidden />
            <span>{side.odds ?? "—"}</span>
          </>
        ) : (
          // Rows show the odds alone; until there are any, the chance.
          <span>{side.odds ?? `${side.pct}%`}</span>
        )}
      </span>
    </button>
  );
}

/** Tip-off as a scoreboard clock: "5:00" in segments, "AM" beside it. */
function ClockTime({ iso }: { iso: string }) {
  const [clock, ...rest] = timeOf(iso).split(/\s/);
  return (
    <div className="nbah-feat__time">
      <SegmentDisplay value={clock} />
      <span className="nbah-feat__ampm">{rest.join(" ")}</span>
    </div>
  );
}

function FeaturedTeam({ team }: { team: NbaGame["home"] }) {
  return (
    <div className="nbah-feat__team">
      <NbaLogo src={team.logo} abbr={team.abbr} size={64} />
      <div className="nbah-feat__name">{shortOf(team)}</div>
      {team.record && <div className="nbah-feat__record">({team.record})</div>}
    </div>
  );
}

function FeaturedGame({
  game,
  market,
  pinned,
  onOpen,
  onBet,
}: {
  game: NbaGame;
  market: Market | null;
  pinned: boolean;
  onOpen: (id: string) => void;
  onBet: (marketId: string, outcomeId: string) => void;
}) {
  const closes = useClosesAt(market?.bettingClosesAt ?? game.tipoff);
  const live = game.state === "in";
  const final = game.state === "post";
  const sides = sidesOf(game, market);
  const canBet = market?.status === "open";
  const open = market ? () => onOpen(market.id) : undefined;

  const status = live
    ? `Live · ${game.statusDetail}`
    : final
      ? game.statusDetail || "Final"
      : canBet
        ? "Open for prediction"
        : market
          ? "Predictions closed"
          : "Opens closer to tip-off";

  return (
    <div
      className={`nbah-feat${market ? " nbah-card--link" : ""}`}
      onClick={open}
      role={market ? "button" : undefined}
      tabIndex={market ? 0 : undefined}
      onKeyDown={open ? openKeys(open) : undefined}
    >
      <div className="nbah-feat__main">
        <div className="nbah-feat__tags">
          <span className="nbah-badge">{pinned ? "★ Featured" : "Featured"}</span>
          <span className="nbah-feat__season">
            {seasonLabel(game.seasonType)}
          </span>
        </div>
        <div className="nbah-feat__match">
          <FeaturedTeam team={game.away} />
          <div className="nbah-feat__center">
            {live || final ? (
              <>
                <div className="nbah-feat__score">
                  {game.away.score ?? "–"}
                  <span>–</span>
                  {game.home.score ?? "–"}
                </div>
                <div
                  className={
                    live ? "nbah-feat__when nbah-live-text" : "nbah-feat__when"
                  }
                >
                  {game.statusDetail || "Final"}
                </div>
              </>
            ) : (
              <>
                <div className="nbah-feat__vs">VS</div>
                <ClockTime iso={game.tipoff} />
                <div className="nbah-feat__when">
                  {dayLabel(dayKey(game.tipoff))}
                </div>
              </>
            )}
          </div>
          <FeaturedTeam team={game.home} />
        </div>
        {sides && !final && market && (
          <div className="nbah-feat__bets">
            <BetButton
              side={sides[0]}
              tone="away"
              filled
              canBet={canBet}
              onBet={(o) => onBet(market.id, o)}
            />
            <BetButton
              side={sides[1]}
              tone="home"
              filled
              canBet={canBet}
              onBet={(o) => onBet(market.id, o)}
            />
          </div>
        )}
      </div>

      <aside className="nbah-feat__side">
        <div
          className={`nbah-chip${live ? " nbah-chip--live" : canBet ? " nbah-chip--open" : ""}`}
        >
          {live ? <Radio size={15} /> : <Zap size={15} />}
          <span>{status}</span>
        </div>
        {sides && (
          <div className="nbah-feat__odds">
            {sides.map((s, i) => (
              <div key={s.team.id} className="nbah-feat__odd">
                <div className="nbah-feat__odd-name">
                  <span
                    className={`nbah-dot nbah-dot--${i ? "home" : "away"}`}
                    aria-hidden
                  />
                  {shortOf(s.team)}
                </div>
                <div className="nbah-feat__odd-pct">{s.pct}%</div>
                <div className="nbah-feat__odd-x">
                  {s.odds ?? "—"}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="nbah-feat__foot">
          {market ? (
            <>
              <span>Nu {poolOf(market).toLocaleString()} pool</span>
              {canBet && closes && (
                <span>
                  <Clock size={11} aria-hidden /> {closes}
                </span>
              )}
            </>
          ) : (
            <span>Prediction opens closer to tip-off</span>
          )}
        </div>
      </aside>
    </div>
  );
}

function LiveGame({
  game,
  market,
  onOpen,
  onBet,
}: {
  game: NbaGame;
  market: Market | null;
  onOpen: (id: string) => void;
  onBet: (marketId: string, outcomeId: string) => void;
}) {
  const sides = sidesOf(game, market);
  const canBet = market?.status === "open";
  const open = market ? () => onOpen(market.id) : undefined;
  const team = (t: NbaGame["home"], home: boolean) => (
    <div className={`nbah-live__team${home ? " nbah-live__team--home" : ""}`}>
      <NbaLogo src={t.logo} abbr={t.abbr} size={38} />
      <div className="nbah-live__text">
        <div className="nbah-live__name">{shortOf(t)}</div>
        <div className="nbah-live__score">{t.score ?? "–"}</div>
      </div>
    </div>
  );
  return (
    <div
      className={`nbah-live${market ? " nbah-card--link" : ""}`}
      onClick={open}
      role={market ? "button" : undefined}
      tabIndex={market ? 0 : undefined}
      onKeyDown={open ? openKeys(open) : undefined}
    >
      <div className="nbah-live__teams">
        {team(game.away, false)}
        <div className="nbah-live__clock nbah-live-text">
          {game.statusDetail}
        </div>
        {team(game.home, true)}
      </div>
      {sides && market && (
        <div className="nbah-live__bets">
          <BetButton
            side={sides[0]}
            tone="away"
            stacked
            canBet={canBet}
            onBet={(o) => onBet(market.id, o)}
          />
          <BetButton
            side={sides[1]}
            tone="home"
            stacked
            canBet={canBet}
            onBet={(o) => onBet(market.id, o)}
          />
        </div>
      )}
    </div>
  );
}

function GameRow({
  game,
  market,
  onOpen,
  onBet,
}: {
  game: NbaGame;
  market: Market | null;
  onOpen: (id: string) => void;
  onBet: (marketId: string, outcomeId: string) => void;
}) {
  const final = game.state === "post";
  const sides = sidesOf(game, market);
  const canBet = market?.status === "open";
  const open = market ? () => onOpen(market.id) : undefined;
  const team = (t: NbaGame["home"], side: "away" | "home", lost: boolean) => (
    <span
      className={`nbah-row__team nbah-row__team--${side}${lost ? " nbah-row__team--lost" : ""}`}
    >
      <NbaLogo src={t.logo} abbr={t.abbr} size={30} />
      <span className="nbah-row__name">{shortOf(t)}</span>
    </span>
  );

  const status = final
    ? null
    : canBet
      ? { cls: "open", text: "Open" }
      : market
        ? market.status === "closed" || market.status === "resolving"
          ? { cls: "closed", text: "Awaiting result" }
          : { cls: "closed", text: "Closed" }
        : game.statusName !== "STATUS_SCHEDULED"
          ? { cls: "closed", text: game.statusDetail }
          : { cls: "soon", text: "Opens soon" };

  return (
    <div
      className={`nbah-row${market ? " nbah-card--link" : ""}`}
      onClick={open}
      role={market ? "button" : undefined}
      tabIndex={market ? 0 : undefined}
      onKeyDown={open ? openKeys(open) : undefined}
    >
      <div className="nbah-row__match">
        {team(game.away, "away", final && game.home.winner)}
        <span className="nbah-row__mid">
          {final ? (
            <>
              <b>
                {game.away.score ?? "–"} – {game.home.score ?? "–"}
              </b>
              <small>{game.statusDetail || "Final"}</small>
            </>
          ) : (
            timeOf(game.tipoff)
          )}
        </span>
        {team(game.home, "home", final && game.away.winner)}
      </div>
      <div className="nbah-row__aside">
        {status && (
          <span className={`nbah-row__status nbah-row__status--${status.cls}`}>
            <i aria-hidden />
            {status.text}
          </span>
        )}
        {final ? (
          <>
            <span className="nbah-row__pool">
              {market
                ? `Nu ${poolOf(market).toLocaleString()} pool`
                : "No market"}
            </span>
            {/* Phones put each score beside its team; wide screens use the middle. */}
            {[game.away, game.home].map((t, i) => (
              <span
                key={t.id}
                className={`nbah-row__score nbah-row__score--${i ? "home" : "away"}${t.winner ? " nbah-row__score--won" : ""}`}
              >
                {t.score ?? "–"}
              </span>
            ))}
          </>
        ) : (
          sides &&
          market && (
            <div className="nbah-row__bets">
              <BetButton
                side={sides[0]}
                tone="away"
                stacked
                showPct={false}
                canBet={canBet}
                onBet={(o) => onBet(market.id, o)}
              />
              <BetButton
                side={sides[1]}
                tone="home"
                stacked
                showPct={false}
                canBet={canBet}
                onBet={(o) => onBet(market.id, o)}
              />
            </div>
          )
        )}
      </div>
    </div>
  );
}

/** "Fri, Oct 17", led by Today / Tomorrow / Yesterday when it is one. */
function dayHeading(key: string): string {
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${key}T00:00:00Z`));
  const near = dayLabel(key);
  return /^(Today|Tomorrow|Yesterday)$/.test(near) ? `${near} · ${date}` : date;
}

function DayGroup({
  day,
  games,
  row,
}: {
  day: string;
  games: NbaGame[];
  row: (g: NbaGame) => React.ReactNode;
}) {
  return (
    <div className="nbah-day">
      <div className="nbah-day__head">{dayHeading(day)}</div>
      {games.map(row)}
    </div>
  );
}

const DAYS_SHOWN = 3;

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
  const [allLive, setAllLive] = useState(false);
  const [allDays, setAllDays] = useState(false);
  const [allResults, setAllResults] = useState(false);

  // Pinned by an admin (the same flag the football hubs use for their featured
  // slot) and kept there while live; otherwise the next game open for
  // prediction. Never repeated in the sections below.
  const pinned = games.find(
    (g) => g.state !== "post" && !!marketFor(g)?.isFeatured,
  );
  const featured =
    pinned ??
    games.find((g) => g.state === "pre" && marketFor(g)?.status === "open");
  const notFeatured = (g: NbaGame) => g.id !== featured?.id;
  const live = games.filter((g) => g.state === "in" && notFeatured(g));
  const upcoming = games.filter((g) => g.state === "pre" && notFeatured(g));
  const results = games.filter((g) => g.state === "post").reverse();

  const byDay = (list: NbaGame[]) => {
    const groups = new Map<string, NbaGame[]>();
    for (const g of list) {
      const k = dayKey(g.tipoff);
      groups.set(k, [...(groups.get(k) ?? []), g]);
    }
    return [...groups.entries()];
  };
  const upcomingDays = byDay(upcoming);
  const resultDays = byDay(results);

  const row = (g: NbaGame) => (
    <GameRow
      key={g.id}
      game={g}
      market={marketFor(g)}
      onOpen={onOpen}
      onBet={onBet}
    />
  );
  const toggle = (
    count: number,
    shown: number,
    on: boolean,
    set: (v: boolean) => void,
  ) =>
    count > shown
      ? { label: on ? "Show less" : "View all", onClick: () => set(!on) }
      : null;

  if (loading && games.length === 0) return <Skeletons />;

  return (
    <div>
      {featured && (
        <Section icon={<Star size={18} fill="currentColor" />} title="Featured Game">
          <FeaturedGame
            game={featured}
            market={marketFor(featured)}
            pinned={featured === pinned}
            onOpen={onOpen}
            onBet={onBet}
          />
        </Section>
      )}

      {live.length > 0 && (
        <Section
          icon={<span className="nbah-live-dot" aria-hidden />}
          title="Live Games"
          action={toggle(live.length, 1, allLive, setAllLive)}
        >
          <div className={allLive ? "nbah-live-grid" : "nbah-live-rail"}>
            {live.map((g) => (
              <LiveGame
                key={g.id}
                game={g}
                market={marketFor(g)}
                onOpen={onOpen}
                onBet={onBet}
              />
            ))}
          </div>
        </Section>
      )}

      <Section
        icon={<CalendarDays size={18} />}
        title="Upcoming Games"
        action={toggle(upcomingDays.length, DAYS_SHOWN, allDays, setAllDays)}
      >
        {upcomingDays.length > 0 ? (
          (allDays ? upcomingDays : upcomingDays.slice(0, DAYS_SHOWN)).map(
            ([day, list]) => (
              <DayGroup key={day} day={day} games={list} row={row} />
            ),
          )
        ) : (
          <EmptyState>
            {live.length || featured
              ? "No more games scheduled this week."
              : "No games in the next week."}
          </EmptyState>
        )}
      </Section>

      {results.length > 0 && (
        <Section
          icon={<Trophy size={18} />}
          title="Recent Results"
          action={toggle(resultDays.length, 1, allResults, setAllResults)}
        >
          {(allResults ? resultDays : resultDays.slice(0, 1)).map(
            ([day, list]) => (
              <DayGroup key={day} day={day} games={list} row={row} />
            ),
          )}
        </Section>
      )}
    </div>
  );
}

// ── Season tab ────────────────────────────────────────────────────────────────
/** Season-long markets: any NBA market that is not a single game. */
const isSeasonMarket = (m: Market) =>
  (m.subcategory ?? "").toLowerCase() !== "nba-match" && !nbaGameIdOf(m);

const poolOf = (m: Market) =>
  Number(m.totalPool) ||
  (m.outcomes ?? []).reduce((sum, o) => sum + Number(o.totalBetAmount ?? 0), 0);

interface SeasonRow {
  key: string;
  label: string;
  logo: string | null | undefined;
  pct: number;
  odds: ReturnType<typeof calcOdds>;
  pool: number;
  /** Null when this row cannot be bet on right now. */
  onPredict: (() => void) | null;
}

/**
 * One season market, whichever way it was built: a normal market whose
 * outcomes are the teams, or a group of Yes/No markets, one per team. Rows
 * arrive ranked; the card shows the top five with the rest behind a toggle.
 */
function SeasonCard({
  title,
  pool,
  closesAt,
  status,
  rows,
  onOpen,
}: {
  title: string;
  pool: number;
  closesAt: string | null | undefined;
  status: Market["status"];
  rows: SeasonRow[];
  onOpen: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const closes = useClosesAt(closesAt);
  const canBet = status === "open";
  const VISIBLE = 5;
  const shown = expanded ? rows : rows.slice(0, VISIBLE);

  return (
    <div
      style={{
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.1)",
        background: NAVY,
      }}
    >
      <div
        onClick={onOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target === e.currentTarget) onOpen();
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "12px 14px",
          background: `radial-gradient(ellipse at 100% 0%, ${NBA_THEME.amberHot}30 0%, transparent 60%), rgba(255,255,255,0.03)`,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          cursor: "pointer",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              ...DISPLAY,
              fontSize: 19,
              lineHeight: 1.05,
              color: "#fff",
            }}
          >
            {title}
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 10.5,
              fontWeight: 700,
              color: SILVER,
            }}
          >
            Nu {pool.toLocaleString()} pool
          </div>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            flexShrink: 0,
            fontSize: 10,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: canBet ? NBA_THEME.amberSoft : SILVER,
          }}
        >
          {canBet ? (
            <>
              <Clock size={11} /> {closes}
            </>
          ) : status === "resolving" ? (
            "Result proposed"
          ) : (
            "Closed"
          )}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {shown.map((r, i) => (
          <div
            key={r.key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              borderTop: i ? "1px solid rgba(255,255,255,0.06)" : "none",
            }}
          >
            <div
              style={{
                ...DISPLAY,
                width: 20,
                textAlign: "center",
                fontSize: 15,
                color: SILVER,
                flexShrink: 0,
              }}
            >
              {i + 1}
            </div>
            <NbaLogo
              src={r.logo}
              abbr={r.label.split(" ").pop() ?? r.label}
              size={32}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: "#fff",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {r.label}
              </div>
              <div
                style={{
                  marginTop: 5,
                  height: 3,
                  borderRadius: 2,
                  background: "rgba(255,255,255,0.08)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${r.pct}%`,
                    height: "100%",
                    background: i === 0 ? AMBER : TEAL,
                  }}
                />
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0, minWidth: 48 }}>
              <div
                style={{
                  ...DISPLAY,
                  fontSize: 18,
                  color: "#fff",
                  lineHeight: 1,
                }}
              >
                {r.pct}%
              </div>
              <div
                style={{
                  marginTop: 3,
                  fontSize: 9.5,
                  fontWeight: 800,
                  color: GOLD,
                }}
              >
                {formatOdds(r.odds)}
              </div>
            </div>
            {r.onPredict && (
              <button
                type="button"
                onClick={r.onPredict}
                style={{
                  flexShrink: 0,
                  border: "none",
                  borderRadius: 7,
                  padding: "8px 12px",
                  background: AMBER,
                  color: NBA_THEME.onAmber,
                  fontSize: 11,
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Predict
              </button>
            )}
          </div>
        ))}
      </div>

      {rows.length > VISIBLE && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            width: "100%",
            padding: "10px 0",
            border: "none",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,182,109,0.06)",
            color: NBA_THEME.amberSoft,
            fontSize: 11.5,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {expanded ? "Show less" : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}

/** A normal season market: its outcomes are the rows, favourite first. */
function singleRows(
  market: Market,
  onBet: (marketId: string, outcomeId: string) => void,
): SeasonRow[] {
  const open = market.status === "open";
  return [...(market.outcomes ?? [])]
    .sort(
      (a, b) =>
        Number(b.totalBetAmount ?? 0) - Number(a.totalBetAmount ?? 0) ||
        calcProb(market, b.id) - calcProb(market, a.id),
    )
    .map((o) => ({
      key: o.id,
      label: o.label,
      logo: o.imageUrl,
      pct: Math.round(calcProb(market, o.id) * 100),
      odds: calcOdds(market, o.id),
      pool: Number(o.totalBetAmount ?? 0),
      onPredict: open ? () => onBet(market.id, o.id) : null,
    }));
}

/**
 * A group: one Yes/No market per option. Each row is an option's own market,
 * showing its Yes chance; Predict backs Yes on that option. Backing No is on
 * the group page the header opens.
 */
function groupRows(
  members: Market[],
  onBet: (marketId: string, outcomeId: string) => void,
): SeasonRow[] {
  return members
    .map((m) => {
      const yes = findOutcome(m, "yes");
      return {
        key: m.id,
        label: candidateName(m),
        logo: m.imageUrl ?? yes?.imageUrl,
        pct: Math.round(chanceOf(m, yes)),
        odds: yes ? calcOdds(m, yes.id) : calcOdds(m, ""),
        pool: poolOf(m),
        onPredict:
          yes && m.status === "open" ? () => onBet(m.id, yes.id) : null,
      };
    })
    .sort((a, b) => b.pct - a.pct || b.pool - a.pool);
}

function SeasonTab({
  markets,
  onOpen,
  onOpenGroup,
  onBet,
}: {
  markets: Market[];
  onOpen: (id: string) => void;
  onOpenGroup: (groupId: string) => void;
  onBet: (marketId: string, outcomeId: string) => void;
}) {
  const season = markets.filter(isSeasonMarket);
  // Group members collapse into one card, placed where the first member sat.
  const cards: React.ReactNode[] = [];
  const seenGroups = new Set<string>();
  for (const m of season) {
    if (!m.groupId) {
      cards.push(
        <SeasonCard
          key={m.id}
          title={m.title}
          pool={poolOf(m)}
          closesAt={m.bettingClosesAt ?? m.closesAt}
          status={m.status}
          rows={singleRows(m, onBet)}
          onOpen={() => onOpen(m.id)}
        />,
      );
      continue;
    }
    if (seenGroups.has(m.groupId)) continue;
    seenGroups.add(m.groupId);
    const members = season.filter((x) => x.groupId === m.groupId);
    const groupId = m.groupId;
    cards.push(
      <SeasonCard
        key={groupId}
        title={m.groupTitle ?? m.title.split("—")[0].trim()}
        pool={members.reduce((sum, x) => sum + poolOf(x), 0)}
        closesAt={m.bettingClosesAt ?? m.closesAt}
        // The group is open while any of its markets is.
        status={members.some((x) => x.status === "open") ? "open" : m.status}
        rows={groupRows(members, onBet)}
        onOpen={() => onOpenGroup(groupId)}
      />,
    );
  }

  if (cards.length === 0)
    return (
      <div style={{ marginTop: 14 }}>
        <EmptyState>
          <div style={{ fontSize: 22, marginBottom: 6 }}>🏆</div>
          Season predictions are coming soon.
          <br />
          NBA Champion · Conference winners · MVP
        </EmptyState>
      </div>
    );
  return <div style={{ display: "grid", gap: 14, marginTop: 14 }}>{cards}</div>;
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
              background: conf === i ? AMBER : "transparent",
              color: conf === i ? NBA_THEME.onAmber : SILVER,
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
  const tabsRef = useRef<HTMLDivElement>(null);
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

  // The cover's counters all lead to the game list.
  const showMatches = () => {
    setTab("matches");
    tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const activeBetMarket = activeBet
    ? (markets.find((m) => m.id === activeBet.marketId) ?? null)
    : null;

  return (
    <Page>
      <div style={{ minHeight: "100vh", background: BG }}>
        <NbaHubCover
          onBack={() => navigate(-1)}
          stats={[
            {
              label: "Games today",
              value: gamesLoading ? "–" : String(todayCount),
              onClick: showMatches,
            },
            {
              label: "Live now",
              value: gamesLoading ? "–" : String(liveCount),
              live: liveCount > 0,
              onClick: showMatches,
            },
            {
              label: "Open markets",
              value: String(openCount),
              onClick: showMatches,
            },
          ]}
        />

        <div
          style={{
            maxWidth: 860,
            margin: "0 auto",
            padding: "18px 16px 120px",
          }}
        >
          <div ref={tabsRef} className="nbah-tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={`nbah-tab${tab === t.id ? " nbah-tab--active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
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
          {tab === "season" && (
            <SeasonTab
              markets={markets}
              onOpen={(id) => navigate(`/market/${id}`)}
              onOpenGroup={(groupId) => navigate(`/group/${groupId}`)}
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
