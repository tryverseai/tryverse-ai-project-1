import { lazy, type ComponentType } from "react";

/**
 * Wraps `React.lazy()` so a stale-deployment chunk load failure (the JS file the browser is
 * asking for no longer exists because a newer build replaced it with different hashed
 * filenames) reloads the page once instead of leaving the tab spinning in its Suspense
 * fallback forever. A `sessionStorage` flag stops this from looping if the reload doesn't fix
 * it (e.g. a real network outage) — after one retry it surfaces the error normally.
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
  chunkName: string
) {
  return lazy(async () => {
    const flagKey = `tv-chunk-retry:${chunkName}`;
    try {
      const mod = await factory();
      sessionStorage.removeItem(flagKey);
      return mod;
    } catch (err) {
      const alreadyRetried = sessionStorage.getItem(flagKey);
      if (!alreadyRetried) {
        sessionStorage.setItem(flagKey, "1");
        window.location.reload();
        // Never resolves — the reload is already in flight.
        return new Promise<{ default: T }>(() => {});
      }
      sessionStorage.removeItem(flagKey);
      throw err;
    }
  });
}
