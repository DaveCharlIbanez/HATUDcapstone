import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  requireCommuterVisibleOrLegacy,
  requireSelfOrLegacy,
} from "./lib/legacyAccess";
import {
  projectCommuterForCounterpart,
  projectCommuterPublic,
  projectCommuterSelf,
} from "./lib/projections";
import {
  requireCommuterOwnership,
  requireRideParticipant,
  resolveActor,
} from "./lib/withAuth";

// ─── Scoped queries ───────────────────────────────────────────────────────────

/**
 * The caller's own commuter profile.
 */
export const getSelf = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.sessionToken);
    if (actor.role !== "commuter" || !actor.commuterId) {
      throw new Error("Forbidden: not a commuter");
    }
    const commuter = await ctx.db.get(actor.commuterId);
    if (!commuter) {
      throw new Error("Commuter profile not found");
    }
    return projectCommuterSelf(commuter);
  },
});

/**
 * The passenger on a ride the caller takes part in. Deliberately narrow: the
 * counterpart never sees the passenger's email or saved home addresses.
 */
export const getForRide = query({
  args: { sessionToken: v.string(), rideId: v.id("rides") },
  handler: async (ctx, args) => {
    const { ride } = await requireRideParticipant(
      ctx,
      args.sessionToken,
      args.rideId
    );
    const commuter = await ctx.db.get(ride.commuterId);
    if (!commuter) {
      throw new Error("Commuter profile not found");
    }
    return projectCommuterForCounterpart(commuter);
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
    const commuter = await ctx.db
      .query("commuters")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
    if (!commuter) {
      return null;
    }
    return args.sessionToken
      ? projectCommuterSelf(commuter)
      : projectCommuterPublic(commuter);
  },
});

export const getById = query({
  args: {
    id: v.id("commuters"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireCommuterVisibleOrLegacy(ctx, args.sessionToken, args.id);
    const commuter = await ctx.db.get(args.id);
    if (!commuter) {
      return null;
    }
    return projectCommuterForCounterpart(commuter);
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

export const update = mutation({
  args: {
    sessionToken: v.string(),
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
    await requireCommuterOwnership(ctx, args.sessionToken, args.id);

    const patch: {
      name?: string;
      phone?: string;
      savedLocations?: {
        name: string;
        address: string;
        latitude: number;
        longitude: number;
      }[];
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) {
        throw new Error("Name cannot be empty");
      }
      patch.name = name;
    }
    if (args.phone !== undefined) {
      patch.phone = args.phone;
    }
    if (args.savedLocations !== undefined) {
      patch.savedLocations = args.savedLocations;
    }

    await ctx.db.patch(args.id, patch);
  },
});

export const addSavedLocation = mutation({
  args: {
    sessionToken: v.string(),
    id: v.id("commuters"),
    location: v.object({
      name: v.string(),
      address: v.string(),
      latitude: v.number(),
      longitude: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    await requireCommuterOwnership(ctx, args.sessionToken, args.id);

    const commuter = await ctx.db.get(args.id);
    if (!commuter) {
      throw new Error("Commuter profile not found");
    }

    await ctx.db.patch(args.id, {
      savedLocations: [...commuter.savedLocations, args.location],
      updatedAt: Date.now(),
    });
  },
});
