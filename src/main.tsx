import ReactDOM from "react-dom/client";
import { StrictMode } from "react";

import "@shared/index.css";
import "@telegram-apps/telegram-ui/dist/styles.css";

const root = ReactDOM.createRoot(document.getElementById("root")!);

import("./mockEnv.ts").then(() =>
  import("./init.ts").then(({ init }) =>
    init({
      debug: import.meta.env.DEV,
      eruda: false,
      mockForMacOS: false,
    }).then(() =>
      import("./components/Root.tsx").then(({ Root }) => {
        root.render(
          <StrictMode>
            <Root />
          </StrictMode>,
        );
      }),
    ),
  ),
);
