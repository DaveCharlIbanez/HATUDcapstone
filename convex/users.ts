import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getById = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => await ctx.db.get(args.id),
});

export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) =>
    await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first(),
});

export const getByPhone = query({
  args: { phone: v.string() },
  handler: async (ctx, args) =>
    await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .first(),
});

export const listByRole = query({
  args: {
    role: v.union(
      v.literal("commuter"),
      v.literal("operator"),
      v.literal("admin")
    ),
  },
  handler: async (ctx, args) =>
    await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", args.role))
      .collect(),
});

export const create = mutation({
  args: {
    email: v.string(),
    passwordHash: v.string(),
    phone: v.string(),
    role: v.union(
      v.literal("commuter"),
      v.literal("operator"),
      v.literal("admin")
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      throw new Error("User with this email already exists");
    }

    const existingPhone = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .first();

    if (existingPhone) {
      throw new Error("User with this phone number already exists");
    }

    const now = Date.now();
    return await ctx.db.insert("users", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateLastLogin = mutation({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { updatedAt: Date.now() });
  },
});
