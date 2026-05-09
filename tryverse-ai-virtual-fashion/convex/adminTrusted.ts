import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { authSubjectSegments } from "./authSubjectKeys";

function requireBackendSecret(secret: string) {
  const expected = process.env.BACKEND_SHARED_SECRET;
  if (!expected || secret !== expected) {
    throw new Error("Unauthorized");
  }
}

export const adminMetricsBundle = query({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    requireBackendSecret(secret);
    const profiles = await ctx.db.query("profiles").collect();
    const tryons = await ctx.db.query("tryons").collect();
    const subs = await ctx.db.query("subscriptions").collect();
    const payments = await ctx.db.query("payments").collect();

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const totalUsers = profiles.length;
    const totalTryons = tryons.length;
    const activeSubscriptions = subs.filter((s) => s.status === "active").length;
    const tryonsToday = tryons.filter((t) => (t.created_at ?? "") >= todayStart).length;
    const tryonsThisMonth = tryons.filter((t) => (t.created_at ?? "") >= monthStart).length;
    const completedTryons = tryons.filter((t) => t.status === "completed").length;

    const revenueData = payments.filter((p) => p.status === "success");

    const dailyTryons = tryons.filter((t) => (t.created_at ?? "") >= thirtyDaysAgo);
    const newUsersData = profiles.filter((p) => (p.created_at ?? "") >= thirtyDaysAgo);

    const dailyMap: Record<string, { tryons: number; users: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const day = d.toISOString().slice(0, 10);
      dailyMap[day] = { tryons: 0, users: 0 };
    }
    for (const t of dailyTryons) {
      const day = t.created_at?.slice(0, 10);
      if (day && dailyMap[day]) dailyMap[day].tryons++;
    }
    for (const u of newUsersData) {
      const day = u.created_at?.slice(0, 10);
      if (day && dailyMap[day]) dailyMap[day].users++;
    }
    const usageOverTime = Object.entries(dailyMap)
      .map(([date, val]) => ({ date, tryons: val.tryons, newUsers: val.users }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalUsers,
      totalTryons,
      activeSubscriptions,
      tryonsToday,
      tryonsThisMonth,
      completedTryons,
      revenueData: revenueData.map((p) => ({ amount: p.amount, currency: p.currency })),
      usageOverTime,
    };
  },
});

export const adminListProfiles = query({
  args: {
    secret: v.string(),
    limit: v.number(),
    offset: v.number(),
    search: v.optional(v.string()),
    accountType: v.optional(v.string()),
  },
  handler: async (ctx, { secret, limit, offset, search, accountType }) => {
    requireBackendSecret(secret);
    let rows = await ctx.db.query("profiles").collect();
    if (accountType === "business" || accountType === "individual") {
      rows = rows.filter((r) => r.account_type === accountType);
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => {
        const b = (r.brand_name ?? "").toLowerCase();
        const e = (r.contact_email ?? "").toLowerCase();
        return b.includes(q) || e.includes(q);
      });
    }
    rows.sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
    const total = rows.length;
    const slice = rows.slice(offset, offset + limit);
    return {
      profiles: slice.map((p) => ({
        id: p.id,
        brand_name: p.brand_name,
        full_name: p.full_name,
        contact_email: p.contact_email,
        account_type: p.account_type,
        plan_id: p.plan_id,
        free_credits_remaining: p.free_credits_remaining,
        monthly_credits_remaining: p.monthly_credits_remaining,
        monthly_credits_total: p.monthly_credits_total,
        widget_activated: p.widget_activated,
        created_at: p.created_at,
        is_blocked: p.is_blocked,
        beta_approved: p.beta_approved,
        beta_rejected: p.beta_rejected,
        beta_requested_at: p.beta_requested_at,
      })),
      total,
    };
  },
});

