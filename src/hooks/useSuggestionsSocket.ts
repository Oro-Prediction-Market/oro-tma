import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type { MarketSuggestion } from "@shared/api/client";

const WS_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:3000"
).replace(/\/api\/?$/, "");

export interface SuggestionVoted {
  id: string;
  votes: number;
}

export type SuggestionAdded = Omit<MarketSuggestion, "votedByMe">;

export interface SuggestionRemoved {
  id: string;
}

export function useSuggestionsSocket(
  enabled: boolean,
  onVoted: (e: SuggestionVoted) => void,
  onAdded: (e: SuggestionAdded) => void,
  onRemoved?: (e: SuggestionRemoved) => void,
): void {
  const socketRef = useRef<Socket | null>(null);
  const onVotedRef = useRef(onVoted);
  const onAddedRef = useRef(onAdded);
  const onRemovedRef = useRef(onRemoved);

  useEffect(() => {
    onVotedRef.current = onVoted;
    onAddedRef.current = onAdded;
    onRemovedRef.current = onRemoved;
  }, [onVoted, onAdded, onRemoved]);

  const connect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const socket = io(`${WS_URL}/suggestions`, {
      transports: ["websocket", "polling"],
      reconnectionDelay: 2000,
      reconnectionAttempts: 20,
    });
    socketRef.current = socket;

    socket.on("suggestion_voted", (payload: SuggestionVoted) => {
      onVotedRef.current(payload);
    });
    socket.on("suggestion_added", (payload: SuggestionAdded) => {
      onAddedRef.current(payload);
    });
    socket.on("suggestion_removed", (payload: SuggestionRemoved) => {
      onRemovedRef.current?.(payload);
    });
    socket.on("connect_error", (err) => {
      console.warn(`[WS] suggestions connect_error: ${err.message}`);
    });
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    connect();

    const handlePageHide = (e: PageTransitionEvent) => {
      if (e.persisted) disconnect();
    };
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) connect();
    };

    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
      disconnect();
    };
  }, [enabled, connect, disconnect]);
}
