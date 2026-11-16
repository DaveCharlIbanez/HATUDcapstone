import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import {
  quoteFare,
  VEHICLE_TYPE,
  vehicleTypeFor,
  vehicleTypeValidator,
} from "./lib/fare";
import { bookedMethod } from "./lib/legacyClients";
import { paymentMethodValidator } from "./lib/paymentMethods";
import { findLiveCommuterRide } from "./lib/rideState";
import { isDemoRide } from "./lib/simulationState";
import { requireCommuterOwnership, resolveActor } from "./lib/withAuth";

/**
 * The write behind a booking, and the check that gates it.
 *
 * These live in their own module because a Convex function cannot reach for
 * an internal function of its own module without the types referring back
 * on themselves. Splitting them is what Convex asks for.
 */

/**
 * The write behind a booking.
 *
 * It takes the distance as an argument rather than measuring it, because the
 * measurement was made by the router and the fare has to be charged on that
 * exact number. The client never supplies it.
 */
export const insert = internalMutation({
  args: {
    sessionToken: v.string(),
    commuterId: v.id("commuters"),
    pickup: v.object({
      address: v.string(),
      latitude: v.number(),
      longitude: v.number(),
    }),
    dropoff: v.object({
      address: v.string(),
      latitude: v.number(),
      longitude: v.number(),
    }),
    vehicleType: v.optional(vehicleTypeValidator),
    // Optional: the Android builds that predate the choice cannot send one.
    // See `convex/lib/legacyClients.ts`.
    paymentMethod: v.optional(paymentMethodValidator),
    // Optional: a live trip unless the rider asked for a demo.
    demoMode: v.optional(v.boolean()),
    distanceKm: v.number(),
  },
  handler: async (ctx, args) => {
    await requireCommuterOwnership(ctx, args.sessionToken, args.commuterId);

    // A passenger may only have one live ride. A second request — a double
    // tap, a retry after a slow response, a booking the passenger abandoned
    // by dismissing the sheet — used to create a second pending ride, and the
    // passenger was then attached to the wrong one while a driver drove to the
    // other. Returning the ride they already have makes the mutation safe to
    // retry and repairs the duplicates that are already in the database.
    const existing = await findLiveCommuterRide(ctx, args.commuterId);
    if (existing) {
      return {
        rideId: existing._id,
        reused: true,
        demoMode: isDemoRide(existing),
        paymentMethod: bookedMethod(existing.paymentMethod),
      };
    }

    const quote = quoteFare(VEHICLE_TYPE, args.distanceKm);
    const now = Date.now();

    const rideId = await ctx.db.insert("rides", {
      commuterId: args.commuterId,
      pickup: args.pickup,
      dropoff: args.dropoff,
      vehicleType: vehicleTypeFor(args.vehicleType),
      status: "pending",
      fare: quote.fare,
      distance: quote.distanceKm,
      paymentStatus: "unpaid",
      paymentMethod: bookedMethod(args.paymentMethod),
      // Stored only when asked for, so a live ride looks as it always has.
      ...(args.demoMode === true ? { demoMode: true } : {}),
      createdAt: now,
      updatedAt: now,
    });

    return {
      rideId,
      reused: false,
      demoMode: args.demoMode === true,
      paymentMethod: bookedMethod(args.paymentMethod),
    };
  },
});

/**
 * Confirms the caller may act as a passenger, and may act on this profile.
 *
 * The actions run this before they spend anything on the router.
 */
export const assertAuthorized = internalQuery({
  args: {
    sessionToken: v.string(),
    commuterId: v.optional(v.id("commuters")),
  },
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.sessionToken);
    if (args.commuterId !== undefined) {
      await requireCommuterOwnership(ctx, args.sessionToken, args.commuterId);
    }
    return { commuterId: actor.commuterId ?? null, role: actor.role };
  },
});