export const adminListTryons = query({
  args: {
    secret: v.string(),
    limit: v.number(),
    offset: v.number(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { secret, limit, offset, status }) => {
    requireBackendSecret(secret);
    let rows = await ctx.db.query("tryons").collect();
    if (status) rows = rows.filter((r) => r.status === status);
    rows.sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
    const total = rows.length;
    const slice = rows.slice(offset, offset + limit);
    const profiles = await ctx.db.query("profiles").collect();
    const pmap = new Map<string, (typeof profiles)[number]>();
    for (const p of profiles) {
      pmap.set(p.id, p);
      for (const seg of authSubjectSegments(p.id)) {
        if (!pmap.has(seg)) pmap.set(seg, p);
      }
    }
    return {
      tryons: slice.map((t) => {
        const uid = t.user_id ?? "";
        let pr = uid ? pmap.get(uid) : undefined;
        if (!pr && uid) {
          for (const seg of authSubjectSegments(uid)) {
            pr = pmap.get(seg);
            if (pr) break;
          }
        }
        return {
          id: t.legacy_id ?? String(t._id),
          user_id: t.user_id,
          status: t.status,
          category: t.category,
          created_at: t.created_at,
          completed_at: t.completed_at,
          brand_name: pr?.brand_name ?? null,
          contact_email: pr?.contact_email ?? null,
        };
      }),
      total,
    };
  },
});

export const adminPaymentsSince = query({
  args: { secret: v.string(), sinceIso: v.string() },
  handler: async (ctx, { secret, sinceIso }) => {
    requireBackendSecret(secret);
    const rows = await ctx.db.query("payments").collect();
    return rows
      .filter((p) => (p.created_at ?? "") >= sinceIso)
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  },
});

export const adminRecentPayments = query({
  args: { secret: v.string(), limit: v.number() },
  handler: async (ctx, { secret, limit }) => {
    requireBackendSecret(secret);
    const rows = await ctx.db.query("payments").collect();
    rows.sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
    const slice = rows.slice(0, limit);
    return slice.map((p) => ({
      id: p.legacy_id ?? String(p._id),
      user_id: p.user_id,
      amount: p.amount,
      currency: p.currency,
      provider: p.provider,
      status: p.status,
      reference: p.reference,
      created_at: p.created_at,
    }));
  },
});

export const adminGetTryonForRetry = query({
  args: { secret: v.string(), legacyId: v.string() },
  handler: async (ctx, { secret, legacyId }) => {
    requireBackendSecret(secret);
    const row = await ctx.db
      .query("tryons")
      .withIndex("by_legacyId", (q) => q.eq("legacy_id", legacyId))
      .unique();
    if (!row) return null;
    return {
      id: row.legacy_id ?? String(row._id),
      user_id: row.user_id,
      person_image: row.person_image,
      product_image: row.product_image,
      category: row.category,
      status: row.status,
    };
  },
});

export const patchUserAccountType = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    account_type: v.union(v.literal("business"), v.literal("individual")),
  },
  handler: async (ctx, { secret, userId, account_type }) => {
    requireBackendSecret(secret);
    const user = await ctx.db.get(userId as Id<"users">);
    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, { account_type } as never);
    const prof = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("id", userId))
      .unique();
    if (prof) {
      await ctx.db.patch(prof._id, {
        account_type,
        updated_at: new Date().toISOString(),
      });
    }
    return { ok: true as const };
  },
});

export const platformAnalyticsSince = query({
  args: { secret: v.string(), sinceIso: v.string() },
  handler: async (ctx, { secret, sinceIso }) => {
    requireBackendSecret(secret);
    const tryons = (await ctx.db.query("tryons").collect()).filter(
      (t) => (t.created_at ?? "") >= sinceIso
    );
    const newUsers = (await ctx.db.query("profiles").collect()).filter(
      (p) => (p.created_at ?? "") >= sinceIso
    ).length;
    return {
      tryons,
      newUsers,
    };
  },
});

export const getProfileForAdminBlock = query({
  args: { secret: v.string(), userId: v.string() },
  handler: async (ctx, { secret, userId }) => {
    requireBackendSecret(secret);
    const row = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("id", userId))
      .unique();
    if (!row) return null;
    return {
      id: row.id,
      brand_name: row.brand_name,
      contact_email: row.contact_email,
      full_name: row.full_name,
    };
  },
});

/** Batch profile rows for audit log display (admin UI). */
export const getProfilesByIdsAdmin = query({
  args: { secret: v.string(), ids: v.array(v.string()) },
  handler: async (ctx, { secret, ids }) => {
    requireBackendSecret(secret);
    const wanted = new Set(ids);
    const profiles = await ctx.db.query("profiles").collect();
    return profiles
      .filter((p) => wanted.has(p.id))
      .map((p) => ({
        id: p.id,
        brand_name: p.brand_name ?? null,
        contact_email: p.contact_email ?? null,
        full_name: p.full_name ?? null,
      }));
  },
});

