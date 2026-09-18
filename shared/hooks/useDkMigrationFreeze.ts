import { useEffect, useMemo, useState } from "react";
import {
  DkMigrationFreezeWindow,
  isDkMigrationFreezeActive,
  resolveDkMigrationFreezeWindow,
} from "@shared/helpers/dkMigrationWindow";

export interface DkMigrationFreezeState {
  /** True only while the migration window is open. */
  active: boolean;
  /** null when the freeze has been switched off entirely. */
  freeze: DkMigrationFreezeWindow | null;
}

/**
 * Tracks the DK Bank migration freeze and flips across each boundary on its own.
 *
 * The wallet is a page people leave open, so this cannot be read once at mount:
 * someone sitting on it at 10:59 pm has to watch the buttons close, and someone
 * who left a tab open overnight has to find them working again at 8 am without
 * reloading.
 *
 * It only re-renders when the answer actually changes. A wallet page that
 * re-rendered every tick for a boundary still hours away would cost far more
 * than this feature is worth.
 *
 * A wrong device clock gets the wrong answer here, which is why the backend
 * enforces the same window on the DK Bank endpoints. This hook makes the
 * closure visible; it is not what makes it true.
 */
export function useDkMigrationFreeze(): DkMigrationFreezeState {
  const freeze = useMemo(() => resolveDkMigrationFreezeWindow(), []);
  const [active, setActive] = useState(() => isDkMigrationFreezeActive(freeze));

  useEffect(() => {
    if (!freeze) return;

    let timer: ReturnType<typeof setTimeout> | undefined;

    const check = () => {
      const now = Date.now();
      // Returning `was` unchanged lets React bail out of the render entirely.
      setActive((was) => {
        const is = isDkMigrationFreezeActive(freeze, now);
        return is === was ? was : is;
      });

      // Past the end there is no next boundary and never will be — stop.
      if (now >= freeze.end.getTime()) return;

      const boundary =
        now < freeze.start.getTime() ? freeze.start.getTime() : freeze.end.getTime();
      // Capped so a timer scheduled days out doesn't drift or get throttled
      // into uselessness; floored so we never spin on a boundary we just hit.
      timer = setTimeout(check, Math.min(Math.max(boundary - now, 250), 60_000));
    };

    check();

    // A phone asleep at 8 am fires its timer late, so re-check on the way back
    // in rather than making the user wait out the rest of the interval.
    document.addEventListener("visibilitychange", check);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [freeze]);

  return { active, freeze };
}
