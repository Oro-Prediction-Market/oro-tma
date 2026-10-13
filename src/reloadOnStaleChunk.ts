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

/** Long enough to stop a reload loop while pods on both builds are serving. */
const RELOAD_GUARD_MS = 10_000;
const RELOAD_KEY = "oro:chunk-reload-at";

/**
 * True when the server is now on a different build from the one this page
 * runs. A chunk that failed for any other reason — a dropped connection, being
 * offline — is not fixed by reloading, so that case is left alone.
 */
async function serverHasNewerBuild(): Promise<boolean> {
  const entry = document.querySelector<HTMLScriptElement>(
    'script[type="module"][src*="/assets/index-"]',
  );
  if (!entry) return false;
  const running = new URL(entry.src).pathname;
  try {
    const res = await fetch(import.meta.env.BASE_URL, { cache: "no-store" });
    if (!res.ok) return false;
    return !(await res.text()).includes(running);
  } catch {
    return false;
  }
}

function onPreloadError() {
  void serverHasNewerBuild().then((newer) => {
    if (!newer) return;
    // During a rolling deploy the reload can land on a pod still serving the
    // old build, so this can recur; the guard has to survive the reload, and
    // without storage there is no safe way to reload.
    try {
      const last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0;
      if (Date.now() - last < RELOAD_GUARD_MS) return;
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    } catch {
      return;
    }
    window.location.reload();
  });
}

export function reloadOnStaleChunk() {
  window.addEventListener("vite:preloadError", onPreloadError);
}
