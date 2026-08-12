import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getMarkets, type Market, type Outcome } from "@shared/api/client";
import {
  Clock,
  Swords,
  Crosshair,
  Skull,
  Castle,
  Flame,
  Gamepad2,
  Target,
  Sword,
  Crown,
  Trophy,
} from "lucide-react";
import { TmaBetModal } from "@/components/TmaBetModal";
import { Page } from "@/components/Page";
import { LoadingScreen } from "@shared/components/LoadingScreen";
import { isWCMarket, calcProb, calcOdds } from "./WorldCupHubPage";
import { isBplMarket, isDrawOutcome } from "./BplHubPage";
import { isUfcMarket } from "./UfcHubPage";
import { isEplMarket } from "./EplHubPage";
import { useMarketSocket } from "@/hooks/useMarketSocket";
import {
  hasToken,
  looksEsports,
  isEsportsFinal,
} from "@shared/helpers/esportsKeywords";
import { EsportsWordmark } from "@shared/components/EsportsWordmark";
import {
  EWC,
  NotchTile,
  notch,
  DISPLAY_FONT,
} from "@shared/components/EsportsUi";

// ── Categories ────────────────────────────────────────────────────────────────
// Two kinds of category live here:
//   • presets — the disciplines and headline game titles below
//   • admin-defined — any other `subcategory` typed into the admin market form
//     on a `gaming` market becomes its own category, keyed `sub:<slug>`
// `tags` match the admin subcategory (bare or `esports-` prefixed); `games` are
// whole-word title/description tokens used to bucket a claimed market.

export type EsportsCategoryKey = string;

type EsportsCategory = {
  key: EsportsCategoryKey;
  label: string;
  Icon: typeof Swords;
  tags: string[];
  games: string[];
};

export const ESPORTS_CATEGORIES: EsportsCategory[] = [
  {
    key: "mlbb",
    label: "MLBB",
    Icon: Sword,
    tags: ["mlbb", "ml", "mobile-legends", "mobilelegends"],
    games: [
      "mobile legends",
      "mobile legends: bang bang",
      "mlbb",
      "mpl",
      "m6 world championship",
      "msc",
    ],
  },
  {
    key: "pubg",
    label: "PUBG",
    Icon: Target,
    tags: ["pubg", "pubgm", "bgmi", "pubg-mobile"],
    games: [
      "pubg",
      "pubg mobile",
      "pubg: battlegrounds",
      "pubgm",
      "bgmi",
      "pmgc",
      "pmsl",
    ],
  },
  {
    key: "dota2",
    label: "Dota 2",
    Icon: Swords,
    tags: ["dota", "dota2", "dota-2"],
    games: ["dota", "dota 2", "the international", "ti"],
  },
  {
    key: "lol",
    label: "League of Legends",
    Icon: Crown,
    tags: ["lol", "league-of-legends", "leagueoflegends", "league"],
    games: [
      "league of legends",
      "lol",
      "lck",
      "lec",
      "lpl",
      "lcs",
      "worlds",
      "msi",
    ],
  },
  {
    key: "cod",
    label: "Call of Duty",
    Icon: Crosshair,
    tags: ["cod", "call-of-duty", "warzone", "cdl"],
    games: [
      "call of duty",
      "cod",
      "cdl",
      "warzone",
      "modern warfare",
      "black ops",
    ],
  },
  {
    key: "ea-fc",
    label: "EA FC Pro",
    Icon: Trophy,
    tags: ["ea-fc", "eafc", "fc-pro", "ea-sports-fc", "fifa"],
    games: [
      "ea fc",
      "ea sports fc",
      "fc pro",
      "fc 26",
      "fc26",
      "fc 25",
      "fc25",
      "fifa",
    ],
  },
  {
    key: "street-fighter",
    label: "Street Fighter",
    Icon: Flame,
    tags: ["street-fighter", "streetfighter", "sf6", "sf"],
    games: ["street fighter", "sf6", "sfv", "sf 6"],
  },
  {
    key: "tekken",
    label: "Tekken 8",
    Icon: Skull,
    tags: ["tekken", "tekken8", "tekken-8"],
    games: ["tekken", "tekken 8", "tekken8"],
  },
  {
    key: "chess",
    label: "Chess",
    Icon: Castle,
    tags: ["chess"],
    games: ["chess", "fide", "grand chess tour", "candidates tournament"],
  },
  { key: "other", label: "Other", Icon: Gamepad2, tags: [], games: [] },
];

