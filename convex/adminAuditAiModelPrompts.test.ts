/// <reference types="vite/client" />
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
const t = () => convexTest(schema, modules);

const SECRET = "test-backend-shared-secret";

beforeEach(() => {
  process.env.BACKEND_SHARED_SECRET = SECRET;
});

async function insertModel(
  tt: ReturnType<typeof t>,
  overrides: Partial<{ user_id: string; prompt: string; status: "active" | "archived" }> = {},
) {
  return tt.run(async (ctx) =>
    ctx.db.insert("ai_generated_models", {
      user_id: overrides.user_id ?? "user_1",
      storage_path: "user_1/models/generated.jpg",
      params: { prompt: overrides.prompt ?? "professional adult fashion model, studio lighting" },
      status: overrides.status ?? "active",
      created_at: new Date().toISOString(),
    })
  );
}

describe("auditAiModelPromptsForMinorContent", () => {
  it("requires the backend shared secret", async () => {
    const tt = t();
    await expect(tt.query(api.adminTrusted.auditAiModelPromptsForMinorContent, { secret: "wrong" })).rejects.toThrow();
  });

  it("scans every row and flags none when all prompts describe adults", async () => {
    const tt = t();
    await insertModel(tt, { prompt: "a 30 year old male model, streetwear" });
    await insertModel(tt, { prompt: "editorial fashion model, confident pose" });

    const result = await tt.query(api.adminTrusted.auditAiModelPromptsForMinorContent, { secret: SECRET });
    expect(result.scanned).toBe(2);
    expect(result.flagged).toBe(0);
    expect(result.hits).toEqual([]);
  });

  it("flags rows whose saved prompt describes a minor, including archived ones", async () => {
    const tt = t();
    await insertModel(tt, { prompt: "adult fashion model" });
    const flaggedId = await insertModel(tt, { prompt: "toddler model wearing a summer outfit", user_id: "user_2" });
    const flaggedArchivedId = await insertModel(tt, {
      prompt: "a 6 year old child model",
      user_id: "user_3",
      status: "archived",
    });

    const result = await tt.query(api.adminTrusted.auditAiModelPromptsForMinorContent, { secret: SECRET });
    expect(result.scanned).toBe(3);
    expect(result.flagged).toBe(2);
    const flaggedIds = result.hits.map((h) => h.id).sort();
    expect(flaggedIds).toEqual([String(flaggedId), String(flaggedArchivedId)].sort());
  });
});
