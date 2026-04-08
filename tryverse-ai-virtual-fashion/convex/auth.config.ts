import type { AuthConfig } from "convex/server";

/**
 * Convex Auth (see `convex/auth.ts`). Dashboard env:
 * - JWT_PRIVATE_KEY, JWKS
 * - SITE_URL — public app origin for email verification links (`@convex-dev/auth`); local: http://localhost:8080
 * - CONVEX_SITE_URL — JWT issuer (often set automatically by Convex; this file falls back to localhost:8080 for domain)
 */
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL ?? "http://localhost:8080",
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
