import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { authSubjectSegments, canonicalAuthSubjectProfileId, subjectsOverlap } from "./authSubjectKeys";
import { collectProfileDocsForSubjectKeys, findProfileBySubjectKeys } from "./profileLookup";
import { defaultModelLibraryRows } from "./modelLibrarySeedRows";

function requireBackendSecret(secret: string) {
  const expected = (process.env.BACKEND_SHARED_SECRET ?? "").trim();
  const got = String(secret).trim();
  if (!expected || got !== expected) {
    throw new Error("Unauthorized");
  }
}

export const getUserRowById = query({
  args: { secret: v.string(), userId: v.string() },
  handler: async (ctx, { secret, userId }) => {
    requireBackendSecret(secret);
    // The auth subject may be a compound string "authAccountId|userDocId".
    // Extract the actual users-table document ID (segment after the last '|').
    const docId = userId.includes("|") ? userId.split("|").pop()! : userId;
    try {
      return await ctx.db.get(docId as Id<"users">);
    } catch {
      // ID is still not a valid Convex document ID — return null gracefully.
      return null;
    }
  },
});

export const getProfileRow = query({
  args: { secret: v.string(), userId: v.string() },
  handler: async (ctx, { secret, userId }) => {
    requireBackendSecret(secret);
    return await findProfileBySubjectKeys(ctx, userId);
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
    contactEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireBackendSecret(args.secret);
    const now = new Date().toISOString();
    /** Always store / compare contact_email in lowercase to prevent case-mismatch duplicates. */
    const normEmail =
      typeof args.contactEmail === "string" ? args.contactEmail.trim().toLowerCase() : "";
    const raw = String(args.userId).trim();
    const canon = canonicalAuthSubjectProfileId(raw);

    /**
     * All profile docs tied to this auth user — first by subject segments, then by email.
     * The email fallback prevents duplicates when the JWT subject shape changed between sessions.
     */
    const hits = await collectProfileDocsForSubjectKeys(ctx, raw, normEmail);

    if (hits.length > 0) {
      hits.sort((a, b) => a._creationTime - b._creationTime);
      const keeper = hits.find((h) => h.id === canon) ?? hits[0]!;
      const duplicates = hits.filter((h) => String(h._id) !== String(keeper._id));

      let welcomeAt = keeper.welcome_email_sent_at;
      let verifyAt = keeper.verification_email_sent_at;
      let termsAt = keeper.terms_of_service_accepted_at;
      let maxFreeRem = keeper.free_credits_remaining;
      let maxFreeTot = keeper.free_credits_total;
      let maxMRem = keeper.monthly_credits_remaining;
      let maxMTot = keeper.monthly_credits_total;
      let betaOk = keeper.beta_approved === true;
      let betaApAt = keeper.beta_approved_at;
      let betaReqAt = keeper.beta_requested_at;
      let betaRej = keeper.beta_rejected === true;
      let betaRejAt = keeper.beta_rejected_at;

      for (const h of hits) {
        if (typeof h.welcome_email_sent_at === "string" && h.welcome_email_sent_at.trim()) {
          if (!welcomeAt || !String(welcomeAt).trim()) welcomeAt = h.welcome_email_sent_at;
        }
        if (typeof h.verification_email_sent_at === "string" && h.verification_email_sent_at.trim()) {
          if (!verifyAt || !String(verifyAt).trim()) verifyAt = h.verification_email_sent_at;
        }
        if (typeof h.terms_of_service_accepted_at === "string" && h.terms_of_service_accepted_at.trim()) {
          if (!termsAt || !String(termsAt).trim()) termsAt = h.terms_of_service_accepted_at;
        }
        maxFreeRem = Math.max(maxFreeRem, h.free_credits_remaining);
        maxFreeTot = Math.max(maxFreeTot, h.free_credits_total);
        maxMRem = Math.max(maxMRem, h.monthly_credits_remaining);
        maxMTot = Math.max(maxMTot, h.monthly_credits_total);
        if (h.beta_approved === true) betaOk = true;
        if (typeof h.beta_approved_at === "string" && h.beta_approved_at.trim()) {
          if (!betaApAt || !String(betaApAt).trim()) betaApAt = h.beta_approved_at;
        }
        if (typeof h.beta_requested_at === "string" && h.beta_requested_at.trim()) {
          if (!betaReqAt || !String(betaReqAt).trim()) betaReqAt = h.beta_requested_at;
        }
        if (h.beta_rejected === true) betaRej = true;
        if (typeof h.beta_rejected_at === "string" && h.beta_rejected_at.trim()) {
          if (!betaRejAt || !String(betaRejAt).trim()) betaRejAt = h.beta_rejected_at;
        }
      }

      for (const d of duplicates) {
        await ctx.db.delete(d._id);
      }

      const patch: Record<string, unknown> = {
        updated_at: now,
        id: canon,
        welcome_email_sent_at: welcomeAt,
        verification_email_sent_at: verifyAt,
        terms_of_service_accepted_at: termsAt,
        free_credits_remaining: maxFreeRem,
        free_credits_total: maxFreeTot,
        monthly_credits_remaining: maxMRem,
        monthly_credits_total: maxMTot,
        beta_approved: betaOk,
        beta_approved_at: betaApAt,
        beta_requested_at: betaReqAt,
        beta_rejected: betaRej,
        beta_rejected_at: betaRejAt,
      };
      // Always write the normalised email onto the keeper (fills in blanks and fixes case).
      if (normEmail) {
        patch.contact_email = normEmail;
      }

      await ctx.db.patch(keeper._id, patch as never);
      return { inserted: false as const, mergedDuplicates: duplicates.length };
    }

    await ctx.db.insert("profiles", {
      id: canon,
      plan_id: "free",
      account_type: args.accountType,
      free_credits_remaining: args.freeCreditsRemaining,
      free_credits_total: args.freeCreditsTotal,
      monthly_credits_remaining: 0,
      monthly_credits_total: 0,
      is_blocked: false,
      widget_activated: false,
      // Self-serve now — no closed-beta approval step. Kept `true` (not omitted) so any code
      // still reading this field for display purposes sees an accurate, non-"pending" state.
      beta_approved: true,
      beta_approved_at: now,
      created_at: now,
      updated_at: now,
      ...(normEmail ? { contact_email: normEmail } : {}),
    });
    return { inserted: true as const, mergedDuplicates: 0 };
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
    const row = await findProfileBySubjectKeys(ctx, userId);
    if (!row) throw new Error("Profile not found");
    const p = patch as Record<string, unknown>;
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of Object.keys(p)) {
      if (p[key] !== undefined) {
        // Always store contact_email in lowercase so the by_contact_email index stays consistent.
        if (key === "contact_email" && typeof p[key] === "string") {
          updates[key] = (p[key] as string).trim().toLowerCase();
        } else {
          updates[key] = p[key];
        }
      }
    }
    await ctx.db.patch(row._id, updates as never);
    return { ok: true as const };
  },
});

