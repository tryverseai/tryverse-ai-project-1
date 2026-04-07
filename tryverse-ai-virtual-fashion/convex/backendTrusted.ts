import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";

function requireBackendSecret(secret: string) {
  const expected = process.env.BACKEND_SHARED_SECRET;
  if (!expected || secret !== expected) {
    throw new Error("Unauthorized");
  }
}

export const getUserRowById = query({
  args: { secret: v.string(), userId: v.string() },
  handler: async (ctx, { secret, userId }) => {
    requireBackendSecret(secret);
    return await ctx.db.get(userId as Id<"users">);
  },
});

export const getProfileRow = query({
  args: { secret: v.string(), userId: v.string() },
  handler: async (ctx, { secret, userId }) => {
    requireBackendSecret(secret);
    return await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("id", userId))
      .unique();
  },
});

export const getPlanRow = query({
  args: { secret: v.string(), planId: v.string() },
  handler: async (ctx, { secret, planId }) => {
    requireBackendSecret(secret);
    return await ctx.db
      .query("plans")
      .withIndex("by_planId", (q) => q.eq("id", planId))
      .unique();
  },
});

export const insertProfileRow = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    accountType: v.string(),
    freeCreditsRemaining: v.number(),
    freeCreditsTotal: v.number(),
  },
  handler: async (ctx, args) => {
    requireBackendSecret(args.secret);
    const now = new Date().toISOString();
    return await ctx.db.insert("profiles", {
      id: args.userId,
      plan_id: "free",
      account_type: args.accountType,
      free_credits_remaining: args.freeCreditsRemaining,
      free_credits_total: args.freeCreditsTotal,
      monthly_credits_remaining: 0,
      monthly_credits_total: 0,
      is_blocked: false,
      widget_activated: false,
      created_at: now,
      updated_at: now,
    });
  },
});

export const patchProfileRow = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    patch: v.any(),
  },
  handler: async (ctx, { secret, userId, patch }) => {
    requireBackendSecret(secret);
    const row = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("id", userId))
      .unique();
    if (!row) throw new Error("Profile not found");
    const p = patch as Record<string, unknown>;
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of Object.keys(p)) {
      if (p[key] !== undefined) updates[key] = p[key];
    }
    // Trusted server-only patch payload from Node credits service.
    await ctx.db.patch(row._id, updates as never);
    return { ok: true as const };
  },
});

export const lookupActiveApiKey = query({
  args: { secret: v.string(), keyValue: v.string() },
  handler: async (ctx, { secret, keyValue }) => {
    requireBackendSecret(secret);
    const row = await ctx.db
      .query("api_keys")
      .withIndex("by_key_value", (q) => q.eq("key_value", keyValue))
      .unique();
    if (!row || row.status !== "active") return null;
    const id = row.legacy_id ?? row._id;
    return {
      id,
      userId: row.user_id,
      keyValue: row.key_value,
      status: row.status,
      name: row.name,
    };
  },
});

export const listAllowedDomainsForApiKey = query({
  args: { secret: v.string(), apiKeyId: v.string() },
  handler: async (ctx, { secret, apiKeyId }) => {
    requireBackendSecret(secret);
    const rows = await ctx.db
      .query("allowed_domains")
      .withIndex("by_apiKeyId", (q) => q.eq("api_key_id", apiKeyId))
      .collect();
    return rows.map((r) => ({ domain: r.domain }));
  },
});

export const markApiKeyUsed = mutation({
  args: { secret: v.string(), keyValue: v.string() },
  handler: async (ctx, { secret, keyValue }) => {
    requireBackendSecret(secret);
    const row = await ctx.db
      .query("api_keys")
      .withIndex("by_key_value", (q) => q.eq("key_value", keyValue))
      .unique();
    if (!row || row.status !== "active") return;
    await ctx.db.patch(row._id, { last_used_at: new Date().toISOString() });
  },
});

// ── Try-ons (legacy_id = UUID returned to clients) ───────────────────────────

export const insertTryon = mutation({
  args: {
    secret: v.string(),
    legacyId: v.string(),
    userId: v.string(),
    personImage: v.string(),
    productImage: v.string(),
    category: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    requireBackendSecret(args.secret);
    const now = new Date().toISOString();
    await ctx.db.insert("tryons", {
      legacy_id: args.legacyId,
      user_id: args.userId,
      person_image: args.personImage,
      product_image: args.productImage,
      category: args.category,
      status: args.status,
      created_at: now,
    });
    return { legacyId: args.legacyId };
  },
});