// Subcategories too generic to deserve their own chip — they fall through to
// title-keyword bucketing instead
const GENERIC_TAGS = [
  "esports",
  "esport",
  "e-sports",
  "gaming",
  "egaming",
  "game",
  "games",
  "match",
  "tournament",
  "event",
];

// Legacy guard: the `gaming` enum value is the renamed `politics` value
// (RenamePoliticsToGaming migration), so old political markets still carry it
const POLITICAL_HINTS = [
  "election",
  "elections",
  "parliament",
  "national assembly",
  "president",
  "presidential",
  "prime minister",
  "constituency",
  "candidate",
  "referendum",
  "by-election",
];

const normaliseTag = (sub: string) =>
  sub
    .toLowerCase()
    .trim()
    .replace(/^e-?sports?-/, "")
    .replace(/\s+/g, "-");

const ACRONYMS = new Set([
  "pubg", "mlbb", "fps", "moba", "br", "tft", "cs2", "csgo", "r6", "kof",
  "aoe", "sf6", "mtg", "tcg", "ccg", "rts", "lol", "mpl", "msc", "bgmi",
  "efootball", "nba2k", "fc26",
]);

/** "mobile-legends" → "Mobile Legends", "csgo" → "CSGO". */
function prettyTag(tag: string): string {
  return tag
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) =>
      ACRONYMS.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(" ");
}

/**
 * Resolve a preset from an admin subcategory tag. Game names count as well as
 * tags, so a "Rocket League" subcategory joins the same category as a market
 * whose title mentions Rocket League — one game never splits across two chips.
 */
function presetForTag(tag: string): EsportsCategory | null {
  if (!tag) return null;
  for (const c of ESPORTS_CATEGORIES) {
    if (c.tags.some((t) => tag === t)) return c;
  }
  for (const c of ESPORTS_CATEGORIES) {
    if (c.games.some((g) => normaliseTag(g) === tag)) return c;
  }
  for (const c of ESPORTS_CATEGORIES) {
    if (c.tags.some((t) => t.length > 3 && tag.includes(t))) return c;
  }
  return null;
}

/**
 * Bucket a market into a category. The admin subcategory wins over title
 * tokens, and an unrecognised subcategory becomes its own category so newly
 * added games show up in the hub without a code change.
 */
export function esportsCategoryOf(market: Market): EsportsCategoryKey {
  const tag = normaliseTag(market.subcategory ?? "");
  if (tag) {
    const preset = presetForTag(tag);
    if (preset) return preset.key;
    if (!GENERIC_TAGS.includes(tag)) return `sub:${tag}`;
  }
  const hay = `${market.title} ${market.description ?? ""}`.toLowerCase();
  for (const c of ESPORTS_CATEGORIES) {
    if (c.games.some((g) => hasToken(hay, g))) return c.key;
  }
  return "other";
}

/** Markets that belong in the /esports hub instead of the main feed grid. */
export function isEsportsMarket(market: Market): boolean {
  const cat = (market.category ?? "").toLowerCase();
  if (cat === "political") return false;

  const sub = (market.subcategory ?? "").toLowerCase();

  // Picking the Gaming category in the admin form is an explicit decision, so
  // it outranks the other hubs' matchers. Without this, a stale sports field —
  // e.g. a BPL settlement URL left over from the form's presets — would route
  // the market to a football hub and it would never appear here.
  if (cat === "gaming") {
    const hay = `${market.title} ${sub}`.toLowerCase();
    if (POLITICAL_HINTS.some((k) => hay.includes(k))) return false;
    // An admin-set subcategory is an explicit signal; without one, only claim
    // the market when its title resolves to a known discipline
    if (sub.trim()) return true;
    return esportsCategoryOf(market) !== "other";
  }

  // Otherwise never poach a market that already has a dedicated hub
  if (isWCMarket(market)) return false;
  if (isBplMarket(market)) return false;
  if (isUfcMarket(market)) return false;
  if (isEplMarket(market)) return false;

  if (sub.includes("esport") || sub.includes("egaming")) return true;
  if (looksEsports(market.title, market.description)) return true;
  return false;
}

export function categoryMeta(key: EsportsCategoryKey): EsportsCategory {
  const preset = ESPORTS_CATEGORIES.find((c) => c.key === key);
  if (preset) return preset;
  if (key.startsWith("sub:")) {
    const tag = key.slice(4);
    return { key, label: prettyTag(tag), Icon: Gamepad2, tags: [tag], games: [] };
  }
  return ESPORTS_CATEGORIES[ESPORTS_CATEGORIES.length - 1];
}

