import type { FC, ReactNode } from "react";
import { TonConnectUIProvider } from "@tonconnect/ui-react";

import { publicUrl } from "@shared/helpers/publicUrl.ts";
import { TONBetPage } from "@/pages/TONBetPage";
import { TONConnectPage } from "@/pages/TONConnectPage/TONConnectPage";

/**
 * The TON pages, each inside the TonConnect provider.
 *
 * Only these two pages use TonConnect, so the provider lives here rather than
 * at the app root: that kept about 376 KB of wallet code in every user's
 * startup download. The routes load this file lazily.
 *
 * The library keeps one TonConnectUI instance per page load and hands it to
 * every provider that mounts, so moving between the two pages keeps the
 * connected wallet, and a saved session is restored on the first mount.
 */
const WithTon: FC<{ children: ReactNode }> = ({ children }) => (
  <TonConnectUIProvider manifestUrl={publicUrl("tonconnect-manifest.json")}>
    {children}
  </TonConnectUIProvider>
);

export const TonBetRoute: FC = () => (
  <WithTon>
    <TONBetPage />
  </WithTon>
);

export const TonConnectRoute: FC = () => (
  <WithTon>
    <TONConnectPage />
  </WithTon>
);
