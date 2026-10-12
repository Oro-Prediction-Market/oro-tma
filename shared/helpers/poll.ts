/**
 * Timers for screens that keep themselves fresh.
 *
 * A backgrounded tab or a minimised Mini App kept polling at full rate —
 * a phone in a pocket fetching the feed six times a minute for nobody. And a
 * burst of live pushes (a busy market, several bets a second) triggered one
 * reload each.
 */

/**
 * `setInterval` that sits out while the page is hidden and runs once as soon
 * as it is shown again, so a returning user never looks at data older than
 * they would have before. Where the platform never reports hidden (some
 * webviews), it behaves exactly like a plain interval.
 *
 * Returns the cleanup.
 */
export function pollWhileVisible(fn: () => void, ms: number): () => void {
  const id = setInterval(() => {
    if (!document.hidden) fn();
  }, ms);
  const onVisibility = () => {
    if (!document.hidden) fn();
  };
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    clearInterval(id);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

/**
 * Collapse calls made within `ms` of the first into one run at the end of
 * that window. Unlike a debounce, a steady stream cannot postpone it forever:
 * the run is at most `ms` after the first call.
 */
export function coalesce(fn: () => void, ms: number): (() => void) & { cancel(): void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const call = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      fn();
    }, ms);
  };
  call.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return call;
}
