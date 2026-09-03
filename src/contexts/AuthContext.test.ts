// Regression coverage for humanizeSignInPasswordError — specifically the throttle-message bug
// found during a live production click-through: Convex wraps a thrown Error's message with an
// "Uncaught Error: " prefix (sometimes doubled) as it crosses the checkThrottle mutation -> the
// signIn action -> the client boundary. The generic "noisy Convex error" fallback in this file
// matched that wrapped text (it contains both "uncaught error" and "sign-in") and silently
// collapsed the throttle message down to the same "Invalid account or password" text as a wrong
// password, leaving a rate-limited user with no indication they should wait rather than keep
// retrying or panic-reset a password that was never actually wrong.
import { describe, it, expect } from "vitest";
import { humanizeSignInPasswordError } from "./AuthContext";

describe("humanizeSignInPasswordError", () => {
  it("preserves the throttle message even after Convex's action-boundary 'Uncaught Error:' wrapping", () => {
    const wrapped = new Error(
      "Uncaught Error: Too many sign-in attempts. Please wait a moment and try again."
    );
    expect(humanizeSignInPasswordError(wrapped).message).toBe(
      "Too many sign-in attempts. Please wait a moment and try again."
    );
  });

  it("preserves the throttle message even with the doubled prefix seen crossing two action boundaries", () => {
    const doubledWrap = new Error(
      "Uncaught Error: Uncaught Error: Too many sign-in attempts. Please wait a moment and try again."
    );
    expect(humanizeSignInPasswordError(doubledWrap).message).toBe(
      "Too many sign-in attempts. Please wait a moment and try again."
    );
  });

  it("still humanizes a genuine wrong-password/InvalidAccountId error to the generic message", () => {
    expect(humanizeSignInPasswordError(new Error("InvalidAccountId")).message).toBe(
      "Invalid account or password."
    );
  });

  it("still humanizes an unrelated noisy Convex/server error (regression check on the existing fallback)", () => {
    const noisy = new Error("Uncaught Error: Server Error in signIn: request id: abc123 auth failed");
    expect(humanizeSignInPasswordError(noisy).message).toBe("Invalid account or password.");
  });

  it("passes through an error message that isn't auth-noise and isn't the throttle message unchanged", () => {
    const other = new Error("Network request failed");
    expect(humanizeSignInPasswordError(other).message).toBe("Network request failed");
  });

  it("falls back to the generic message for an empty error", () => {
    expect(humanizeSignInPasswordError(new Error("")).message).toBe("Invalid account or password.");
  });
});
