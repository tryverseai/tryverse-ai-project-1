import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireBackendSecret } from "./security";

/**
 * A request whose original attempt never reached `completeIdempotencyKey` (crashed process,
 * dropped connection before the generation record was created) would otherwise block that key
 * forever. After this long with no `ref_id` set, the key is treated as reclaimable rather than
 * "still processing".
 */
const STALE_PROCESSING_MS = 2 * 60 * 1000;

export const claimIdempotencyKey = mutation({
  args: { secret: v.string(), userId: v.string(), key: v.string(), route: v.string() },
  handler: async (ctx, { secret, userId, key, route }) => {
    requireBackendSecret(secret);
    const existing = await ctx.db
      .query("generation_idempotency")
      .withIndex("by_user_key", (q) => q.eq("user_id", userId).eq("key", key))
      .unique();

    if (!existing) {
      await ctx.db.insert("generation_idempotency", {
        key,
        user_id: userId,
        route,
        created_at: new Date().toISOString(),
      });
      return { claimed: true as const };
    }

    if (existing.ref_id) {
      return { claimed: false as const, route: existing.route, refId: existing.ref_id };
    }

    const age = Date.now() - new Date(existing.created_at).getTime();
    if (age > STALE_PROCESSING_MS) {
      // The original attempt for this key is presumed dead (crashed before ever creating the
      // generation record) — re-claim it as a fresh attempt rather than leaving the user stuck.
      await ctx.db.patch(existing._id, { route, created_at: new Date().toISOString() });
      return { claimed: true as const };
    }

    return { claimed: false as const, route: existing.route, refId: null };
  },
});

export const completeIdempotencyKey = mutation({
  args: { secret: v.string(), userId: v.string(), key: v.string(), refId: v.string() },
  handler: async (ctx, { secret, userId, key, refId }) => {
    requireBackendSecret(secret);
    const existing = await ctx.db
      .query("generation_idempotency")
      .withIndex("by_user_key", (q) => q.eq("user_id", userId).eq("key", key))
      .unique();
    if (!existing) return; // Shouldn't happen (claim always inserts first) — nothing to patch.
    await ctx.db.patch(existing._id, { ref_id: refId });
  },
});
