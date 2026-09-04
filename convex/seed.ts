import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { defaultModelLibraryRows } from "./modelLibrarySeedRows";

/** Inserts default plans when the table is empty (safe to call multiple times). */
export const seedPlansIfEmpty = mutation({
  args: {},
  handler: async (ctx) => {
    const any = await ctx.db.query("plans").take(1);
    if (any.length > 0) return { seeded: false as const };

    const now = new Date().toISOString();
    const rows: Array<{
      id: string;
      name: string;
      is_active: boolean;
      max_products: number;
      price_ngn: number;
      price_usd: number;
      tryons_per_month: number;
      features: unknown;
      created_at: string;
    }> = [
      {
        id: "free",
        name: "Free",
        is_active: true,
        max_products: 0,
        price_ngn: 0,
        price_usd: 0,
        tryons_per_month: 5,
        features: [
          "10 free AI generations on signup",
          "Watermark on free tier",
          "Basic quality",
          "Upgrade anytime",
        ],
        created_at: now,
      },
      {
        id: "pro",
        name: "Pro",
        is_active: true,
        max_products: 0,
        price_ngn: 7500,
        price_usd: 8,
        tryons_per_month: 75,
        features: [
          "50–100 try-ons / month (quota)",
          "HD images",
          "No watermark",
          "Download images",
        ],
        created_at: now,
      },
      {
        id: "creator",
        name: "Creator",
        is_active: true,
        max_products: 0,
        price_ngn: 15000,
        price_usd: 15,
        tryons_per_month: 250,
        features: [
          "200–300 try-ons / month (quota)",
          "HD + stronger realism",
          "Generate marketing images",
          "Priority processing",
        ],
        created_at: now,
      },
      {
        id: "starter",
        name: "Starter",
        is_active: true,
        max_products: 100,
        price_ngn: 150000,
        price_usd: 150,
        tryons_per_month: 150,
        features: [
          "100–200 try-ons / month (quota)",
          "50–100 products",
          "Basic fit prediction",
          "Download images",
        ],
        created_at: now,
      },
      {
        id: "growth",
        name: "Growth",
        is_active: true,
        max_products: 750,
        price_ngn: 200000,
        price_usd: 250,
        tryons_per_month: 750,
        features: [
          "500–1000 try-ons / month (quota)",
          "100–500 products",
          "Analytics",
          "API / widget",
          "Marketing content",
        ],
        created_at: now,
      },
      {
        id: "enterprise",
        name: "Enterprise",
        is_active: true,
        max_products: 0,
        price_ngn: 0,
        price_usd: 0,
        tryons_per_month: -1,
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

    for (const p of rows) {
      await ctx.db.insert("plans", p);
    }
    return { seeded: true as const, count: rows.length };
  },
});

/**
 * One-off, idempotent correction of the obsolete free-plan feature copy that predates the
 * B2B-only pivot ("Free try-on pool (individuals: 5 · brands: 10 on signup)" and near-variants).
 * `seedPlansIfEmpty` / `ensurePlansSeeded` only ever INSERT into an empty table, so a live
 * deployment seeded before this change still shows the old string. This patches just that one
 * array entry.
 *
 * Safety:
 *  - Touches ONLY the row whose `id === "free"` AND whose `price_ngn`/`price_usd` are both 0
 *    (a sanity check that it really is the free plan before writing).
 *  - Replaces ONLY known-obsolete strings inside `features`; never touches `id`, `name`,
 *    `price_ngn`, `price_usd`, `tryons_per_month`, `max_products`, `is_active`, or any other row.
 *  - Idempotent: a second run finds nothing to replace and reports `changed: false`.
 *
 * Run:      npx convex run seed:fixFreePlanFeatureCopy
 * Rollback: npx convex run seed:fixFreePlanFeatureCopy '{ "revert": true }'
 *           (restores the pre-pivot string on the free plan — same guard rails).
 */
export const fixFreePlanFeatureCopy = mutation({
  args: { revert: v.optional(v.boolean()) },
  handler: async (ctx, { revert }) => {
    const CANONICAL = "10 free AI generations on signup";
    const OBSOLETE = [
      "Free try-on pool (individuals: 5 · brands: 10 on signup)",
      "Free try-on pool (individuals: 5 - brands: 10 on signup)",
    ];

    const free = await ctx.db
      .query("plans")
      .withIndex("by_planId", (q) => q.eq("id", "free"))
      .unique();

    if (!free) return { changed: false as const, reason: "no free plan row" };
    if (Number(free.price_ngn) !== 0 || Number(free.price_usd) !== 0) {
      return { changed: false as const, reason: "free plan row failed price sanity check — not touched" };
    }

    const features: unknown = free.features;
    if (!Array.isArray(features)) {
      return { changed: false as const, reason: "features is not an array" };
    }

    const from = revert ? [CANONICAL] : OBSOLETE;
    const to = revert ? OBSOLETE[0]! : CANONICAL;

    let hits = 0;
    const next = features.map((f) => {
      if (typeof f === "string" && from.includes(f)) {
        hits++;
        return to;
      }
      return f;
    });

    if (hits === 0) return { changed: false as const, reason: "nothing to replace (already correct)" };

    await ctx.db.patch(free._id, { features: next });
    return { changed: true as const, replaced: hits, to };
  },
});

/** Default Try-On Studio / widget catalog (`public/model-library` paths relative to FRONTEND_URL). Run once: `npx convex run seed:seedModelLibraryIfEmpty` */
export const seedModelLibraryIfEmpty = mutation({
  args: {},
  handler: async (ctx) => {
    const any = await ctx.db.query("tryverse_model_library").take(1);
    if (any.length > 0) return { seeded: false as const };

    const now = new Date().toISOString();
    const rows = defaultModelLibraryRows(now);

    for (const row of rows) {
      await ctx.db.insert("tryverse_model_library", row);
    }
    return { seeded: true as const, count: rows.length };
  },
});

/** Dev helper: optional flag for future gated seeds. */
export const noop = mutation({
  args: {},
  handler: async () => ({ ok: true }),
});
