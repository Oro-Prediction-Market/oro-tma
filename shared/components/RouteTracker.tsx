import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useTrack } from "../hooks/useTrack";

const ROUTE_LABELS: Record<string, string> = {
  "/": "feed",
  "/leaderboard": "leaderboard",
  "/challenges": "challenges",
  "/wallet": "wallet",
  "/profile": "profile",
};

const KNOWN_PATHS = new Set(Object.keys(ROUTE_LABELS));

/** Drop inside HashRouter — fires page.view on every route change. */
export function RouteTracker() {
  const location = useLocation();
  const track = useTrack();
  const prevPath = useRef<string | null>(null);

  useEffect(() => {
    if (location.pathname === prevPath.current) return;
    prevPath.current = location.pathname;

    // Only track recognised app routes — reject anything that looks like
    // Telegram init data leaking into the hash path on first load.
    if (!KNOWN_PATHS.has(location.pathname)) return;

    const page = ROUTE_LABELS[location.pathname];
    track("page.view", { page });
  }, [location.pathname, track]);

  return null;
}