export const patchTryonByLegacyId = mutation({
  args: {
    secret: v.string(),
    legacyId: v.string(),
    patch: v.object({
      status: v.optional(v.string()),
      result_image: v.optional(v.string()),
      completed_at: v.optional(v.union(v.string(), v.null())),
    }),
  },
  handler: async (ctx, { secret, legacyId, patch }) => {
    requireBackendSecret(secret);
    const row = await ctx.db
      .query("tryons")
      .withIndex("by_legacyId", (q) => q.eq("legacy_id", legacyId))
      .unique();
    if (!row) throw new Error("Try-on not found");
    const updates: Record<string, unknown> = {};
    if (patch.status !== undefined) updates.status = patch.status;
    if (patch.result_image !== undefined) updates.result_image = patch.result_image;
    if (patch.completed_at !== undefined) {
      updates.completed_at = patch.completed_at === null ? undefined : patch.completed_at;
    }
    await ctx.db.patch(row._id, updates as never);
    return { ok: true as const };
  },
});

export const getTryonByLegacyIdForUser = query({
  args: { secret: v.string(), legacyId: v.string(), userId: v.string() },
  handler: async (ctx, { secret, legacyId, userId }) => {
    requireBackendSecret(secret);
    const row = await ctx.db
      .query("tryons")
      .withIndex("by_legacyId", (q) => q.eq("legacy_id", legacyId))
      .unique();
    if (!row || row.user_id !== userId) return null;
    return {
      id: row.legacy_id ?? legacyId,
      status: row.status,
      result_image: row.result_image ?? null,
      created_at: row.created_at ?? null,
      completed_at: row.completed_at ?? null,
      category: row.category,
      user_id: row.user_id,
    };
  },
});

export const deleteTryonByLegacyIdForUser = mutation({
  args: { secret: v.string(), legacyId: v.string(), userId: v.string() },
  handler: async (ctx, { secret, legacyId, userId }) => {
    requireBackendSecret(secret);
    const row = await ctx.db
      .query("tryons")
      .withIndex("by_legacyId", (q) => q.eq("legacy_id", legacyId))
      .unique();
    if (!row || row.user_id !== userId) return { deleted: false as const };
    await ctx.db.delete(row._id);
    return { deleted: true as const };
  },
});

export const listTryonsForUser = query({
  args: {
    secret: v.string(),
    userId: v.string(),
    limit: v.number(),
    offset: v.number(),
    category: v.optional(v.string()),
  },
  handler: async (ctx, { secret, userId, limit, offset, category }) => {
    requireBackendSecret(secret);
    let rows = await ctx.db
      .query("tryons")
      .withIndex("by_userId", (q) => q.eq("user_id", userId))
      .collect();
    if (category) rows = rows.filter((r) => r.category === category);
    rows.sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
    const total = rows.length;
    const slice = rows.slice(offset, offset + limit);
    return {
      tryons: slice.map((t) => ({
        id: t.legacy_id ?? String(t._id),
        status: t.status,
        category: t.category,
        result_image: t.result_image ?? null,
        created_at: t.created_at ?? null,
        completed_at: t.completed_at ?? null,
      })),
      total,
    };
  },
});

export const insertUsageEvent = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    eventType: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, { secret, userId, eventType, metadata }) => {
    requireBackendSecret(secret);
    await ctx.db.insert("usage_events", {
      user_id: userId,
      event_type: eventType,
      metadata,
      created_at: new Date().toISOString(),
    });
  },
});

export const insertAdminAuditLog = mutation({
  args: {
    secret: v.string(),
    event_type: v.string(),
    action: v.string(),
    actor: v.optional(v.string()),
    target_id: v.optional(v.string()),
    details: v.optional(v.any()),
    ip_address: v.optional(v.string()),
    user_agent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireBackendSecret(args.secret);
    await ctx.db.insert("admin_audit_log", {
      event_type: args.event_type,
      action: args.action,
      actor: args.actor,
      target_id: args.target_id,
      details: args.details,
      ip_address: args.ip_address,
      user_agent: args.user_agent,
      created_at: new Date().toISOString(),
    });
  },
});

