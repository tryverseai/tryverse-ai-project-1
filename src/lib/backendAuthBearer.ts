/**
 * Bearer JWT for Express `/api/*` — populated from Convex Auth (`useAuthToken`) in AuthProvider.
 * Not persisted in legacy local-session format.
 */
let convexJwt: string | null = null;

/** Same as `@convex-dev/auth` `JWT_STORAGE_KEY` + namespaced suffix (see `useNamespacedStorage`). */
const CONVEX_AUTH_JWT_STORAGE_KEY = "__convexAuthJWT";

/**
 * Read the Convex Auth access token from localStorage immediately after `signIn` resolves.
 * React `useAuthToken` updates in the next commit; bootstrap runs in the same tick and would
 * otherwise POST without `Authorization` until `useEffect` syncs the module cache.
 */
export function readConvexAuthJwtFromBrowserStorage(): string | null {
  if (typeof window === "undefined") return null;
  const raw = typeof import.meta.env.VITE_CONVEX_URL === "string" ? import.meta.env.VITE_CONVEX_URL.trim() : "";
  if (!raw) return null;
  const ns = raw.replace(/[^a-zA-Z0-9]/g, "");
  const key = `${CONVEX_AUTH_JWT_STORAGE_KEY}_${ns}`;
  const t = window.localStorage.getItem(key)?.trim();
  return t && t.length > 0 ? t : null;
}

export function hydrateBackendAuthBearerFromBrowserStorage(): void {
  const t = readConvexAuthJwtFromBrowserStorage();
  if (t) setBackendAuthBearerToken(t);
}

export function setBackendAuthBearerToken(token: string | null | undefined): void {
  convexJwt = typeof token === "string" && token.trim() !== "" ? token.trim() : null;
}

export function getBackendAuthBearerHeader(): string | null {
  return convexJwt ? `Bearer ${convexJwt}` : null;
}

/** After `signIn("password", …)` the client may need a few ticks before the JWT is available. */
export async function waitForBackendAuthBearerHeader(maxMs = 12_000): Promise<string | null> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    hydrateBackendAuthBearerFromBrowserStorage();
    const h = getBackendAuthBearerHeader();
    if (h?.startsWith("Bearer ") && h.length > "Bearer ".length + 8) {
      return h;
    }
    await new Promise<void>((r) => setTimeout(r, 40));
  }
  return null;
}
