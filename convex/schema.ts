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
    /** Closed beta: dashboard only when true; false/undefined = pending until admin approves */
    beta_approved: v.optional(v.boolean()),
    beta_requested_at: v.optional(v.string()),
    beta_approved_at: v.optional(v.string()),
    beta_rejected: v.optional(v.boolean()),
    beta_rejected_at: v.optional(v.string()),
    terms_of_service_accepted_at: v.optional(v.string()),
    /** Which published legal-policy version terms_of_service_accepted_at was recorded against — lets us tell a stale acceptance from a current one without ever rewriting historical accepted-at timestamps. */
    policy_version_accepted: v.optional(v.string()),
    /** Set once the customer has made an explicit plan choice on the post-terms onboarding gate. */
    plan_selected_at: v.optional(v.string()),
    /** Legacy: was used to dedupe post-verify “welcome” sends; prefer `welcome_email_sent_at`. */
    verification_email_sent_at: v.optional(v.string()),
    /** Set once after first successful email verification + bootstrap welcome email. */
    welcome_email_sent_at: v.optional(v.string()),
  })
    .index("by_userId", ["id"])
    .index("by_contact_email", ["contact_email"]),

  /** Browser / client fingerprints approved after email OTP + optional device code (new device). */
  trusted_devices: defineTable({
    user_profile_id: v.string(),
    fingerprint: v.string(),
    created_at: v.string(),
  })
    .index("by_user", ["user_profile_id"])
    .index("by_user_fingerprint", ["user_profile_id", "fingerprint"]),

  /** Short-lived 6-digit device approval challenges (10 min). */
  device_approval_challenges: defineTable({
    user_profile_id: v.string(),
    fingerprint: v.string(),
    code_hash: v.string(),
    expires_at: v.number(),
    used: v.boolean(),
    created_at: v.string(),
  })
    .index("by_user_profile_fingerprint", ["user_profile_id", "fingerprint"])
    .index("by_user_profile", ["user_profile_id"]),

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
    /** Subset of ["read","write"]. Undefined/empty = full access — every key created before this
     *  field existed keeps working exactly as before. */
    scopes: v.optional(v.array(v.string())),
    /** ISO timestamp. Undefined = never expires. */
    expires_at: v.optional(v.string()),
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
  })
    .index("by_userId", ["user_id"])
    .index("by_reference", ["reference"]),

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

  /** Durable per-email cooldown for signup/password-reset OTP sends — prevents email-bombing an
   *  arbitrary inbox via unlimited "resend code" requests. Checked from inside the Convex Auth
   *  email provider's `sendVerificationRequest`, which runs as an action (has ctx.db access). */
  email_verification_throttle: defineTable({
    email: v.string(),
    last_sent_at: v.number(),
    window_start: v.number(),
    count_in_window: v.number(),
  }).index("by_email", ["email"]),

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

  /**
   * Usage/history log for Enterprise-gated AI generation features (AI Model Generation, AI Video
   * Generation via Higgsfield). Written by `backendTrusted.logAiGenerationUsage`; plan-tier
   * enforcement itself lives in `backend/src/middleware/requirePlan.ts` (reads `profiles.plan_id`,
   * not this table). Not yet wired to any route — primitive only, callers land with the workstream
   * that ships the actual generation endpoints.
   */
  ai_generation_usage: defineTable({
    user_id: v.string(),
    feature: v.union(
      v.literal("ai_model"),
      v.literal("ai_photoshoot"),
      v.literal("outfit_builder"),
      v.literal("product_model"),
      v.literal("video")
    ),
    created_at: v.optional(v.string()),
  }).index("by_userId", ["user_id"]),

  /**
   * Enterprise "Outfit Builder" generations — a composited flat-lay of multiple products
   * (top/bottom-or-one-piece + optional shoes/outerwear) worn together by one model, generated
   * via FASHN's Try-On Max model. Deliberately separate from `tryons`, which models exactly one
   * product per generation and is not touched by this feature.
   */
  outfit_generations: defineTable({
    user_id: v.string(),
    model_image: v.string(),
    slots: v.object({
      top: v.optional(v.string()),
      bottom: v.optional(v.string()),
      one_piece: v.optional(v.string()),
      shoes: v.optional(v.string()),
      outerwear: v.optional(v.string()),
    }),
    composite_image: v.optional(v.string()),
    prompt_used: v.string(),
    result_image: v.optional(v.string()),
    status: v.string(),
    error: v.optional(v.string()),
    created_at: v.string(),
    completed_at: v.optional(v.string()),
  })
    .index("by_userId", ["user_id"])
    .index("by_user_created", ["user_id", "created_at"]),

  /** Enterprise "Generate AI Model" library — saved/reusable generated fashion models. */
  ai_generated_models: defineTable({
    user_id: v.string(),
    storage_path: v.string(),
    params: v.object({
      prompt: v.string(),
    }),
    status: v.union(v.literal("active"), v.literal("archived")),
    created_at: v.string(),
  })
    .index("by_userId", ["user_id"])
    .index("by_user_created", ["user_id", "created_at"]),

  /**
   * Enterprise "AI Model Studio" — a product photo generated onto an AI-created model via FASHN's
   * `product-to-model` endpoint. Deliberately separate from `ai_generated_models` (a saved,
   * reusable model library) and from the existing Replicate-based AI Product Photoshoot — this is
   * a lighter-weight, single-shot generator with no model library step.
   */
  product_model_generations: defineTable({
    user_id: v.string(),
    product_image: v.string(),
    face_reference: v.optional(v.string()),
    prompt_used: v.optional(v.string()),
    result_image: v.optional(v.string()),
    status: v.string(),
    error: v.optional(v.string()),
    created_at: v.string(),
    completed_at: v.optional(v.string()),
  })
    .index("by_userId", ["user_id"])
    .index("by_user_created", ["user_id", "created_at"]),

  /**
   * AI Product Photoshoot (`AiPhotoshootTab.tsx`) — records which product and model a photoshoot
   * result actually used, so results can be audited/associated after the fact. Previously this
   * feature only logged an anonymous usage-count row with no product/model relationship.
   */
  photoshoot_generations: defineTable({
    user_id: v.string(),
    product_storage_path: v.string(),
    model_id: v.string(),
    model_source: v.string(),
    theme: v.optional(v.string()),
    lighting: v.optional(v.string()),
    background: v.optional(v.string()),
    result_image: v.optional(v.string()),
    status: v.string(),
    error: v.optional(v.string()),
    created_at: v.string(),
    completed_at: v.optional(v.string()),
  })
    .index("by_userId", ["user_id"])
    .index("by_user_created", ["user_id", "created_at"]),

  /**
   * Enterprise "AI Video" — animates a still image (any result the brand already generated, or a
   * fresh upload) via FASHN's `image-to-video` endpoint. Real per-credit cost (480p=1, 720p=3,
   * 1080p=6, x2 for 10s) — kept behind the same Enterprise gate + dark-ship flag as everything else
   * here, and separate from all other generation tables/queues.
   */
  video_generations: defineTable({
    user_id: v.string(),
    source_image: v.string(),
    prompt_used: v.optional(v.string()),
    duration_seconds: v.number(),
    resolution: v.string(),
    result_video: v.optional(v.string()),
    status: v.string(),
    error: v.optional(v.string()),
    created_at: v.string(),
    completed_at: v.optional(v.string()),
  })
    .index("by_userId", ["user_id"])
    .index("by_user_created", ["user_id", "created_at"]),
});
