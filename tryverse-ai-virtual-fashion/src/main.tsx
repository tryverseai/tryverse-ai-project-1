import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
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
  // Load the app asynchronously so import-time errors (e.g. invalid env, bad modules)
  // surface here instead of a silent blank page.
  void import("./App.tsx")
    .then(({ default: App }) => {
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
        rootEl.innerHTML = `<p style="font-family:system-ui;padding:1.5rem;max-width:40rem;color:#111">TryVerse failed to start: ${msg}</p>`;
        console.error(e);
      }
    })
    .catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      const stack = e instanceof Error ? e.stack ?? "" : "";
      rootEl.innerHTML = `<div style="font-family:system-ui;padding:1.5rem;max-width:44rem;color:#111;background:#fff">
        <p style="font-weight:600;margin-bottom:0.5rem;font-size:18px">TryVerse could not load</p>
        <p style="font-size:14px;line-height:1.5;margin-bottom:1rem;opacity:0.9">Copy <code style="background:#f4f4f5;padding:2px 6px;border-radius:4px">tryverse-ai-virtual-fashion/.env.example</code> to <code style="background:#f4f4f5;padding:2px 6px;border-radius:4px">.env</code> and set Supabase keys. Open the app at <strong>http://localhost:8080</strong> (API on port 3001).</p>
        <pre style="font-size:12px;white-space:pre-wrap;background:#f4f4f5;padding:12px;border-radius:8px;margin:0;overflow:auto;border:1px solid #e5e5e5">${escapeHtml(msg)}
${escapeHtml(stack)}</pre>
      </div>`;
      console.error(e);
    });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
