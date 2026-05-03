import { useEffect } from "react";
import { getToken } from "@shared/api/client";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

/**
 * Connects to the backend SSE stream and dispatches custom DOM events
 * when server-pushed notifications arrive (e.g. balance:updated).
 *
 * Pages can listen via: window.addEventListener("oro:balance-changed", ...)
 * (TmaWalletPage already does this.)
 *
 * Call this once at the app root level.
 */
export function useSSE() {
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      es = new EventSource(
        `${API_URL}/sse/stream?token=${encodeURIComponent(token)}`,
      );

      es.addEventListener("balance:updated", () => {
        window.dispatchEvent(new CustomEvent("oro:balance-changed"));
      });

      es.addEventListener("market:updated", (e: any) => {
        try {
          const data = JSON.parse(e.data || "{}");
          window.dispatchEvent(
            new CustomEvent("oro:market-changed", { detail: data }),
          );
        } catch {}
      });

      es.onerror = () => {
        es?.close();
        retryTimeout = setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      es?.close();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, []);
}
