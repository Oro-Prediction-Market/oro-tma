import { useEffect } from "react";
import { bustCache, getToken, onTokenChange, request } from "@shared/api/client";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const RETRY_MIN_MS = 5_000;
const RETRY_MAX_MS = 60_000;

/**
 * Connects to the backend SSE stream and dispatches custom DOM events
 * when server-pushed notifications arrive (e.g. balance:updated).
 *
 * Pages can listen via: window.addEventListener("oro:balance-changed", ...)
 * (TmaWalletPage already does this.)
 *
 * Call this once at the app root level. It follows the session: it connects
 * when a token arrives (sign-in finishes after the app has mounted), moves to
 * the new token when it changes, and disconnects on sign-out. Reading the
 * token only once at mount meant live updates never started on a fresh
 * sign-in or a reload.
 *
 * Each connection opens with a single-use ticket from POST /sse/ticket, so the
 * session token never goes into a URL (URLs end up in proxy logs).
 */
export function useSSE() {
  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let retryMs = RETRY_MIN_MS;
    // Bumped on every (re)start, so a ticket that arrives after the session
    // changed is dropped instead of opening a second stream.
    let generation = 0;

    const stop = () => {
      generation++;
      es?.close();
      es = null;
      if (retryTimeout) clearTimeout(retryTimeout);
      retryTimeout = null;
    };

    const retry = (gen: number) => {
      if (gen !== generation) return;
      es?.close();
      es = null;
      retryTimeout = setTimeout(() => connect(gen), retryMs);
      retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
    };

    const connect = async (gen: number) => {
      if (gen !== generation || !getToken()) return;
      let ticket: string;
      try {
        ({ ticket } = await request<{ ticket: string }>("/sse/ticket", {
          method: "POST",
        }));
      } catch {
        // A 401 here clears the token, which stops this loop via onTokenChange.
        retry(gen);
        return;
      }
      if (gen !== generation) return;

      es = new EventSource(
        `${API_URL}/sse/stream?ticket=${encodeURIComponent(ticket)}`,
      );

      es.onopen = () => {
        retryMs = RETRY_MIN_MS;
      };

      es.addEventListener("balance:updated", () => {
        // Drop the cached profile and ledger first. The GET cache serves a
        // stale copy while it revalidates, so every listener refetching on
        // this event would otherwise be handed the pre-change balance.
        bustCache("/users/me");
        window.dispatchEvent(new CustomEvent("oro:balance-changed"));
      });

      es.addEventListener("market:updated", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data || "{}");
          window.dispatchEvent(
            new CustomEvent("oro:market-changed", { detail: data }),
          );
        } catch {}
      });

      // The ticket is single-use, so the browser's own reconnect would be
      // refused: close and start over with a fresh ticket.
      es.onerror = () => retry(gen);
    };

    const start = () => {
      stop();
      retryMs = RETRY_MIN_MS;
      connect(generation);
    };

    start();
    const unsubscribe = onTokenChange(start);

    return () => {
      unsubscribe();
      stop();
    };
  }, []);
}
