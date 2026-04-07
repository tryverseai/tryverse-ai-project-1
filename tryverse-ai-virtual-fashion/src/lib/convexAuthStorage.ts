/** Matches `@convex-dev/auth` browser localStorage key layout. */
const JWT_STORAGE_KEY = "__convexAuthJWT";

function namespacedJwtKey(): string | null {
  const raw = typeof import.meta.env.VITE_CONVEX_URL === "string" ? import.meta.env.VITE_CONVEX_URL.trim() : "";
  if (!raw) return null;
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
