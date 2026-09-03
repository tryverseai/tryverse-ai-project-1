/// <reference types="vite/client" />
// Authorization/IDOR coverage for backendTrusted.ts's per-user generation read/delete functions.
// These are the highest-blast-radius paths in the trusted-secret API surface: a regression here
// (e.g. someone drops the `row.user_id !== userId` guard while refactoring) would let one account
// read or delete another account's AI generation results. Written as its own file — distinct
// concern from backendTrusted.test.ts's credit/payment coverage — covering one representative
// generation type in depth (outfit) and the owner-check shape for the other three plus the
// deliberately-unauthenticated public-link capability query.
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

describe("outfit generation ownership (getOutfitGenerationForUser / deleteOutfitGenerationForUser)", () => {
  async function seedOutfit(client: ReturnType<typeof t>, ownerId: string) {
    return client.run(async (ctx) => {
      return await ctx.db.insert("outfit_generations", {
        user_id: ownerId,
        model_image: "https://example.com/model.png",
        slots: { top: "p1", bottom: "p2" },
        prompt_used: "test prompt",
        status: "completed",
        result_image: "outfits/owner-result.png",
        created_at: new Date().toISOString(),
      });
    });
  }

  it("the owner can read their own generation", async () => {
    const client = t();
    const id = await seedOutfit(client, "owner-1");
    const result = await client.query(api.backendTrusted.getOutfitGenerationForUser, {
      secret: SECRET,
      userId: "owner-1",
      id,
    });
    expect(result).not.toBeNull();
    expect(result?.resultImage).toBe("outfits/owner-result.png");
  });

  it("a different user gets null, not the owner's data (IDOR check)", async () => {
    const client = t();
    const id = await seedOutfit(client, "owner-1");
    const result = await client.query(api.backendTrusted.getOutfitGenerationForUser, {
      secret: SECRET,
      userId: "attacker-2",
      id,
    });
    expect(result).toBeNull();
  });

  it("a nonexistent id returns null rather than throwing", async () => {
    const client = t();
    const realId = await seedOutfit(client, "owner-1");
    await client.mutation(api.backendTrusted.deleteOutfitGenerationForUser, {
      secret: SECRET,
      userId: "owner-1",
      id: realId,
    });
    // Re-querying a now-deleted id is the simplest way to get a guaranteed-absent id of the
    // right branded type without reaching into Convex internals.
    const result = await client.query(api.backendTrusted.getOutfitGenerationForUser, {
      secret: SECRET,
      userId: "owner-1",
      id: realId,
    });
    expect(result).toBeNull();
  });

  it("the owner can delete their own generation, and it is actually gone", async () => {
    const client = t();
    const id = await seedOutfit(client, "owner-1");
    const result = await client.mutation(api.backendTrusted.deleteOutfitGenerationForUser, {
      secret: SECRET,
      userId: "owner-1",
      id,
    });
    expect(result).toEqual({ deleted: true, resultPath: "outfits/owner-result.png" });

    const row = await client.run(async (ctx) => await ctx.db.get(id));
    expect(row).toBeNull();
  });

  it("a different user's delete attempt is refused and the row survives (IDOR check)", async () => {
    const client = t();
    const id = await seedOutfit(client, "owner-1");
    const result = await client.mutation(api.backendTrusted.deleteOutfitGenerationForUser, {
      secret: SECRET,
      userId: "attacker-2",
      id,
    });
    expect(result).toEqual({ deleted: false, resultPath: null });

    const row = await client.run(async (ctx) => await ctx.db.get(id));
    expect(row).not.toBeNull();
    expect(row?.user_id).toBe("owner-1");
  });

  it("rejects with a wrong shared secret and reveals nothing", async () => {
    const client = t();
    const id = await seedOutfit(client, "owner-1");
    await expect(
      client.query(api.backendTrusted.getOutfitGenerationForUser, {
        secret: "wrong-secret",
        userId: "owner-1",
        id,
      })
    ).rejects.toThrow();
  });
});

describe("product-model generation ownership (getProductModelGenerationForUser / deleteProductModelGenerationForUser)", () => {
  async function seedProductModel(client: ReturnType<typeof t>, ownerId: string) {
    return client.run(async (ctx) => {
      return await ctx.db.insert("product_model_generations", {
        user_id: ownerId,
        product_image: "https://example.com/product.png",
        status: "completed",
        result_image: "product-model/owner-result.png",
        created_at: new Date().toISOString(),
      });
    });
  }

  it("a different user cannot read another account's product-model generation", async () => {
    const client = t();
    const id = await seedProductModel(client, "owner-1");
    const result = await client.query(api.backendTrusted.getProductModelGenerationForUser, {
      secret: SECRET,
      userId: "attacker-2",
      id,
    });
    expect(result).toBeNull();
  });

  it("a different user cannot delete another account's product-model generation", async () => {
    const client = t();
    const id = await seedProductModel(client, "owner-1");
    const result = await client.mutation(api.backendTrusted.deleteProductModelGenerationForUser, {
      secret: SECRET,
      userId: "attacker-2",
      id,
    });
    expect(result).toEqual({ deleted: false, resultPath: null });
    const row = await client.run(async (ctx) => await ctx.db.get(id));
    expect(row).not.toBeNull();
  });
});

