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

/**
 * Clear or refuse a driver application.
 *
 * Approval means "may drive", not "is on shift": the driver still has to go
 * online themselves, so the approval also takes them offline. A refusal can
 * carry a note, which the driver sees on their application screen so they
 * know what to fix.
 */
export const setOperatorApproval = mutation({
  args: {
    sessionToken: v.string(),
    id: v.id("operators"),
    approvalStatus: v.union(v.literal("approved"), v.literal("rejected")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.sessionToken, "admin");

    const operator = await ctx.db.get(args.id);
    if (!operator) {
      throw new Error("Operator not found");
    }

    const note = args.note?.trim();

    await ctx.db.patch(args.id, {
      approvalStatus: args.approvalStatus,
      rejectionNote: args.approvalStatus === "rejected" ? note : undefined,
      isAvailable: false,
      updatedAt: Date.now(),
    });
  },
});
