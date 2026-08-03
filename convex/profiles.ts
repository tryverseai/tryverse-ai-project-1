import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { canonicalAuthSubjectProfileId, subjectsOverlap } from "./authSubjectKeys";
import { collectProfileDocsForSubjectKeys, findProfileBySubjectKeys } from "./profileLookup";

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
  beta_approved: v.optional(v.boolean()),
  beta_requested_at: v.optional(v.string()),
  beta_approved_at: v.optional(v.string()),
  beta_rejected: v.optional(v.boolean()),
  beta_rejected_at: v.optional(v.string()),
  terms_of_service_accepted_at: v.optional(v.string()),
  plan_selected_at: v.optional(v.string()),
  verification_email_sent_at: v.optional(v.string()),
  welcome_email_sent_at: v.optional(v.string()),
});

/** Current user's profile (Convex Auth JWT). */
export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await findProfileBySubjectKeys(ctx, identity.subject);
  },
});

export const upsertProfileForUser = mutation({
  args: {
    userId: v.string(),
    patch: profilePatch,
  },
  handler: async (ctx, { userId, patch }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !subjectsOverlap(identity.subject, userId)) {
      throw new Error("Not authorized");
    }

    const stableId = canonicalAuthSubjectProfileId(userId);
    // Always normalise contact_email to lowercase to keep the by_contact_email index consistent.
    const normEmail =
      typeof patch.contact_email === "string" ? patch.contact_email.trim().toLowerCase() : undefined;

    // Subject-based lookup first, then email-based fallback to prevent cross-session duplicates.
    const hits = await collectProfileDocsForSubjectKeys(ctx, identity.subject, normEmail);
    const existing =
      hits.find((h) => h.id === stableId) ??
      hits.find((h) => h.id === canonicalAuthSubjectProfileId(userId)) ??
      hits[0] ??
      (await findProfileBySubjectKeys(ctx, userId));

    const now = new Date().toISOString();
    const defaults = {
      id: stableId,
      plan_id: patch.plan_id ?? "free",
      account_type: patch.account_type ?? "business",
      brand_name: patch.brand_name,
      full_name: patch.full_name,
      role: patch.role,
      website_url: patch.website_url,
      contact_email: normEmail,
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
      beta_approved: patch.beta_approved ?? false,
      beta_requested_at: patch.beta_requested_at ?? now,
      created_at: now,
      updated_at: now,
    };

    if (existing) {
      const updates: Record<string, unknown> = { updated_at: now, id: stableId };
      for (const [key, val] of Object.entries(patch) as [string, unknown][]) {
        if (val !== undefined) {
          updates[key] = key === "contact_email" && typeof val === "string"
            ? val.trim().toLowerCase()
            : val;
        }
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
    const existing = await findProfileBySubjectKeys(ctx, identity.subject);
    if (!existing) throw new Error("Profile not found");
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { updated_at: now };
    for (const [k, v] of Object.entries(args)) {
      if (v !== undefined) {
        updates[k] = k === "contact_email" && typeof v === "string"
          ? v.trim().toLowerCase()
          : v;
      }
    }
    await ctx.db.patch(existing._id, updates);
  },
});

export const acceptTermsOfService = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const existing = await findProfileBySubjectKeys(ctx, identity.subject);
    if (!existing) throw new Error("Profile not found");
    const now = new Date().toISOString();
    await ctx.db.patch(existing._id, {
      terms_of_service_accepted_at: now,
      updated_at: now,
    });
    return { ok: true as const };
  },
});

/** One-time gate after Terms acceptance — records that the customer made an explicit plan choice. */
export const confirmPlanSelection = mutation({
  args: { plan_id: v.optional(v.string()) },
  handler: async (ctx, { plan_id }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const existing = await findProfileBySubjectKeys(ctx, identity.subject);
    if (!existing) throw new Error("Profile not found");
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { plan_selected_at: now, updated_at: now };
    if (plan_id) updates.plan_id = plan_id;
    await ctx.db.patch(existing._id, updates);
    return { ok: true as const };
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
    const existing = await findProfileBySubjectKeys(ctx, identity.subject);
    if (!existing) throw new Error("Profile not found");
    await ctx.db.patch(existing._id, {
      compliance_onboarding_completed_at: completed_at,
      onboarding_goals,
      updated_at: completed_at,
    });
  },
});
