import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const profilePatch = v.object({
  plan_id: v.optional(v.string()),
  account_type: v.optional(v.string()),
  brand_name: v.optional(v.string()),
  full_name: v.optional(v.string()),
  role: v.optional(v.string()),
  website_url: v.optional(v.string()),
  contact_email: v.optional(v.string()),
  current_plan_id: v.optional(v.string()),
  free_credits_remaining: v.optional(v.number()),
  free_credits_total: v.optional(v.number()),
  monthly_credits_remaining: v.optional(v.number()),
  monthly_credits_total: v.optional(v.number()),
  widget_activated: v.optional(v.boolean()),
  compliance_onboarding_completed_at: v.optional(v.string()),
  onboarding_goals: v.optional(v.array(v.string())),
  is_blocked: v.optional(v.boolean()),
  widget_auto_detect: v.optional(v.boolean()),
  widget_collect_analytics: v.optional(v.boolean()),
  widget_fit_recommendations: v.optional(v.boolean()),
  widget_show_models: v.optional(v.boolean()),
});

/** Current user's profile (Convex Auth JWT). */
export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;
    return await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("id", userId))
      .unique();
  },
});

export const upsertProfileForUser = mutation({
  args: {
    userId: v.string(),
    patch: profilePatch,
  },
  handler: async (ctx, { userId, patch }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== userId) {
      throw new Error("Not authorized");
    }

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("id", userId))
      .unique();

    const now = new Date().toISOString();
    const defaults = {
      id: userId,
      plan_id: patch.plan_id ?? "free",
      account_type: patch.account_type ?? "business",
      brand_name: patch.brand_name,
      full_name: patch.full_name,
      role: patch.role,
      website_url: patch.website_url,
      contact_email: patch.contact_email,
      current_plan_id: patch.current_plan_id,
      free_credits_remaining: patch.free_credits_remaining ?? 20,
      free_credits_total: patch.free_credits_total ?? 20,
      monthly_credits_remaining: patch.monthly_credits_remaining ?? 0,
      monthly_credits_total: patch.monthly_credits_total ?? 0,
      widget_activated: patch.widget_activated ?? false,
      compliance_onboarding_completed_at: patch.compliance_onboarding_completed_at,
      onboarding_goals: patch.onboarding_goals,
      is_blocked: patch.is_blocked ?? false,
      widget_auto_detect: patch.widget_auto_detect,
      widget_collect_analytics: patch.widget_collect_analytics,
      widget_fit_recommendations: patch.widget_fit_recommendations,
      widget_show_models: patch.widget_show_models,
      created_at: now,
      updated_at: now,
    };

    if (existing) {
      const updates: Record<string, unknown> = { updated_at: now };
      for (const [key, val] of Object.entries(patch) as [string, unknown][]) {
        if (val !== undefined) updates[key] = val;
      }
      await ctx.db.patch(existing._id, updates);
      return existing._id;
    }

    return await ctx.db.insert("profiles", defaults);
  },
});

export const updateSettings = mutation({
  args: {
    brand_name: v.optional(v.string()),
    website_url: v.optional(v.string()),
    contact_email: v.optional(v.string()),
    widget_show_models: v.optional(v.boolean()),
    widget_fit_recommendations: v.optional(v.boolean()),
    widget_auto_detect: v.optional(v.boolean()),
    widget_collect_analytics: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("id", identity.subject))
      .unique();
    if (!existing) throw new Error("Profile not found");
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { updated_at: now };
    for (const [k, v] of Object.entries(args)) {
      if (v !== undefined) updates[k] = v;
    }
    await ctx.db.patch(existing._id, updates);
  },
});

export const completeCompliance = mutation({
  args: {
    onboarding_goals: v.array(v.string()),
    completed_at: v.string(),
  },
  handler: async (ctx, { onboarding_goals, completed_at }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("id", identity.subject))
      .unique();
    if (!existing) throw new Error("Profile not found");
    await ctx.db.patch(existing._id, {
      compliance_onboarding_completed_at: completed_at,
      onboarding_goals,
      updated_at: completed_at,
    });
  },
});
