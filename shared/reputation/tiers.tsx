import React from "react";
import {
  Sprout,
  Compass,
  Crosshair,
  Brain,
  Flame,
  Sparkles,
  Trophy,
  type LucideIcon,
} from "lucide-react";

/**
 * The reputation ladder — the single source of truth for its rungs, their
 * requirements, and how they are labelled and coloured.
 *
 * These helpers used to be copy-pasted into every screen showing a badge, and
 * the "next tier" thresholds were hardcoded separately again in the profile and
 * leaderboard progress widgets. That is how the ladder drifted: a rung added in
 * one place did not exist in another, and the progress hints quoted numbers the
 * backend had stopped using.
 *
 * Requirements MUST match calcTier() in
 * oro-backend/src/markets/reputation.service.ts. Each rung is gated on BOTH a
 * minimum number of resolved predictions and a minimum raw win rate:
 *
 *   Legend        201+ picks AND >= 80%
 *   Prophet       101+ picks AND >= 70%
 *   Hot Hand       71+ picks AND >= 65%
 *   Analyst        51+ picks AND >= 60%
 *   Sharpshooter   31+ picks AND >= 50%
 *   Scout          10+ picks           (volume milestone, no accuracy bar)
 *   Rookie      under 10 picks
 *
 * `minPicks` is the smallest qualifying count, so the test is `total >=
 * minPicks`. The backend writes `total > 30`; for integer counts that is the
 * same as `>= 31`, which is what is stored here — it makes the "N more picks"
 * hints come out right without an off-by-one.
 *
 * Colours progress grey -> teal -> blue -> violet -> green -> pink -> amber so
 * rungs stay distinguishable at the 9px size used under a username.
 */
export interface TierMeta {
  /** Position in the ladder, lowest first. Compare on this, never on strings. */
  order: number;
  label: string;
  color: string;
  Icon: LucideIcon;
  /** Smallest qualifying pick count (inclusive). */
  minPicks: number;
  /** Minimum raw win rate, 0–1. Zero means no accuracy requirement. */
  minWinRate: number;
}

export const TIERS: Record<string, TierMeta> = {
  rookie: {
    order: 0,
    label: "Rookie",
    color: "#94a3b8",
    Icon: Sprout,
    minPicks: 0,
    minWinRate: 0,
  },
  scout: {
    order: 1,
    label: "Scout",
    color: "#2dd4bf",
    Icon: Compass,
    minPicks: 10,
    minWinRate: 0,
  },
  sharpshooter: {
    order: 2,
    label: "Sharpshooter",
    color: "#3b82f6",
    Icon: Crosshair,
    minPicks: 31,
    minWinRate: 0.5,
  },
  analyst: {
    order: 3,
    label: "Analyst",
    color: "#a78bfa",
    Icon: Brain,
    minPicks: 51,
    minWinRate: 0.6,
  },
  hot_hand: {
    order: 4,
    label: "Hot Hand",
    color: "#22c55e",
    Icon: Flame,
    minPicks: 71,
    minWinRate: 0.65,
  },
  prophet: {
    order: 5,
    label: "Prophet",
    color: "#f472b6",
    Icon: Sparkles,
    minPicks: 101,
    minWinRate: 0.7,
  },
  legend: {
    order: 6,
    label: "Legend",
    color: "#f59e0b",
    Icon: Trophy,
    minPicks: 201,
    minWinRate: 0.8,
  },
};

/** Lowest rung first. */
export const TIER_ORDER: string[] = Object.entries(TIERS)
  .sort((a, b) => a[1].order - b[1].order)
  .map(([key]) => key);

/** Unknown or missing tiers fall back to Rookie rather than rendering blank. */
export function tierMeta(tier?: string | null): TierMeta {
  return TIERS[tier ?? "rookie"] ?? TIERS.rookie;
}

export function tierLabel(tier?: string | null): string {
  return tierMeta(tier).label;
}

export function tierColor(tier?: string | null): string {
  return tierMeta(tier).color;
}

export function tierIcon(tier?: string | null, size = 12): React.ReactElement {
  const { Icon, color } = tierMeta(tier);
  return <Icon size={size} color={color} />;
}