export const listPlansActiveTrusted = query({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    requireBackendSecret(secret);
    const rows = await ctx.db.query("plans").collect();
    return rows
      .filter((p) => p.is_active)
      .sort((a, b) => a.tryons_per_month - b.tryons_per_month)
      .map((p) => ({
        id: p.id,
        name: p.name,
        tryons_per_month: p.tryons_per_month,
        max_products: p.max_products,
        price_ngn: p.price_ngn,
        price_usd: p.price_usd,
      }));
  },
});

export const recentTryonsActivity = query({
  args: { secret: v.string(), limit: v.number() },
  handler: async (ctx, { secret, limit }) => {
    requireBackendSecret(secret);
    const rows = await ctx.db.query("tryons").collect();
    rows.sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
    const slice = rows.slice(0, limit);
    const profiles = await ctx.db.query("profiles").collect();
    const pmap = new Map(profiles.map((p) => [p.id, p] as const));
    return slice.map((t) => {
      const uid = t.user_id ?? "";
      const pr = uid ? pmap.get(uid) : undefined;
      return {
        id: t.legacy_id ?? String(t._id),
        user_id: t.user_id,
        status: t.status,
        category: t.category,
        created_at: t.created_at ?? "",
        brand_name: pr?.brand_name ?? null,
      };
    });
  },
});

export const listApiKeysAdmin = query({
  args: { secret: v.string(), limit: v.number() },
  handler: async (ctx, { secret, limit }) => {
    requireBackendSecret(secret);
    const rows = await ctx.db.query("api_keys").collect();
    rows.sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
    return rows.slice(0, limit).map((k) => ({
      id: k.legacy_id ?? String(k._id),
      user_id: k.user_id,
      key_value: k.key_value,
      name: k.name,
      status: k.status,
      last_used: k.last_used_at ?? null,
      created_at: k.created_at ?? "",
    }));
  },
});

export const revokeApiKeyAdmin = mutation({
  args: { secret: v.string(), legacyId: v.string() },
  handler: async (ctx, { secret, legacyId }) => {
    requireBackendSecret(secret);
    const rows = await ctx.db.query("api_keys").collect();
    const row = rows.find((r) => r.legacy_id === legacyId || String(r._id) === legacyId);
    if (!row) throw new Error("not_found");
    await ctx.db.patch(row._id, { status: "revoked" });
  },
});

export const listAllowedDomainsAdmin = query({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    requireBackendSecret(secret);
    const domains = await ctx.db.query("allowed_domains").collect();
    domains.sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
    const keys = await ctx.db.query("api_keys").collect();
    const keyToUser = new Map(keys.map((k) => [String(k.legacy_id ?? k._id), k.user_id] as const));
    const profiles = await ctx.db.query("profiles").collect();
    const brand = new Map(profiles.map((p) => [p.id, p.brand_name ?? "—"] as const));
    return domains.map((d) => ({
      id: String(d._id),
      api_key_id: d.api_key_id,
      domain: d.domain,
      verified: false,
      created_at: d.created_at ?? "",
      brand_name: brand.get(keyToUser.get(d.api_key_id) ?? "") ?? "—",
    }));
  },
});

export const listAuditLogAdmin = query({
  args: {
    secret: v.string(),
    limit: v.number(),
    offset: v.number(),
    eventTypes: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { secret, limit, offset, eventTypes }) => {
    requireBackendSecret(secret);
    let rows = await ctx.db.query("admin_audit_log").collect();
    if (eventTypes && eventTypes.length > 0) {
      rows = rows.filter((r) => eventTypes.includes(r.event_type));
    }
    rows.sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
    const total = rows.length;
    const slice = rows.slice(offset, offset + limit);
    return {
      entries: slice.map((e) => ({
        id: String(e._id),
        event_type: e.event_type,
        actor: e.actor,
        action: e.action,
        target_id: e.target_id,
        details: e.details,
        ip_address: e.ip_address,
        created_at: e.created_at ?? "",
      })),
      total,
    };
  },
});

export const clearAuditLogAdmin = mutation({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    requireBackendSecret(secret);
    const rows = await ctx.db.query("admin_audit_log").collect();
    for (const r of rows) {
      await ctx.db.delete(r._id);
    }
  },
});

