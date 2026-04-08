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

/** Default Try-On Studio / widget catalog (`public/model-library` paths relative to FRONTEND_URL). Run once: `npx convex run seed:seedModelLibraryIfEmpty` */
export const seedModelLibraryIfEmpty = mutation({
  args: {},
  handler: async (ctx) => {
    const any = await ctx.db.query("tryverse_model_library").take(1);
    if (any.length > 0) return { seeded: false as const };

    const now = new Date().toISOString();
    type Row = {
      slug: string;
      display_name: string;
      gender: "female" | "male";
      image_url: string;
      sort_order: number;
      is_active: boolean;
      free_tier_eligible: boolean;
      created_at: string;
    };
    const female: Array<{ slug: string; display_name: string }> = [
      { slug: "zoe", display_name: "Zoe" },
      { slug: "lina", display_name: "Lina" },
      { slug: "min-ji", display_name: "Min-Ji" },
      { slug: "sophia", display_name: "Sophia" },
      { slug: "camila", display_name: "Camila" },
      { slug: "rashna", display_name: "Rashna" },
      { slug: "stephanie", display_name: "Stephanie" },
      { slug: "asher", display_name: "Asher" },
      { slug: "hanna", display_name: "Hanna" },
      { slug: "mia", display_name: "Mia" },
      { slug: "louis", display_name: "Louis" },
      { slug: "aiko", display_name: "Aiko" },
      { slug: "nicole", display_name: "Nicole" },
      { slug: "diane", display_name: "Diane" },
    ];
    const male: Array<{ slug: string; display_name: string }> = [
      { slug: "andrew", display_name: "Andrew" },
      { slug: "jack", display_name: "Jack" },
      { slug: "jordan", display_name: "Jordan" },
      { slug: "steve", display_name: "Steve" },
      { slug: "vandik", display_name: "Vandik" },
      { slug: "lucas", display_name: "Lucas" },
      { slug: "max", display_name: "Max" },
      { slug: "li-xeng", display_name: "Li Xeng" },
      { slug: "jed", display_name: "Jed" },
      { slug: "alex", display_name: "Alex" },
      { slug: "alfred", display_name: "Alfred" },
      { slug: "derrick", display_name: "Derrick" },
    ];

    const rows: Row[] = [];
    let order = 0;
    for (const m of female) {
      rows.push({
        slug: m.slug,
        display_name: m.display_name,
        gender: "female",
        image_url: `/model-library/${m.slug}.png`,
        sort_order: order++,
        is_active: true,
        free_tier_eligible: m.slug === "diane",
        created_at: now,
      });
    }
    for (const m of male) {
      rows.push({
        slug: m.slug,
        display_name: m.display_name,
        gender: "male",
        image_url: `/model-library/${m.slug}.png`,
        sort_order: order++,
        is_active: true,
        free_tier_eligible: m.slug === "andrew",
        created_at: now,
      });
    }

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
