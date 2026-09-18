// ─────────────────────────────────────────────────────────────────────────────
// DK Bank migration freeze
//
// DK migrates its core banking system overnight on 19 September 2026, and
// account numbers change in the cutover. Top ups and cash outs are closed for
// the duration; balances, open predictions and payouts are untouched.
//
// This is a one-off window between two fixed instants, not a nightly schedule —
// once the clock passes the end, `isDkMigrationFreezeActive` is false forever
// and the buttons come back on their own.
//
// The wallet uses this to disable the buttons and say why. It is *not* the
// control: the same window is enforced on the DK Bank endpoints in the backend,
// which is what holds when a device clock is wrong. Keep the two in step.
//
// VITE_DK_MIGRATION_FREEZE_START / _END override the dates, and the literal
// `off` lifts the freeze. Vite inlines these at build time, so changing them
// here means a rebuild — the backend override is the one that moves at runtime.
// ─────────────────────────────────────────────────────────────────────────────

export const DK_MIGRATION_FREEZE_DEFAULT_START = "2026-09-19T23:00:00+06:00";
export const DK_MIGRATION_FREEZE_DEFAULT_END = "2026-09-20T08:00:00+06:00";

export interface DkMigrationFreezeWindow {
  start: Date;
  end: Date;
}

/**
 * Resolves the window once per module load. Returns null only when the freeze
 * has been explicitly switched off — a blank or unparseable override falls back
 * to the default window rather than opening the rail.
 */
export function resolveDkMigrationFreezeWindow(): DkMigrationFreezeWindow | null {
  const env = import.meta.env as Record<string, string | undefined>;
  const rawStart = env.VITE_DK_MIGRATION_FREEZE_START;
  const rawEnd = env.VITE_DK_MIGRATION_FREEZE_END;

  if (isOff(rawStart) || isOff(rawEnd)) return null;

  const start = parseOverride(rawStart) ?? new Date(DK_MIGRATION_FREEZE_DEFAULT_START);
  const end = parseOverride(rawEnd) ?? new Date(DK_MIGRATION_FREEZE_DEFAULT_END);

  if (start.getTime() >= end.getTime()) {
    return {
      start: new Date(DK_MIGRATION_FREEZE_DEFAULT_START),
      end: new Date(DK_MIGRATION_FREEZE_DEFAULT_END),
    };
  }

  return { start, end };
}

export function isDkMigrationFreezeActive(
  freeze: DkMigrationFreezeWindow | null,
  now: number = Date.now(),
): boolean {
  if (!freeze) return false;
  // Half-open: the rail reopens exactly at the end instant, not a tick later.
  return now >= freeze.start.getTime() && now < freeze.end.getTime();
}

/** e.g. "11:00 pm tonight until 8:00 am tomorrow" — Bhutan time, wherever the phone is. */
export function formatDkMigrationFreeze(freeze: DkMigrationFreezeWindow): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Thimphu",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${fmt.format(freeze.start)} – ${fmt.format(freeze.end)} BTT`;
}

function isOff(raw: string | undefined): boolean {
  return raw?.trim().toLowerCase() === "off";
}

function parseOverride(raw: string | undefined): Date | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