export const countTrustedDevicesForProfile = query({
  args: { secret: v.string(), userProfileId: v.string() },
  handler: async (ctx, { secret, userProfileId }) => {
    requireBackendSecret(secret);
    const rows = await ctx.db
      .query("trusted_devices")
      .withIndex("by_user", (q) => q.eq("user_profile_id", userProfileId))
      .collect();
    return rows.length;
  },
});

export const isDeviceFingerprintTrusted = query({
  args: { secret: v.string(), userProfileId: v.string(), fingerprint: v.string() },
  handler: async (ctx, { secret, userProfileId, fingerprint }) => {
    requireBackendSecret(secret);
    const fp = fingerprint.trim();
    if (!fp) return false;
    const row = await ctx.db
      .query("trusted_devices")
      .withIndex("by_user_fingerprint", (q) =>
        q.eq("user_profile_id", userProfileId).eq("fingerprint", fp),
      )
      .unique();
    return row !== null;
  },
});

export const registerTrustedDevice = mutation({
  args: { secret: v.string(), userProfileId: v.string(), fingerprint: v.string() },
  handler: async (ctx, args) => {
    requireBackendSecret(args.secret);
    const fp = args.fingerprint.trim();
    if (!fp) throw new Error("Missing fingerprint");
    const existing = await ctx.db
      .query("trusted_devices")
      .withIndex("by_user_fingerprint", (q) =>
        q.eq("user_profile_id", args.userProfileId).eq("fingerprint", fp),
      )
      .unique();
    if (existing) return { ok: true as const, created: false as const };
    const now = new Date().toISOString();
    await ctx.db.insert("trusted_devices", {
      user_profile_id: args.userProfileId,
      fingerprint: fp,
      created_at: now,
    });
    return { ok: true as const, created: true as const };
  },
});

export const replaceDeviceApprovalChallenge = mutation({
  args: {
    secret: v.string(),
    userProfileId: v.string(),
    fingerprint: v.string(),
    codeHash: v.string(),
    expiresAtMs: v.number(),
  },
  handler: async (ctx, args) => {
    requireBackendSecret(args.secret);
    const fp = args.fingerprint.trim();
    if (!fp) throw new Error("Missing fingerprint");
    const prev = await ctx.db
      .query("device_approval_challenges")
      .withIndex("by_user_profile_fingerprint", (q) =>
        q.eq("user_profile_id", args.userProfileId).eq("fingerprint", fp),
      )
      .collect();
    for (const row of prev) await ctx.db.delete(row._id);
    const now = new Date().toISOString();
    await ctx.db.insert("device_approval_challenges", {
      user_profile_id: args.userProfileId,
      fingerprint: fp,
      code_hash: args.codeHash,
      expires_at: args.expiresAtMs,
      used: false,
      created_at: now,
    });
    return { ok: true as const };
  },
});

