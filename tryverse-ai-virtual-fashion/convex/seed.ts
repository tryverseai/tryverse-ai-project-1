import { mutation } from "./_generated/server";
import { v } from "convex/values";

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
          "Free try-on pool (individuals: 5 · brands: 20 on signup)",
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
        price_ngn: 65000,
        price_usd: 45,
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
        price_usd: 140,
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
          "AI video generation",
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

/** Dev helper: optional flag for future gated seeds. */
export const noop = mutation({
  args: {},
  handler: async () => ({ ok: true }),
});
