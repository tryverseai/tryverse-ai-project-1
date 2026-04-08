import { query } from "./_generated/server";

/** Same shape as backend GET /api/models for the Try-On Studio. */
export const listActiveModels = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("tryverse_model_library").collect();
    const active = rows
      .filter((r) => r.is_active)
      .sort((a, b) => a.sort_order - b.sort_order);

    return active.map((r) => {
      const g = String(r.gender ?? "").trim().toLowerCase();
      const gender: "female" | "male" = g === "male" ? "male" : "female";
      return {
        id: r.legacy_id ?? r._id,
        slug: r.slug,
        display_name: r.display_name,
        gender,
        body_type: r.body_type ?? null,
        appearance_tag: r.appearance_tag ?? null,
        image_url: r.image_url,
        sort_order: r.sort_order,
        free_tier_eligible: r.free_tier_eligible,
      };
    });
  },
});