export const getWidgetProfileRow = query({
  args: { secret: v.string(), userId: v.string() },
  handler: async (ctx, { secret, userId }) => {
    requireBackendSecret(secret);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("id", userId))
      .unique();
    if (!profile) return null;
    return {
      brand_name: profile.brand_name ?? null,
      widget_activated: profile.widget_activated,
      widget_show_models: profile.widget_show_models,
    };
  },
});

export const listAllModelLibraryRows = query({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    requireBackendSecret(secret);
    const rows = await ctx.db.query("tryverse_model_library").collect();
    rows.sort((a, b) => a.sort_order - b.sort_order);
    return rows.map((r) => ({
      id: r.legacy_id ?? String(r._id),
      slug: r.slug,
      display_name: r.display_name,
      gender: r.gender,
      body_type: r.body_type ?? null,
      appearance_tag: r.appearance_tag ?? null,
      image_url: r.image_url,
      sort_order: r.sort_order,
      is_active: r.is_active,
      created_at: r.created_at ?? "",
      free_tier_eligible: r.free_tier_eligible,
    }));
  },
});

export const getModelLibraryRowByLegacyId = query({
  args: { secret: v.string(), legacyId: v.string() },
  handler: async (ctx, { secret, legacyId }) => {
    requireBackendSecret(secret);
    const rows = await ctx.db.query("tryverse_model_library").collect();
    const row = rows.find((r) => r.legacy_id === legacyId || String(r._id) === legacyId);
    if (!row) return null;
    return {
      id: row.legacy_id ?? String(row._id),
      slug: row.slug,
      display_name: row.display_name,
    };
  },
});

export const patchModelLibraryByLegacyId = mutation({
  args: {
    secret: v.string(),
    legacyId: v.string(),
    patch: v.object({
      is_active: v.optional(v.boolean()),
      free_tier_eligible: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, { secret, legacyId, patch }) => {
    requireBackendSecret(secret);
    const rows = await ctx.db.query("tryverse_model_library").collect();
    const row = rows.find((r) => r.legacy_id === legacyId || String(r._id) === legacyId);
    if (!row) throw new Error("Model not found");
    const updates: Record<string, unknown> = {};
    if (patch.is_active !== undefined) updates.is_active = patch.is_active;
    if (patch.free_tier_eligible !== undefined) updates.free_tier_eligible = patch.free_tier_eligible;
    await ctx.db.patch(row._id, updates as never);
    return { ok: true as const };
  },
});

export const userAnalyticsSince = query({
  args: { secret: v.string(), userId: v.string(), sinceIso: v.string() },
  handler: async (ctx, { secret, userId, sinceIso }) => {
    requireBackendSecret(secret);
    const tryonRows = await ctx.db
      .query("tryons")
      .withIndex("by_userId", (q) => q.eq("user_id", userId))
      .collect();
    const tryons = tryonRows.filter((t) => (t.created_at ?? "") >= sinceIso);
    const eventRows = await ctx.db
      .query("usage_events")
      .withIndex("by_userId_time", (q) => q.eq("user_id", userId))
      .collect();
    const events = eventRows.filter((e) => (e.created_at ?? "") >= sinceIso);
    return {
      tryons: tryons.map((t) => ({
        id: t.legacy_id,
        status: t.status,
        category: t.category,
        product_image: t.product_image,
        created_at: t.created_at ?? "",
        completed_at: t.completed_at ?? null,
      })),
      events: events.map((e) => ({
        event_type: e.event_type,
        metadata: e.metadata,
        created_at: e.created_at ?? "",
      })),
    };
  },
});

export const paymentSuccessExists = query({
  args: { secret: v.string(), reference: v.string() },
  handler: async (ctx, { secret, reference }) => {
    requireBackendSecret(secret);
    const rows = await ctx.db.query("payments").collect();
    return rows.some((p) => p.reference === reference && p.status === "success");
  },
});

export const insertPaymentTrusted = mutation({
  args: {
    secret: v.string(),
    user_id: v.string(),
    reference: v.string(),
    amount: v.number(),
    currency: v.string(),
    status: v.string(),
    provider: v.string(),
  },
  handler: async (ctx, a) => {
    requireBackendSecret(a.secret);
    await ctx.db.insert("payments", {
      user_id: a.user_id,
      reference: a.reference,
      amount: a.amount,
      currency: a.currency,
      status: a.status,
      provider: a.provider,
      created_at: new Date().toISOString(),
    });
  },
});

export const upsertSubscriptionForUser = mutation({
  args: {
    secret: v.string(),
    user_id: v.string(),
    plan_id: v.string(),
    status: v.string(),
    provider: v.string(),
    current_period_start: v.string(),
    current_period_end: v.string(),
    provider_subscription_id: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    requireBackendSecret(a.secret);
    const rows = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("user_id", a.user_id))
      .collect();
    const now = new Date().toISOString();
    const base: Record<string, unknown> = {
      user_id: a.user_id,
      plan_id: a.plan_id,
      status: a.status,
      provider: a.provider,
      current_period_start: a.current_period_start,
      current_period_end: a.current_period_end,
      updated_at: now,
    };
    if (a.provider_subscription_id !== undefined) {
      base.provider_subscription_id = a.provider_subscription_id;
    }
    if (rows.length > 0) {
      await ctx.db.patch(rows[0]!._id, base as never);
    } else {
      await ctx.db.insert("subscriptions", { ...base, created_at: now } as never);
    }
  },
});

export const cancelSubscriptionsForUser = mutation({
  args: { secret: v.string(), user_id: v.string() },
  handler: async (ctx, { secret, user_id }) => {
    requireBackendSecret(secret);
    const rows = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("user_id", user_id))
      .collect();
    const now = new Date().toISOString();
    for (const r of rows) {
      await ctx.db.patch(r._id, { status: "cancelled", updated_at: now } as never);
    }
  },
});

