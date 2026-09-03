// Authorization/IDOR coverage for products.ts — the real browser-facing (ctx.auth, not
// shared-secret) CRUD surface for a brand's product catalog. update/delete are keyed by a
// client-supplied `id` string, so this is exactly the identity-from-arg / missing-ownership-check
// shape worth pinning down with tests: a regression that dropped `findOwnedProduct`'s ownership
// comparison would let one account edit or delete another account's catalog product.
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");

function t() {
  return convexTest(schema, modules);
}

describe("products ownership", () => {
  it("an unauthenticated caller cannot create a product", async () => {
    const client = t();
    await expect(
      client.mutation(api.products.createProduct, {
        name: "Test Shirt",
        category: "tops",
      })
    ).rejects.toThrow(/not authenticated/i);
  });

  it("listMyProducts/getMyProduct return null for an unauthenticated caller rather than throwing", async () => {
    const client = t();
    await expect(client.query(api.products.listMyProducts, {})).resolves.toBeNull();
    await expect(client.query(api.products.getMyProduct, { id: "whatever" })).resolves.toBeNull();
  });

  it("a product created by one user is invisible to another user's listMyProducts/getMyProduct", async () => {
    const client = t();
    const owner = client.withIdentity({ subject: "owner-1" });
    const attacker = client.withIdentity({ subject: "attacker-2" });

    const created = await owner.mutation(api.products.createProduct, {
      name: "Owner's Shirt",
      category: "tops",
    });

    const attackerList = await attacker.query(api.products.listMyProducts, {});
    expect(attackerList?.products.find((p) => p.id === created.id)).toBeUndefined();

    const attackerGet = await attacker.query(api.products.getMyProduct, { id: String(created.id) });
    expect(attackerGet).toBeNull();

    // The real owner sees it fine.
    const ownerGet = await owner.query(api.products.getMyProduct, { id: String(created.id) });
    expect(ownerGet?.name).toBe("Owner's Shirt");
  });

  it("a different user's updateProduct is refused and the product is unchanged (IDOR check)", async () => {
    const client = t();
    const owner = client.withIdentity({ subject: "owner-1" });
    const attacker = client.withIdentity({ subject: "attacker-2" });

    const created = await owner.mutation(api.products.createProduct, {
      name: "Owner's Shirt",
      category: "tops",
    });

    await expect(
      attacker.mutation(api.products.updateProduct, {
        id: String(created.id),
        name: "Hijacked Name",
      })
    ).rejects.toThrow(/not found/i);

    const stillOwners = await owner.query(api.products.getMyProduct, { id: String(created.id) });
    expect(stillOwners?.name).toBe("Owner's Shirt");
  });

  it("a different user's deleteProduct is refused and the product survives (IDOR check)", async () => {
    const client = t();
    const owner = client.withIdentity({ subject: "owner-1" });
    const attacker = client.withIdentity({ subject: "attacker-2" });

    const created = await owner.mutation(api.products.createProduct, {
      name: "Owner's Shirt",
      category: "tops",
    });

    await expect(
      attacker.mutation(api.products.deleteProduct, { id: String(created.id) })
    ).rejects.toThrow(/not found/i);

    const stillThere = await owner.query(api.products.getMyProduct, { id: String(created.id) });
    expect(stillThere).not.toBeNull();
  });

  it("the owner can update and delete their own product", async () => {
    const client = t();
    const owner = client.withIdentity({ subject: "owner-1" });

    const created = await owner.mutation(api.products.createProduct, {
      name: "Owner's Shirt",
      category: "tops",
    });

    const updated = await owner.mutation(api.products.updateProduct, {
      id: String(created.id),
      name: "Renamed Shirt",
    });
    expect(updated.name).toBe("Renamed Shirt");

    await owner.mutation(api.products.deleteProduct, { id: String(created.id) });
    const gone = await owner.query(api.products.getMyProduct, { id: String(created.id) });
    expect(gone).toBeNull();
  });

  it("a product listing is correctly scoped per-user even with several products across two accounts", async () => {
    const client = t();
    const owner = client.withIdentity({ subject: "owner-1" });
    const attacker = client.withIdentity({ subject: "attacker-2" });

    await owner.mutation(api.products.createProduct, { name: "Owner A", category: "tops" });
    await owner.mutation(api.products.createProduct, { name: "Owner B", category: "bottoms" });
    await attacker.mutation(api.products.createProduct, { name: "Attacker A", category: "tops" });

    const ownerList = await owner.query(api.products.listMyProducts, {});
    const attackerList = await attacker.query(api.products.listMyProducts, {});

    expect(ownerList?.products.map((p) => p.name).sort()).toEqual(["Owner A", "Owner B"]);
    expect(attackerList?.products.map((p) => p.name)).toEqual(["Attacker A"]);
  });
});
