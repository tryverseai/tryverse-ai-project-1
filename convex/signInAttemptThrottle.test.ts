import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { internal } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");

function t() {
  return convexTest(schema, modules);
}

describe("signInAttemptThrottle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not throttle a fresh email with no prior attempts", async () => {
    const client = t();
    await expect(
      client.mutation(internal.signInAttemptThrottle.checkThrottle, { email: "new@example.com" })
    ).resolves.toBeNull();
  });

  it("does not throttle after a single failed attempt", async () => {
    const client = t();
    await client.mutation(internal.signInAttemptThrottle.recordAttemptResult, {
      email: "u1@example.com",
      success: false,
    });
    await expect(
      client.mutation(internal.signInAttemptThrottle.checkThrottle, { email: "u1@example.com" })
    ).resolves.toBeNull();
  });

  it("throttles after reaching the first threshold (5 failures)", async () => {
    const client = t();
    for (let i = 0; i < 5; i++) {
      await client.mutation(internal.signInAttemptThrottle.recordAttemptResult, {
        email: "u2@example.com",
        success: false,
      });
    }
    await expect(
      client.mutation(internal.signInAttemptThrottle.checkThrottle, { email: "u2@example.com" })
    ).rejects.toThrow(/too many sign-in attempts/i);
  });

  it("gives the identical generic message for an email that has never had a real account (no enumeration signal)", async () => {
    const client = t();
    for (let i = 0; i < 5; i++) {
      await client.mutation(internal.signInAttemptThrottle.recordAttemptResult, {
        email: "definitely-not-a-real-account@example.com",
        success: false,
      });
    }
    await expect(
      client.mutation(internal.signInAttemptThrottle.checkThrottle, {
        email: "definitely-not-a-real-account@example.com",
      })
    ).rejects.toThrow("Too many sign-in attempts. Please wait a moment and try again.");
  });

  it("escalates the cooldown at higher failure thresholds", async () => {
    const client = t();
    for (let i = 0; i < 10; i++) {
      await client.mutation(internal.signInAttemptThrottle.recordAttemptResult, {
        email: "u3@example.com",
        success: false,
      });
    }
    // Still within the 30s cooldown from the 5-fail threshold -> definitely still throttled.
    await vi.advanceTimersByTimeAsync(31_000);
    // But the 10-fail threshold's 2-minute cooldown should still be active.
    await expect(
      client.mutation(internal.signInAttemptThrottle.checkThrottle, { email: "u3@example.com" })
    ).rejects.toThrow(/too many sign-in attempts/i);
  });

  it("cooldown expires and allows a retry after enough time passes", async () => {
    const client = t();
    for (let i = 0; i < 5; i++) {
      await client.mutation(internal.signInAttemptThrottle.recordAttemptResult, {
        email: "u4@example.com",
        success: false,
      });
    }
    // 5-failure cooldown is 30s.
    await vi.advanceTimersByTimeAsync(31_000);
    await expect(
      client.mutation(internal.signInAttemptThrottle.checkThrottle, { email: "u4@example.com" })
    ).resolves.toBeNull();
  });

  it("a successful sign-in clears the failure state entirely, resetting throttling", async () => {
    const client = t();
    for (let i = 0; i < 6; i++) {
      await client.mutation(internal.signInAttemptThrottle.recordAttemptResult, {
        email: "u5@example.com",
        success: false,
      });
    }
    // Currently throttled.
    await expect(
      client.mutation(internal.signInAttemptThrottle.checkThrottle, { email: "u5@example.com" })
    ).rejects.toThrow(/too many sign-in attempts/i);

    // A genuine successful sign-in (e.g. the real owner finally enters the right password, or an
    // admin resets it) clears the record entirely.
    await client.mutation(internal.signInAttemptThrottle.recordAttemptResult, {
      email: "u5@example.com",
      success: true,
    });

    await expect(
      client.mutation(internal.signInAttemptThrottle.checkThrottle, { email: "u5@example.com" })
    ).resolves.toBeNull();

    // And failure counting starts fresh — one more failure alone shouldn't re-throttle.
    await client.mutation(internal.signInAttemptThrottle.recordAttemptResult, {
      email: "u5@example.com",
      success: false,
    });
    await expect(
      client.mutation(internal.signInAttemptThrottle.checkThrottle, { email: "u5@example.com" })
    ).resolves.toBeNull();
  });

  it("throttling for one email never affects a different email", async () => {
    const client = t();
    for (let i = 0; i < 8; i++) {
      await client.mutation(internal.signInAttemptThrottle.recordAttemptResult, {
        email: "attacked@example.com",
        success: false,
      });
    }
    await expect(
      client.mutation(internal.signInAttemptThrottle.checkThrottle, { email: "attacked@example.com" })
    ).rejects.toThrow();
    await expect(
      client.mutation(internal.signInAttemptThrottle.checkThrottle, { email: "unrelated@example.com" })
    ).resolves.toBeNull();
  });

  it("email matching is case-insensitive and trims whitespace", async () => {
    const client = t();
    for (let i = 0; i < 5; i++) {
      await client.mutation(internal.signInAttemptThrottle.recordAttemptResult, {
        email: "  Mixed.Case@Example.com  ",
        success: false,
      });
    }
    await expect(
      client.mutation(internal.signInAttemptThrottle.checkThrottle, { email: "mixed.case@example.com" })
    ).rejects.toThrow();
  });
});