// ── Small helpers ─────────────────────────────────────────────────────────────

export function getSideImage(market: Market, idx: number): string | null {
  const sides = (market.outcomes ?? []).filter(
    (o) => !isDrawOutcome(o.label ?? ""),
  );
  const outcome = sides[idx];
  if (outcome?.imageUrl) return outcome.imageUrl;
  if (idx === 0) return market.imageUrl;
  if (idx === 1) return market.imageUrlAlt;
  return null;
}

export function outcomeImage(market: Market, outcome: Outcome): string | null {
  if (outcome.imageUrl) return outcome.imageUrl;
  const sides = (market.outcomes ?? []).filter(
    (o) => !isDrawOutcome(o.label ?? ""),
  );
  const i = sides.findIndex((o) => o.id === outcome.id);
  if (i === 0) return market.imageUrl;
  if (i === 1) return market.imageUrlAlt;
  return null;
}

export function shortTeamName(label: string): string {
  const trimmed = label.trim();
  if (trimmed.length <= 14) return trimmed;
  const parts = trimmed.split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : trimmed;
}

export function parseVsNames(title: string): { a: string; b: string } {
  const m = title.match(
    /^(?:.*?[:\-–—]\s*)?(.+?)\s+vs\.?\s+(.+?)(?:\s*[–—\-:?]|\s*\(|\s+(?:who|which|will)\b|$)/i,
  );
  if (m) return { a: m[1].trim(), b: m[2].trim() };
  return { a: "Team A", b: "Team B" };
}

function useClosesAt(closesAt: string | null | undefined): string {
  const [label, setLabel] = React.useState("");
  React.useEffect(() => {
    if (!closesAt) return;
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

/** Page-scoped CSS — hover states and scrollbar hiding inline styles can't do. */
function EwcStyles() {
  return (
    <style>{`
      .ewc-scroll::-webkit-scrollbar { display: none; }
      .ewc-card { transition: transform .15s cubic-bezier(.4,0,.2,1); }
      .ewc-card:hover { transform: translateY(-2px); }
      .ewc-btn-gold { background: ${EWC.goldButton}; }
      .ewc-btn-gold:hover:not(:disabled) { background: ${EWC.goldButtonHover}; }
      .ewc-btn-green { background: ${EWC.greenButton}; }
      .ewc-btn-green:hover:not(:disabled) { background: ${EWC.greenButtonHover}; }
      .ewc-chip { cursor: pointer; }
    `}</style>
  );
}

export function TeamAvatar({
  src,
  label,
  size,
  color = EWC.gold,
}: {
  src: string | null;
  label: string;
  size: number;
  color?: string;
}) {
  const [failed, setFailed] = useState(false);
  const shape = { width: size, height: size, flexShrink: 0, clipPath: notch(6) };
  if (src && !failed) {
    return (
      <img
        src={src}
        alt={label}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        style={{
          ...shape,
          objectFit: "contain",
          padding: Math.round(size * 0.1),
          boxSizing: "border-box",
          background: EWC.control,
        }}
      />
    );
  }
  return (
    <div
      style={{
        ...shape,
        background: EWC.control,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.42,
        fontWeight: 900,
        color,
      }}
    >
      {label.trim().charAt(0).toUpperCase()}
    </div>
  );
}

/** Uppercase micro-label — the hub's workhorse type style. */
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

function CategoryTag({ categoryKey }: { categoryKey: EsportsCategoryKey }) {
  const { label, Icon } = categoryMeta(categoryKey);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        color: EWC.goldBright,
        flexShrink: 0,
      }}
    >
      <Icon size={12} />
      <Label color={EWC.goldBright}>{label}</Label>
    </span>
  );
}

function StatusPill({ market }: { market: Market }) {
  const closes = useClosesAt(market.bettingClosesAt ?? market.closesAt);
  const resolving = market.status === "resolving";
  const locked = resolving || market.status === "closed";
  const settleEta = useClosesAt(resolving ? market.disputeDeadlineAt : null);

  if (locked)
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {settleEta && settleEta !== "Closed" && (
          <Label size={9}>{settleEta}</Label>
        )}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            border: `1px solid ${EWC.goldLine}`,
            clipPath: notch(6),
            padding: "3px 7px",
          }}
        >
          <Label color={EWC.gold}>{resolving ? "Resolving" : "Closed"}</Label>
        </span>
      </div>
    );
  if (!closes) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        flexShrink: 0,
        color: EWC.textSecondary,
      }}
    >
      <Clock size={11} />
      <span
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: EWC.trackSmall,
          color: EWC.text,
        }}
      >
        {closes}
      </span>
    </div>
  );
}