export const verifyDeviceApprovalChallenge = mutation({
  args: {
    secret: v.string(),
    userProfileId: v.string(),
    fingerprint: v.string(),
    codeHash: v.string(),
  },
  handler: async (ctx, args) => {
    requireBackendSecret(args.secret);
    const fp = args.fingerprint.trim();
    if (!fp) throw new Error("Missing fingerprint");
    const rows = await ctx.db
      .query("device_approval_challenges")
      .withIndex("by_user_profile_fingerprint", (q) =>
        q.eq("user_profile_id", args.userProfileId).eq("fingerprint", fp),
      )
      .collect();
    const nowMs = Date.now();
    let matched: Doc<"device_approval_challenges"> | null = null;
    for (const row of rows) {
      if (row.used) continue;
      if (row.expires_at <= nowMs) continue;
      if (row.code_hash !== args.codeHash) continue;
      matched = row;
      break;
    }
    if (!matched) throw new Error("INVALID_DEVICE_CODE");

    await ctx.db.patch(matched._id, { used: true } as never);

    const trustExists = await ctx.db
      .query("trusted_devices")
      .withIndex("by_user_fingerprint", (q) =>
        q.eq("user_profile_id", args.userProfileId).eq("fingerprint", fp),
      )
      .unique();
    if (!trustExists) {
      const ts = new Date().toISOString();
      await ctx.db.insert("trusted_devices", {
        user_profile_id: args.userProfileId,
        fingerprint: fp,
        created_at: ts,
      });
    }

    const stale = await ctx.db
      .query("device_approval_challenges")
      .withIndex("by_user_profile_fingerprint", (q) =>
        q.eq("user_profile_id", args.userProfileId).eq("fingerprint", fp),
      )
      .collect();
    for (const row of stale) {
      if (row._id !== matched._id && !row.used) await ctx.db.delete(row._id);
    }

    return { ok: true as const };
  },
});

async function profileRowForBackend(ctx: MutationCtx, userId: string) {
  return await findProfileBySubjectKeys(ctx, userId);
}

