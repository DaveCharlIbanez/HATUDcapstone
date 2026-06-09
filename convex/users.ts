import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

// Strip the passwordHash field before returning any user document to the client
function sanitize(user: Record<string, unknown> | null) {
  if (!user) return null;
  const { passwordHash: _omit, ...safe } = user as any;
  return safe;
}

export const getById = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => sanitize(await ctx.db.get(args.id)),
});

export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    return sanitize(user);
  },
});

export const getByPhone = query({
  args: { phone: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .first();
    return sanitize(user);
  },
});

export const listByRole = query({
  args: {
    role: v.union(
      v.literal("commuter"),
      v.literal("operator"),
      v.literal("admin")
    ),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", args.role))
      .collect();
    return users.map(sanitize);
  },
});

// Internal only — direct user creation should go through auth.signup
export const create = internalMutation({
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
    if (existing) throw new Error("User with this email already exists");

    const existingPhone = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .first();
    if (existingPhone) throw new Error("User with this phone number already exists");

    const now = Date.now();
    return await ctx.db.insert("users", { ...args, createdAt: now, updatedAt: now });
  },
});

export const updateLastLogin = mutation({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { updatedAt: Date.now() });
  },
});
