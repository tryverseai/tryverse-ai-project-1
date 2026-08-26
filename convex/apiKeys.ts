import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { hashApiKey } from "./security";

function randomApiKeySecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `tv_live_${hex}`;
}

function newLegacyId(): string {
  return crypto.randomUUID();
}

/** Dashboard list; `id` is stable UUID in `legacy_id` for URLs and allowed_domains. */
export const listMyApiKeys = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;
    const rows = await ctx.db
      .query("api_keys")
      .withIndex("by_userId", (q) => q.eq("user_id", userId))
      .collect();
    rows.sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
    return rows.map((r) => ({
      id: r.legacy_id ?? r._id,
      name: r.name,
      key_value: r.key_value ?? null,
      key_last4: r.key_last4 ?? (r.key_value ? r.key_value.slice(-4) : null),
      created_at: r.created_at ?? "",
      last_used_at: r.last_used_at ?? null,
      status: r.status,
    }));
  },
});

export const createMyApiKey = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const now = new Date().toISOString();
    const key_value = randomApiKeySecret();
    const key_hash = await hashApiKey(key_value);
    const key_last4 = key_value.slice(-4);
    const legacy_id = newLegacyId();
    await ctx.db.insert("api_keys", {
      legacy_id,
      user_id: identity.subject,
      key_hash,
      key_last4,
      name: name.trim() || "Production",
      status: "active",
      created_at: now,
    });
    return { id: legacy_id, name: name.trim() || "Production", key_value, created_at: now, status: "active" as const };
  },
});

export const revokeMyApiKey = mutation({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const rows = await ctx.db
      .query("api_keys")
      .withIndex("by_userId", (q) => q.eq("user_id", identity.subject))
      .collect();
    const row = rows.find((r) => r.legacy_id === id || String(r._id) === id);
    if (!row) throw new Error("Key not found");
    await ctx.db.patch(row._id, { status: "revoked" });
  },
});

export const deleteMyApiKey = mutation({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const rows = await ctx.db
      .query("api_keys")
      .withIndex("by_userId", (q) => q.eq("user_id", identity.subject))
      .collect();
    const row = rows.find((r) => r.legacy_id === id || String(r._id) === id);
    if (!row) throw new Error("Key not found");
    await ctx.db.delete(row._id);
  },
});
