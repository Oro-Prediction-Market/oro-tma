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
import { trackEvent } from "@shared/api/client";

export function App() {
  const lp = useLaunchParams();
  const { theme } = useTheme();
  const auth = useAuth();
  const { loading, requiresKYC } = auth;
  const shouldOnboard = useOnboarding();
  const [showOnboarding, setShowOnboarding] = useState(shouldOnboard);

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    trackEvent({ eventType: "app.open", platform: "tma" });
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
      <HashRouter>
        <RouteTracker />
        <div
          style={{
            paddingBottom: 80,
            minHeight: "100vh",
            position: "relative",
          }}
        >
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