/** Profiles waiting for beta access (not approved yet: false or missing flag, not rejected). */
export const listPendingBetaAccessAdmin = query({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    requireBackendSecret(secret);
    const rows = await ctx.db.query("profiles").collect();
    const pending = rows
      .filter((r) => r.beta_rejected !== true && r.beta_approved !== true)
      .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
    return {
      profiles: pending.map((p) => ({
        userId: p.id,
        full_name: p.full_name ?? null,
        contact_email: p.contact_email ?? null,
        brand_name: p.brand_name ?? null,
        account_type: p.account_type,
        created_at: p.created_at ?? null,
        beta_requested_at: p.beta_requested_at ?? null,
      })),
    };
  },
});

async function profileRowForAdmin(ctx: MutationCtx, userId: string) {
  for (const key of authSubjectSegments(userId)) {
    const row = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("id", key))
      .unique();
    if (row) return row;
  }
  return null;
}

export const approveBetaAccessAdmin = mutation({
  args: { secret: v.string(), userId: v.string() },
  handler: async (ctx, { secret, userId }) => {
    requireBackendSecret(secret);
    const row = await profileRowForAdmin(ctx, userId);
    if (!row) throw new Error("Profile not found");
    const now = new Date().toISOString();
    await ctx.db.patch(row._id, {
      beta_approved: true,
      beta_approved_at: now,
      beta_rejected: false,
      updated_at: now,
    } as never);
    return { ok: true as const };
  },
});

export const rejectBetaAccessAdmin = mutation({
  args: { secret: v.string(), userId: v.string() },
  handler: async (ctx, { secret, userId }) => {
    requireBackendSecret(secret);
    const row = await profileRowForAdmin(ctx, userId);
    if (!row) throw new Error("Profile not found");
    const now = new Date().toISOString();
    await ctx.db.patch(row._id, {
      beta_rejected: true,
      beta_rejected_at: now,
      updated_at: now,
    } as never);
    return { ok: true as const };
  },
});

/**
 * Cascade-delete a user’s app data (profile, keys, try-ons, etc.).
 * Does not remove Convex Auth `authAccounts` rows (library limitation); deleting the profile
 * blocks dashboard access; signing in may recreate a profile on next bootstrap unless the auth user is removed manually.
 */
export const deleteUserAccountAdmin = mutation({
  args: { secret: v.string(), userId: v.string() },
  handler: async (ctx, { secret, userId }) => {
    requireBackendSecret(secret);
    const keys = authSubjectSegments(userId);
    if (keys.length === 0) throw new Error("Invalid userId");

    const deletedTryonIds = new Set<string>();

    for (const uid of keys) {
      const apiRows = await ctx.db
        .query("api_keys")
        .withIndex("by_userId", (q) => q.eq("user_id", uid))
        .collect();
      for (const k of apiRows) {
        const kid = String(k.legacy_id ?? k._id);
        const domains = await ctx.db
          .query("allowed_domains")
          .withIndex("by_apiKeyId", (q) => q.eq("api_key_id", kid))
          .collect();
        for (const d of domains) await ctx.db.delete(d._id);
        await ctx.db.delete(k._id);
      }

      const subs = await ctx.db
        .query("subscriptions")
        .withIndex("by_userId", (q) => q.eq("user_id", uid))
        .collect();
      for (const s of subs) await ctx.db.delete(s._id);

      const pays = await ctx.db
        .query("payments")
        .withIndex("by_userId", (q) => q.eq("user_id", uid))
        .collect();
      for (const p of pays) await ctx.db.delete(p._id);

      const prods = await ctx.db
        .query("products")
        .withIndex("by_userId", (q) => q.eq("user_id", uid))
        .collect();
      for (const p of prods) await ctx.db.delete(p._id);

      const usages = await ctx.db
        .query("usage_events")
        .withIndex("by_userId_time", (q) => q.eq("user_id", uid))
        .collect();
      for (const e of usages) await ctx.db.delete(e._id);

      const tryonRows = await ctx.db
        .query("tryons")
        .withIndex("by_userId", (q) => q.eq("user_id", uid))
        .collect();
      for (const t of tryonRows) {
        const tid = String(t._id);
        if (deletedTryonIds.has(tid)) continue;
        deletedTryonIds.add(tid);
        await ctx.db.delete(t._id);
      }
    }

    const prof = await profileRowForAdmin(ctx, userId);
    if (prof) await ctx.db.delete(prof._id);

    for (const seg of keys) {
      try {
        const doc = await ctx.db.get(seg as Id<"users">);
        if (doc) await ctx.db.delete(doc._id);
      } catch {
        /* invalid id */
      }
    }

    return { ok: true as const };
  },
});
