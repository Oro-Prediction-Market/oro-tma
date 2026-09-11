import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  bustCache,
  getSavedMarketIds,
  getToken,
  saveMarket,
  unsaveMarket,
} from "../api/client";

/**
 * Which markets the signed-in user has saved.
 *
 * A module-level store rather than a React context: bookmark buttons appear on
 * every feed card, on every market detail page, and on the saved list itself —
 * three trees in two apps with different roots. A store needs no provider
 * mounted in either, so adding a bookmark somewhere new costs one import.
 *
 * The set is fetched once per session (ids only — a few hundred bytes) and
 * kept in step by the toggle, so a card knows whether it is saved without
 * asking the server.
 */

const EMPTY: ReadonlySet<string> = new Set<string>();

let ids: ReadonlySet<string> = EMPTY;
/** The token the set was loaded under — a different one means a different user. */
let loadedFor: string | null = null;
let inflight = false;

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): ReadonlySet<string> {
  return ids;
}

/** Always a new Set, never a mutation: identity is what tells React to redraw. */
function setIds(next: ReadonlySet<string>) {
  ids = next;
  listeners.forEach((l) => l());
}

/**
 * Load the set if it is not already loaded for the current session.
 *
 * Called from every bookmark button's mount, which is what picks the set up
 * after a sign-in that happened later than the first render: signed out it is
 * a no-op, and once loaded it is a no-op too.
 */
export function loadSavedMarkets(force = false) {
  const token = getToken();

  if (!token) {
    // Signed out. Drop anything held so the next account starts clean.
    if (loadedFor !== null) {
      loadedFor = null;
      setIds(EMPTY);
    }
    return;
  }

  if (inflight) return;
  if (!force && loadedFor === token) return;

  inflight = true;
  loadedFor = token;
  getSavedMarketIds()
    .then((list) => setIds(new Set(list)))
    .catch(() => {
      // Leave the set as it is and allow a later mount to retry. A failed load
      // must not draw every bookmark hollow — that would read as "unsaved".
      loadedFor = null;
    })
    .finally(() => {
      inflight = false;
    });
}

/**
 * Save or unsave, optimistically.
 *
 * The icon fills on tap and the request follows. On failure it goes back,
 * because a bookmark that looks saved and is not is worse than one that
 * visibly refused. Returns the new state.
 */
export async function toggleSavedMarket(marketId: string): Promise<boolean> {
  if (!getToken()) throw new Error("Sign in to save a market");

  const wasSaved = ids.has(marketId);
  const optimistic = new Set(ids);
  if (wasSaved) optimistic.delete(marketId);
  else optimistic.add(marketId);
  setIds(optimistic);

  try {
    if (wasSaved) await unsaveMarket(marketId);
    else await saveMarket(marketId);
    // The list endpoint is GET-cached by path; the toggle is what invalidates
    // it, or the saved page would show the list as it was a minute ago.
    bustCache("/users/me/saved-markets");
    return !wasSaved;
  } catch (e) {
    // Undo against the current set rather than restoring the captured one, so
    // a second toggle that landed in between is not thrown away.
    const reverted = new Set(ids);
    if (wasSaved) reverted.add(marketId);
    else reverted.delete(marketId);
    setIds(reverted);
    throw e;
  }
}

/** Forget everything — a sign-out, so the next account does not inherit it. */
export function resetSavedMarkets() {
  loadedFor = null;
  setIds(EMPTY);
}

if (typeof window !== "undefined") {
  window.addEventListener("oro:unauthorized", resetSavedMarkets);
}

export function useSavedMarkets() {
  const savedIds = useSyncExternalStore(subscribe, snapshot, snapshot);

  useEffect(() => {
    loadSavedMarkets();
  }, []);

  const isSaved = useCallback(
    (marketId: string) => savedIds.has(marketId),
    [savedIds],
  );

  return { savedIds, isSaved, toggle: toggleSavedMarket, signedIn: !!getToken() };
}
