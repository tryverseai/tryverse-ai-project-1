import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

/**
 * Convex Auth `users` + app tables. Profile `id` matches `ctx.auth` subject (string user id).
 */
export default defineSchema({
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    account_type: v.optional(v.string()),
    brand_name: v.optional(v.string()),
    full_name: v.optional(v.string()),
    role: v.optional(v.string()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  profiles: defineTable({
    id: v.string(),
    plan_id: v.string(),
    account_type: v.string(),
    brand_name: v.optional(v.string()),
    compliance_onboarding_completed_at: v.optional(v.string()),
    contact_email: v.optional(v.string()),
    created_at: v.optional(v.string()),
    current_plan_id: v.optional(v.string()),
    free_credits_remaining: v.number(),
    free_credits_total: v.number(),
    full_name: v.optional(v.string()),
    is_blocked: v.boolean(),
    monthly_credits_remaining: v.number(),
    monthly_credits_total: v.number(),
    onboarding_goals: v.optional(v.array(v.string())),
    role: v.optional(v.string()),
    updated_at: v.optional(v.string()),
    website_url: v.optional(v.string()),
    widget_activated: v.boolean(),
    widget_auto_detect: v.optional(v.boolean()),
    widget_collect_analytics: v.optional(v.boolean()),
    widget_fit_recommendations: v.optional(v.boolean()),
    widget_show_models: v.optional(v.boolean()),
  }).index("by_userId", ["id"]),

  plans: defineTable({
    id: v.string(),
    name: v.string(),
    is_active: v.boolean(),
    max_products: v.number(),
    price_ngn: v.number(),
    price_usd: v.number(),
    tryons_per_month: v.number(),
    created_at: v.optional(v.string()),
    features: v.optional(v.any()),
  }).index("by_planId", ["id"]),

  tryverse_model_library: defineTable({
    legacy_id: v.optional(v.string()),
    slug: v.string(),
    display_name: v.string(),
    gender: v.string(),
    body_type: v.optional(v.string()),
    appearance_tag: v.optional(v.string()),
    image_url: v.string(),
    sort_order: v.number(),
    is_active: v.boolean(),
    free_tier_eligible: v.boolean(),
    created_at: v.optional(v.string()),
  })
    .index("by_slug", ["slug"])
    .index("by_active_sort", ["is_active", "sort_order"]),

  api_keys: defineTable({
    legacy_id: v.optional(v.string()),
    user_id: v.string(),
    key_value: v.string(),
    name: v.string(),
    status: v.string(),
    created_at: v.optional(v.string()),
    last_used_at: v.optional(v.string()),
  })
    .index("by_userId", ["user_id"])
    .index("by_key_value", ["key_value"]),

  allowed_domains: defineTable({
    legacy_id: v.optional(v.string()),
    api_key_id: v.string(),
    domain: v.string(),
    created_at: v.optional(v.string()),
  }).index("by_apiKeyId", ["api_key_id"]),

  subscriptions: defineTable({
    legacy_id: v.optional(v.string()),
    user_id: v.string(),
    plan_id: v.string(),
    status: v.string(),
    provider: v.string(),
    provider_subscription_id: v.optional(v.string()),
    current_period_start: v.optional(v.string()),
    current_period_end: v.optional(v.string()),
    created_at: v.optional(v.string()),
    updated_at: v.optional(v.string()),
  })
    .index("by_userId", ["user_id"])
    .index("by_planId", ["plan_id"]),

  payments: defineTable({
    legacy_id: v.optional(v.string()),
    user_id: v.optional(v.string()),
    amount: v.number(),
    currency: v.string(),
    provider: v.string(),
    reference: v.string(),
    status: v.string(),
    created_at: v.optional(v.string()),
  }).index("by_userId", ["user_id"]),

  products: defineTable({
    legacy_id: v.optional(v.string()),
    user_id: v.string(),
    name: v.string(),
    image_url: v.optional(v.string()),
    category: v.string(),
    product_url: v.optional(v.string()),
    tryons_count: v.number(),
    created_at: v.optional(v.string()),
    updated_at: v.optional(v.string()),
  })
    .index("by_userId", ["user_id"])
    // Composite index: efficient category-filtered listing without a full table scan
    .index("by_user_category", ["user_id", "category"])
    // Allows O(1) lookup by legacy UUID in update/delete mutations
    .index("by_legacyId", ["legacy_id"]),

  tryons: defineTable({
    legacy_id: v.optional(v.string()),
    user_id: v.optional(v.string()),
    category: v.string(),
    person_image: v.string(),
    product_image: v.string(),
    result_image: v.optional(v.string()),
    status: v.string(),
    created_at: v.optional(v.string()),
    completed_at: v.optional(v.string()),
  })
    .index("by_userId", ["user_id"])
    .index("by_status", ["status"])
    .index("by_legacyId", ["legacy_id"])
    // Composite index: efficient per-user sorted history listing
    .index("by_user_created", ["user_id", "created_at"]),

  usage_events: defineTable({
    legacy_id: v.optional(v.string()),
    user_id: v.string(),
    event_type: v.string(),
    metadata: v.optional(v.any()),
    created_at: v.optional(v.string()),
  }).index("by_userId_time", ["user_id", "created_at"]),

  early_access_requests: defineTable({
    legacy_id: v.optional(v.string()),
    applicant_type: v.optional(v.string()),
    first_name: v.string(),
    email: v.string(),
    brand_name: v.string(),
    role: v.string(),
    website_url: v.string(),
    platform: v.string(),
    product_range: v.string(),
    monthly_revenue: v.string(),
    return_rate: v.string(),
    top_return_reason: v.string(),
    customer_confidence: v.string(),
    tried_solutions: v.any(),
    must_have_features: v.any(),
    biggest_challenge: v.string(),
    timeline: v.string(),
    heard_about: v.optional(v.string()),
    prior_solution_notes: v.optional(v.string()),
    created_at: v.optional(v.string()),
    /** Admin waitlist UX: omit or \"open\"; \"ignored\" = reviewed / deprioritized */
    waitlist_review_status: v.optional(v.string()),
  }).index("by_email", ["email"]),

  invites: defineTable({
    token: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    /** \"personal\" | \"business\" (business maps to Convex profile account_type \"business\") */
    accountType: v.string(),
    companyName: v.optional(v.string()),
    /** pending | sent | accepted | expired */
    status: v.string(),
    createdAt: v.number(),
    sentAt: v.optional(v.number()),
    acceptedAt: v.optional(v.number()),
    createdBy: v.optional(v.string()),
  })
    .index("by_token", ["token"])
    .index("by_email", ["email"])
    .index("by_status", ["status"])
    .index("by_account_type", ["accountType"]),

  support_requests: defineTable({
    legacy_id: v.optional(v.string()),
    name: v.optional(v.string()),
    first_name: v.optional(v.string()),
    last_name: v.optional(v.string()),
    company_name: v.optional(v.string()),
    email: v.string(),
    phone_number: v.optional(v.string()),
    category: v.string(),
    subject: v.string(),
    message: v.string(),
    status: v.string(),
    created_at: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    .index("by_category", ["category"]),

  rate_limits: defineTable({
    legacy_id: v.optional(v.string()),
    api_key_id: v.string(),
    request_count: v.number(),
    window_start: v.string(),
  }).index("by_key_window", ["api_key_id", "window_start"]),

  admin_audit_log: defineTable({
    event_type: v.string(),
    actor: v.optional(v.string()),
    action: v.string(),
    target_id: v.optional(v.string()),
    details: v.optional(v.any()),
    ip_address: v.optional(v.string()),
    user_agent: v.optional(v.string()),
    created_at: v.optional(v.string()),
  }).index("by_created", ["created_at"]),
});
