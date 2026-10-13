/**
 * Recovery from a deploy under an open mini app.
 *
 * Pages load their code on first visit, from files whose names change with
 * every build. Someone who opened the app before a deploy still runs the old
 * build, and the first page they open afterwards asks for a file the server no
 * longer has — "Something didn't load" until they close and reopen the app.
 *
 * Reloading at that moment lands them on the current build, on the page they
 * tapped. It is a navigation, so nothing half-typed is on screen to lose.
 */

/** Long enough that a chunk which is really broken does not reload in a loop. */
const RELOAD_GUARD_MS = 10_000;
const RELOAD_KEY = "oro:chunk-reload-at";

export function reloadOnStaleChunk() {
  window.addEventListener("vite:preloadError", (event) => {
    let last = 0;
    try {
      last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0;
    } catch {
      /* storage blocked: fall through and reload once */
    }
    if (Date.now() - last < RELOAD_GUARD_MS) return;
    try {
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    } catch {
      /* storage blocked */
    }
    event.preventDefault();
    window.location.reload();
  });
}
