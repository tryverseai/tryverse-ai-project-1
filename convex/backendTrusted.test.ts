/// <reference types="vite/client" />
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");

const SECRET = "test-shared-secret";

beforeEach(() => {
  process.env.BACKEND_SHARED_SECRET = SECRET;
});

function t() {
  return convexTest(schema, modules);
}

/** Seeds a minimal valid profile row and returns its userId ("id" field). */
async function seedProfile(
  ctx: Parameters<Parameters<ReturnType<typeof t>["run"]>[0]>[0],
  userId: string,
  overrides: Partial<{
    plan_id: string;
    free_credits_remaining: number;
    free_credits_total: number;
    monthly_credits_remaining: number;
    monthly_credits_total: number;
  }> = {}
) {
  await ctx.db.insert("profiles", {
    id: userId,
    plan_id: overrides.plan_id ?? "free",
    account_type: "business",
    is_blocked: false,
    widget_activated: false,
    free_credits_remaining: overrides.free_credits_remaining ?? 5,
    free_credits_total: overrides.free_credits_total ?? 10,
    monthly_credits_remaining: overrides.monthly_credits_remaining ?? 0,
    monthly_credits_total: overrides.monthly_credits_total ?? 0,
  });
}

async function getProfile(
  ctx: Parameters<Parameters<ReturnType<typeof t>["run"]>[0]>[0],
  userId: string
) {
  const rows = await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q: any) => q.eq("id", userId))
    .collect();
  return rows[0]!;
}

