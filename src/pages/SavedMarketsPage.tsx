import { FC, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Page } from "@/components/Page";
import { SavedMarketsPanel } from "@shared/components/SavedMarkets";
import { calcProb } from "@/pages/WorldCupHubPage";
import type { Market } from "@shared/api/client";

/**
 * The two formatters the shared list needs, in this app's terms.
 *
 * Exported because the public profile renders the same list for someone else
 * and has to format it identically — a saved market should not read one way on
 * your own page and another on a visitor's.
 */
export function useSavedFormatters() {
  const probOf = useCallback(
    (market: Market, outcomeId: string) => calcProb(market, outcomeId),
    [],
  );

  /** An empty pool is an invitation, not a zero — the same wording the feed uses. */
  const poolLabel = useCallback((market: Market) => {
    const pool = Number(market.totalPool ?? 0);
    return pool > 0 ? `Nu ${pool.toLocaleString()}` : "Be the first to predict";
  }, []);

  return { probOf, poolLabel };
}

/**
 * The markets this account has bookmarked.
 *
 * The list itself is shared with the web app byte for byte; what differs is
 * the shell and the two formatters handed in — this app has one currency, so
 * pools are ngultrum and the probability needs no currency argument.
 */
export const SavedMarketsPage: FC = () => {
  const navigate = useNavigate();
  const { probOf, poolLabel } = useSavedFormatters();

  return (
    <Page back={true}>
      <div style={{ padding: "16px 16px 100px" }}>
        <SavedMarketsPanel
          probOf={probOf}
          poolLabel={poolLabel}
          onOpen={(id) => navigate(`/market/${id}`)}
          onBrowse={() => navigate("/")}
        />
      </div>
    </Page>
  );
};

export default SavedMarketsPage;
