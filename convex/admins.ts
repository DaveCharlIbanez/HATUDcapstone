import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) =>
    await ctx.db
      .query("admins")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first(),
});

export const getById = query({
  args: { id: v.id("admins") },
  handler: async (ctx, args) => await ctx.db.get(args.id),
});

export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) =>
    await ctx.db
      .query("admins")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first(),
});

export const listAll = query({
  args: {},
  handler: async (ctx) => await ctx.db.query("admins").collect(),
});

export const create = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    email: v.string(),
    permissions: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("admins")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      throw new Error("Admin profile already exists for this user");
    }

    const now = Date.now();
    return await ctx.db.insert("admins", {
      userId: args.userId,
      name: args.name,
      email: args.email,
      permissions: args.permissions ?? [
        "view_all",
        "manage_users",
        "view_analytics",
      ],
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("admins"),
    name: v.optional(v.string()),
    permissions: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const admin = await ctx.db.get(args.id);
    if (!admin) {
      throw new Error("Admin not found");
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      updates.name = args.name;
    }
    if (args.permissions !== undefined) {
      updates.permissions = args.permissions;
    }

    await ctx.db.patch(args.id, updates);
  },
});

export const hasPermission = query({
  args: {
    id: v.id("admins"),
    permission: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await ctx.db.get(args.id);
    if (!admin) {
      return false;
    }
    return admin.permissions.includes(args.permission);
  },
});