export const insertSupportRequestTrusted = mutation({
  args: {
    secret: v.string(),
    name: v.string(),
    first_name: v.string(),
    last_name: v.string(),
    company_name: v.union(v.null(), v.string()),
    email: v.string(),
    phone_number: v.union(v.null(), v.string()),
    category: v.string(),
    subject: v.string(),
    message: v.string(),
  },
  handler: async (ctx, a) => {
    requireBackendSecret(a.secret);
    await ctx.db.insert("support_requests", {
      name: a.name,
      first_name: a.first_name,
      last_name: a.last_name,
      company_name: a.company_name ?? undefined,
      email: a.email,
      phone_number: a.phone_number ?? undefined,
      category: a.category,
      subject: a.subject,
      message: a.message,
      status: "open",
      created_at: new Date().toISOString(),
    });
  },
});

export const insertEarlyAccessRowTrusted = mutation({
  args: { secret: v.string(), row: v.any() },
  handler: async (ctx, { secret, row }) => {
    requireBackendSecret(secret);
    const r = row as Record<string, unknown>;
    await ctx.db.insert("early_access_requests", {
      ...r,
      created_at: new Date().toISOString(),
    } as never);
  },
});

export const getModelForResolvePath = query({
  args: { secret: v.string(), idOrSlug: v.string() },
  handler: async (ctx, { secret, idOrSlug }) => {
    requireBackendSecret(secret);
    const raw = idOrSlug.trim();
    const rows = await ctx.db.query("tryverse_model_library").collect();
    const row = rows.find(
      (r) => r.slug === raw || r.legacy_id === raw || String(r._id) === raw
    );
    if (!row || !row.is_active) return null;
    return {
      id: row.legacy_id ?? String(row._id),
      slug: row.slug,
      image_url: row.image_url,
      is_active: row.is_active,
      free_tier_eligible: row.free_tier_eligible,
    };
  },
});

export const insertAllowedDomainForUser = mutation({
  args: { secret: v.string(), userId: v.string(), domain: v.string() },
  handler: async (ctx, { secret, userId, domain }) => {
    requireBackendSecret(secret);
    const keys = await ctx.db
      .query("api_keys")
      .withIndex("by_userId", (q) => q.eq("user_id", userId))
      .collect();
    const active = keys.find((k) => k.status === "active");
    if (!active) throw new Error("NO_ACTIVE_API_KEY");
    const apiKeyId = String(active.legacy_id ?? active._id);
    const existing = await ctx.db
      .query("allowed_domains")
      .withIndex("by_apiKeyId", (q) => q.eq("api_key_id", apiKeyId))
      .collect();
    if (existing.some((e) => e.domain === domain)) {
      throw new Error("DUPLICATE_DOMAIN");
    }
    await ctx.db.insert("allowed_domains", {
      api_key_id: apiKeyId,
      domain,
      created_at: new Date().toISOString(),
    });
    return { ok: true as const };
  },
});
