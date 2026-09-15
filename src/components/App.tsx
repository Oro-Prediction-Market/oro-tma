import { Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes, HashRouter } from "react-router-dom";
import { useLaunchParams } from "@tma.js/sdk-react";
import { AppRoot } from "@telegram-apps/telegram-ui";
import { PwaBottomNav } from "@/components/PwaBottomNav";

import { routes } from "@/navigation/routes.tsx";
import { useTheme } from "@shared/hooks/useTheme";
import { useSSE } from "@shared/hooks/useSSE";
import { useAuth } from "@shared/hooks/useAuth";
import { OnboardingModal, useOnboarding } from "./OnboardingModal";
import { OnboardingPage } from "@/pages/OnboardingPage";
import { RouteTracker } from "@shared/components/RouteTracker";
import {
  DeepLinkRedirect,
  captureStartParam,
} from "@shared/components/DeepLinkRedirect";
import { ChallengeContextBanner } from "@shared/components/ChallengeContextBanner";
import { SystemNotificationModal } from "@/components/SystemNotificationModal";
import { ConsentGate } from "@shared/components/ConsentGate";
import { useConsentRequired } from "@shared/hooks/useConsentRequired";
import { TermsPage } from "@/pages/TermsPage";
import { trackEvent } from "@shared/api/client";

export function App() {
  const lp = useLaunchParams();
  const { theme } = useTheme();
  const auth = useAuth();
  const { loading, requiresKYC } = auth;
  const shouldOnboard = useOnboarding();
  const [showOnboarding, setShowOnboarding] = useState(shouldOnboard);
  // Only once a real account exists — a user still in the signup wizard has no
  // row to record consent against.
  const { consentRequired, acceptConsent } = useConsentRequired(
    !loading && !requiresKYC,
  );
  const [showTerms, setShowTerms] = useState(false);

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    trackEvent({ eventType: "app.open", platform: "tma" });
    // Stash any deep-link target NOW, before the onboarding gate below can
    // return early — so a brand-new user's market/challenge link survives
    // sign-up and DeepLinkRedirect can replay it once the router mounts.
    captureStartParam();
  }, []);

  // Connect to SSE for real-time server push (balance updates, market changes)
  useSSE();

  // Show full-screen onboarding for new users who haven't registered yet
  if (!loading && requiresKYC) {
    return (
      <AppRoot
        appearance={isDark ? "dark" : "light"}
        platform={["macos", "ios"].includes(lp.tgWebAppPlatform) ? "ios" : "base"}
      >
        <OnboardingPage auth={auth} />
      </AppRoot>
    );
  }

  return (
    <AppRoot
      appearance={isDark ? "dark" : "light"}
      platform={["macos", "ios"].includes(lp.tgWebAppPlatform) ? "ios" : "base"}
    >
      <HashRouter future={{ v7_startTransition: true }}>
        <RouteTracker />
        <DeepLinkRedirect />
        <div
          style={{
            paddingBottom: 80,
            minHeight: "100vh",
            position: "relative",
          }}
        >
          <ChallengeContextBanner />
          <SystemNotificationModal />
          {/* Blocks the app until this user has consented. Mounted here, beside
              the notification modal, because it is the same shape of thing: an
              app-level overlay that gates itself on a server-side flag. Below
              the requiresKYC gate above, so a user still registering is not
              asked to consent to an account that does not exist yet. */}
          <ConsentGate
            open={consentRequired}
            onAccept={acceptConsent}
            onDecline={auth.logout}
            onOpenTerms={() => setShowTerms(true)}
            onOpenPrivacy={() => setShowTerms(true)}
          />
          {showTerms && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 10000,
                overflowY: "auto",
                background: "var(--bg-main, #0f0f23)",
              }}
            >
              <TermsPage onBack={() => setShowTerms(false)} />
            </div>
          )}
          <Suspense
            fallback={
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: "50vh",
                  color: "var(--text-muted, #94a3b8)",
                }}
              >
                Loading…
              </div>
            }
          >
            <Routes>
              {routes.map((route) => (
                <Route key={route.path} {...route} />
              ))}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
        </div>
        <PwaBottomNav />
        {showOnboarding && (
          <OnboardingModal onDone={() => setShowOnboarding(false)} />
        )}
      </HashRouter>
    </AppRoot>
  );
}
