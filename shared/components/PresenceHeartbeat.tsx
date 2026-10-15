import { useEffect, useSyncExternalStore } from "react";
import { feedHeartbeat } from "../api/client";

/**
 * "N online": everyone with the app open, on any page.
 *
 * The server counts sessions that checked in within the last 45 s, so a
 * check-in every 30 s keeps an open app counted. It used to run on the feed
 * only, which dropped anyone reading a market, their wallet or a hub.
 */
const INTERVAL_MS = 30_000;

let count: number | null = null;
const listeners = new Set<() => void>();

function sessionId(): string {
  let sid: string | null = null;
  try {
    sid = sessionStorage.getItem("oro_feed_sid");
  } catch {
    /* storage blocked: a fresh id per load still counts the visit */
  }
  if (!sid) {
    sid = crypto.randomUUID();
    try {
      sessionStorage.setItem("oro_feed_sid", sid);
    } catch {
      /* see above */
    }
  }
  return sid;
}

/** Mount once, at the app root. Renders nothing. */
export function PresenceHeartbeat() {
  useEffect(() => {
    const sid = sessionId();
    const ping = () => {
      // A backgrounded app is not online; it checks in again on return.
      if (document.visibilityState === "hidden") return;
      feedHeartbeat(sid)
        .then((r) => {
          count = r.count;
          listeners.forEach((l) => l());
        })
        .catch(() => {});
    };
    ping();
    const id = setInterval(ping, INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}

/** The latest count, or null until the first check-in answers. */
export function useOnlineCount(): number | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => count,
  );
}