describe("reserveCredit", () => {
  it("draws from the free pool for a free-tier user and reports creditType 'free'", async () => {
    const client = t();
    await client.run((ctx) => seedProfile(ctx, "u-free", { free_credits_remaining: 3, free_credits_total: 10 }));

    const result = await client.mutation(api.backendTrusted.reserveCredit, {
      secret: SECRET,
      userId: "u-free",
    });

    expect(result).toEqual({ ok: true, creditType: "free" });
    const row = await client.run((ctx) => getProfile(ctx, "u-free"));
    expect(row.free_credits_remaining).toBe(2);
  });

  it("draws from the monthly pool for a paid plan with monthly credits remaining", async () => {
    const client = t();
    await client.run((ctx) =>
      seedProfile(ctx, "u-paid", {
        plan_id: "starter",
        monthly_credits_remaining: 50,
        monthly_credits_total: 100,
        free_credits_remaining: 0,
        free_credits_total: 0,
      })
    );

    const result = await client.mutation(api.backendTrusted.reserveCredit, {
      secret: SECRET,
      userId: "u-paid",
    });

    expect(result).toEqual({ ok: true, creditType: "monthly" });
    const row = await client.run((ctx) => getProfile(ctx, "u-paid"));
    expect(row.monthly_credits_remaining).toBe(49);
    expect(row.free_credits_remaining).toBe(0);
  });

  it("falls through to the free pool when a paid plan's monthly allotment is exhausted mid-cycle", async () => {
    // This is the exact scenario the creditType-threading fix (this session) exists for: a paid
    // user whose monthly credits ran out still has free credits, so reservation must draw from
    // free — and restoreCredit must be told that, not guess "paid plan => must be monthly".
    const client = t();
    await client.run((ctx) =>
      seedProfile(ctx, "u-exhausted", {
        plan_id: "starter",
        monthly_credits_remaining: 0,
        monthly_credits_total: 100,
        free_credits_remaining: 2,
        free_credits_total: 10,
      })
    );

    const result = await client.mutation(api.backendTrusted.reserveCredit, {
      secret: SECRET,
      userId: "u-exhausted",
    });

    expect(result).toEqual({ ok: true, creditType: "free" });
    const row = await client.run((ctx) => getProfile(ctx, "u-exhausted"));
    expect(row.free_credits_remaining).toBe(1);
    expect(row.monthly_credits_remaining).toBe(0);
  });

  it("rejects reservation and makes no write when both pools are exhausted", async () => {
    const client = t();
    await client.run((ctx) =>
      seedProfile(ctx, "u-broke", {
        plan_id: "starter",
        monthly_credits_remaining: 0,
        monthly_credits_total: 100,
        free_credits_remaining: 0,
        free_credits_total: 10,
      })
    );

    const result = await client.mutation(api.backendTrusted.reserveCredit, {
      secret: SECRET,
      userId: "u-broke",
    });

    expect(result.ok).toBe(false);
    const row = await client.run((ctx) => getProfile(ctx, "u-broke"));
    expect(row.free_credits_remaining).toBe(0);
    expect(row.monthly_credits_remaining).toBe(0);
  });

  it("never double-deducts: a second reservation fails once the single remaining credit is spent", async () => {
    const client = t();
    await client.run((ctx) => seedProfile(ctx, "u-one-credit", { free_credits_remaining: 1, free_credits_total: 1 }));

    const first = await client.mutation(api.backendTrusted.reserveCredit, { secret: SECRET, userId: "u-one-credit" });
    const second = await client.mutation(api.backendTrusted.reserveCredit, { secret: SECRET, userId: "u-one-credit" });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    const row = await client.run((ctx) => getProfile(ctx, "u-one-credit"));
    expect(row.free_credits_remaining).toBe(0);
  });

  it("does not decrement an enterprise/unlimited plan (monthly_credits_total === -1)", async () => {
    const client = t();
    await client.run((ctx) =>
      seedProfile(ctx, "u-enterprise", {
        plan_id: "enterprise",
        monthly_credits_remaining: -1,
        monthly_credits_total: -1,
      })
    );

    const result = await client.mutation(api.backendTrusted.reserveCredit, {
      secret: SECRET,
      userId: "u-enterprise",
    });

    expect(result).toEqual({ ok: true, creditType: "monthly" });
    const row = await client.run((ctx) => getProfile(ctx, "u-enterprise"));
    expect(row.monthly_credits_remaining).toBe(-1);
  });

  it("honors a custom amount, reserving more than 1 credit atomically", async () => {
    const client = t();
    await client.run((ctx) => seedProfile(ctx, "u-multi", { free_credits_remaining: 5, free_credits_total: 10 }));

    const result = await client.mutation(api.backendTrusted.reserveCredit, {
      secret: SECRET,
      userId: "u-multi",
      amount: 3,
    });

    expect(result).toEqual({ ok: true, creditType: "free" });
    const row = await client.run((ctx) => getProfile(ctx, "u-multi"));
    expect(row.free_credits_remaining).toBe(2);
  });

  it("rejects with a wrong shared secret and makes no write", async () => {
    const client = t();
    await client.run((ctx) => seedProfile(ctx, "u-secret", { free_credits_remaining: 5, free_credits_total: 10 }));

    await expect(
      client.mutation(api.backendTrusted.reserveCredit, { secret: "wrong-secret", userId: "u-secret" })
    ).rejects.toThrow();

    const row = await client.run((ctx) => getProfile(ctx, "u-secret"));
    expect(row.free_credits_remaining).toBe(5);
  });

  it("returns ok:false for a userId with no matching profile, rather than throwing", async () => {
    const client = t();
    const result = await client.mutation(api.backendTrusted.reserveCredit, {
      secret: SECRET,
      userId: "no-such-user",
    });
    expect(result.ok).toBe(false);
  });
});

