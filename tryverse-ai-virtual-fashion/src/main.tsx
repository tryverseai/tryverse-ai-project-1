import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSentry } from "./lib/sentry";

try {
  initSentry();
} catch (e) {
  console.error("Sentry init failed:", e);
}

const rootEl = document.getElementById("root");
if (!rootEl) {
  document.body.innerHTML =
    "<p style=\"font-family:system-ui;padding:1.5rem\">TryVerse: missing #root in index.html.</p>";
} else {
  try {
    createRoot(rootEl).render(
      <Sentry.ErrorBoundary
        fallback={({ error, resetError }) => (
          <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
            <h1 className="text-lg font-semibold text-foreground mb-2">Something went wrong</h1>
            <p className="text-sm text-muted-foreground mb-4 max-w-md text-center">{error?.message}</p>
            <button
              type="button"
              onClick={resetError}
              className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm font-medium"
            >
              Try again
            </button>
          </div>
        )}
        showDialog={false}
      >
        <App />
      </Sentry.ErrorBoundary>
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    rootEl.innerHTML = `<p style="font-family:system-ui;padding:1.5rem;max-width:40rem">TryVerse failed to start: ${msg}</p>`;
    console.error(e);
  }
}