describe("video generation ownership (getVideoGenerationForUser / deleteVideoGenerationForUser)", () => {
  async function seedVideo(client: ReturnType<typeof t>, ownerId: string) {
    return client.run(async (ctx) => {
      return await ctx.db.insert("video_generations", {
        user_id: ownerId,
        source_image: "https://example.com/source.png",
        duration_seconds: 5,
        resolution: "1080p",
        status: "completed",
        result_video: "video/owner-result.mp4",
        created_at: new Date().toISOString(),
      });
    });
  }

  it("a different user cannot read another account's video generation", async () => {
    const client = t();
    const id = await seedVideo(client, "owner-1");
    const result = await client.query(api.backendTrusted.getVideoGenerationForUser, {
      secret: SECRET,
      userId: "attacker-2",
      id,
    });
    expect(result).toBeNull();
  });

  it("a different user cannot delete another account's video generation", async () => {
    const client = t();
    const id = await seedVideo(client, "owner-1");
    const result = await client.mutation(api.backendTrusted.deleteVideoGenerationForUser, {
      secret: SECRET,
      userId: "attacker-2",
      id,
    });
    expect(result).toEqual({ deleted: false, resultPath: null });
    const row = await client.run(async (ctx) => await ctx.db.get(id));
    expect(row).not.toBeNull();
  });
});

describe("try-on ownership (getTryonByLegacyIdForUser / deleteTryonByLegacyIdForUser)", () => {
  async function seedTryon(client: ReturnType<typeof t>, ownerId: string, legacyId: string) {
    return client.run(async (ctx) => {
      return await ctx.db.insert("tryons", {
        legacy_id: legacyId,
        user_id: ownerId,
        category: "tops",
        person_image: "person.png",
        product_image: "product.png",
        result_image: "tryons/owner-result.png",
        status: "completed",
        created_at: new Date().toISOString(),
      });
    });
  }

  it("a different user cannot read another account's try-on by legacy id", async () => {
    const client = t();
    await seedTryon(client, "owner-1", "legacy-abc");
    const result = await client.query(api.backendTrusted.getTryonByLegacyIdForUser, {
      secret: SECRET,
      userId: "attacker-2",
      legacyId: "legacy-abc",
    });
    expect(result).toBeNull();
  });

  it("a different user cannot delete another account's try-on, and it survives", async () => {
    const client = t();
    const id = await seedTryon(client, "owner-1", "legacy-abc");
    const result = await client.mutation(api.backendTrusted.deleteTryonByLegacyIdForUser, {
      secret: SECRET,
      userId: "attacker-2",
      legacyId: "legacy-abc",
    });
    expect(result).toEqual({ deleted: false });
    const row = await client.run(async (ctx) => await ctx.db.get(id));
    expect(row).not.toBeNull();
  });

  it("the owner can read and delete their own try-on", async () => {
    const client = t();
    const id = await seedTryon(client, "owner-1", "legacy-xyz");
    const read = await client.query(api.backendTrusted.getTryonByLegacyIdForUser, {
      secret: SECRET,
      userId: "owner-1",
      legacyId: "legacy-xyz",
    });
    expect(read?.result_image).toBe("tryons/owner-result.png");

    const del = await client.mutation(api.backendTrusted.deleteTryonByLegacyIdForUser, {
      secret: SECRET,
      userId: "owner-1",
      legacyId: "legacy-xyz",
    });
    expect(del).toEqual({ deleted: true });
    const row = await client.run(async (ctx) => await ctx.db.get(id));
    expect(row).toBeNull();
  });
});

describe("getTryonResultForPublicLink (deliberately unauthenticated capability-URL query)", () => {
  it("returns only the result image — never user_id or any other account-identifying field", async () => {
    const client = t();
    await client.run(async (ctx) => {
      await ctx.db.insert("tryons", {
        legacy_id: "legacy-public",
        user_id: "owner-1",
        category: "tops",
        person_image: "person.png",
        product_image: "product.png",
        result_image: "tryons/public-result.png",
        status: "completed",
        created_at: new Date().toISOString(),
      });
    });
    const result = await client.query(api.backendTrusted.getTryonResultForPublicLink, {
      secret: SECRET,
      legacyId: "legacy-public",
    });
    expect(result).toEqual({ result_image: "tryons/public-result.png" });
    // No user_id, status, or any other field leaks through this deliberately-unauthenticated path.
    expect(Object.keys(result ?? {})).toEqual(["result_image"]);
  });

  it("returns null for a try-on that has not completed yet, even though the id is valid", async () => {
    const client = t();
    await client.run(async (ctx) => {
      await ctx.db.insert("tryons", {
        legacy_id: "legacy-pending",
        user_id: "owner-1",
        category: "tops",
        person_image: "person.png",
        product_image: "product.png",
        status: "processing",
        created_at: new Date().toISOString(),
      });
    });
    const result = await client.query(api.backendTrusted.getTryonResultForPublicLink, {
      secret: SECRET,
      legacyId: "legacy-pending",
    });
    expect(result).toBeNull();
  });

  it("rejects with a wrong shared secret", async () => {
    const client = t();
    await expect(
      client.query(api.backendTrusted.getTryonResultForPublicLink, {
        secret: "wrong-secret",
        legacyId: "legacy-public",
      })
    ).rejects.toThrow();
  });
});
