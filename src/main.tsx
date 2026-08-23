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
  void loadApp()
    .then(({ default: App }) => {
      try {
        createRoot(rootEl).render(
          <Sentry.ErrorBoundary
            fallback={({ error, resetError }) => (
              <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
                <h1 className="text-lg font-semibold text-foreground mb-2">Something went wrong</h1>
                <p className="text-sm text-muted-foreground mb-4 max-w-md text-center">{(error as Error | undefined)?.message}</p>
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
        rootEl.innerHTML = `<p style="font-family:system-ui;padding:1.5rem;max-width:40rem;color:#111">TryVerse failed to start: ${escapeHtml(msg)}</p>`;
        console.error(e);
      }
    })
    .catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      const stack = e instanceof Error ? e.stack ?? "" : "";
      rootEl.innerHTML = `<div style="font-family:system-ui;padding:1.5rem;max-width:44rem;color:#111;background:#fff">
        <p style="font-weight:600;margin-bottom:0.5rem;font-size:18px">TryVerse could not load</p>
        <p style="font-size:14px;line-height:1.5;margin-bottom:1rem;opacity:0.9">Check the browser console and ensure the TryVerse API is reachable (e.g. Vite proxy to port 3001). Open the app at <strong>http://localhost:8080</strong>.</p>
        <pre style="font-size:12px;white-space:pre-wrap;background:#f4f4f5;padding:12px;border-radius:8px;margin:0;overflow:auto;border:1px solid #e5e5e5">${escapeHtml(msg)}
${escapeHtml(stack)}</pre>
      </div>`;
      console.error(e);
    });
}

/**
 * Same stale-deployment self-heal as lazyWithRetry.ts, but for the entry-point import itself:
 * if a deploy has replaced this chunk's hashed filename since the tab's index.html was cached
 * (or first painted), the dynamic import 404s. One silent reload almost always fixes it by
 * fetching the current index.html + matching assets; a sessionStorage flag stops a real outage
 * from reload-looping.
 */
async function loadApp() {
  const flagKey = "tv-chunk-retry:App";
  try {
    const mod = await import("./App.tsx");
    sessionStorage.removeItem(flagKey);
    return mod;
  } catch (err) {
    if (!sessionStorage.getItem(flagKey)) {
      sessionStorage.setItem(flagKey, "1");
      window.location.reload();
      return new Promise<typeof import("./App.tsx")>(() => {});
    }
    sessionStorage.removeItem(flagKey);
    throw err;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
