import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";

function requireBackendSecret(secret: string) {
  const expected = process.env.BACKEND_SHARED_SECRET;
  if (!expected || secret !== expected) {
    throw new Error("Unauthorized");
  }
}

/** Node uploads a buffer via POST to this URL; response JSON includes storageId. */
export const storageGenerateUploadUrl = mutation({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    requireBackendSecret(secret);
    return await ctx.storage.generateUploadUrl();
  },
});

export const storageGetUrl = query({
  args: { secret: v.string(), storageId: v.string() },
  handler: async (ctx, { secret, storageId }) => {
    requireBackendSecret(secret);
    return await ctx.storage.getUrl(storageId as Id<"_storage">);
  },
});

export const storageDelete = mutation({
  args: { secret: v.string(), storageId: v.string() },
  handler: async (ctx, { secret, storageId }) => {
    requireBackendSecret(secret);
    await ctx.storage.delete(storageId as Id<"_storage">);
  },
});
