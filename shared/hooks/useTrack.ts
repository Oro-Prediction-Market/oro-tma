import { useCallback, useRef } from "react";
import { trackEvent } from "../api/client";

const PLATFORM: "tma" | "pwa" = window.Telegram?.WebApp ? "tma" : "pwa";

/** Stable session ID for the lifetime of this page load */
const SESSION_ID = crypto.randomUUID();

/**
 * Returns a stable `track` function that fires behavioural events
 * to POST /events. Fire-and-forget — never throws, never awaited.
 *
 * Usage:
 *   const track = useTrack();
 *   track("page.view", { page: "feed" });
 *   track("market.view", { marketId, marketTitle });
 */
export function useTrack() {
  const trackRef = useRef(
    (eventType: string, meta?: Record<string, any>) => {
      trackEvent({ eventType, sessionId: SESSION_ID, platform: PLATFORM, meta });
    },
  );
  return useCallback(
    (eventType: string, meta?: Record<string, any>) =>
      trackRef.current(eventType, meta),
    [],
  );
}
