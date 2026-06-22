// ─────────────────────────────────────────────────────────────────────────────
// FIFA World Cup 2026 — Knockout bracket scaffold
//
// This is a STATIC schedule used to render the Knockout tab in the World Cup
// hub. Each slot is a fixed bracket position; the teams stay "TBD" until a
// betting market exists for that fixture (matched by kickoff time below).
//
// ⚠️  DATES: transcribed from the design mockup and anchored to Bhutan time
//     (Asia/Thimphu, +06:00, no DST). VERIFY these against the official FIFA
//     2026 schedule before launch, and fill in the slots still marked `null`
//     (Round-of-32 #16, Round-of-16 #8, both Semi-finals, and the Final).
//     This file is the single source of truth — edit kickoffs here only.
// ─────────────────────────────────────────────────────────────────────────────

export type KnockoutRoundKey = "r32" | "r16" | "qf" | "sf" | "final";

export interface BracketSlot {
  /** Stable id, e.g. "r32-1" */
  id: string;
  /** Kickoff as a full ISO instant (Bhutan +06:00), or null when not yet scheduled */
  kickoff: string | null;
}

export interface BracketRound {
  key: KnockoutRoundKey;
  label: string;
  slots: BracketSlot[];
}

const s = (id: string, kickoff: string | null): BracketSlot => ({ id, kickoff });

export const WC_KNOCKOUT: BracketRound[] = [
  {
    key: "r32",
    label: "Round of 32",
    slots: [
      s("r32-1", "2026-06-29T01:00:00+06:00"),
      s("r32-2", "2026-06-30T07:00:00+06:00"),
      s("r32-3", "2026-06-30T02:30:00+06:00"),
      s("r32-4", "2026-07-01T03:00:00+06:00"),
      s("r32-5", "2026-07-02T02:00:00+06:00"),
      s("r32-6", "2026-07-02T06:00:00+06:00"),
      s("r32-7", "2026-07-03T01:00:00+06:00"),
      s("r32-8", "2026-07-03T05:00:00+06:00"),
      s("r32-9", "2026-06-29T23:00:00+06:00"),
      s("r32-10", "2026-06-30T23:00:00+06:00"),
      s("r32-11", "2026-07-01T07:00:00+06:00"),
      s("r32-12", "2026-07-01T22:00:00+06:00"),
      s("r32-13", "2026-07-03T09:00:00+06:00"),
      s("r32-14", "2026-07-04T07:30:00+06:00"),
      s("r32-15", "2026-07-04T00:00:00+06:00"),
      s("r32-16", null), // TODO: fill kickoff
    ],
  },
  {
    key: "r16",
    label: "Round of 16",
    slots: [
      s("r16-1", "2026-07-04T23:00:00+06:00"),
      s("r16-2", "2026-07-05T03:00:00+06:00"),
      s("r16-3", "2026-07-07T06:00:00+06:00"),
      s("r16-4", "2026-07-07T01:00:00+06:00"),
      s("r16-5", "2026-07-06T02:00:00+06:00"),
      s("r16-6", "2026-07-06T06:00:00+06:00"),
      s("r16-7", "2026-07-08T02:00:00+06:00"),
      s("r16-8", null), // TODO: fill kickoff
    ],
  },
  {
    key: "qf",
    label: "Quarter-finals",
    slots: [
      s("qf-1", "2026-07-10T02:00:00+06:00"),
      s("qf-2", "2026-07-11T01:00:00+06:00"),
      s("qf-3", "2026-07-12T03:00:00+06:00"),
      s("qf-4", "2026-07-12T07:00:00+06:00"),
    ],
  },
  {
    key: "sf",
    label: "Semi-finals",
    slots: [
      s("sf-1", null), // TODO: fill kickoff
      s("sf-2", null), // TODO: fill kickoff
    ],
  },
  {
    key: "final",
    label: "Final",
    slots: [
      s("final-1", null), // TODO: fill kickoff
    ],
  },
];

interface MatchableMarket {
  closesAt?: string | null;
  opensAt?: string | null;
  bettingClosesAt?: string | null;
  metadata?: Record<string, any> | null;
}

/**
 * Match a bracket slot to a live betting market.
 *
 * 1. Explicit: a market whose `metadata.bracketSlot` equals this slot's id
 *    (set by admin when creating the wc-match market) always wins.
 * 2. Fallback: otherwise, the market whose betting-close time is closest to the
 *    slot kickoff AND within `windowMs` of it.
 *
 * Returns null when nothing matches.
 */
export function findMarketForSlot<T extends MatchableMarket>(
  slot: BracketSlot,
  markets: T[],
  windowMs = 12 * 3_600_000,
): T | null {
  // 1. Explicit slot assignment takes priority.
  const explicit = markets.find((m) => m.metadata?.bracketSlot === slot.id);
  if (explicit) return explicit;

  // 2. Fall back to nearest kickoff time.
  if (!slot.kickoff) return null;
  const target = new Date(slot.kickoff).getTime();
  if (Number.isNaN(target)) return null;

  let best: T | null = null;
  let bestDiff = Infinity;
  for (const m of markets) {
    // Skip markets explicitly pinned to a different slot.
    if (m.metadata?.bracketSlot && m.metadata.bracketSlot !== slot.id) continue;
    const ref = m.bettingClosesAt ?? m.closesAt ?? m.opensAt;
    if (!ref) continue;
    const diff = Math.abs(new Date(ref).getTime() - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = m;
    }
  }
  return bestDiff <= windowMs ? best : null;
}