/** An eliminated outcome: no new bets, and existing bets lose at resolution. */
function OutBadge({ fullWidth = false }: { fullWidth?: boolean }) {
  return (
    <div
      title="Eliminated — no new bets accepted"
      style={{
        width: fullWidth ? "100%" : undefined,
        textAlign: "center",
        border: "1px solid rgba(229,72,77,0.40)",
        background: "rgba(229,72,77,0.12)",
        clipPath: notch(7),
        padding: fullWidth ? "9px 0" : "7px 11px",
        color: EWC.danger,
        fontSize: 10,
        fontWeight: 900,
        textTransform: "uppercase",
        letterSpacing: EWC.trackTiny,
        flexShrink: 0,
      }}
    >
      Out
    </div>
  );
}

/** Two-tone share bar — gold side vs green side. */
function ProbBar({ pctA }: { pctA: number }) {
  return (
    <div style={{ display: "flex", height: 3, background: EWC.control }}>
      <div style={{ width: `${pctA}%`, background: EWC.gold }} />
      <div style={{ width: `${100 - pctA}%`, background: EWC.green }} />
    </div>
  );
}

/** Shared card shell: notched, gold keyline, sheet-toned header strip. */
function CardShell({
  categoryKey,
  market,
  children,
  onClick,
}: {
  categoryKey: EsportsCategoryKey;
  market: Market;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      className="ewc-card"
      onClick={onClick}
      style={{
        background: EWC.goldLine,
        clipPath: notch(12),
        padding: 1,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div style={{ background: EWC.surface, clipPath: notch(12) }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "9px 12px",
            background: EWC.sheet,
            borderBottom: `1px solid ${EWC.border}`,
          }}
        >
          <CategoryTag categoryKey={categoryKey} />
          <StatusPill market={market} />
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Cards ─────────────────────────────────────────────────────────────────────

function EsportsMatchCard({
  market,
  categoryKey,
  onBet,
}: {
  market: Market;
  categoryKey: EsportsCategoryKey;
  onBet: (marketId: string, outcomeId: string) => void;
}) {
  const navigate = useNavigate();
  const resolving = market.status === "resolving";
  const locked = resolving || market.status === "closed";

  // Live pool/odds: every bet triggers a "market_updated" push on the
  // /markets WebSocket room for this market — no refresh needed
  const liveData = useMarketSocket(locked ? undefined : market.id);
  const m = useMemo<Market>(() => {
    if (!liveData) return market;
    return {
      ...market,
      totalPool: String(liveData.totalPool),
      outcomes: (market.outcomes ?? []).map((o) => {
        const live = liveData.outcomes.find((lo) => lo.id === o.id);
        if (!live) return o;
        return {
          ...o,
          totalBetAmount: String(live.totalBetAmount),
          lmsrProbability: live.lmsrProbability ?? o.lmsrProbability,
          currentOdds: String(live.currentOdds),
        } as typeof o;
      }),
    };
  }, [market, liveData]);

  const totalPool =
    Number(m.totalPool ?? 0) ||
    (m.outcomes ?? []).reduce((s, o) => s + Number(o.totalBetAmount ?? 0), 0);

  const sides = (m.outcomes ?? []).filter((o) => !isDrawOutcome(o.label ?? ""));
  const [sa, sb] = sides;
  if (!sa || !sb) return null;

  const titleNames = parseVsNames(market.title);
  const nameOf = (label: string, idx: number) =>
    /^(yes|no)$/i.test(label.trim())
      ? idx === 0
        ? titleNames.a
        : titleNames.b
      : label;

  const pctA = Math.round(calcProb(m, sa.id) * 100);
  const pctB = 100 - pctA;
  const isFinal = isEsportsFinal(market.title);

  const renderSide = (
    outcome: typeof sa,
    idx: number,
    color: string,
    pct: number,
  ) => {
    const name = shortTeamName(nameOf(outcome.label, idx));
    const left = idx === 0;
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: left ? "flex-start" : "flex-end",
          minWidth: 0,
          opacity: outcome.isEliminated ? 0.55 : 1,
        }}
      >
        <TeamAvatar
          src={getSideImage(market, idx)}
          label={name}
          size={31}
          color={color}
        />
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: EWC.text,
            textTransform: "uppercase",
            letterSpacing: EWC.trackSmall,
            textAlign: left ? "left" : "right",
            width: "100%",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            marginTop: 7,
          }}
        >
          {name}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 5,
            marginTop: 6,
          }}
        >
          <span
            style={{
              fontSize: 23,
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
        <div style={{ marginTop: 3 }}>
          <Label size={9}>
            Nu {Number(outcome.totalBetAmount ?? 0).toLocaleString()}
          </Label>
        </div>
        {outcome.isEliminated ? (
          <div style={{ width: "100%", marginTop: 9 }}>
            <OutBadge fullWidth />
          </div>
        ) : (
        <button
          className={idx === 0 ? "ewc-btn-gold" : "ewc-btn-green"}
          disabled={locked}
          onClick={(e) => {
            e.stopPropagation();
            onBet(market.id, outcome.id);
          }}
          style={{
            width: "100%",
            marginTop: 9,
            padding: "8px 0",
            border: "none",
            clipPath: notch(8),
            color: idx === 0 ? "#1a1400" : "#00160c",
            fontSize: 11,
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: EWC.trackTiny,
            cursor: locked ? "default" : "pointer",
            opacity: locked ? 0.45 : 1,
          }}
        >
          Predict
        </button>
        )}
      </div>
    );
  };

  return (
    <CardShell
      market={market}
      categoryKey={categoryKey}
      onClick={() => navigate(`/market/${market.id}`)}
    >
      <div style={{ padding: "10px 11px 9px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          {renderSide(sa, 0, EWC.gold, pctA)}
          <div
            style={{
              width: 30,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 5,
              paddingTop: 7,
            }}
          >
            <Label color={EWC.textSecondary} size={11}>
              vs
            </Label>
            <div
              style={{
                width: 1,
                flex: 1,
                minHeight: 46,
                background: `linear-gradient(180deg, ${EWC.border} 0%, transparent 100%)`,
              }}
            />
          </div>
          {renderSide(sb, 1, EWC.green, pctB)}
        </div>
      </div>

      <ProbBar pctA={pctA} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "7px 10px",
          background: isFinal ? EWC.glass : EWC.panel,
          borderTop: isFinal ? `1px solid ${EWC.goldLine}` : "none",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            minWidth: 0,
            fontFamily: DISPLAY_FONT,
            fontSize: 10,
            fontWeight: isFinal ? 700 : 400,
            color: isFinal ? EWC.goldBright : EWC.textMuted,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {isFinal && <Trophy size={11} style={{ flexShrink: 0 }} />}
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {market.title}
          </span>
        </span>
        <span style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
          <Label>pool </Label>
          <span style={{ fontSize: 11, fontWeight: 800, color: EWC.text }}>
            Nu {totalPool.toLocaleString()}
          </span>
        </span>
      </div>
    </CardShell>
  );
}

function EsportsEventMarket({
  market,
  categoryKey,
  onBet,
}: {
  market: Market;
  categoryKey: EsportsCategoryKey;
  onBet: (marketId: string, outcomeId: string) => void;
}) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const locked = market.status === "resolving" || market.status === "closed";
  const totalPool = Number(market.totalPool ?? 0);
  const outcomes = market.outcomes ?? [];
  // Field markets can run long — show the strongest few until expanded
  const COLLAPSED_COUNT = 4;
  // Eliminated outcomes sink to the bottom; the rest rank by probability
  const ranked = [...outcomes].sort((a, b) => {
    const ea = Number(!!a.isEliminated);
    const eb = Number(!!b.isEliminated);
    if (ea !== eb) return ea - eb;
    return calcProb(market, b.id) - calcProb(market, a.id);
  });
  const shown = expanded ? ranked : ranked.slice(0, COLLAPSED_COUNT);
  const hidden = ranked.length - COLLAPSED_COUNT;

  return (
    <CardShell market={market} categoryKey={categoryKey}>
      <div
        onClick={() => navigate(`/market/${market.id}`)}
        style={{ padding: "10px 10px 3px", cursor: "pointer" }}
      >
        <div
          style={{
            fontFamily: DISPLAY_FONT,
            fontSize: 13,
            fontWeight: 700,
            color: EWC.text,
            letterSpacing: EWC.trackSmall,
            lineHeight: 1.4,
          }}
        >
          {market.title}
        </div>
        <div style={{ marginTop: 5 }}>
          <Label>
            {outcomes.length} outcomes · pool Nu {totalPool.toLocaleString()}
          </Label>
        </div>
      </div>

      <div style={{ padding: "3px 10px 10px" }}>
        {shown.map((outcome, idx) => {
          const pct = Math.round(calcProb(market, outcome.id) * 100);
          const odds = calcOdds(market, outcome.id);
          const eliminated = !!outcome.isEliminated;
          return (
            <div
              key={outcome.id}
              onClick={() => navigate(`/market/${market.id}`)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "7px 0",
                borderTop: idx === 0 ? "none" : `1px solid ${EWC.border}`,
                cursor: "pointer",
                opacity: eliminated ? 0.55 : 1,
              }}
            >
              <TeamAvatar
                src={outcomeImage(market, outcome)}
                label={outcome.label}
                size={26}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
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
                    marginTop: 5,
                    height: 3,
                    background: EWC.control,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      background: eliminated ? EWC.textMuted : EWC.gold,
                    }}
                  />
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, minWidth: 42 }}>
                <div
                  style={{
                    fontSize: 14,
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
              {eliminated ? (
                <OutBadge />
              ) : (
                !locked && (
                <button
                  className="ewc-btn-gold"
                  onClick={(e) => {
                    e.stopPropagation();
                    onBet(market.id, outcome.id);
                  }}
                  style={{
                    border: "none",
                    clipPath: notch(7),
                    padding: "7px 12px",
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
        {hidden > 0 && (
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                setExpanded((v) => !v);
              }
            }}
            style={{
              borderTop: `1px solid ${EWC.border}`,
              paddingTop: 9,
              cursor: "pointer",
              textAlign: "center",
              outline: "none",
            }}
          >
            <Label color={EWC.gold}>
              {expanded ? "Show less «" : `+${hidden} more outcomes »`}
            </Label>
          </div>
        )}
      </div>
    </CardShell>
  );
}

/** Hub masthead — trophy, lockup and the live counters. */
export function EsportsMasthead({
  onBack,
  stats,
}: {
  onBack: () => void;
  stats: { label: string; val: string }[];
}) {
  return (
    <div
      style={{
        position: "relative",
        background: EWC.bg,
        borderBottom: `1px solid ${EWC.goldLine}`,
      }}
    >
      <div
        style={{
          position: "relative",
          maxWidth: 860,
          margin: "0 auto",
          padding: "12px 16px 16px",
        }}
      >
        <button
          onClick={onBack}
          aria-label="Go back"
          style={{
            position: "absolute",
            left: 16,
            top: 12,
            zIndex: 2,
            background: EWC.glass,
            border: `1px solid ${EWC.goldLine}`,
            clipPath: notch(7),
            width: 30,
            height: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: EWC.text,
            fontSize: 15,
            padding: 0,
          }}
        >
          ←
        </button>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <EsportsWordmark
            as="h1"
            size="clamp(32px, 12vw, 50px)"
            showSub={false}
            style={{ marginTop: 6 }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              marginTop: 9,
            }}
          >
            <span style={{ width: 26, height: 1, background: EWC.border }} />
            <Label color={EWC.gold}>Nothing is Granted</Label>
            <span style={{ width: 26, height: 1, background: EWC.border }} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          {stats.map(({ label, val }) => (
            <NotchTile key={label} padding="9px 4px" style={{ flex: 1 }}>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 900,
                    color: EWC.text,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {val}
                </div>
                <div style={{ marginTop: 3 }}>
                  <Label size={8}>{label}</Label>
                </div>
              </div>
            </NotchTile>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type ActiveBet = { marketId: string; outcomeId: string };

export function isMatchMarket(m: Market): boolean {
  const sides = (m.outcomes ?? []).filter((o) => !isDrawOutcome(o.label ?? ""));
  if (sides.length !== 2) return false;
  const isBinary = sides.every((o) => /^(yes|no)$/i.test((o.label ?? "").trim()));
  if (isBinary) return /\bvs\b/i.test(m.title);
  return true;
}

export function EsportsHubPage() {
  const navigate = useNavigate();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBet, setActiveBet] = useState<ActiveBet | null>(null);
  const [selected, setSelected] = useState<EsportsCategoryKey | "all">("all");

  const loadMarkets = () =>
    getMarkets()
      .then((d) =>
        setMarkets(
          d.filter(
            (m) =>
              m.status === "open" ||
              m.status === "upcoming" ||
              m.status === "closed" ||
              m.status === "resolving",
          ),
        ),
      )
      .catch(console.error)
      .finally(() => setLoading(false));

  useEffect(() => {
    loadMarkets();
    // Live pool/percentage updates: the app-root SSE stream rebroadcasts
    // backend "market:updated" pushes as this window event
    const onMarketChanged = () => loadMarkets();
    window.addEventListener("oro:market-changed", onMarketChanged);
    return () =>
      window.removeEventListener("oro:market-changed", onMarketChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bucket once — every downstream list reads from this
  const tagged = useMemo(
    () =>
      markets
        .filter(isEsportsMarket)
        .map((m) => ({ market: m, categoryKey: esportsCategoryOf(m) }))
        .sort((a, b) => {
          const t = (m: Market) =>
            m.bettingClosesAt
              ? new Date(m.bettingClosesAt).getTime()
              : m.closesAt
                ? new Date(m.closesAt).getTime()
                : Infinity;
          return t(a.market) - t(b.market);
        }),
    [markets],
  );

  const counts = useMemo(() => {
    const c = new Map<EsportsCategoryKey, number>();
    for (const { categoryKey } of tagged)
      c.set(categoryKey, (c.get(categoryKey) ?? 0) + 1);
    return c;
  }, [tagged]);

  const totalPool = tagged.reduce(
    (s, { market }) => s + Number(market.totalPool ?? 0),
    0,
  );
  // Pool volume per category — the tiebreaker when two chips have equal counts.
  const poolByCat = useMemo(() => {
    const p = new Map<EsportsCategoryKey, number>();
    for (const { categoryKey, market } of tagged)
      p.set(categoryKey, (p.get(categoryKey) ?? 0) + Number(market.totalPool ?? 0));
    return p;
  }, [tagged]);
  // Admin-defined categories (subcategories with no preset), busiest first
  const adminCategories = useMemo(
    () =>
      [...counts.keys()]
        .filter((k) => k.startsWith("sub:"))
        .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
        .map(categoryMeta),
    [counts],
  );

  const liveCategories = useMemo(
    () => [
      ...ESPORTS_CATEGORIES.filter((c) => (counts.get(c.key) ?? 0) > 0),
      ...adminCategories,
    ],
    [counts, adminCategories],
  );

  // "Other" only earns a chip when something actually landed there.
  // Busiest categories lead — sorted by market count, then pool volume. Ties
  // (e.g. every empty category) keep their ESPORTS_CATEGORIES order via stable
  // sort, so the row stays predictable.
  const chips = useMemo(() => {
    const base = [
      ...ESPORTS_CATEGORIES.filter(
        (c) => c.key !== "other" || (counts.get("other") ?? 0) > 0,
      ),
      ...adminCategories,
    ];
    return [...base].sort((a, b) => {
      const ca = counts.get(a.key) ?? 0;
      const cb = counts.get(b.key) ?? 0;
      if (cb !== ca) return cb - ca;
      const pa = poolByCat.get(a.key) ?? 0;
      const pb = poolByCat.get(b.key) ?? 0;
      return pb - pa;
    });
  }, [counts, poolByCat, adminCategories]);

  const visible =
    selected === "all"
      ? tagged
      : tagged.filter((t) => t.categoryKey === selected);

  const activeMarket = activeBet
    ? markets.find((m) => m.id === activeBet.marketId)
    : null;

  if (loading) return <LoadingScreen message="Loading Esports…" />;

  const renderCard = ({
    market,
    categoryKey,
  }: {
    market: Market;
    categoryKey: EsportsCategoryKey;
  }) =>
    isMatchMarket(market) ? (
      <EsportsMatchCard
        key={market.id}
        market={market}
        categoryKey={categoryKey}
        onBet={(marketId, outcomeId) => setActiveBet({ marketId, outcomeId })}
      />
    ) : (
      // Field/tournament markets are the headline — span the whole row
      <div key={market.id} style={{ gridColumn: "1 / -1" }}>
        <EsportsEventMarket
          market={market}
          categoryKey={categoryKey}
          onBet={(marketId, outcomeId) => setActiveBet({ marketId, outcomeId })}
        />
      </div>
    );

  const grid = (items: typeof tagged) => {
    // Headline field/tournament markets first, matches after (stable otherwise)
    const ordered = [...items].sort(
      (a, b) =>
        Number(isMatchMarket(a.market)) - Number(isMatchMarket(b.market)),
    );
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 10,
          alignItems: "start",
        }}
      >
        {ordered.map(renderCard)}
      </div>
    );
  };

  return (
    <Page>
      <div style={{ minHeight: "100vh", background: EWC.bg }}>
      <EwcStyles />

      <EsportsMasthead
        onBack={() => navigate(-1)}
        stats={[
          { label: "Predictions", val: String(tagged.length) },
          { label: "Disciplines", val: String(liveCategories.length) },
          { label: "Total pool", val: `Nu ${totalPool.toLocaleString()}` },
        ]}
      />

      {/* ── Discipline filter — sticks under the masthead while scrolling ── */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          background: EWC.bg,
          borderBottom: `1px solid ${EWC.border}`,
        }}
      >
        <div
          className="ewc-scroll"
          style={{
            display: "flex",
            gap: 6,
            overflowX: "auto",
            scrollbarWidth: "none",
            padding: "10px 16px",
            maxWidth: 860,
            margin: "0 auto",
          }}
        >
          {[{ key: "all", label: "All", Icon: Gamepad2 }, ...chips].map(
            (c) => {
              const active = selected === c.key;
              const count =
                c.key === "all"
                  ? tagged.length
                  : (counts.get(c.key) ?? 0);
              const Icon = c.Icon;
              return (
                <NotchTile
                  key={c.key}
                  className="ewc-chip"
                  radius={7}
                  accent={active}
                  padding="7px 11px"
                  onClick={() => setSelected(c.key)}
                  style={{
                    flexShrink: 0,
                    opacity: count === 0 && !active ? 0.5 : 1,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <Icon
                      size={13}
                      color={active ? "#1a1400" : EWC.goldBright}
                    />
                    <Label color={active ? "#1a1400" : EWC.textSecondary}>
                      {c.label}
                    </Label>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 900,
                        color: active ? "#1a1400" : EWC.text,
                        opacity: active ? 0.7 : 1,
                      }}
                    >
                      {count}
                    </span>
                  </div>
                </NotchTile>
              );
            },
          )}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────── */}
      <div style={{ padding: "18px 16px 100px", maxWidth: 860, margin: "0 auto" }}>
        {visible.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "52px 16px",
              border: `1px dashed ${EWC.border}`,
              clipPath: notch(12),
              background: EWC.glass,
            }}
          >
            <Gamepad2 size={26} color={EWC.textMuted} />
            <div style={{ marginTop: 10 }}>
              <Label color={EWC.text} size={12}>
                {selected === "all"
                  ? "No esports markets yet"
                  : `No ${categoryMeta(selected).label} markets yet`}
              </Label>
            </div>
            <div style={{ fontSize: 11, marginTop: 6, color: EWC.textMuted }}>
              Check back when the next tournament bracket drops
            </div>
          </div>
        ) : selected === "all" ? (
          // Grouped by discipline so every category is browsable at a glance
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {liveCategories.map((c) => {
              const items = tagged.filter((t) => t.categoryKey === c.key);
              const pool = items.reduce(
                (s, { market }) => s + Number(market.totalPool ?? 0),
                0,
              );
              return (
                <section key={c.key}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      marginBottom: 11,
                    }}
                  >
                    <c.Icon size={15} color={EWC.goldBright} />
                    <h2 style={{ margin: 0 }}>
                      <Label color={EWC.text} size={13} style={{ fontWeight: 900 }}>
                        {c.label}
                      </Label>
                    </h2>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 900,
                        color: EWC.gold,
                        border: `1px solid ${EWC.goldLine}`,
                        clipPath: notch(5),
                        padding: "2px 6px",
                      }}
                    >
                      {items.length}
                    </span>
                    <span style={{ flex: 1, height: 1, background: EWC.border }} />
                    <Label style={{ flexShrink: 0 }}>
                      Nu {pool.toLocaleString()} pool
                    </Label>
                  </div>
                  {grid(items)}
                </section>
              );
            })}
          </div>
        ) : (
          grid(visible)
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
            setActiveBet(null);
            loadMarkets();
          }}
          onFailure={(e: string) => console.error(e)}
          onGoToWallet={() => navigate("/wallet")}
        />
      )}
      </div>
    </Page>
  );
}