describe("restoreCredit", () => {
  it("restores to the free pool when told creditType 'free', even for a paid plan with room in its monthly pool", async () => {
    // Regression test for the exact bug fixed this session: restoreCredit used to guess "paid
    // plan with room in monthly => must restore to monthly", which is wrong whenever the original
    // reservation actually drew from free (see the "falls through to free pool" test above).
    const client = t();
    await client.run((ctx) =>
      seedProfile(ctx, "u-restore-free", {
        plan_id: "starter",
        monthly_credits_remaining: 50,
        monthly_credits_total: 100,
        free_credits_remaining: 1,
        free_credits_total: 10,
      })
    );

    await client.mutation(api.backendTrusted.restoreCredit, {
      secret: SECRET,
      userId: "u-restore-free",
      creditType: "free",
    });

    const row = await client.run((ctx) => getProfile(ctx, "u-restore-free"));
    expect(row.free_credits_remaining).toBe(2);
    expect(row.monthly_credits_remaining).toBe(50); // untouched
  });

  it("restores to the monthly pool when told creditType 'monthly'", async () => {
    const client = t();
    await client.run((ctx) =>
      seedProfile(ctx, "u-restore-monthly", {
        plan_id: "starter",
        monthly_credits_remaining: 49,
        monthly_credits_total: 100,
        free_credits_remaining: 5,
        free_credits_total: 10,
      })
    );

    await client.mutation(api.backendTrusted.restoreCredit, {
      secret: SECRET,
      userId: "u-restore-monthly",
      creditType: "monthly",
    });

    const row = await client.run((ctx) => getProfile(ctx, "u-restore-monthly"));
    expect(row.monthly_credits_remaining).toBe(50);
    expect(row.free_credits_remaining).toBe(5); // untouched
  });

  it("never restores a pool above its total", async () => {
    const client = t();
    await client.run((ctx) =>
      seedProfile(ctx, "u-restore-cap", {
        free_credits_remaining: 10,
        free_credits_total: 10,
      })
    );

    await client.mutation(api.backendTrusted.restoreCredit, {
      secret: SECRET,
      userId: "u-restore-cap",
      creditType: "free",
    });

    const row = await client.run((ctx) => getProfile(ctx, "u-restore-cap"));
    expect(row.free_credits_remaining).toBe(10);
  });

  it("is a no-op for an enterprise/unlimited plan", async () => {
    const client = t();
    await client.run((ctx) =>
      seedProfile(ctx, "u-restore-ent", {
        plan_id: "enterprise",
        monthly_credits_remaining: -1,
        monthly_credits_total: -1,
      })
    );

    const result = await client.mutation(api.backendTrusted.restoreCredit, {
      secret: SECRET,
      userId: "u-restore-ent",
      creditType: "monthly",
    });

    expect(result).toEqual({ ok: true });
    const row = await client.run((ctx) => getProfile(ctx, "u-restore-ent"));
    expect(row.monthly_credits_remaining).toBe(-1);
  });

  it("falls back to guessing correctly when no creditType is provided (legacy caller compatibility)", async () => {
    const client = t();
    await client.run((ctx) =>
      seedProfile(ctx, "u-legacy", {
        plan_id: "free",
        free_credits_remaining: 3,
        free_credits_total: 10,
        monthly_credits_remaining: 0,
        monthly_credits_total: 0,
      })
    );

    await client.mutation(api.backendTrusted.restoreCredit, {
      secret: SECRET,
      userId: "u-legacy",
    });

    const row = await client.run((ctx) => getProfile(ctx, "u-legacy"));
    expect(row.free_credits_remaining).toBe(4);
  });

  describe("refundKey idempotency (Bull retry double-refund fix)", () => {
    it("only restores once when the same refundKey is submitted twice, e.g. two failed Bull retry attempts for the same job", async () => {
      const client = t();
      await client.run((ctx) =>
        seedProfile(ctx, "u-dedup", {
          free_credits_remaining: 3,
          free_credits_total: 10,
        })
      );

      const first = await client.mutation(api.backendTrusted.restoreCredit, {
        secret: SECRET,
        userId: "u-dedup",
        creditType: "free",
        refundKey: "tryon:abc123",
      });
      const second = await client.mutation(api.backendTrusted.restoreCredit, {
        secret: SECRET,
        userId: "u-dedup",
        creditType: "free",
        refundKey: "tryon:abc123",
      });

      expect(first).toEqual({ ok: true });
      expect(second).toEqual({ ok: true, deduped: true });

      const row = await client.run((ctx) => getProfile(ctx, "u-dedup"));
      // Restored exactly once (3 -> 4), not twice (which would be 5).
      expect(row.free_credits_remaining).toBe(4);
    });

    it("restores independently for two different refundKeys (different generations)", async () => {
      const client = t();
      await client.run((ctx) =>
        seedProfile(ctx, "u-dedup-2", {
          free_credits_remaining: 0,
          free_credits_total: 10,
        })
      );

      await client.mutation(api.backendTrusted.restoreCredit, {
        secret: SECRET,
        userId: "u-dedup-2",
        creditType: "free",
        refundKey: "tryon:job-1",
      });
      await client.mutation(api.backendTrusted.restoreCredit, {
        secret: SECRET,
        userId: "u-dedup-2",
        creditType: "free",
        refundKey: "tryon:job-2",
      });

      const row = await client.run((ctx) => getProfile(ctx, "u-dedup-2"));
      expect(row.free_credits_remaining).toBe(2);
    });

    it("still restores every time when no refundKey is given (unchanged legacy behavior)", async () => {
      const client = t();
      await client.run((ctx) =>
        seedProfile(ctx, "u-no-key", {
          free_credits_remaining: 0,
          free_credits_total: 10,
        })
      );

      await client.mutation(api.backendTrusted.restoreCredit, {
        secret: SECRET,
        userId: "u-no-key",
        creditType: "free",
      });
      await client.mutation(api.backendTrusted.restoreCredit, {
        secret: SECRET,
        userId: "u-no-key",
        creditType: "free",
      });

      const row = await client.run((ctx) => getProfile(ctx, "u-no-key"));
      expect(row.free_credits_remaining).toBe(2);
    });

    it("does not create a dedup row (and stays restorable) when the profile itself doesn't exist", async () => {
      const client = t();
      const result = await client.mutation(api.backendTrusted.restoreCredit, {
        secret: SECRET,
        userId: "u-does-not-exist",
        refundKey: "tryon:orphan",
      });
      expect(result).toEqual({ ok: false });
    });
  });
});

