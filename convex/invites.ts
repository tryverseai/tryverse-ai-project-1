import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireBackendSecret } from "./security";

function newInviteToken(): string {
  return `inv_${crypto.randomUUID().replace(/-/g, "")}`;
}

export const getInviteByTokenTrusted = query({
  args: { secret: v.string(), token: v.string() },
  handler: async (ctx, { secret, token }) => {
    requireBackendSecret(secret);
    const row = await ctx.db
      .query("invites")
      .withIndex("by_token", (q) => q.eq("token", token.trim()))
      .unique();
    return row ?? null;
  },
});

export const listInvitesTrusted = query({
  args: {
    secret: v.string(),
    statusFilter: v.optional(v.string()),
    accountTypeFilter: v.optional(v.string()),
  },
  handler: async (ctx, { secret, statusFilter, accountTypeFilter }) => {
    requireBackendSecret(secret);
    let rows: Doc<"invites">[] = await ctx.db.query("invites").collect();
    if (statusFilter) rows = rows.filter((r) => r.status === statusFilter);
    if (accountTypeFilter) rows = rows.filter((r) => r.accountType === accountTypeFilter);
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return rows;
  },
});

export const createInviteTrusted = mutation({
  args: {
    secret: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    /** TryVerse is B2B-only. Accepted for wire back-compat; every invite is stored as "business". */
    accountType: v.optional(v.string()),
    companyName: v.optional(v.string()),
    createdBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireBackendSecret(args.secret);
    const email = args.email.trim().toLowerCase();
    if (!email) throw new Error("EMAIL_REQUIRED");

    let token = newInviteToken();
    for (let i = 0; i < 5; i++) {
      const exists = await ctx.db
        .query("invites")
        .withIndex("by_token", (q) => q.eq("token", token))
        .unique();
      if (!exists) break;
      token = newInviteToken();
    }

    await ctx.db.insert("invites", {
      token,
      email,
      name: args.name?.trim() || undefined,
      accountType: "business",
      companyName: args.companyName?.trim() || undefined,
      status: "pending",
      createdAt: Date.now(),
      createdBy: args.createdBy,
    });

    return { token };
  },
});

export const markInviteSentTrusted = mutation({
  args: { secret: v.string(), token: v.string() },
  handler: async (ctx, { secret, token }) => {
    requireBackendSecret(secret);
    const row = await ctx.db
      .query("invites")
      .withIndex("by_token", (q) => q.eq("token", token.trim()))
      .unique();
    if (!row) throw new Error("NOT_FOUND");
    if (row.status !== "pending") {
      throw new Error(`INVALID_STATUS:${row.status}`);
    }
    await ctx.db.patch(row._id, {
      status: "sent",
      sentAt: Date.now(),
    });
    return { ok: true as const };
  },
});

export const markInviteAcceptedTrusted = mutation({
  args: { secret: v.string(), token: v.string() },
  handler: async (ctx, { secret, token }) => {
    requireBackendSecret(secret);
    const row = await ctx.db
      .query("invites")
      .withIndex("by_token", (q) => q.eq("token", token.trim()))
      .unique();
    if (!row) throw new Error("NOT_FOUND");
    if (row.status !== "sent") {
      throw new Error(`INVALID_STATUS:${row.status}`);
    }
    await ctx.db.patch(row._id, {
      status: "accepted",
      acceptedAt: Date.now(),
    });
    return { ok: true as const };
  },
});

export const deleteInviteByTokenTrusted = mutation({
  args: { secret: v.string(), token: v.string() },
  handler: async (ctx, { secret, token }) => {
    requireBackendSecret(secret);
    const row = await ctx.db
      .query("invites")
      .withIndex("by_token", (q) => q.eq("token", token.trim()))
      .unique();
    if (!row) return { deleted: false as const };
    await ctx.db.delete(row._id as Id<"invites">);
    return { deleted: true as const };
  },
});
