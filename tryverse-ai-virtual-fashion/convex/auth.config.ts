import type { AuthConfig } from "convex/server";

/**
 * Convex Auth (see `convex/auth.ts`). Dashboard env:
 * - JWT_PRIVATE_KEY, JWKS (from `node @convex-dev/auth/dist/cli/generateKeys.js` or docs)
 * - CONVEX_SITE_URL — e.g. https://your-app.com (or http://localhost:8080 for local)
 */
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL ?? "http://localhost:8080",
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