/**
 * True when `tier` is at or above `min` on the ladder.
 *
 * Always use this instead of a membership test like
 * `["sharpshooter", "hot_hand", "legend"].includes(tier)`. Those lists have to
 * be updated by hand every time a rung is added, and the failure is silent and
 * backwards: a user promoted into a NEW rung drops out of the list and appears
 * to LOSE a badge they had already earned.
 */
export function tierAtLeast(
  tier: string | null | undefined,
  min: string,
): boolean {
  return tierMeta(tier).order >= tierMeta(min).order;
}

/** The rung above this one, or null at the top of the ladder. */
export function nextTierMeta(tier?: string | null): TierMeta | null {
  const next = TIER_ORDER[tierMeta(tier).order + 1];
  return next ? TIERS[next] : null;
}

/**
 * A rung's requirement as one line — "31+ picks · 50%+ accuracy".
 *
 * Derived from the same two numbers the backend gates on rather than written
 * out as seven strings on the screen that shows them, so a changed threshold
 * cannot leave a stale sentence behind. That drift is what this module exists
 * to prevent.
 *
 * `minPicks` is already the smallest QUALIFYING count (31, where the backend
 * writes `total > 30`), so it is quoted directly: "31+ picks" is the bar.
 *
 * A `minWinRate` of 0 means there is NO accuracy bar, not a 0% one. Rookie is
 * where everyone starts, and Scout is a pure volume milestone left deliberately
 * ungated so beginners are not judged on win rate before they have one.
 * Printing "0%+ accuracy" for either would invent a requirement that does not
 * exist.
 */
export function tierRequirement(tier?: string | null): string {
  const { minPicks, minWinRate } = tierMeta(tier);
  if (minPicks <= 0) return "Everyone starts here";
  const picks = `${minPicks}+ picks`;
  return minWinRate > 0
    ? `${picks} · ${Math.round(minWinRate * 100)}%+ accuracy`
    : picks;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Everything needed to render a tier chip — label, text colour, and the
 * translucent fill/border derived from the same base colour so a new rung is
 * styled automatically instead of falling back to grey.
 */
export function tierChip(tier?: string | null): {
  label: string;
  color: string;
  bg: string;
  border: string;
  Icon: LucideIcon;
} {
  const m = tierMeta(tier);
  return {
    label: m.label,
    color: m.color,
    bg: hexToRgba(m.color, 0.25),
    border: hexToRgba(m.color, 0.4),
    Icon: m.Icon,
  };
}

export interface TierProgress {
  /** e.g. "Sharpshooter → Analyst" */
  label: string;
  nextColor: string;
  /** 0–1, averaged across whichever requirements the next rung actually has. */
  progress: number;
  hint: string;
}

/**
 * Progress toward the next rung. Returns null at Legend, where there is no
 * next rung to describe.
 *
 * Both requirements are read from the ladder above rather than restated, so
 * the hint can never quote a threshold the backend has stopped using.
 *
 * @param total resolved predictions
 * @param acc   raw win rate, 0–1
 */
export function tierProgress(
  tier: string | null | undefined,
  total: number,
  acc: number,
): TierProgress | null {
  const next = nextTierMeta(tier);
  if (!next) return null;

  const picksLeft = Math.max(next.minPicks - total, 0);
  const pickPart = next.minPicks > 0 ? Math.min(total / next.minPicks, 1) : 1;

  // Rungs with no accuracy bar (Scout) are pure volume — averaging in a
  // fabricated accuracy term would understate how close the user actually is.
  const hasAccBar = next.minWinRate > 0;
  const accPart = hasAccBar ? Math.min(acc / next.minWinRate, 1) : 1;
  const progress = hasAccBar ? (pickPart + accPart) / 2 : pickPart;

  const accShort = hasAccBar && acc < next.minWinRate;
  let hint: string;
  if (picksLeft > 0 && accShort) {
    hint = `${picksLeft} more picks · aim for ${Math.round(next.minWinRate * 100)}%+ accuracy`;
  } else if (picksLeft > 0) {
    hint = `${picksLeft} more ${picksLeft === 1 ? "pick" : "picks"} to reach ${next.label}`;
  } else if (accShort) {
    hint = `${Math.round((next.minWinRate - acc) * 100)}% more accuracy needed`;
  } else {
    hint = "Almost there!";
  }

  return {
    label: `${tierLabel(tier)} → ${next.label}`,
    nextColor: next.color,
    progress,
    hint,
  };
}
