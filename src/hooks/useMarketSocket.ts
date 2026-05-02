import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const WS_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:3000"
).replace(/\/api\/?$/, "");

export interface MarketOutcomeUpdate {
  id: string;
  totalBetAmount: number;
  lmsrProbability: number | null;
  currentOdds: number;
}

export interface MarketUpdate {
  marketId: string;
  totalPool: number;
  outcomes: MarketOutcomeUpdate[];
}

/**
 * Subscribes to live market updates for a single market via WebSocket.
 * Returns the latest update payload (null until the first event arrives).
 *
 * Properly handles the bfcache: disconnects on pagehide (persisted) and
 * reconnects on pageshow (persisted) so the socket never blocks bfcache entry.
 */
const DEBOUNCE_MS = 300;

export function useMarketSocket(
  marketId: string | undefined,
): MarketUpdate | null {
  const [update, setUpdate] = useState<MarketUpdate | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep a stable ref to the current marketId so page-show handler can reconnect
  const marketIdRef = useRef(marketId);
  useEffect(() => {
    marketIdRef.current = marketId;
  }, [marketId]);

  const debouncedSetUpdate = useCallback((payload: MarketUpdate) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setUpdate(payload), DEBOUNCE_MS);
  }, []);

  const connect = useCallback(
    (id: string) => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      const socket = io(`${WS_URL}/markets`, {
        query: { marketId: id },
        transports: ["websocket", "polling"],
        reconnectionDelay: 2000,
        reconnectionAttempts: 20,
      });

      socketRef.current = socket;

      socket.on("market_updated", (payload: MarketUpdate) => {
        if (payload.marketId === id) {
          debouncedSetUpdate(payload);
        }
      });

      socket.on("connect_error", (err) => {
        console.warn(`[WS] connect_error: ${err.message}`);
      });
    },
    [debouncedSetUpdate],
  );

  const disconnect = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!marketId) return;

    connect(marketId);

    // ── bfcache: disconnect on pagehide, reconnect on pageshow ──────────────
    const handlePageHide = (e: PageTransitionEvent) => {
      if (e.persisted) disconnect();
    };
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted && marketIdRef.current) connect(marketIdRef.current);
    };

    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
      disconnect();
    };
  }, [marketId, connect, disconnect]);

  return update;
}