/** Mirrors adminTrusted.approveBetaAccessAdmin when that export is missing on the linked deployment. */
export const approveBetaAccessBackendTrusted = mutation({
  args: { secret: v.string(), userId: v.string() },
  handler: async (ctx, { secret, userId }) => {
    requireBackendSecret(secret);
    const row = await profileRowForBackend(ctx, userId);
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

/** Mirrors adminTrusted.rejectBetaAccessAdmin when that export is missing on the linked deployment. */
export const rejectBetaAccessBackendTrusted = mutation({
  args: { secret: v.string(), userId: v.string() },
  handler: async (ctx, { secret, userId }) => {
    requireBackendSecret(secret);
    const row = await profileRowForBackend(ctx, userId);
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
 * Same cascade as adminTrusted.deleteUserAccountAdmin — kept here so deploys that only ship
 * backendTrusted still support admin account deletion from the API.
 */
export const deleteUserAccountBackendTrusted = mutation({
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

    const prof = await profileRowForBackend(ctx, userId);
    if (prof) {
      const pid = prof.id;
      const trusts = await ctx.db
        .query("trusted_devices")
        .withIndex("by_user", (q) => q.eq("user_profile_id", pid))
        .collect();
      for (const t of trusts) await ctx.db.delete(t._id);
      const chals = await ctx.db
        .query("device_approval_challenges")
        .withIndex("by_user_profile", (q) => q.eq("user_profile_id", pid))
        .collect();
      for (const c of chals) await ctx.db.delete(c._id);
      await ctx.db.delete(prof._id);
    }

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

export const lookupActiveApiKey = query({
  args: { secret: v.string(), keyValue: v.string() },
  handler: async (ctx, { secret, keyValue }) => {
    requireBackendSecret(secret);
    const row = await ctx.db
      .query("api_keys")
      .withIndex("by_key_value", (q) => q.eq("key_value", keyValue))
      .unique();
    if (!row || row.status !== "active") return null;
    // Expired keys behave exactly like inactive ones — same "invalid or revoked" error the
    // caller already handles, no new error path needed anywhere downstream.
    if (row.expires_at && row.expires_at < new Date().toISOString()) return null;
    const id = row.legacy_id ?? row._id;
    return {
      id,
      userId: row.user_id,
      keyValue: row.key_value,
      status: row.status,
      name: row.name,
      scopes: row.scopes ?? null,
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

/**
 * Migrates dashboard try-on rows from legacy Bearer subject variants (`accountId|user`,
 * compound string, bare segment) onto the canonical user doc id so history survives
 * new sessions and password-reset flows that change JWT shape slightly.
 */
export const consolidateTryonsToCanonicalUserId = mutation({
  args: {
    secret: v.string(),
    aliases: v.array(v.string()),
    canonicalUserId: v.string(),
  },
  handler: async (ctx, { secret, aliases, canonicalUserId }) => {
    requireBackendSecret(secret);
    const uniq = [...new Set(aliases.map((s) => String(s).trim()).filter(Boolean))].filter(
      (a) => a !== canonicalUserId
    );
    let updated = 0;
    for (const alias of uniq) {
      const rows = await ctx.db
        .query("tryons")
        .withIndex("by_user_created", (q) => q.eq("user_id", alias))
        .collect();
      for (const row of rows) {
        await ctx.db.patch(row._id, { user_id: canonicalUserId } as never);
        updated++;
      }
    }
    return { updated };
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
    if (!row || !subjectsOverlap(userId, row.user_id ?? "")) return null;
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

/**
 * Capability-URL lookup for the result-email link (`GET /api/results/tryon/:id` on the backend) —
 * the legacy try-on ID itself is the access token, same trust model as any unguessable share link
 * (it's a high-entropy generated ID, not a sequential/guessable one). No userId check by design:
 * this is reached from an email client with no TryVerse session. Deliberately returns only the
 * minimum needed to serve the image, and only once the generation actually succeeded — never a
 * user_id or any other account-identifying field.
 */
export const getTryonResultForPublicLink = query({
  args: { secret: v.string(), legacyId: v.string() },
  handler: async (ctx, { secret, legacyId }) => {
    requireBackendSecret(secret);
    const row = await ctx.db
      .query("tryons")
      .withIndex("by_legacyId", (q) => q.eq("legacy_id", legacyId))
      .unique();
    if (!row || row.status !== "completed" || !row.result_image) return null;
    return { result_image: row.result_image };
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
    if (!row || !subjectsOverlap(userId, row.user_id ?? ""))
      return { deleted: false as const };
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
    // Use the by_user_created composite index so Convex scans only this user's
    // rows (already ordered by created_at desc) — eliminates the full table scan
    // and removes the in-memory sort that was here before.
    let rows = await ctx.db
      .query("tryons")
      .withIndex("by_user_created", (q) => q.eq("user_id", userId))
      .order("desc")
      .collect();
    if (category) rows = rows.filter((r) => r.category === category);
    // No manual sort needed — index already delivers desc order
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

/**
 * Cursor-based try-on history — reads exactly `numItems` rows per call.
 * Uses Convex native `.paginate()` on the by_user_created index so no rows
 * outside the requested page are ever loaded from storage.
 *
 * `cursor` must be the opaque `continueCursor` string returned by the previous
 * call; pass `null` to start from the most recent try-on.
 */
export const listTryonsForUserCursor = query({
  args: {
    secret: v.string(),
    userId: v.string(),
    numItems: v.number(),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, { secret, userId, numItems, cursor }) => {
    requireBackendSecret(secret);
    const result = await ctx.db
      .query("tryons")
      .withIndex("by_user_created", (q) => q.eq("user_id", userId))
      .order("desc")
      .paginate({ numItems, cursor: cursor ?? null });
    return {
      tryons: result.page.map((t) => ({
        id: t.legacy_id ?? String(t._id),
        status: t.status,
        category: t.category,
        result_image: t.result_image ?? null,
        created_at: t.created_at ?? null,
        completed_at: t.completed_at ?? null,
      })),
      nextCursor: result.isDone ? null : result.continueCursor,
      isDone: result.isDone,
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
    const profile = await findProfileBySubjectKeys(ctx, userId);
    if (!profile) return null;
    return {
      brand_name: profile.brand_name ?? null,
      widget_activated: profile.widget_activated,
      widget_show_models: profile.widget_show_models,
    };
  },
});

/**
 * Cheap plan-tier check for `backend/src/middleware/requirePlan.ts`. Reuses the existing
 * `profiles.plan_id` tier-name convention (`"free" | "starter" | "growth" | "enterprise"`,
 * see `convex/seed.ts` and `backend/src/services/credits.ts` PLAN_LIMITS) rather than adding a
 * separate `is_enterprise` boolean — `plan_id` is already the single source of truth for tier
 * everywhere else in this codebase (credit allocation, rate limiting), so a boolean would just be
 * a second field that can drift out of sync with it.
 */
export const getUserPlanTier = query({
  args: { secret: v.string(), userId: v.string() },
  handler: async (ctx, { secret, userId }) => {
    requireBackendSecret(secret);
    const profile = await findProfileBySubjectKeys(ctx, userId);
    if (!profile) return null;
    const planId = typeof profile.plan_id === "string" && profile.plan_id ? profile.plan_id : "free";
    return {
      planId,
      isEnterprise: planId === "enterprise",
    };
  },
});

/**
 * Usage/history log for the Enterprise-gated AI generation features (AI Model Generation, AI
 * Video Generation via Higgsfield). Insert-only primitive — not yet called by any route; the
 * workstream that ships `/generate`-style endpoints for those features calls this after a
 * successful generation.
 */
export const logAiGenerationUsage = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    feature: v.union(
      v.literal("ai_model"),
      v.literal("ai_photoshoot"),
      v.literal("outfit_builder"),
      v.literal("product_model"),
      v.literal("video")
    ),
  },
  handler: async (ctx, { secret, userId, feature }) => {
    requireBackendSecret(secret);
    await ctx.db.insert("ai_generation_usage", {
      user_id: userId,
      feature,
      created_at: new Date().toISOString(),
    });
    return { ok: true as const };
  },
});

const aiModelParamsValidator = v.object({
  prompt: v.string(),
});

/** Saves a generated AI fashion model (Enterprise "Generate AI Model" library) after a successful Replicate run. */
export const saveGeneratedAiModel = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    storagePath: v.string(),
    params: aiModelParamsValidator,
  },
  handler: async (ctx, { secret, userId, storagePath, params }) => {
    requireBackendSecret(secret);
    const id = await ctx.db.insert("ai_generated_models", {
      user_id: userId,
      storage_path: storagePath,
      params,
      status: "active",
      created_at: new Date().toISOString(),
    });
    return { id };
  },
});

/** Lists a user's saved AI-generated models (active only), newest first. */
export const listGeneratedAiModels = query({
  args: { secret: v.string(), userId: v.string() },
  handler: async (ctx, { secret, userId }) => {
    requireBackendSecret(secret);
    const rows = await ctx.db
      .query("ai_generated_models")
      .withIndex("by_userId", (q) => q.eq("user_id", userId))
      .collect();
    return rows
      .filter((r) => r.status === "active")
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((r) => ({
        id: r._id,
        storagePath: r.storage_path,
        params: r.params,
        createdAt: r.created_at,
      }));
  },
});

/** Archives (soft-deletes) a saved AI-generated model — owner-checked. */
export const archiveGeneratedAiModel = mutation({
  args: { secret: v.string(), userId: v.string(), modelId: v.id("ai_generated_models") },
  handler: async (ctx, { secret, userId, modelId }) => {
    requireBackendSecret(secret);
    const row = await ctx.db.get(modelId);
    if (!row || row.user_id !== userId) throw new Error("not_found");
    await ctx.db.patch(modelId, { status: "archived" });
    return { ok: true as const };
  },
});

const outfitSlotsValidator = v.object({
  top: v.optional(v.string()),
  bottom: v.optional(v.string()),
  one_piece: v.optional(v.string()),
  shoes: v.optional(v.string()),
  outerwear: v.optional(v.string()),
});

/** Inserts a new Outfit Builder generation row in "processing" status. Mirrors `insertTryon`. */
export const insertOutfitGeneration = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    modelImage: v.string(),
    slots: outfitSlotsValidator,
    promptUsed: v.string(),
  },
  handler: async (ctx, { secret, userId, modelImage, slots, promptUsed }) => {
    requireBackendSecret(secret);
    const id = await ctx.db.insert("outfit_generations", {
      user_id: userId,
      model_image: modelImage,
      slots,
      prompt_used: promptUsed,
      status: "processing",
      created_at: new Date().toISOString(),
    });
    return { id: String(id) };
  },
});

/** Patches an Outfit Builder generation by its Convex `_id`. Mirrors `patchTryonByLegacyId`. */
export const patchOutfitGeneration = mutation({
  args: {
    secret: v.string(),
    id: v.id("outfit_generations"),
    patch: v.object({
      status: v.optional(v.string()),
      composite_image: v.optional(v.string()),
      result_image: v.optional(v.string()),
      error: v.optional(v.string()),
      completed_at: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { secret, id, patch }) => {
    requireBackendSecret(secret);
    const row = await ctx.db.get(id);
    if (!row) throw new Error("Outfit generation not found");
    await ctx.db.patch(id, patch);
    return { ok: true as const };
  },
});

/** Reads one Outfit Builder generation — owner-checked. */
export const getOutfitGenerationForUser = query({
  args: { secret: v.string(), userId: v.string(), id: v.id("outfit_generations") },
  handler: async (ctx, { secret, userId, id }) => {
    requireBackendSecret(secret);
    const row = await ctx.db.get(id);
    if (!row || row.user_id !== userId) return null;
    return {
      id: String(row._id),
      status: row.status,
      resultImage: row.result_image ?? null,
      error: row.error ?? null,
      createdAt: row.created_at,
      completedAt: row.completed_at ?? null,
    };
  },
});

/**
 * Batch product lookup for the Outfit Builder — resolves a brand's own catalog products by ID,
 * ownership-scoped by `user_id` (mirrors `products.ts::getMyProduct`'s ownership check, but via
 * the trusted-secret pattern with an explicit `userId` so it's consistent with the rest of
 * `aiStudio.ts`, which never uses the JWT-passthrough Convex client `products.ts` routes use).
 * IDs the caller doesn't own are silently omitted from the result rather than erroring.
 */
export const getProductsForOutfit = query({
  args: { secret: v.string(), userId: v.string(), productIds: v.array(v.string()) },
  handler: async (ctx, { secret, userId, productIds }) => {
    requireBackendSecret(secret);
    // `products.user_id` is written as the raw (possibly compound "authAccountId|userDocId")
    // ctx.auth identity.subject at creation time (see convex/products.ts createProduct), while
    // `userId` here is the canonicalized single-segment id the Express backend derives via
    // canonicalConvexProfileUserId. An exact `by_userId` index match between those two never
    // hits for compound subjects — every product created through the normal UI would silently
    // fail to resolve here. Fetch each product directly instead (same lookup `findOwnedProduct`
    // in products.ts already uses) and verify ownership with the same subject-overlap tolerance
    // profiles/tryons already rely on, rather than trusting an exact index match.
    const found: Array<{ id: string; name: string; image_url: string | null; category: string }> = [];
    for (const productId of productIds) {
      const byLegacy = await ctx.db
        .query("products")
        .withIndex("by_legacyId", (q) => q.eq("legacy_id", productId))
        .unique();
      let row = byLegacy;
      if (!row) {
        try {
          row = await ctx.db.get(productId as Id<"products">);
        } catch {
          row = null;
        }
      }
      if (!row || !subjectsOverlap(row.user_id, userId)) continue;
      found.push({
        id: row.legacy_id ?? String(row._id),
        name: row.name,
        image_url: row.image_url ?? null,
        category: row.category,
      });
    }
    return found;
  },
});

/** Inserts a new AI Model Studio generation row in "processing" status. Mirrors `insertOutfitGeneration`. */
export const insertProductModelGeneration = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    productImage: v.string(),
    faceReference: v.optional(v.string()),
    promptUsed: v.optional(v.string()),
  },
  handler: async (ctx, { secret, userId, productImage, faceReference, promptUsed }) => {
    requireBackendSecret(secret);
    const id = await ctx.db.insert("product_model_generations", {
      user_id: userId,
      product_image: productImage,
      face_reference: faceReference,
      prompt_used: promptUsed,
      status: "processing",
      created_at: new Date().toISOString(),
    });
    return { id: String(id) };
  },
});

/** Patches an AI Model Studio generation by its Convex `_id`. */
export const patchProductModelGeneration = mutation({
  args: {
    secret: v.string(),
    id: v.id("product_model_generations"),
    patch: v.object({
      status: v.optional(v.string()),
      result_image: v.optional(v.string()),
      error: v.optional(v.string()),
      completed_at: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { secret, id, patch }) => {
    requireBackendSecret(secret);
    const row = await ctx.db.get(id);
    if (!row) throw new Error("Product model generation not found");
    await ctx.db.patch(id, patch);
    return { ok: true as const };
  },
});

/** Inserts a new AI Product Photoshoot generation row in "processing" status. */
export const insertPhotoshootGeneration = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    productStoragePath: v.string(),
    modelId: v.string(),
    modelSource: v.string(),
    theme: v.optional(v.string()),
    lighting: v.optional(v.string()),
    background: v.optional(v.string()),
  },
  handler: async (ctx, { secret, userId, productStoragePath, modelId, modelSource, theme, lighting, background }) => {
    requireBackendSecret(secret);
    const id = await ctx.db.insert("photoshoot_generations", {
      user_id: userId,
      product_storage_path: productStoragePath,
      model_id: modelId,
      model_source: modelSource,
      theme,
      lighting,
      background,
      status: "processing",
      created_at: new Date().toISOString(),
    });
    return { id: String(id) };
  },
});

/** Patches an AI Product Photoshoot generation by its Convex `_id`. */
export const patchPhotoshootGeneration = mutation({
  args: {
    secret: v.string(),
    id: v.id("photoshoot_generations"),
    patch: v.object({
      status: v.optional(v.string()),
      result_image: v.optional(v.string()),
      error: v.optional(v.string()),
      completed_at: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { secret, id, patch }) => {
    requireBackendSecret(secret);
    const row = await ctx.db.get(id);
    if (!row) throw new Error("Photoshoot generation not found");
    await ctx.db.patch(id, patch);
    return { ok: true as const };
  },
});

/** Reads one AI Model Studio generation — owner-checked. */
export const getProductModelGenerationForUser = query({
  args: { secret: v.string(), userId: v.string(), id: v.id("product_model_generations") },
  handler: async (ctx, { secret, userId, id }) => {
    requireBackendSecret(secret);
    const row = await ctx.db.get(id);
    if (!row || row.user_id !== userId) return null;
    return {
      id: String(row._id),
      status: row.status,
      resultImage: row.result_image ?? null,
      error: row.error ?? null,
      createdAt: row.created_at,
      completedAt: row.completed_at ?? null,
    };
  },
});

/** Inserts a new AI Video generation row in "processing" status. Mirrors `insertOutfitGeneration`. */
export const insertVideoGeneration = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    sourceImage: v.string(),
    promptUsed: v.optional(v.string()),
    durationSeconds: v.number(),
    resolution: v.string(),
  },
  handler: async (ctx, { secret, userId, sourceImage, promptUsed, durationSeconds, resolution }) => {
    requireBackendSecret(secret);
    const id = await ctx.db.insert("video_generations", {
      user_id: userId,
      source_image: sourceImage,
      prompt_used: promptUsed,
      duration_seconds: durationSeconds,
      resolution,
      status: "processing",
      created_at: new Date().toISOString(),
    });
    return { id: String(id) };
  },
});

/** Patches an AI Video generation by its Convex `_id`. */
export const patchVideoGeneration = mutation({
  args: {
    secret: v.string(),
    id: v.id("video_generations"),
    patch: v.object({
      status: v.optional(v.string()),
      result_video: v.optional(v.string()),
      error: v.optional(v.string()),
      completed_at: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { secret, id, patch }) => {
    requireBackendSecret(secret);
    const row = await ctx.db.get(id);
    if (!row) throw new Error("Video generation not found");
    await ctx.db.patch(id, patch);
    return { ok: true as const };
  },
});

/** Reads one AI Video generation — owner-checked. */
export const getVideoGenerationForUser = query({
  args: { secret: v.string(), userId: v.string(), id: v.id("video_generations") },
  handler: async (ctx, { secret, userId, id }) => {
    requireBackendSecret(secret);
    const row = await ctx.db.get(id);
    if (!row || row.user_id !== userId) return null;
    return {
      id: String(row._id),
      status: row.status,
      resultVideo: row.result_video ?? null,
      error: row.error ?? null,
      createdAt: row.created_at,
      completedAt: row.completed_at ?? null,
    };
  },
});

/** Idempotent: fills `tryverse_model_library` when empty (called from Railway GET /api/models). */
export const ensureModelLibrarySeeded = mutation({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    requireBackendSecret(secret);
    const existing = await ctx.db.query("tryverse_model_library").take(1);
    if (existing.length > 0) return { seeded: false as const };
    const now = new Date().toISOString();
    let count = 0;
    for (const row of defaultModelLibraryRows(now)) {
      await ctx.db.insert("tryverse_model_library", row);
      count++;
    }
    return { seeded: true as const, count };
  },
});

/** Idempotent: fills `plans` when empty, including the `enterprise` tier `requirePlan()` checks against. Mirrors `seed.ts`'s `seedPlansIfEmpty` for callers without Convex CLI auth (the Express backend). */
export const ensurePlansSeeded = mutation({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    requireBackendSecret(secret);
    const existing = await ctx.db.query("plans").take(1);
    if (existing.length > 0) return { seeded: false as const };
    const now = new Date().toISOString();
    const rows = [
      {
        id: "free", name: "Free", is_active: true, max_products: 0, price_ngn: 0, price_usd: 0, tryons_per_month: 5,
        features: ["Free try-on pool (individuals: 5 · brands: 10 on signup)", "Watermark on free tier", "Basic quality", "Upgrade anytime"],
        created_at: now,
      },
      {
        id: "pro", name: "Pro", is_active: true, max_products: 0, price_ngn: 7500, price_usd: 8, tryons_per_month: 75,
        features: ["50–100 try-ons / month (quota)", "HD images", "No watermark", "Download images"],
        created_at: now,
      },
      {
        id: "creator", name: "Creator", is_active: true, max_products: 0, price_ngn: 15000, price_usd: 15, tryons_per_month: 250,
        features: ["200–300 try-ons / month (quota)", "HD + stronger realism", "Generate marketing images", "Priority processing"],
        created_at: now,
      },
      {
        id: "starter", name: "Starter", is_active: true, max_products: 100, price_ngn: 150000, price_usd: 150, tryons_per_month: 150,
        features: ["100–200 try-ons / month (quota)", "50–100 products", "Basic fit prediction", "Download images"],
        created_at: now,
      },
      {
        id: "growth", name: "Growth", is_active: true, max_products: 750, price_ngn: 200000, price_usd: 250, tryons_per_month: 750,
        features: ["500–1000 try-ons / month (quota)", "100–500 products", "Analytics", "API access", "Marketing content"],
        created_at: now,
      },
      {
        id: "enterprise", name: "Enterprise", is_active: true, max_products: 0, price_ngn: 0, price_usd: 0, tryons_per_month: -1,
        features: [
          "AI Model Generation — build a reusable fashion-model library",
          "AI Product Photoshoot — generate ecommerce photography from your catalog",
          "Custom models",
          "SLA",
          "Dedicated infrastructure",
          "Custom pricing — contact sales",
        ],
        created_at: now,
      },
    ];
    for (const row of rows) await ctx.db.insert("plans", row);
    return { seeded: true as const, count: rows.length };
  },
});

/** A user's own API keys — unlike `adminTrusted.listApiKeysAdmin`, this is scoped to one account. */
export const listApiKeysForUser = query({
  args: { secret: v.string(), userId: v.string() },
  handler: async (ctx, { secret, userId }) => {
    requireBackendSecret(secret);
    const rows = await ctx.db
      .query("api_keys")
      .withIndex("by_userId", (q) => q.eq("user_id", userId))
      .collect();
    return rows
      .filter((k) => k.status === "active")
      .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))
      .map((k) => ({
        id: k.legacy_id ?? String(k._id),
        key_value: k.key_value,
        name: k.name,
        created_at: k.created_at ?? "",
        last_used_at: k.last_used_at ?? null,
        scopes: k.scopes ?? null,
        expires_at: k.expires_at ?? null,
        expired: Boolean(k.expires_at && k.expires_at < new Date().toISOString()),
      }));
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

/** Admin: set free_tier_eligible for all library rows (dashboard free-plan preset access). */
export const bulkSetModelLibraryFreeTier = mutation({
  args: {
    secret: v.string(),
    mode: v.union(
      v.literal("all_in_catalog"),
      v.literal("defaults_only"),
      v.literal("all_rows")
    ),
  },
  handler: async (ctx, { secret, mode }) => {
    requireBackendSecret(secret);
    const rows = await ctx.db.query("tryverse_model_library").collect();
    let updated = 0;
    for (const row of rows) {
      let eligible: boolean;
      if (mode === "all_rows") {
        eligible = true;
      } else if (mode === "all_in_catalog") {
        eligible = row.is_active;
      } else {
        const s = String(row.slug ?? "")
          .trim()
          .toLowerCase();
        eligible = s === "diane" || s === "andrew";
      }
      if (row.free_tier_eligible !== eligible) {
        await ctx.db.patch(row._id, { free_tier_eligible: eligible });
        updated += 1;
      }
    }
    return { ok: true as const, updated };
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
    // Convex optional fields reject explicit `null`; omit null/undefined keys.
    const cleaned = Object.fromEntries(
      Object.entries(r).filter(([, val]) => val !== null && val !== undefined)
    ) as Record<string, unknown>;
    const id = await ctx.db.insert("early_access_requests", {
      ...cleaned,
      created_at: new Date().toISOString(),
    } as never);
    return { id: String(id) };
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

/**
 * Atomically checks and reserves one try-on credit for `userId`.
 * Convex mutations are serialized at the document level, so two concurrent
 * requests cannot both succeed when only one credit remains — eliminating the
 * read-then-check race in the Node credit service.
 *
 * Returns { ok: true, creditType } on success (credit has been decremented).
 * Returns { ok: false, reason } when no credits remain (no write is made).
 */
export const reserveCredit = mutation({
  args: { secret: v.string(), userId: v.string(), amount: v.optional(v.number()) },
  handler: async (ctx, { secret, userId, amount }) => {
    requireBackendSecret(secret);
    const cost = Math.max(1, Math.floor(amount ?? 1));
    const row = await profileRowForBackend(ctx, userId);
    if (!row) return { ok: false as const, reason: "Profile not found" };

    // Enterprise / unlimited plan — no decrement needed
    if (Number(row.monthly_credits_total) === -1) {
      return { ok: true as const, creditType: "monthly" as const };
    }

    const planId = typeof row.plan_id === "string" ? row.plan_id : "free";
    const monthlyRem = Number(row.monthly_credits_remaining ?? 0);

    // Paid plan with monthly credits remaining
    if (planId !== "free" && monthlyRem >= cost) {
      await ctx.db.patch(row._id, {
        monthly_credits_remaining: monthlyRem - cost,
        updated_at: new Date().toISOString(),
      } as never);
      return { ok: true as const, creditType: "monthly" as const };
    }

    // Free tier credits
    const freeRem = Number(row.free_credits_remaining ?? 0);
    if (freeRem >= cost) {
      await ctx.db.patch(row._id, {
        free_credits_remaining: freeRem - cost,
        updated_at: new Date().toISOString(),
      } as never);
      return { ok: true as const, creditType: "free" as const };
    }

    return { ok: false as const, reason: "No credits remaining" };
  },
});

export const restoreCredit = mutation({
  args: { secret: v.string(), userId: v.string(), amount: v.optional(v.number()) },
  handler: async (ctx, { secret, userId, amount }) => {
    requireBackendSecret(secret);
    const cost = Math.max(1, Math.floor(amount ?? 1));
    const row = await profileRowForBackend(ctx, userId);
    if (!row) return { ok: false as const };
    if (Number(row.monthly_credits_total) === -1) return { ok: true as const };

    const planId = typeof row.plan_id === "string" ? row.plan_id : "free";
    const monthlyRem = Number(row.monthly_credits_remaining ?? 0);
    const monthlyTot = Number(row.monthly_credits_total ?? 0);
    const freeRem = Number(row.free_credits_remaining ?? 0);
    const freeTot = Number(row.free_credits_total ?? 0);

    if (planId !== "free" && monthlyRem < monthlyTot) {
      await ctx.db.patch(row._id, {
        monthly_credits_remaining: Math.min(monthlyTot, monthlyRem + cost),
        updated_at: new Date().toISOString(),
      } as never);
      return { ok: true as const };
    }
    if (freeRem < freeTot) {
      await ctx.db.patch(row._id, {
        free_credits_remaining: Math.min(freeTot, freeRem + cost),
        updated_at: new Date().toISOString(),
      } as never);
      return { ok: true as const };
    }
    return { ok: true as const };
  },
});

export const listAllowedDomainsForUser = query({
  args: { secret: v.string(), userId: v.string() },
  handler: async (ctx, { secret, userId }) => {
    requireBackendSecret(secret);
    const keys = await ctx.db
      .query("api_keys")
      .withIndex("by_userId", (q) => q.eq("user_id", userId))
      .collect();
    const domains: { domain: string; apiKeyId: string; apiKeyName: string }[] = [];
    for (const k of keys) {
      if (k.status !== "active") continue;
      const apiKeyId = String(k.legacy_id ?? k._id);
      const rows = await ctx.db
        .query("allowed_domains")
        .withIndex("by_apiKeyId", (q) => q.eq("api_key_id", apiKeyId))
        .collect();
      for (const r of rows) {
        domains.push({ domain: r.domain, apiKeyId, apiKeyName: k.name });
      }
    }
    domains.sort((a, b) => a.domain.localeCompare(b.domain));
    return domains;
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

export const listEarlyAccessRequestsAdminTrusted = query({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    requireBackendSecret(secret);
    const rows = await ctx.db.query("early_access_requests").collect();
    rows.sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
    return rows.map((r) => ({
      id: String(r._id),
      applicant_type: r.applicant_type,
      first_name: r.first_name,
      email: r.email,
      brand_name: r.brand_name,
      role: r.role,
      website_url: r.website_url,
      platform: r.platform,
      timeline: r.timeline,
      biggest_challenge: r.biggest_challenge,
      created_at: r.created_at,
      waitlist_review_status: r.waitlist_review_status,
    }));
  },
});

export const patchEarlyAccessReviewTrusted = mutation({
  args: {
    secret: v.string(),
    docId: v.id("early_access_requests"),
    waitlist_review_status: v.string(),
  },
  handler: async (ctx, { secret, docId, waitlist_review_status }) => {
    requireBackendSecret(secret);
    await ctx.db.patch(docId, { waitlist_review_status });
    return { ok: true as const };
  },
});

/** Same as `invites.listInvitesTrusted` — deployed with backend bridge so admin `/invites` works even if the `invites` module alias is missing on Convex. */
export const listInvitesForAdminTrusted = query({
  args: {
    secret: v.string(),
    statusFilter: v.optional(v.string()),
    accountTypeFilter: v.optional(v.string()),
  },
  handler: async (ctx, { secret, statusFilter, accountTypeFilter }) => {
    requireBackendSecret(secret);
    let rows: Doc<"invites">[] = await ctx.db.query("invites").collect();
    if (statusFilter) rows = rows.filter((r) => r.status === statusFilter);
    if (accountTypeFilter) rows = rows.filter((r) => r.accountType === accountTypeFilter);
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return rows;
  },
});
