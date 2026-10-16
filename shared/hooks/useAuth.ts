import { useEffect, useSyncExternalStore } from "react";
import {
  initData as tmaInitData,
  retrieveLaunchParams,
} from "@tma.js/sdk-react";
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

const SIGNED_OUT: AuthState = {
  user: null,
  token: null,
  preKycToken: null,
  loading: false,
  error: null,
  requiresKYC: false,
  telegramProfile: null,
  referralCode: null,
};

/**
 * One sign-in state for the whole app.
 *
 * Every screen used to run its own copy of this hook, each with its own state
 * and its own sign-in. Opened from a referral link, each of them called
 * /auth/telegram again — a new user got several logins racing each other
 * (the duplicate-login error), and a pre-KYC token held by one screen was
 * invisible to the rest. Now the sign-in runs once per app open and every
 * caller reads the same state. A screen that mounts later refreshes the
 * user from /users/me (a cached GET), as each screen's own sign-in used to.
 */
let state: AuthState = { ...SIGNED_OUT, token: getToken(), loading: true };
const listeners = new Set<() => void>();
let started = false;
let inflight: Promise<void> | null = null;

function setAuth(next: (s: AuthState) => AuthState) {
  state = next(state);
  listeners.forEach((l) => l());
}

async function runInitialize(): Promise<void> {
  // A re-check while signed in (Settings' retry) must not put the whole app
  // back behind its loading screen: every screen now shares this state.
  setAuth((s) => ({ ...s, loading: !s.user, error: null }));

  try {
    const telegramInitData = (window as any).Telegram?.WebApp?.initData;
    // Resolve the deep-link start param. This app runs on the @tma.js SDK and
    // does NOT load the legacy telegram-web-app.js, so window.Telegram.WebApp
    // (and its initDataUnsafe.start_param) is usually absent — read from the
    // SDK's launch params first, falling back to the global if present.
    let startParam: string | undefined;
    try {
      startParam = retrieveLaunchParams().tgWebAppStartParam;
    } catch {
      // SDK not initialized (e.g. non-Telegram env) — ignore.
    }
    if (!startParam) {
      startParam = (window as any).Telegram?.WebApp?.initDataUnsafe
        ?.start_param;
    }
    const referralCode = startParam?.startsWith("ref_")
      ? startParam
      : undefined;

    if (getToken() && !referralCode) {
      try {
        const user = await getMe();
        setAuth((s) => ({
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
      setAuth((s) => ({
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
      setAuth((s) => ({
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
      setAuth((s) => ({
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
    setAuth((s) => ({
      ...s,
      user: null,
      token: null,
      loading: false,
      error: err.message || "Login failed",
    }));
  }
}

/** Sign in, or re-check the session. Concurrent calls share one attempt. */
function initialize(): Promise<void> {
  if (!inflight) {
    inflight = runInitialize().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/**
 * A refused session (expired, or ended by "sign out everywhere") signs in
 * again from Telegram's launch data, as the next screen used to when every
 * screen signed itself in. The user stays on screen meanwhile. At most once a
 * minute, so a server that keeps refusing cannot start a login loop; if the
 * launch data is too old (over 24 h) the sign-in fails and the app shows
 * signed out, as before.
 */
const RECOVERY_GAP_MS = 60_000;
let lastRecovery = 0;
if (typeof window !== "undefined") {
  window.addEventListener("oro:unauthorized", () => {
    if (!started || Date.now() - lastRecovery < RECOVERY_GAP_MS) return;
    lastRecovery = Date.now();
    initialize();
  });
}

/** A later screen's mount: pick up a changed balance or profile. */
function refreshUser() {
  const id = state.user?.id;
  if (!id || inflight) return;
  getMe()
    .then((user) => {
      if (state.user?.id === id) setAuth((s) => ({ ...s, user }));
    })
    .catch(() => {});
}

function logout() {
  clearToken();
  setAuth(() => SIGNED_OUT);
}

function onRegistered(token: string, user: AuthUser) {
  setToken(token);
  setAuth((s) => ({
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
}

async function register(
  username: string,
  fullName: string,
  otp: string,
  phoneNumber?: string,
  email?: string,
): Promise<AuthUser> {
  const { preKycToken, referralCode, telegramProfile } = state;
  if (!preKycToken) throw new Error("No pre-KYC token. Please restart.");

  const result = await registerTelegramUser(
    {
      username,
      fullName,
      otp,
      phoneNumber,
      email,
      referralCode: referralCode ?? undefined,
      photoUrl: telegramProfile?.photoUrl ?? undefined,
    },
    preKycToken,
  );
  // Delay UI transition so success screen can be shown first
  setTimeout(() => onRegistered(result.token, result.user), 1500);
  return result.user;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useAuth(): UseAuth {
  const current = useSyncExternalStore(subscribe, () => state);

  useEffect(() => {
    if (!started) {
      started = true;
      initialize();
    } else {
      refreshUser();
    }
  }, []);

  return { ...current, logout, retry: initialize, onRegistered, register };
}
