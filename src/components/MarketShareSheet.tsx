import { FC } from "react";
import type { Market } from "@shared/api/client";
import { BottomSheet } from "@/components/ui/Modal";
import {
  MarketShareCard,
  marketOutcomeChances,
  type MarketShareOutcome,
  type MarketShareTheme,
} from "@/components/MarketShareCard";

interface MarketShareSheetProps {
  open: boolean;
  onClose: () => void;
  market: Market;
  /** Card title. Defaults to the market's group title / title. */
  title?: string;
  /** Accent colour so the card matches this market's theme. */
  accentColor?: string;
  /** Override outcomes (relabelled / recoloured per market type). Defaults to
   *  the honest pool-share chances for the market's own outcomes. */
  outcomes?: MarketShareOutcome[];
  /** Current user's referral id (telegramId) for the deep link. */
  referralId?: string;
  theme?: MarketShareTheme;
}

/**
 * Bottom sheet that previews the shareable market card and offers Share/Download.
 * Every market-type detail view renders one of these; only `accentColor` and
 * (optionally) `outcomes` change so each card matches its market's look.
 */
export const MarketShareSheet: FC<MarketShareSheetProps> = ({
  open,
  onClose,
  market,
  title,
  accentColor,
  outcomes,
  referralId,
  theme,
}) => (
  <BottomSheet open={open} onClose={onClose} title="Share market" theme={theme}>
    <div style={{ padding: "0 16px 8px" }}>
      <MarketShareCard
        marketTitle={(title ?? market.groupTitle ?? market.title ?? "").trim()}
        outcomes={outcomes ?? marketOutcomeChances(market)}
        accentColor={accentColor}
        poolAmount={Number(market.totalPool) || 0}
        marketId={market.id}
        referralId={referralId}
        theme={theme}
      />
    </div>
  </BottomSheet>
);
