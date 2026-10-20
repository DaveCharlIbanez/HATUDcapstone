import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireRole } from "./lib/withAuth";

// Admin profiles are only readable through the admin dashboard queries in
// `adminQueries.ts`. The by-id / by-email / list-all lookups that used to live
// here were unauthenticated enumeration points and had no callers.

// Requires an existing admin session — prevents privilege escalation
export const create = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
    name: v.string(),
    email: v.string(),
    permissions: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.sessionToken, "admin");

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
    sessionToken: v.string(),
    id: v.id("admins"),
    name: v.optional(v.string()),
    permissions: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.sessionToken, "admin");

    const admin = await ctx.db.get(args.id);
    if (!admin) {
      throw new Error("Admin not found");
    }

    const updates: {
      name?: string;
      permissions?: string[];
      updatedAt: number;
    } = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      updates.name = args.name;
    }
    if (args.permissions !== undefined) {
      updates.permissions = args.permissions;
    }

    await ctx.db.patch(args.id, updates);
  },
});
