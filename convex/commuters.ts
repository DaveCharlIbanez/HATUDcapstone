import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) =>
    await ctx.db
      .query("commuters")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first(),
});

export const getById = query({
  args: { id: v.id("commuters") },
  handler: async (ctx, args) => await ctx.db.get(args.id),
});

export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) =>
    await ctx.db
      .query("commuters")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first(),
});

export const create = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    savedLocations: v.optional(
      v.array(
        v.object({
          name: v.string(),
          address: v.string(),
          latitude: v.number(),
          longitude: v.number(),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("commuters")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      throw new Error("Commuter profile already exists for this user");
    }

    const now = Date.now();
    return await ctx.db.insert("commuters", {
      userId: args.userId,
      name: args.name,
      email: args.email,
      phone: args.phone,
      savedLocations: args.savedLocations ?? [],
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("commuters"),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    savedLocations: v.optional(
      v.array(
        v.object({
          name: v.string(),
          address: v.string(),
          latitude: v.number(),
          longitude: v.number(),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Commuter not found");
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      updates.name = args.name;
    }
    if (args.phone !== undefined) {
      updates.phone = args.phone;
    }
    if (args.savedLocations !== undefined) {
      updates.savedLocations = args.savedLocations;
    }

    await ctx.db.patch(args.id, updates);
  },
});

export const addSavedLocation = mutation({
  args: {
    id: v.id("commuters"),
    location: v.object({
      name: v.string(),
      address: v.string(),
      latitude: v.number(),
      longitude: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const commuter = await ctx.db.get(args.id);
    if (!commuter) {
      throw new Error("Commuter not found");
    }

    const updatedLocations = [...commuter.savedLocations, args.location];
    await ctx.db.patch(args.id, {
      savedLocations: updatedLocations,
      updatedAt: Date.now(),
    });
  },
});


