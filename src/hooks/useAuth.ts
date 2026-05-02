import { useState, useEffect, useCallback } from "react";
import { initData as tmaInitData } from "@tma.js/sdk-react";
import {
  loginWithTelegram,
  getMe,
  clearToken,
  getToken,
  AuthUser,
} from "@shared/api/client";

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: getToken(),
    loading: true,
    error: null,
  });

  const initialize = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      // ── Case 1: already have a stored token ──────────────────────────────
      if (getToken()) {
        try {
          const user = await getMe();
          setState({ user, token: getToken(), loading: false, error: null });
          return;
        } catch {
          // Token expired or invalid — fall through to re-login
          clearToken();
        }
      }

      // ── Case 2: use TMA SDK's initData (works in real Telegram AND mock) ─
      // Prefer window.Telegram.WebApp.initData (exact string Telegram signed).
      // Fall back to tmaInitData.raw() only when the TMA SDK has been
      // initialized (i.e. inside Telegram). In the PWA path the SDK is never
      // initialized and .raw() throws, so we skip it entirely.
      const telegramInitData = (window as any).Telegram?.WebApp?.initData;
      let sdkRaw: string | undefined;
      if (!telegramInitData) {
        try {
          sdkRaw = tmaInitData.raw();
        } catch {
          // TMA SDK not initialized (PWA path) — ignore
        }
      }
      const raw = telegramInitData || sdkRaw;
      if (raw) {
        // Pass the deep-link start_param so the backend can record the referrer.
        // Format: t.me/OroPredictBot?start=ref_<telegramId>
        const startParam: string | undefined = (window as any).Telegram?.WebApp
          ?.initDataUnsafe?.start_param;
        const referralCode = startParam?.startsWith("ref_")
          ? startParam
          : undefined;
        const { user, token } = await loginWithTelegram(raw, referralCode);
        setState({ user, token, loading: false, error: null });
        return;
      }

      setState({
        user: null,
        token: null,
        loading: false,
        error: "No Telegram initData available",
      });
    } catch (err: any) {
      setState({
        user: null,
        token: null,
        loading: false,
        error: err.message || "Login failed",
      });
    }
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const logout = () => {
    clearToken();
    setState({ user: null, token: null, loading: false, error: null });
  };

  return { ...state, logout, retry: initialize };
}
