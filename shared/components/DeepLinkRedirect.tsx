import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { retrieveLaunchParams } from "@tma.js/sdk-react";
import { getChallengePreview } from "@shared/api/client";

/**
 * Routes a Telegram deep link to the place it actually points at.
 *
 * The share links we mint carry a target the app has, until now, thrown away:
 *   - `ref_<telegramId>_m_<marketId>`  — "Challenge a Friend" on a market
 *   - `m_<marketId>`                   — a bare market link
 *   - `challenge_<id>`                 — a duel invite
 *
 * `useAuth` reads the `ref_` half for referral credit; the market/challenge
 * half was never used, so every shared link dumped the recipient on the feed
 * instead of the market their friend was talking about. This component reads
 * the launch param once and navigates to `/market/:id`.
 *
 * Mounted inside the router. It only redirects on the very first landing (path
 * "/") and only once per app load, so it never fights the user's own taps.
 */

// Module-level so a component remount (e.g. React strict mode) can't re-fire it.
let handled = false;

// A new user tapping a share link hits the onboarding screen FIRST — the router
// (and this component) only mount after sign-up. By then the launch param can be
// gone. So we stash the target in sessionStorage the moment the app opens (see
// captureStartParam, called from App before the onboarding gate) and read it
// back here after sign-up. Keyed separately from referral capture.
const DEEPLINK_KEY = "oro_pending_deeplink";

function rawStartParam(): string | undefined {
  try {
    const fromSdk = retrieveLaunchParams().tgWebAppStartParam;
    if (fromSdk) return fromSdk;
  } catch {
    // SDK not initialized (e.g. non-Telegram env) — fall through.
  }
  return (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param;
}

/**
 * Persist the deep-link target as early as possible — BEFORE the onboarding
 * gate — so it survives a brand-new user's sign-up flow. No-op unless the launch
 * param actually points at a market or challenge.
 */
export function captureStartParam(): void {
  try {
    const p = rawStartParam();
    if (p && (marketIdFromStartParam(p) || challengeIdFromStartParam(p))) {
      sessionStorage.setItem(DEEPLINK_KEY, p);
    }
  } catch {
    // sessionStorage unavailable — the live launch param is still the fallback.
  }
}

function readStartParam(): string | undefined {
  // Prefer the stashed target (survives onboarding), then the live launch param.
  try {
    const stashed = sessionStorage.getItem(DEEPLINK_KEY);
    if (stashed) return stashed;
  } catch {
    // ignore
  }
  return rawStartParam();
}

function clearStashedParam(): void {
  try {
    sessionStorage.removeItem(DEEPLINK_KEY);
  } catch {
    // ignore
  }
}

/** Pull the market id out of any of the deep-link shapes, or null. */
export function marketIdFromStartParam(param: string | undefined): string | null {
  if (!param) return null;
  if (param.includes("_m_")) {
    const id = param.split("_m_")[1];
    return id || null;
  }
  if (param.startsWith("m_")) {
    const id = param.slice(2);
    return id || null;
  }
  return null;
}

/** Pull the challenge id out of a `challenge_<id>` deep link, or null. */
export function challengeIdFromStartParam(
  param: string | undefined,
): string | null {
  if (!param || !param.startsWith("challenge_")) return null;
  const id = param.slice("challenge_".length);
  return id || null;
}

export function DeepLinkRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (handled) return;
    // Only act on the initial landing — never override in-app navigation.
    if (location.pathname !== "/") return;

    const param = readStartParam();
    const marketId = marketIdFromStartParam(param);
    const challengeId = challengeIdFromStartParam(param);

    if (marketId) {
      handled = true;
      clearStashedParam();
      navigate(`/market/${marketId}`, { replace: true });
      return;
    }

    if (challengeId) {
      handled = true;
      clearStashedParam();
      // A challenge has no page of its own — resolve it to its market so the
      // recipient lands where the duel actually lives, with context in state.
      getChallengePreview(challengeId)
        .then((preview) => {
          if (preview?.marketId) {
            navigate(`/market/${preview.marketId}`, {
              replace: true,
              state: { challenge: preview },
            });
          }
        })
        .catch(() => {
          /* invalid/expired challenge — leave them on the feed */
        });
    }
  }, [location.pathname, navigate]);

  return null;
}
