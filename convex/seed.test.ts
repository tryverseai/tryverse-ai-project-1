/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
const t = () => convexTest(schema, modules);

const OBSOLETE = "Free try-on pool (individuals: 5 · brands: 10 on signup)";
const CANONICAL = "10 free AI generations on signup";

async function insertFreePlan(
  ctx: Parameters<Parameters<ReturnType<typeof t>["run"]>[0]>[0],
  overrides: Partial<{ features: unknown; price_ngn: number; price_usd: number }> = {},
) {
  await ctx.db.insert("plans", {
    id: "free",
    name: "Free",
    is_active: true,
    max_products: 0,
    price_ngn: overrides.price_ngn ?? 0,
    price_usd: overrides.price_usd ?? 0,
    tryons_per_month: 5,
    features: overrides.features ?? [OBSOLETE, "Watermark on free tier", "Upgrade anytime"],
    created_at: new Date().toISOString(),
  });
}

const readFreeFeatures = (tt: ReturnType<typeof t>) =>
  tt.run(async (ctx) => {
    const row = await ctx.db
      .query("plans")
      .withIndex("by_planId", (q) => q.eq("id", "free"))
      .unique();
    return row?.features as string[] | undefined;
  });

// fixFreePlanFeatureCopy — the one-off, guarded correction of the pre-B2B-pivot free-plan
// feature string. These tests lock in the guard rails: free-plan-only, price-zero sanity check,
// string-scoped replacement, idempotency, and a working revert.

describe("seed:fixFreePlanFeatureCopy", () => {
  it("replaces only the obsolete free-plan string and leaves the rest untouched", async () => {
    const tt = t();
    await tt.run((ctx) => insertFreePlan(ctx));

    const res = await tt.mutation(api.seed.fixFreePlanFeatureCopy, {});
    expect(res).toMatchObject({ changed: true, replaced: 1, to: CANONICAL });

    const features = await readFreeFeatures(tt);
    expect(features).toEqual([CANONICAL, "Watermark on free tier", "Upgrade anytime"]);
  });

  it("is idempotent — a second run changes nothing", async () => {
    const tt = t();
    await tt.run((ctx) => insertFreePlan(ctx));
    await tt.mutation(api.seed.fixFreePlanFeatureCopy, {});
    const second = await tt.mutation(api.seed.fixFreePlanFeatureCopy, {});
    expect(second).toMatchObject({ changed: false });
  });

  it("refuses to touch a 'free' row that is not actually free (price sanity check)", async () => {
    const tt = t();
    await tt.run((ctx) => insertFreePlan(ctx, { price_usd: 8 }));

    const res = await tt.mutation(api.seed.fixFreePlanFeatureCopy, {});
    expect(res).toMatchObject({ changed: false });
    const features = await readFreeFeatures(tt);
    expect(features?.[0]).toBe(OBSOLETE); // unchanged
  });

  it("never touches any plan other than 'free'", async () => {
    const tt = t();
    await tt.run(async (ctx) => {
      await insertFreePlan(ctx);
      await ctx.db.insert("plans", {
        id: "starter",
        name: "Starter",
        is_active: true,
        max_products: 0,
        price_ngn: 7500,
        price_usd: 8,
        tryons_per_month: 100,
        features: ["individuals: 5 · brands: 10", "HD images"],
        created_at: new Date().toISOString(),
      });
    });

    await tt.mutation(api.seed.fixFreePlanFeatureCopy, {});

    const starter = await tt.run((ctx) =>
      ctx.db.query("plans").withIndex("by_planId", (q) => q.eq("id", "starter")).unique(),
    );
    expect(starter?.features).toEqual(["individuals: 5 · brands: 10", "HD images"]);
    expect(starter?.price_usd).toBe(8);
  });

  it("does not change price / id / quota fields on the free row", async () => {
    const tt = t();
    await tt.run((ctx) => insertFreePlan(ctx));
    await tt.mutation(api.seed.fixFreePlanFeatureCopy, {});

    const free = await tt.run((ctx) =>
      ctx.db.query("plans").withIndex("by_planId", (q) => q.eq("id", "free")).unique(),
    );
    expect(free).toMatchObject({ id: "free", price_ngn: 0, price_usd: 0, tryons_per_month: 5, is_active: true });
  });

  it("revert restores the pre-pivot string", async () => {
    const tt = t();
    await tt.run((ctx) => insertFreePlan(ctx));
    await tt.mutation(api.seed.fixFreePlanFeatureCopy, {});
    const rev = await tt.mutation(api.seed.fixFreePlanFeatureCopy, { revert: true });
    expect(rev).toMatchObject({ changed: true, to: OBSOLETE });
    const features = await readFreeFeatures(tt);
    expect(features?.[0]).toBe(OBSOLETE);
  });
});
