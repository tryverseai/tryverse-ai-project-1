/** Matches `@convex-dev/auth` browser localStorage key layout. */
const JWT_STORAGE_KEY = "__convexAuthJWT";

function namespacedJwtKey(): string | null {
  const raw = typeof import.meta.env.VITE_CONVEX_URL === "string" ? import.meta.env.VITE_CONVEX_URL.trim() : "";
  if (!raw) {
    if (import.meta.env.DEV) {
      console.warn(
        "[TryVerse] VITE_CONVEX_URL is not set. Auth JWT will never be found in localStorage. " +
          "Set VITE_CONVEX_URL in .env.local to the URL shown in `npx convex dev`."
      );
    }
    return null;
  }
  const escaped = raw.replace(/[^a-zA-Z0-9]/g, "");
  return `${JWT_STORAGE_KEY}_${escaped}`;
}

/** Convex Auth access JWT for `Authorization: Bearer` to the TryVerse API. */
export function readConvexAuthJwt(): string | null {
  if (typeof window === "undefined") return null;
  const key = namespacedJwtKey();
  if (!key) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Explicitly removes the Convex Auth JWT from localStorage.
 * Called during sign-out to ensure no stale token remains even if the
 * Convex Auth library's own cleanup silently fails.
 */
export function clearConvexAuthJwt(): void {
  if (typeof window === "undefined") return;
  const key = namespacedJwtKey();
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
