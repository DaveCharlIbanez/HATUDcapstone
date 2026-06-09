import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireOperatorOwnership } from "./lib/withAuth";

export const getByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) =>
    await ctx.db
      .query("operators")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first(),
});

export const getById = query({
  args: { id: v.id("operators") },
  handler: async (ctx, args) => await ctx.db.get(args.id),
});

export const getByLicense = query({
  args: { licenseNumber: v.string() },
  handler: async (ctx, args) =>
    await ctx.db
      .query("operators")
      .withIndex("by_license", (q) => q.eq("licenseNumber", args.licenseNumber))
      .first(),
});

export const listAvailable = query({
  args: {},
  handler: async (ctx) =>
    await ctx.db
      .query("operators")
      .withIndex("by_isAvailable", (q) => q.eq("isAvailable", true))
      .collect(),
});

// Internal only — called by auth.signup, not directly by clients
export const create = internalMutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    licenseNumber: v.string(),
    vehicleInfo: v.object({
      plateNumber: v.string(),
      model: v.string(),
      color: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("operators")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      throw new Error("Operator profile already exists for this user");
    }

    const existingLicense = await ctx.db
      .query("operators")
      .withIndex("by_license", (q) => q.eq("licenseNumber", args.licenseNumber))
      .first();

    if (existingLicense) {
      throw new Error("Operator with this license number already exists");
    }

    const now = Date.now();
    return await ctx.db.insert("operators", {
      userId: args.userId,
      name: args.name,
      email: args.email,
      phone: args.phone,
      licenseNumber: args.licenseNumber,
      vehicleInfo: args.vehicleInfo,
      isAvailable: false,
      currentLocation: undefined,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const setAvailability = mutation({
  args: {
    sessionToken: v.string(),
    id: v.id("operators"),
    isAvailable: v.boolean(),
    currentLocation: v.optional(
      v.object({
        latitude: v.number(),
        longitude: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    await requireOperatorOwnership(ctx, args.sessionToken, args.id);

    await ctx.db.patch(args.id, {
      isAvailable: args.isAvailable,
      currentLocation: args.currentLocation,
      updatedAt: Date.now(),
    });
  },
});

export const updateLocation = mutation({
  args: {
    sessionToken: v.string(),
    id: v.id("operators"),
    location: v.object({
      latitude: v.number(),
      longitude: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    await requireOperatorOwnership(ctx, args.sessionToken, args.id);

    await ctx.db.patch(args.id, {
      currentLocation: args.location,
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    sessionToken: v.string(),
    id: v.id("operators"),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    vehicleInfo: v.optional(
      v.object({
        plateNumber: v.string(),
        model: v.string(),
        color: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    await requireOperatorOwnership(ctx, args.sessionToken, args.id);

    const operator = await ctx.db.get(args.id);
    if (!operator) throw new Error("Operator not found");

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.phone !== undefined) updates.phone = args.phone;
    if (args.vehicleInfo !== undefined) updates.vehicleInfo = args.vehicleInfo;

    await ctx.db.patch(args.id, updates);
  },
});
