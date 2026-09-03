import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
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

describe("generationIdempotency", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("claims a fresh key", async () => {
    const client = t();
    const result = await client.mutation(api.generationIdempotency.claimIdempotencyKey, {
      secret: SECRET,
      userId: "user1",
      key: "key-abc-123",
      route: "tryon",
    });
    expect(result).toEqual({ claimed: true });
  });

  it("rejects a wrong shared secret", async () => {
    const client = t();
    await expect(
      client.mutation(api.generationIdempotency.claimIdempotencyKey, {
        secret: "wrong-secret",
        userId: "user1",
        key: "key-abc-123",
        route: "tryon",
      })
    ).rejects.toThrow();
  });

  it("a duplicate claim while the original is still processing (no ref_id yet, recent) is refused with refId: null", async () => {
    const client = t();
    await client.mutation(api.generationIdempotency.claimIdempotencyKey, {
      secret: SECRET,
      userId: "user1",
      key: "key-abc-123",
      route: "tryon",
    });
    // No completeIdempotencyKey call yet — simulates the original request still in flight.
    const result = await client.mutation(api.generationIdempotency.claimIdempotencyKey, {
      secret: SECRET,
      userId: "user1",
      key: "key-abc-123",
      route: "tryon",
    });
    expect(result).toEqual({ claimed: false, route: "tryon", refId: null });
  });

  it("a duplicate claim after completeIdempotencyKey returns the existing refId instead of re-claiming", async () => {
    const client = t();
    await client.mutation(api.generationIdempotency.claimIdempotencyKey, {
      secret: SECRET,
      userId: "user1",
      key: "key-abc-123",
      route: "tryon",
    });
    await client.mutation(api.generationIdempotency.completeIdempotencyKey, {
      secret: SECRET,
      userId: "user1",
      key: "key-abc-123",
      refId: "tryon_999",
    });

    const result = await client.mutation(api.generationIdempotency.claimIdempotencyKey, {
      secret: SECRET,
      userId: "user1",
      key: "key-abc-123",
      route: "tryon",
    });
    expect(result).toEqual({ claimed: false, route: "tryon", refId: "tryon_999" });
  });

  it("a stale unclaimed row (>2 minutes, no ref_id — original request presumably crashed) is reclaimable as a fresh attempt", async () => {
    const client = t();
    await client.mutation(api.generationIdempotency.claimIdempotencyKey, {
      secret: SECRET,
      userId: "user1",
      key: "key-abc-123",
      route: "tryon",
    });

    // Still within the 2-minute window — must NOT be reclaimable yet.
    await vi.advanceTimersByTimeAsync(60_000);
    const stillProcessing = await client.mutation(api.generationIdempotency.claimIdempotencyKey, {
      secret: SECRET,
      userId: "user1",
      key: "key-abc-123",
      route: "tryon",
    });
    expect(stillProcessing).toEqual({ claimed: false, route: "tryon", refId: null });

    // Past the 2-minute staleness threshold — the original attempt is presumed dead.
    await vi.advanceTimersByTimeAsync(2 * 60 * 1000 + 1_000);
    const reclaimed = await client.mutation(api.generationIdempotency.claimIdempotencyKey, {
      secret: SECRET,
      userId: "user1",
      key: "key-abc-123",
      route: "tryon",
    });
    expect(reclaimed).toEqual({ claimed: true });
  });

  it("the same key string never collides across different users", async () => {
    const client = t();
    const first = await client.mutation(api.generationIdempotency.claimIdempotencyKey, {
      secret: SECRET,
      userId: "user1",
      key: "shared-key-value",
      route: "tryon",
    });
    const second = await client.mutation(api.generationIdempotency.claimIdempotencyKey, {
      secret: SECRET,
      userId: "user2",
      key: "shared-key-value",
      route: "tryon",
    });
    expect(first).toEqual({ claimed: true });
    expect(second).toEqual({ claimed: true });
  });

  it("different keys for the same user are independent", async () => {
    const client = t();
    const first = await client.mutation(api.generationIdempotency.claimIdempotencyKey, {
      secret: SECRET,
      userId: "user1",
      key: "key-one",
      route: "tryon",
    });
    const second = await client.mutation(api.generationIdempotency.claimIdempotencyKey, {
      secret: SECRET,
      userId: "user1",
      key: "key-two",
      route: "tryon",
    });
    expect(first).toEqual({ claimed: true });
    expect(second).toEqual({ claimed: true });
  });

  it("completeIdempotencyKey is a no-op when the key was never claimed (defensive — should not happen in practice)", async () => {
    const client = t();
    await expect(
      client.mutation(api.generationIdempotency.completeIdempotencyKey, {
        secret: SECRET,
        userId: "user1",
        key: "never-claimed",
        refId: "whatever",
      })
    ).resolves.toBeNull();
  });

  it("completing one route's key does not affect a different route reusing the same key/user pair conceptually (route is stored, not part of the lookup key)", async () => {
    // The dedup index is (user_id, key) only — route is metadata on the row, not part of identity.
    // This test documents that behavior explicitly rather than leaving it implicit.
    const client = t();
    await client.mutation(api.generationIdempotency.claimIdempotencyKey, {
      secret: SECRET,
      userId: "user1",
      key: "key-abc-123",
      route: "outfit",
    });
    const duplicate = await client.mutation(api.generationIdempotency.claimIdempotencyKey, {
      secret: SECRET,
      userId: "user1",
      key: "key-abc-123",
      route: "video",
    });
    // Refused as a duplicate of the *outfit* claim even though this second call named a different
    // route — proves a client can't bypass the dedup by relabeling the route on retry.
    expect(duplicate).toEqual({ claimed: false, route: "outfit", refId: null });
  });
});
