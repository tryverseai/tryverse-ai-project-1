import { describe, it, expect } from "vitest";
import { SESSION_TOTAL_DURATION_MS, SESSION_INACTIVE_DURATION_MS, JWT_DURATION_MS } from "./auth";

// @convex-dev/auth's own defaults when `session`/`jwt` config is omitted (see
// node_modules/@convex-dev/auth/dist/server/implementation/{sessions,refreshTokens,tokens}.js).
// This is the exact "unset" configuration that caused sessions to last up to 30 days.
const LIBRARY_DEFAULT_SESSION_TOTAL_DURATION_MS = 1000 * 60 * 60 * 24 * 30;
const LIBRARY_DEFAULT_SESSION_INACTIVE_DURATION_MS = 1000 * 60 * 60 * 24 * 30;
const LIBRARY_DEFAULT_JWT_DURATION_MS = 1000 * 60 * 60;

describe("convex/auth.ts session TTL configuration", () => {
  it("is explicitly configured (not left to silently default)", () => {
    expect(SESSION_TOTAL_DURATION_MS).toBeGreaterThan(0);
    expect(SESSION_INACTIVE_DURATION_MS).toBeGreaterThan(0);
    expect(JWT_DURATION_MS).toBeGreaterThan(0);
  });

  it("is strictly tighter than the library's own 30-day / 30-day / 1-hour defaults", () => {
    expect(SESSION_TOTAL_DURATION_MS).toBeLessThan(LIBRARY_DEFAULT_SESSION_TOTAL_DURATION_MS);
    expect(SESSION_INACTIVE_DURATION_MS).toBeLessThan(LIBRARY_DEFAULT_SESSION_INACTIVE_DURATION_MS);
    expect(JWT_DURATION_MS).toBeLessThan(LIBRARY_DEFAULT_JWT_DURATION_MS);
  });

  it("matches the intended policy: 24h absolute, 4h idle, 15min access token", () => {
    expect(SESSION_TOTAL_DURATION_MS).toBe(24 * 60 * 60 * 1000);
    expect(SESSION_INACTIVE_DURATION_MS).toBe(4 * 60 * 60 * 1000);
    expect(JWT_DURATION_MS).toBe(15 * 60 * 1000);
  });

  it("caps the idle window at or below the absolute ceiling (an idle-only cap looser than the absolute cap would be dead code)", () => {
    expect(SESSION_INACTIVE_DURATION_MS).toBeLessThanOrEqual(SESSION_TOTAL_DURATION_MS);
  });
});
