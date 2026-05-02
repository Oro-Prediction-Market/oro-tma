import { Placeholder, AppRoot } from "@telegram-apps/telegram-ui";
import { retrieveLaunchParams, isColorDark, isRGB } from "@tma.js/sdk-react";
import { useMemo } from "react";
import { OroLogo } from "@shared/components/OroLogo";

export function EnvUnsupported() {
  const [platform, isDark] = useMemo(() => {
    try {
      const lp = retrieveLaunchParams();
      const { bg_color: bgColor } = lp.tgWebAppThemeParams;
      return [
        lp.tgWebAppPlatform,
        bgColor && isRGB(bgColor) ? isColorDark(bgColor) : false,
      ];
    } catch {
      return ["android", false];
    }
  }, []);

  return (
    <AppRoot
      appearance={isDark ? "dark" : "light"}
      platform={["macos", "ios"].includes(platform) ? "ios" : "base"}
    >
      <Placeholder
        header="Oro - Parimutuel Prediction Markets"
        description="This app is only available through Telegram. Please open it in the Telegram app."
      >
        <div style={{ marginBottom: 24, display: "flex", justifyContent: "center" }}>
          <OroLogo size={120} />
        </div>
        <div style={{ marginTop: "2rem", padding: "0 1rem" }}>
          <p style={{ fontSize: "0.9rem", lineHeight: "1.5", color: "#888" }}>
            To access Oro prediction platform:
          </p>
          <ol
            style={{
              textAlign: "left",
              fontSize: "0.9rem",
              lineHeight: "1.8",
              color: "#888",
              marginTop: "1rem",
            }}
          >
            <li>Open Telegram on your device</li>
            <li>
              Search for <strong>@OroPredictBot</strong>
            </li>
            <li>Start the bot and tap "Open App"</li>
          </ol>
        </div>
      </Placeholder>
    </AppRoot>
  );
}
