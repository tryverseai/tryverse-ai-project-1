import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

/**
 * createProduct never sets legacy_id, so every product made through the current UI is only
 * findable by its real Convex _id. The by_legacyId index lookup alone (as update/delete used to
 * do) never matches those rows — always "Not found". Fall back to a direct _id get, same pattern
 * getMyProduct already used correctly.
 */
async function findOwnedProduct(
  ctx: any,
  id: string,
  ownerId: string
): Promise<Doc<"products"> | null> {
  const byLegacy = await ctx.db
    .query("products")
    .withIndex("by_legacyId", (q: any) => q.eq("legacy_id", id))
    .unique();
  if (byLegacy) return byLegacy.user_id === ownerId ? byLegacy : null;
  try {
    const byId = await ctx.db.get(id as Id<"products">);
    if (byId && byId.user_id === ownerId) return byId;
  } catch {
    /* not a valid Convex id */
  }
  return null;
}

export const listMyProducts = query({
  args: {
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, { page = 1, limit = 20, category }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;
    // Use the composite index when a category filter is active to avoid scanning
    // all of the user's products.
    let rows = category
      ? await ctx.db
          .query("products")
          .withIndex("by_user_category", (q) => q.eq("user_id", userId).eq("category", category))
          .collect()
      : await ctx.db
          .query("products")
          .withIndex("by_userId", (q) => q.eq("user_id", userId))
          .collect();
    rows.sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
    const total = rows.length;
    const from = (page - 1) * limit;
    const slice = rows.slice(from, from + limit);
    const mapped = slice.map((p) => ({
      id: p.legacy_id ?? p._id,
      name: p.name,
      image_url: p.image_url ?? null,
      category: p.category,
      product_url: p.product_url ?? null,
      tryons_count: p.tryons_count,
      created_at: p.created_at ?? "",
      updated_at: p.updated_at ?? "",
    }));
    return {
      products: mapped,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  },
});

export const getMyProduct = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const rows = await ctx.db
      .query("products")
      .withIndex("by_userId", (q) => q.eq("user_id", identity.subject))
      .collect();
    const p = rows.find((r) => r.legacy_id === id || String(r._id) === id);
    if (!p) return null;
    return {
      id: p.legacy_id ?? p._id,
      name: p.name,
      image_url: p.image_url ?? null,
      category: p.category,
      product_url: p.product_url ?? null,
      tryons_count: p.tryons_count,
      created_at: p.created_at ?? "",
      updated_at: p.updated_at ?? "",
    };
  },
});

export const createProduct = mutation({
  args: {
    name: v.string(),
    image_url: v.optional(v.string()),
    category: v.string(),
    product_url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const now = new Date().toISOString();
    const id = await ctx.db.insert("products", {
      user_id: identity.subject,
      name: args.name,
      image_url: args.image_url,
      category: args.category,
      product_url: args.product_url,
      tryons_count: 0,
      created_at: now,
      updated_at: now,
    });
    const doc = await ctx.db.get(id);
    if (!doc) throw new Error("Insert failed");
    return {
      id: doc.legacy_id ?? doc._id,
      name: doc.name,
      image_url: doc.image_url ?? null,
      category: doc.category,
      product_url: doc.product_url ?? null,
      tryons_count: doc.tryons_count,
      created_at: doc.created_at ?? now,
      updated_at: doc.updated_at ?? now,
    };
  },
});

export const updateProduct = mutation({
  args: {
    id: v.string(),
    name: v.optional(v.string()),
    image_url: v.optional(v.string()),
    category: v.optional(v.string()),
    product_url: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const doc = await findOwnedProduct(ctx, id, identity.subject);
    if (!doc) throw new Error("Not found");
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { updated_at: now };
    if (patch.name !== undefined) updates.name = patch.name;
    if (patch.image_url !== undefined) updates.image_url = patch.image_url;
    if (patch.category !== undefined) updates.category = patch.category;
    if (patch.product_url !== undefined) updates.product_url = patch.product_url;
    await ctx.db.patch(doc._id, updates);
    const next = await ctx.db.get(doc._id);
    if (!next) throw new Error("Update failed");
    return {
      id: next.legacy_id ?? next._id,
      name: next.name,
      image_url: next.image_url ?? null,
      category: next.category,
      product_url: next.product_url ?? null,
      tryons_count: next.tryons_count,
      created_at: next.created_at ?? "",
      updated_at: next.updated_at ?? "",
    };
  },
});

export const deleteProduct = mutation({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const doc = await findOwnedProduct(ctx, id, identity.subject);
    if (!doc) throw new Error("Not found");
    await ctx.db.delete(doc._id);
  },
});
