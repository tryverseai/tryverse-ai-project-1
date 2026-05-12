import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * One-time: merge duplicate `profiles` rows that share the same normalized `contact_email`.
 * Run from Convex dashboard → Functions → internal → `deduplicateProfiles`.
 * Safe to repeat (idempotent toward one row per email).
 *
 * IMPORTANT: Delete this module after successful run per ops checklist.
 */
export const deduplicateProfiles = internalMutation({
  args: v.object({}),
  handler: async (ctx) => {
    const profiles = await ctx.db.query("profiles").collect();
    type ProfileDoc = (typeof profiles)[number];
    const byEmail = new Map<string, ProfileDoc[]>();

    for (const profile of profiles) {
      const raw = profile.contact_email;
      if (typeof raw !== "string" || !raw.trim()) continue;
      const email = raw.trim().toLowerCase();
      const list = byEmail.get(email);
      if (!list) byEmail.set(email, [profile]);
      else list.push(profile);
    }

    let deleted = 0;
    for (const [, dupes] of byEmail) {
      if (dupes.length < 2) continue;
      dupes.sort((a, b) => a._creationTime - b._creationTime);
      const [, ...remove] = dupes;
      for (const dupe of remove) {
        await ctx.db.delete(dupe._id);
        deleted++;
      }
    }
    return { deleted };
  },
});
