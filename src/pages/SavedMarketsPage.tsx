import { FC, useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Page } from "@/components/Page";
import { SavedMarketsPanel } from "@shared/components/SavedMarkets";
import { calcProb } from "@/pages/WorldCupHubPage";
import { getPublicProfile, type Market } from "@shared/api/client";

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
 * A saved-markets list — yours at /saved, someone else's at /saved/:id.
 *
 * One page for both, because the list is the same list; what changes is whose
 * it is and whether the rows can be unsaved. The alternative was a second
 * near-identical page that would drift the first time either was touched.
 *
 * The list itself is shared with the web app byte for byte; what differs is
 * the shell and the two formatters handed in — this app has one currency, so
 * pools are ngultrum and the probability needs no currency argument.
 */
export const SavedMarketsPage: FC = () => {
  const navigate = useNavigate();
  const { id: ownerId } = useParams();
  const { probOf, poolLabel } = useSavedFormatters();
  const [ownerName, setOwnerName] = useState<string | undefined>();

  // Only to name the empty state. A failure here leaves the list intact and
  // falls back to "This predictor" — not worth blocking the page for.
  useEffect(() => {
    if (!ownerId) return;
    let live = true;
    getPublicProfile(ownerId)
      .then((p) => {
        if (live)
          setOwnerName(
            p.username ? `@${p.username}` : (p.firstName ?? "This predictor"),
          );
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [ownerId]);

  return (
    <Page back={true}>
      <div style={{ padding: "16px 16px 100px" }}>
        {ownerId && (
          <p
            style={{
              margin: "0 0 12px",
              fontSize: "0.78rem",
              fontWeight: 700,
              color: "var(--text-muted)",
            }}
          >
            Markets {ownerName ?? "this predictor"} is watching
          </p>
        )}
        <SavedMarketsPanel
          userId={ownerId}
          ownerName={ownerName}
          probOf={probOf}
          poolLabel={poolLabel}
          onOpen={(mid) => navigate(`/market/${mid}`)}
          onBrowse={() => navigate("/")}
        />
      </div>
    </Page>
  );
};

export default SavedMarketsPage;
