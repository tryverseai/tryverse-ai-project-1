import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
    // Scoped to convex/ and backend/ only — this config has no "@" path alias and runs under
    // edge-runtime (no jsdom/React), so a src/**/*.test.ts file (resolved by root vitest.config.ts
    // instead, which does have both) fails here with an unresolvable-import error rather than
    // being skipped. A bare "**/*.test.ts" picked those files up by accident.
    include: ["convex/**/*.test.ts", "backend/**/*.test.ts"],
  },
});
