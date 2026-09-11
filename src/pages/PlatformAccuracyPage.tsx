import { FC } from "react";
import { Page } from "@/components/Page";
import { PlatformAccuracyPanel } from "@shared/components/PlatformAccuracy";

/**
 * Oro's track record, in public.
 *
 * Reached from Settings. The body is shared with the web app byte for byte;
 * only the shell differs, because the two have different headers and back
 * behaviour.
 */
export const PlatformAccuracyPage: FC = () => (
  <Page back={true}>
    <div style={{ padding: "16px 16px 100px" }}>
      <PlatformAccuracyPanel />
    </div>
  </Page>
);

export default PlatformAccuracyPage;
