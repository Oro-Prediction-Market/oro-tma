import { TonConnectUIProvider } from "@tonconnect/ui-react";

import { App } from "./App.tsx";
import { ErrorBoundary } from "./ErrorBoundary.tsx";
import { publicUrl } from "@shared/helpers/publicUrl.ts";
import { ThemeProvider } from "@shared/contexts/ThemeContext";

function ErrorBoundaryError({ error }: { error: unknown }) {
  console.error("[Oro] Unhandled error:", error);
  const msg = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  return (
    <div
      style={{
        padding: "40px 24px",
        textAlign: "center",
        fontFamily: "sans-serif",
      }}
    >
      <p
        style={{
          fontSize: "1rem",
          fontWeight: 600,
          color: "#111",
          marginBottom: 12,
        }}
      >
        Something didn't load.
      </p>
      <p
        style={{
          fontSize: "0.75rem",
          color: "#e11d48",
          marginBottom: 12,
          wordBreak: "break-all",
        }}
      >
        {msg}
      </p>
      {stack && (
        <pre
          style={{
            fontSize: "0.65rem",
            color: "#666",
            textAlign: "left",
            maxHeight: 120,
            overflow: "auto",
            background: "#f3f4f6",
            borderRadius: 8,
            padding: 10,
            marginBottom: 16,
          }}
        >
          {stack}
        </pre>
      )}
      <p style={{ fontSize: "0.875rem", color: "#555", marginBottom: 24 }}>
        <button
          onClick={() => {
            window.location.replace("/#/");
          }}
          style={{
            background: "none",
            border: "none",
            color: "#6d28d9",
            textDecoration: "underline",
            cursor: "pointer",
            fontSize: "inherit",
            padding: 0,
          }}
        >
          Open Oro
        </button>
      </p>
    </div>
  );
}

export function Root() {
  return (
    <ErrorBoundary fallback={ErrorBoundaryError}>
      <ThemeProvider>
        <TonConnectUIProvider
          manifestUrl={publicUrl("tonconnect-manifest.json")}
        >
          <App />
        </TonConnectUIProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
