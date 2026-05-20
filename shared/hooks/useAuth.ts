import { useState, useEffect, useCallback } from "react";
import { initData as tmaInitData } from "@tma.js/sdk-react";
import {
  loginWithTelegram,
  registerTelegramUser,
  getMe,
  clearToken,
  setToken,
  getToken,
  AuthUser,
  TelegramProfile,
} from "@shared/api/client";

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  /** Short-lived pre-KYC token held in memory only (never in localStorage). */
  preKycToken: string | null;
  loading: boolean;
  error: string | null;
  requiresKYC: boolean;
  telegramProfile: TelegramProfile | null;
  /** Referral code captured from Telegram startParam — forwarded to registration. */
  referralCode: string | null;
}

export interface UseAuth extends AuthState {
  logout: () => void;
  retry: () => void;
  /** Call after successful onboarding to swap the pre-KYC token for a full JWT. */
  onRegistered: (token: string, user: AuthUser) => void;
  /** Register a new user. Returns the registered user on success. */
  register: (
    username: string,
    fullName: string,
    otp: string,
    phoneNumber?: string,
    email?: string,
  ) => Promise<AuthUser>;
}

export function useAuth(): UseAuth {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: getToken(),
    preKycToken: null,
    loading: true,
    error: null,
    requiresKYC: false,
    telegramProfile: null,
    referralCode: null,
  });

  const initialize = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const telegramInitData = (window as any).Telegram?.WebApp?.initData;
      const startParam: string | undefined = (window as any).Telegram?.WebApp
        ?.initDataUnsafe?.start_param;
      const referralCode = startParam?.startsWith("ref_")
        ? startParam
        : undefined;

      if (getToken() && !referralCode) {
        try {
          const user = await getMe();
          setState((s) => ({
            ...s,
            user,
            token: getToken(),
            loading: false,
            error: null,
          }));
          return;
        } catch {
          clearToken();
        }
      }

      let sdkRaw: string | undefined;
      if (!telegramInitData) {
        try {
          sdkRaw = tmaInitData.raw();
        } catch {
          // TMA SDK not initialized
        }
      }
      const raw = telegramInitData || sdkRaw;
      if (!raw) {
        setState((s) => ({
          ...s,
          user: null,
          token: null,
          loading: false,
          error: "No Telegram initData available",
        }));
        return;
      }

      const result = await loginWithTelegram(raw, referralCode);

      if (result.requiresKYC || !result.user) {
        // New user — hold pre-KYC token in memory, not localStorage
        setState((s) => ({
          ...s,
          user: null,
          token: null,
          preKycToken: result.token,
          requiresKYC: true,
          telegramProfile: result.telegramProfile ?? null,
          referralCode: referralCode ?? result.referralCode ?? null,
          loading: false,
          error: null,
        }));
      } else {
        setState((s) => ({
          ...s,
          user: result.user!,
          token: result.token,
          preKycToken: null,
          requiresKYC: false,
          telegramProfile: null,
          referralCode: null,
          loading: false,
          error: null,
        }));
      }
    } catch (err: any) {
      setState((s) => ({
        ...s,
        user: null,
        token: null,
        loading: false,
        error: err.message || "Login failed",
      }));
    }
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const logout = useCallback(() => {
    clearToken();
    setState({
      user: null,
      token: null,
      preKycToken: null,
      loading: false,
      error: null,
      requiresKYC: false,
      telegramProfile: null,
      referralCode: null,
    });
  }, []);

  const onRegistered = useCallback((token: string, user: AuthUser) => {
    setToken(token);
    setState((s) => ({
      ...s,
      user,
      token,
      preKycToken: null,
      requiresKYC: false,
      telegramProfile: null,
      referralCode: null,
      loading: false,
      error: null,
    }));
  }, []);

  const register = useCallback(
    async (
      username: string,
      fullName: string,
      otp: string,
      phoneNumber?: string,
      email?: string,
    ): Promise<AuthUser> => {
      const preKycToken = state.preKycToken;
      if (!preKycToken) throw new Error("No pre-KYC token. Please restart.");

      const result = await registerTelegramUser(
        {
          username,
          fullName,
          otp,
          phoneNumber,
          email,
          referralCode: state.referralCode ?? undefined,
          photoUrl: state.telegramProfile?.photoUrl ?? undefined,
        },
        preKycToken,
      );
      // Delay UI transition so success screen can be shown first
      setTimeout(() => onRegistered(result.token, result.user), 1500);
      return result.user;
    },
    [state.preKycToken, state.referralCode, onRegistered],
  );

  return { ...state, logout, retry: initialize, onRegistered, register };
}
