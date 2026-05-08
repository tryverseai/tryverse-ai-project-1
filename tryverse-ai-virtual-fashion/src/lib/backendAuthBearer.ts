/**
 * Bearer JWT for Express `/api/*` — populated from Convex Auth (`useAuthToken`) in AuthProvider.
 * Not persisted in legacy local-session format.
 */
let convexJwt: string | null = null;

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
    const h = getBackendAuthBearerHeader();
    if (h?.startsWith("Bearer ") && h.length > "Bearer ".length + 8) {
      return h;
    }
    await new Promise<void>((r) => setTimeout(r, 40));
  }
  return null;
}
