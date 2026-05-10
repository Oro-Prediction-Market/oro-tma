import { TonConnectUIProvider } from '@tonconnect/ui-react';

import { App } from './App.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { publicUrl } from '@shared/helpers/publicUrl.ts';
import { ThemeProvider } from '@shared/contexts/ThemeContext';

function ErrorBoundaryError({ error }: { error: unknown }) {
  console.error('[Oro] Unhandled error:', error);
  return (
    <div style={{ padding: '40px 24px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <p style={{ fontSize: '1rem', fontWeight: 600, color: '#111', marginBottom: 12 }}>
        Something didn't load.
      </p>
      <p style={{ fontSize: '0.875rem', color: '#555', marginBottom: 24 }}>
        <button
          onClick={() => { window.location.replace('/#/'); }}
          style={{
            background: 'none',
            border: 'none',
            color: '#6d28d9',
            textDecoration: 'underline',
            cursor: 'pointer',
            fontSize: 'inherit',
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
          manifestUrl={publicUrl('tonconnect-manifest.json')}
        >
          <App/>
        </TonConnectUIProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
