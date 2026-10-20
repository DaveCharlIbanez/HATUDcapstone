import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  requireOperatorVisibleOrLegacy,
  requireRoleOrLegacy,
  requireSelfOrLegacy,
} from "./lib/legacyAccess";
import {
  projectOperatorForCounterpart,
  projectOperatorPublic,
  projectOperatorSelf,
} from "./lib/projections";
import {
  requireOperatorOwnership,
  requireRideParticipant,
  resolveActor,
} from "./lib/withAuth";

// ─── Scoped queries ───────────────────────────────────────────────────────────

/**
 * The caller's own operator profile, including the fields only they may see
 * (licence number, phone, live position).
 */
export const getSelf = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.sessionToken);
    if (actor.role !== "operator" || !actor.operatorId) {
      throw new Error("Forbidden: not an operator");
    }
    const operator = await ctx.db.get(actor.operatorId);
    if (!operator) {
      throw new Error("Operator profile not found");
    }
    return projectOperatorSelf(operator);
  },
});

/**
 * The driver on a ride the caller takes part in. The passenger never sees the
 * driver's licence number, phone number or live position.
 */
export const getForRide = query({
  args: { sessionToken: v.string(), rideId: v.id("rides") },
  handler: async (ctx, args) => {
    const { ride } = await requireRideParticipant(
      ctx,
      args.sessionToken,
      args.rideId
    );
    if (!ride.operatorId) {
      return null;
    }
    const operator = await ctx.db.get(ride.operatorId);
    if (!operator) {
      return null;
    }
    return projectOperatorForCounterpart(operator);
  },
});

/**
 * The roster of drivers currently taking rides. Drivers and admins only.
 */
export const listAvailable = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    await requireRoleOrLegacy(ctx, args.sessionToken, "operator");
    const operators = await ctx.db
      .query("operators")
      .withIndex("by_isAvailable", (q) => q.eq("isAvailable", true))
      .collect();
    return operators.map(projectOperatorPublic);
  },
});

// ─── Legacy compatibility ─────────────────────────────────────────────────────
// Superseded by getSelf / getForRide. Kept only for the Android builds that
// predate session-token auth. See convex/lib/legacyAccess.ts.

export const getByUserId = query({
  args: {
    userId: v.id("users"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireSelfOrLegacy(ctx, args.sessionToken, args.userId);
    const operator = await ctx.db
      .query("operators")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
    if (!operator) {
      return null;
    }
    return args.sessionToken
      ? projectOperatorSelf(operator)
      : projectOperatorPublic(operator);
  },
});

export const getById = query({
  args: {
    id: v.id("operators"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireOperatorVisibleOrLegacy(ctx, args.sessionToken, args.id);
    const operator = await ctx.db.get(args.id);
    if (!operator) {
      return null;
    }
    return projectOperatorForCounterpart(operator);
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

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

    const patch: {
      isAvailable: boolean;
      currentLocation?: { latitude: number; longitude: number };
      updatedAt: number;
    } = { isAvailable: args.isAvailable, updatedAt: Date.now() };

    // Only overwrite the stored position when one was supplied — patching an
    // absent value would wipe the driver's last known location.
    if (args.currentLocation !== undefined) {
      patch.currentLocation = args.currentLocation;
    }

    await ctx.db.patch(args.id, patch);
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
    if (!operator) {
      throw new Error("Operator not found");
    }

    const updates: {
      name?: string;
      phone?: string;
      vehicleInfo?: { plateNumber: string; model: string; color: string };
      updatedAt: number;
    } = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      updates.name = args.name;
    }
    if (args.phone !== undefined) {
      updates.phone = args.phone;
    }
    if (args.vehicleInfo !== undefined) {
      updates.vehicleInfo = args.vehicleInfo;
    }

    await ctx.db.patch(args.id, updates);
  },
});
