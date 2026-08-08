import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Guards Convex Auth's signup-verification and password-reset OTP emails against abuse: without
 * this, anyone can enter an arbitrary email address and trigger unlimited "resend code" sends,
 * email-bombing a victim's inbox. Two independent limits, both durable (Convex db, not
 * in-memory — actions may run cold/across instances):
 *  - COOLDOWN_MS: minimum gap between two sends to the same address.
 *  - MAX_PER_WINDOW / WINDOW_MS: hard cap within a rolling window even if spaced out.
 */
const COOLDOWN_MS = 30_000;
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 6;

export const checkAndRecordSend = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = email.trim().toLowerCase();
    const now = Date.now();

    const existing = await ctx.db
      .query("email_verification_throttle")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .unique();

    if (!existing) {
      await ctx.db.insert("email_verification_throttle", {
        email: normalized,
        last_sent_at: now,
        window_start: now,
        count_in_window: 1,
      });
      return;
    }

    if (now - existing.last_sent_at < COOLDOWN_MS) {
      const waitSec = Math.ceil((COOLDOWN_MS - (now - existing.last_sent_at)) / 1000);
      throw new Error(`Please wait ${waitSec}s before requesting another code.`);
    }

    const windowExpired = now - existing.window_start > WINDOW_MS;
    const nextCount = windowExpired ? 1 : existing.count_in_window + 1;

    if (!windowExpired && nextCount > MAX_PER_WINDOW) {
      throw new Error("Too many verification emails requested. Please try again in an hour.");
    }

    await ctx.db.patch(existing._id, {
      last_sent_at: now,
      window_start: windowExpired ? now : existing.window_start,
      count_in_window: nextCount,
    });
  },
});
