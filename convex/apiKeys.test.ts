// Authorization/IDOR coverage for apiKeys.ts. API keys grant programmatic account access, so a
// cross-user revoke/delete/listing bug here is high severity — worth pinning down explicitly.
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");

function t() {
  return convexTest(schema, modules);
}

describe("api key ownership", () => {
  it("a different user's revokeMyApiKey is refused and the key stays active (IDOR check)", async () => {
    const client = t();
    const owner = client.withIdentity({ subject: "owner-1" });
    const attacker = client.withIdentity({ subject: "attacker-2" });

    const created = await owner.mutation(api.apiKeys.createMyApiKey, { name: "My Key" });

    await expect(
      attacker.mutation(api.apiKeys.revokeMyApiKey, { id: created.id })
    ).rejects.toThrow(/not found/i);

    const list = await owner.query(api.apiKeys.listMyApiKeys, {});
    expect(list?.find((k) => k.id === created.id)?.status).toBe("active");
  });

  it("a different user's deleteMyApiKey is refused and the key survives (IDOR check)", async () => {
    const client = t();
    const owner = client.withIdentity({ subject: "owner-1" });
    const attacker = client.withIdentity({ subject: "attacker-2" });

    const created = await owner.mutation(api.apiKeys.createMyApiKey, { name: "My Key" });

    await expect(
      attacker.mutation(api.apiKeys.deleteMyApiKey, { id: created.id })
    ).rejects.toThrow(/not found/i);

    const list = await owner.query(api.apiKeys.listMyApiKeys, {});
    expect(list?.some((k) => k.id === created.id)).toBe(true);
  });

  it("the owner can revoke and delete their own key", async () => {
    const client = t();
    const owner = client.withIdentity({ subject: "owner-1" });

    const created = await owner.mutation(api.apiKeys.createMyApiKey, { name: "My Key" });
    await owner.mutation(api.apiKeys.revokeMyApiKey, { id: created.id });

    const afterRevoke = await owner.query(api.apiKeys.listMyApiKeys, {});
    expect(afterRevoke?.find((k) => k.id === created.id)?.status).toBe("revoked");

    await owner.mutation(api.apiKeys.deleteMyApiKey, { id: created.id });
    const afterDelete = await owner.query(api.apiKeys.listMyApiKeys, {});
    expect(afterDelete?.some((k) => k.id === created.id)).toBe(false);
  });

  it("listMyApiKeys never returns another account's keys", async () => {
    const client = t();
    const owner = client.withIdentity({ subject: "owner-1" });
    const attacker = client.withIdentity({ subject: "attacker-2" });

    await owner.mutation(api.apiKeys.createMyApiKey, { name: "Owner Key" });
    await attacker.mutation(api.apiKeys.createMyApiKey, { name: "Attacker Key" });

    const ownerList = await owner.query(api.apiKeys.listMyApiKeys, {});
    const attackerList = await attacker.query(api.apiKeys.listMyApiKeys, {});

    expect(ownerList?.map((k) => k.name)).toEqual(["Owner Key"]);
    expect(attackerList?.map((k) => k.name)).toEqual(["Attacker Key"]);
  });

  it("an unauthenticated caller gets null from listMyApiKeys rather than every key in the table", async () => {
    const client = t();
    const owner = client.withIdentity({ subject: "owner-1" });
    await owner.mutation(api.apiKeys.createMyApiKey, { name: "Owner Key" });

    await expect(client.query(api.apiKeys.listMyApiKeys, {})).resolves.toBeNull();
  });
});