describe("insertPaymentIfNewTrusted (webhook idempotency)", () => {
  it("inserts a payment on first sight of a reference", async () => {
    const client = t();
    const result = await client.mutation(api.backendTrusted.insertPaymentIfNewTrusted, {
      secret: SECRET,
      user_id: "u-pay-1",
      reference: "ref-abc-123",
      amount: 5000,
      currency: "NGN",
      status: "success",
      provider: "paystack",
    });

    expect(result).toEqual({ inserted: true });
  });

  it("rejects a duplicate webhook delivery for a reference that already succeeded, without creating a second row", async () => {
    const client = t();
    const first = await client.mutation(api.backendTrusted.insertPaymentIfNewTrusted, {
      secret: SECRET,
      user_id: "u-pay-2",
      reference: "ref-dup-1",
      amount: 5000,
      currency: "NGN",
      status: "success",
      provider: "paystack",
    });
    const second = await client.mutation(api.backendTrusted.insertPaymentIfNewTrusted, {
      secret: SECRET,
      user_id: "u-pay-2",
      reference: "ref-dup-1",
      amount: 5000,
      currency: "NGN",
      status: "success",
      provider: "paystack",
    });

    expect(first).toEqual({ inserted: true });
    expect(second).toEqual({ inserted: false });

    const rows = await client.run((ctx) =>
      ctx.db
        .query("payments")
        .withIndex("by_reference", (q: any) => q.eq("reference", "ref-dup-1"))
        .collect()
    );
    expect(rows.length).toBe(1);
  });

  it("still inserts when the existing row for that reference never reached 'success' (e.g. a prior 'failed' attempt)", async () => {
    // Important distinction in the actual guard: `existing.some(p => p.status === 'success')`.
    // A failed/pending row for the same reference must not permanently block a later successful
    // retry of the same transaction.
    const client = t();
    const first = await client.mutation(api.backendTrusted.insertPaymentIfNewTrusted, {
      secret: SECRET,
      user_id: "u-pay-3",
      reference: "ref-retry-1",
      amount: 5000,
      currency: "NGN",
      status: "failed",
      provider: "paystack",
    });
    const second = await client.mutation(api.backendTrusted.insertPaymentIfNewTrusted, {
      secret: SECRET,
      user_id: "u-pay-3",
      reference: "ref-retry-1",
      amount: 5000,
      currency: "NGN",
      status: "success",
      provider: "paystack",
    });

    expect(first).toEqual({ inserted: true });
    expect(second).toEqual({ inserted: true });

    const rows = await client.run((ctx) =>
      ctx.db
        .query("payments")
        .withIndex("by_reference", (q: any) => q.eq("reference", "ref-retry-1"))
        .collect()
    );
    expect(rows.length).toBe(2);
  });

  it("rejects with a wrong shared secret and inserts nothing", async () => {
    const client = t();
    await expect(
      client.mutation(api.backendTrusted.insertPaymentIfNewTrusted, {
        secret: "wrong-secret",
        user_id: "u-pay-4",
        reference: "ref-bad-secret",
        amount: 5000,
        currency: "NGN",
        status: "success",
        provider: "paystack",
      })
    ).rejects.toThrow();

    const rows = await client.run((ctx) =>
      ctx.db
        .query("payments")
        .withIndex("by_reference", (q: any) => q.eq("reference", "ref-bad-secret"))
        .collect()
    );
    expect(rows.length).toBe(0);
  });
});
