import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { canonicalAuthSubjectProfileId } from "./authSubjectKeys";

/**
 * One-time: merge all duplicate `profiles` rows for the same email/user.
 *
 * Groups first by normalised contact_email (covers all cases where the same email
 * ended up in multiple rows regardless of the auth subject key stored in `id`).
 * For each group it:
 *   1. Picks the canonical keeper (prefers the row whose `id` matches the canonical
 *      form of the oldest row's id, otherwise takes the oldest).
 *   2. Merges useful fields from all duplicates into the keeper.
 *   3. Normalises keeper.id to its canonical form.
 *   4. Deletes the duplicate rows.
 *
 * Safe to run multiple times (idempotent).
 * Run from Convex Dashboard → Functions → internal → `deduplicateProfiles`.
 */
export const deduplicateProfiles = internalMutation({
  args: v.object({}),
  handler: async (ctx) => {
    const profiles = await ctx.db.query("profiles").collect();
    type ProfileDoc = (typeof profiles)[number];

    // Group by normalised email.
    const byEmail = new Map<string, ProfileDoc[]>();
    const noEmail: ProfileDoc[] = [];
    for (const p of profiles) {
      const email =
        typeof p.contact_email === "string" ? p.contact_email.trim().toLowerCase() : "";
      if (!email) {
        noEmail.push(p);
        continue;
      }
      const list = byEmail.get(email) ?? [];
      list.push(p);
      byEmail.set(email, list);
    }

    let merged = 0;
    let deleted = 0;
    let normalised = 0;

    // Process email-grouped duplicates.
    for (const [email, group] of byEmail) {
      group.sort((a, b) => a._creationTime - b._creationTime);
      const oldestCanon = canonicalAuthSubjectProfileId(group[0]!.id);
      const keeper =
        group.find((p) => p.id === oldestCanon) ??
        group.find((p) => p.id === canonicalAuthSubjectProfileId(p.id)) ??
        group[0]!;
      const duplicates = group.filter((p) => String(p._id) !== String(keeper._id));

      // Merge important flags from all rows into the keeper.
      const patch: Record<string, unknown> = {
        id: canonicalAuthSubjectProfileId(keeper.id),
        contact_email: email,
        updated_at: new Date().toISOString(),
      };

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

      for (const h of group) {
        if (typeof h.welcome_email_sent_at === "string" && h.welcome_email_sent_at.trim())
          welcomeAt ??= h.welcome_email_sent_at;
        if (typeof h.verification_email_sent_at === "string" && h.verification_email_sent_at.trim())
          verifyAt ??= h.verification_email_sent_at;
        if (typeof h.terms_of_service_accepted_at === "string" && h.terms_of_service_accepted_at.trim())
          termsAt ??= h.terms_of_service_accepted_at;
        maxFreeRem = Math.max(maxFreeRem, h.free_credits_remaining);
        maxFreeTot = Math.max(maxFreeTot, h.free_credits_total);
        maxMRem = Math.max(maxMRem, h.monthly_credits_remaining);
        maxMTot = Math.max(maxMTot, h.monthly_credits_total);
        if (h.beta_approved === true) betaOk = true;
        if (typeof h.beta_approved_at === "string" && h.beta_approved_at.trim())
          betaApAt ??= h.beta_approved_at;
        if (typeof h.beta_requested_at === "string" && h.beta_requested_at.trim())
          betaReqAt ??= h.beta_requested_at;
        if (h.beta_rejected === true) betaRej = true;
        if (typeof h.beta_rejected_at === "string" && h.beta_rejected_at.trim())
          betaRejAt ??= h.beta_rejected_at;
      }

      Object.assign(patch, {
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
      });

      await ctx.db.patch(keeper._id, patch as never);
      merged++;

      for (const d of duplicates) {
        await ctx.db.delete(d._id);
        deleted++;
      }
    }

    // For profiles with no email: just normalise the id field.
    for (const p of noEmail) {
      const canon = canonicalAuthSubjectProfileId(p.id);
      if (canon !== p.id) {
        await ctx.db.patch(p._id, { id: canon, updated_at: new Date().toISOString() } as never);
        normalised++;
      }
    }

    return { merged, deleted, normalised };
  },
});
