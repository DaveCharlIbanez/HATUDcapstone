import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, mutation, query } from "./_generated/server";
import { isApproved } from "./lib/approval";
import { driverIsStillOnTheWay } from "./lib/arrival";
import { commuterCanCancel } from "./lib/cancellation";
import {
  type FareQuote,
  fareQuoteValidator,
  quoteFare as priceFare,
  VEHICLE_TYPE,
  vehicleTypeFor,
  vehicleTypeValidator,
} from "./lib/fare";
import {
  requireRideAccessOrLegacy,
  requireSelfOrLegacy,
} from "./lib/legacyAccess";
import { legacyStartIsRedundant } from "./lib/legacyClients";
import {
  type PaymentMethod,
  paymentMethodValidator,
} from "./lib/paymentMethods";
import {
  projectCommuterForCounterpart,
  projectCommuterForQueue,
  projectOperatorForCounterpart,
} from "./lib/projections";
import {
  canTransition,
  findActiveCommuterRide,
  findActiveOperatorRide,
  findRecentTripNeedingAttention,
  findRideToRate,
  findTripNeedingAttention,
  hasLiveRide,
  isRideRated,
  type RideStatus,
  rideNeedsRating,
  rideOwesPayment,
} from "./lib/rideState";
import { coordinateValidator } from "./lib/routing";
import { settlementOf } from "./lib/settlement";
import {
  isDemoRide,
  simulatedLocation,
  startRideSimulation,
} from "./lib/simulationState";
import {
  requireAuth,
  requireOperatorOwnership,
  requireRideParticipant,
  resolveActor,
} from "./lib/withAuth";

// ─── Scoped queries ───────────────────────────────────────────────────────────

export type { RideStatus } from "./lib/rideState";

const rideStatusValidator = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("inProgress"),
  v.literal("completed"),
  v.literal("cancelled")
);

export type ActiveRidePartner =
  | ({ kind: "operator" } & ReturnType<typeof projectOperatorForCounterpart>)
  | ({ kind: "commuter" } & ReturnType<typeof projectCommuterForCounterpart>);

/**
 * The caller's own in-flight ride, together with a projected view of the
 * other party. The id of the counterpart is never taken from the client — it
 * is derived from the ride the caller actually owns.
 *
 * A passenger who has no live ride also gets their most recent completed one,
 * so the map can show the trip that has just ended and offer to pay for it.
 */
export const getActiveForMe = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.sessionToken);

    if (actor.role === "commuter") {
      if (!actor.commuterId) {
        return null;
      }
      const ride = await findActiveCommuterRide(ctx, actor.commuterId);
      if (!ride) {
        // Only a trip that has just finished is surfaced. One that was
        // settled days ago is not what should greet somebody when they open
        // the app, and putting it back in front of them left the map
        // claiming a ride was complete for a trip they had never taken.
        const latestCompleted = await findRecentTripNeedingAttention(
          ctx,
          actor.commuterId,
          Date.now()
        );
        return latestCompleted
          ? { ride: null, partner: null, latestCompleted }
          : null;
      }
      const operator = ride.operatorId
        ? await ctx.db.get(ride.operatorId)
        : null;
      const partner = operator
        ? {
            kind: "operator" as const,
            ...projectOperatorForCounterpart(operator),
          }
        : null;
      return { ride, partner, latestCompleted: null };
    }

    if (actor.role === "operator") {
      if (!actor.operatorId) {
        return null;
      }
      const ride = await findActiveOperatorRide(ctx, actor.operatorId);
      if (!ride) {
        return null;
      }
      const commuter = await ctx.db.get(ride.commuterId);
      const partner = commuter
        ? {
            kind: "commuter" as const,
            ...projectCommuterForCounterpart(commuter),
          }
        : null;
      return { ride, partner, latestCompleted: null };
    }

    throw new Error("Forbidden: this role does not have an active ride");
  },
});

/**
 * The live position of the other party on a ride the caller takes part in.
 */
export const getPartnerLocation = query({
  args: { sessionToken: v.string(), rideId: v.id("rides") },
  handler: async (ctx, args) => {
    const { actor, ride } = await requireRideParticipant(
      ctx,
      args.sessionToken,
      args.rideId
    );

    // During the trip both people are in the simulated vehicle, so its
    // position stands in for both of theirs.
    const simulated = await simulatedLocation(ctx, ride);
    const operatorLocation = simulated ?? ride.operatorLocation ?? null;
    const commuterLocation = simulated ?? ride.commuterLocation ?? null;

    if (actor.role === "admin") {
      return { operatorLocation, commuterLocation };
    }

    if (actor.role === "commuter") {
      return { operatorLocation };
    }

    return { commuterLocation };
  },
});

/**
 * The price of a trip before it is booked, for every vehicle class.
 *
 * The distance is measured by the router — the same one whose route the
 * passenger is shown on the map — so the quote and the route agree, and the
 * same measurement is used again when the ride is created. That is what
 * stops the passenger being quoted one price and charged another.
 *
 * This is an action because it makes a network call, and a Convex action is
 * the only kind of function that can.
 */
export const quoteFare = action({
  args: {
    sessionToken: v.string(),
    pickup: coordinateValidator,
    dropoff: coordinateValidator,
  },
  returns: v.object({
    distanceKm: v.number(),
    source: v.union(v.literal("router"), v.literal("estimate")),
    standard: fareQuoteValidator,
    /**
     * The quote for the ride type the Android builds that predate the single
     * ride type ask for.
     *
     * They read this for a card they are about to stop offering, and they
     * read it as `quote.priority.fare` — so it has to be there, or their map
     * screen throws when it draws that card. It is the same fare, because
     * there is only one fare.
     */
    priority: fareQuoteValidator,
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    distanceKm: number;
    source: "router" | "estimate";
    standard: FareQuote;
    priority: FareQuote;
  }> => {
    await ctx.runQuery(internal.rideBooking.assertAuthorized, {
      sessionToken: args.sessionToken,
    });

    const distance = await ctx.runAction(internal.routeDistances.getOrFetch, {
      pickup: args.pickup,
      dropoff: args.dropoff,
    });

    const standard = priceFare(VEHICLE_TYPE, distance.distanceKm);

    return {
      distanceKm: distance.distanceKm,
      source: distance.source,
      standard,
      priority: standard,
    };
  },
});

/**
 * The caller's most recent completed ride, used for payment and feedback.
 */
/**
 * The finished trip that still needs something from the passenger.
 *
 * This is the dashboard's business: it is where the things waiting for you
 * belong. The map only carries a trip that has just ended.
 */
export const getTripNeedingAttention = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.sessionToken);
    if (actor.role !== "commuter" || !actor.commuterId) {
      throw new Error("Forbidden: only passengers have trips to settle");
    }

    const now = Date.now();
    const trip = await findTripNeedingAttention(ctx, actor.commuterId, now);
    if (!trip) {
      return null;
    }

    return {
      dropoffAddress: trip.dropoff.address,
      fare: trip.fare,
      needsPayment: rideOwesPayment(trip),
      needsRating: await rideNeedsRating(ctx, trip, now),
      pickupAddress: trip.pickup.address,
      rideId: trip._id,
      status: trip.status,
    };
  },
});

export const getLatestCompletedForMe = query({
  args: {
    sessionToken: v.string(),
    /**
     * A specific ride to rate.
     *
     * The rating page is reached from the payment page, which knows which
     * trip was just paid for. Without this the page picked the newest
     * finished trip, which was often a different one.
     */
    rideId: v.optional(v.id("rides")),
  },
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.sessionToken);
    if (actor.role !== "commuter" || !actor.commuterId) {
      throw new Error("Forbidden: only passengers have completed rides");
    }

    if (args.rideId) {
      const ride = await ctx.db.get(args.rideId);
      if (!ride || ride.commuterId !== actor.commuterId) {
        throw new Error("Forbidden: this ride does not belong to you");
      }
      if (ride.status !== "completed") {
        throw new Error("Only a completed ride can be rated");
      }
      return ride;
    }

    // Otherwise the trip the passenger is being asked to rate — their newest
    // one, if it has not been rated or skipped.
    return await findRideToRate(ctx, actor.commuterId, Date.now());
  },
});

/**
 * The passenger chose not to rate a trip.
 *
 * Rating is optional. Without this, "Skip for now" saved nothing and the
 * dashboard asked again on every visit.
 */
export const dismissRatingPrompt = mutation({
  args: {
    sessionToken: v.string(),
    rideId: v.id("rides"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.sessionToken);
    const ride = await ctx.db.get(args.rideId);
    if (
      !ride ||
      actor.role !== "commuter" ||
      ride.commuterId !== actor.commuterId
    ) {
      throw new Error("Forbidden: this ride does not belong to you");
    }
    if (ride.status !== "completed") {
      throw new Error("Only a completed ride can be rated");
    }
    if (
      ride.ratingDismissedAt !== undefined ||
      (await isRideRated(ctx, ride._id))
    ) {
      return null;
    }
    await ctx.db.patch(args.rideId, { ratingDismissedAt: Date.now() });
    return null;
  },
});

/**
 * The open requests a driver can take.
 *
 * The queue belongs to the driver, not to the deployment: it is the requests
 * that are still unclaimed, minus the ones that are already assigned. A
 * passenger appears here by name only — the phone number belongs to a
 * counterpart on a ride the driver has actually accepted, and handing it out
 * for every open request in the system leaked it to every driver.
 */
export const listPendingForMe = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.sessionToken);
    if (actor.role !== "operator" || !actor.operatorId) {
      throw new Error("Forbidden: only drivers have a ride queue");
    }

    const pendingRides = await ctx.db
      .query("rides")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .collect();

    // A pending ride that already names a driver is an inconsistent row — it
    // is not claimable, and it must not sit in the queue forever.
    const claimable = pendingRides.filter(
      (ride) => ride.operatorId === undefined
    );

    const withCommuter = await Promise.all(
      claimable.map(async (ride) => {
        const commuter = await ctx.db.get(ride.commuterId);
        return {
          ...ride,
          commuter: commuter ? projectCommuterForQueue(commuter) : null,
        };
      })
    );

    return withCommuter;
  },
});

// ─── Legacy compatibility ─────────────────────────────────────────────────────
// Superseded by getActiveForMe / getPartnerLocation. Kept only for the Android
// builds that predate session-token auth. See convex/lib/legacyAccess.ts.

export const getActiveByCommuter = query({
  args: {
    commuterId: v.id("commuters"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const commuter = await ctx.db.get(args.commuterId);
    if (!commuter) {
      return null;
    }
    await requireSelfOrLegacy(ctx, args.sessionToken, commuter.userId);
    const rides = await ctx.db
      .query("rides")
      .withIndex("by_commuterId", (q) => q.eq("commuterId", args.commuterId))
      .order("desc")
      .collect();
    return (
      rides.find(
        (r) =>
          r.status === "pending" ||
          r.status === "accepted" ||
          r.status === "inProgress"
      ) ?? null
    );
  },
});

export const getActiveByOperator = query({
  args: {
    operatorId: v.id("operators"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const operator = await ctx.db.get(args.operatorId);
    if (!operator) {
      return null;
    }
    await requireSelfOrLegacy(ctx, args.sessionToken, operator.userId);
    const rides = await ctx.db
      .query("rides")
      .withIndex("by_operatorId", (q) => q.eq("operatorId", args.operatorId))
      .order("desc")
      .collect();
    return (
      rides.find((r) => r.status === "accepted" || r.status === "inProgress") ??
      null
    );
  },
});

export const getOperatorLocation = query({
  args: {
    rideId: v.id("rides"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { ride } = await requireRideAccessOrLegacy(
      ctx,
      args.sessionToken,
      args.rideId
    );
    return ride.operatorLocation ?? null;
  },
});

export const getCommuterLocation = query({
  args: {
    rideId: v.id("rides"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { ride } = await requireRideAccessOrLegacy(
      ctx,
      args.sessionToken,
      args.rideId
    );
    return ride.commuterLocation ?? null;
  },
});

// ─── Booking ───────────────────────────────────────────────────────────────────

/**
 * Books a ride.
 *
 * The fare is charged on the road distance the router measured — the same
 * measurement behind the quote the passenger was shown, so the two cannot
 * disagree. Measuring it needs a network call, and a Convex action is the
 * only kind of function that can make one, so the booking is an action and
 * the write is done by an internal mutation.
 */
export const create = action({
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
    /**
     * The ride type the rider asked for.
     *
     * There is one ride type, so this is not really a choice — it is here
     * because the Android builds that predate it send it. It is booked as the
     * ride that exists either way.
     */
    vehicleType: v.optional(vehicleTypeValidator),
    // The method the rider chose when they booked. It is fixed for the life
    // of the ride: the driver has to know before they accept whether they are
    // collecting cash.
    //
    // Optional because the Android builds that predate the choice cannot send
    // one — see `convex/lib/legacyClients.ts`. A build that does send it
    // always has it honoured.
    paymentMethod: v.optional(paymentMethodValidator),
    // Retained only so that builds which predate server-side pricing keep
    // working. The value is ignored: the fare is always computed here and
    // locked in at booking time.
    fare: v.optional(v.number()),
    distance: v.optional(v.number()),
    /**
     * Book a demo trip: once it starts, the server drives the vehicle along
     * the road instead of following GPS. Left out, the trip is live — which
     * is what the builds that predate the choice book.
     */
    demoMode: v.optional(v.boolean()),
  },
  returns: v.object({
    rideId: v.id("rides"),
    reused: v.boolean(),
    /**
     * Whether the ride is a demo trip. A booking that reused a live ride
     * keeps that ride's mode, so the client is told which one is in force.
     */
    demoMode: v.boolean(),
    /**
     * The method the ride is settled by.
     *
     * A booking that reused a live ride keeps the method that ride already
     * had, so the client is told which one is really in force.
     */
    paymentMethod: paymentMethodValidator,
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    rideId: Id<"rides">;
    reused: boolean;
    demoMode: boolean;
    paymentMethod: PaymentMethod;
  }> => {
    // The check happens before the router is asked, so an unauthorised
    // caller cannot spend the router's budget. The write checks again, in a
    // transaction, where it counts.
    await ctx.runQuery(internal.rideBooking.assertAuthorized, {
      commuterId: args.commuterId,
      sessionToken: args.sessionToken,
    });

    const distance = await ctx.runAction(internal.routeDistances.getOrFetch, {
      pickup: {
        latitude: args.pickup.latitude,
        longitude: args.pickup.longitude,
      },
      dropoff: {
        latitude: args.dropoff.latitude,
        longitude: args.dropoff.longitude,
      },
    });

    return await ctx.runMutation(internal.rideBooking.insert, {
      commuterId: args.commuterId,
      demoMode: args.demoMode,
      distanceKm: distance.distanceKm,
      dropoff: args.dropoff,
      paymentMethod: args.paymentMethod,
      pickup: args.pickup,
      sessionToken: args.sessionToken,
      vehicleType: vehicleTypeFor(args.vehicleType),
    });
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

export const updateStatus = mutation({
  args: {
    sessionToken: v.string(),
    id: v.id("rides"),
    status: rideStatusValidator,
  },
  handler: async (ctx, args) => {
    const { userId, role } = await requireAuth(ctx, args.sessionToken);

    const ride = await ctx.db.get(args.id);
    if (!ride) {
      throw new Error("Ride not found");
    }

    // A driver on a build that predates the passenger-started trip taps
    // "Picked up" after the passenger has confirmed, and the ride is already
    // under way. The tap has to succeed: an error for a trip that is running
    // correctly sends the driver looking for a problem that is not there.
    if (legacyStartIsRedundant(role, ride, args.status)) {
      return;
    }

    // Role-based status whitelist
    const allowed = allowedStatusesFor(role);

    if (!allowed.includes(args.status)) {
      throw new Error(`Forbidden: ${role} cannot set status to ${args.status}`);
    }

    // The status a ride came from decides where it may go next. Without this
    // a ride could be completed without ever being in progress, and a live
    // ride could be walked back to `accepted`.
    if (!canTransition(ride.status, args.status)) {
      throw new Error(
        `A ride that is ${ride.status} cannot become ${args.status}.`
      );
    }

    // fixoct45: the driver cannot start a trip the passenger has not
    // confirmed. The operator screen showed "Start trip" greyed out but still
    // clickable, and this mutation accepted the tap, so a ride could begin
    // without the passenger. A no-show is handled by `rides.cancel`.
    if (
      role === "operator" &&
      args.status === "inProgress" &&
      ride.confirmedAt === undefined
    ) {
      throw new Error(
        "The passenger has not confirmed the pickup yet, so the trip cannot start."
      );
    }

    // Operators can only update rides assigned to them
    if (role === "operator") {
      const operator = await ctx.db
        .query("operators")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (!operator || ride.operatorId !== operator._id) {
        throw new Error("Forbidden: this ride is not assigned to you");
      }
    }

    // Commuters can only cancel their own rides
    if (role === "commuter") {
      const commuter = await ctx.db
        .query("commuters")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (!commuter || ride.commuterId !== commuter._id) {
        throw new Error("Forbidden: this ride does not belong to you");
      }
    }

    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: args.status,
      // A dropped request records when it was dropped. `updatedAt` cannot be
      // used for this: it is bumped by every unrelated patch on the ride.
      ...(args.status === "cancelled" ? { cancelledAt: now } : {}),
      // An admin moving a ride to accepted starts the passenger's window too.
      ...(args.status === "accepted" ? { acceptedAt: now } : {}),
      updatedAt: now,
    });

    // The driver started the trip: the vehicle sets off along the road.
    if (args.status === "inProgress") {
      await startRideSimulation(ctx, ride);
    }
  },
});

export const accept = mutation({
  args: {
    sessionToken: v.string(),
    id: v.id("rides"),
    operatorId: v.id("operators"),
  },
  handler: async (ctx, args) => {
    await requireOperatorOwnership(ctx, args.sessionToken, args.operatorId);

    const ride = await ctx.db.get(args.id);
    if (!ride) {
      throw new Error("Ride not found");
    }
    if (ride.status !== "pending") {
      throw new Error("This request was already taken by another driver.");
    }

    const operator = await ctx.db.get(args.operatorId);
    if (!operator) {
      throw new Error("Operator not found");
    }

    if (!isApproved(operator)) {
      throw new Error("Forbidden: your account is not approved yet.");
    }

    // A driver may only hold one live ride at a time.
    if (await hasLiveRide(ctx, args.operatorId)) {
      throw new Error("Finish your current ride before taking another.");
    }

    // Being on shift is the driver's own decision, and it is separate from
    // being busy. The message says so, because the previous wording made an
    // off-shift driver believe another driver had taken their ride.
    if (!operator.isAvailable) {
      throw new Error("Go online to start taking rides.");
    }

    const now = Date.now();
    await ctx.db.patch(args.id, {
      operatorId: args.operatorId,
      status: "accepted",
      // Starts the passenger's one-minute window to cancel (fixoct46).
      acceptedAt: now,
      updatedAt: now,
    });

    // `isAvailable` is the driver's shift flag and is deliberately not
    // touched here: taking a ride must not take the driver offline, and
    // completing it must not put them back on shift.
  },
});

/**
 * A ride the driver has just finished, and where its payment stands
 * (fixoct48).
 *
 * Once the driver ends a trip it leaves `getActiveForMe`, so the driver's map
 * had nothing left to show: no "ride completed", and no way to see whether a
 * GCash or Maya passenger had paid. The screen asks for the ride it has just
 * completed, by id, and this follows its payment live.
 */
export const getFinishedForOperator = query({
  args: {
    sessionToken: v.string(),
    rideId: v.id("rides"),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("rides"),
      completedAt: v.optional(v.number()),
      demoMode: v.optional(v.boolean()),
      dropoffAddress: v.string(),
      fare: v.number(),
      paidAt: v.optional(v.number()),
      passengerName: v.optional(v.string()),
      paymentMethod: v.optional(v.string()),
      pickupAddress: v.string(),
      settlement: v.union(
        v.literal("cashCollected"),
        v.literal("awaitingPayment"),
        v.literal("paid"),
        v.literal("failed")
      ),
    })
  ),
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.sessionToken);
    if (actor.role !== "operator" || !actor.operatorId) {
      throw new Error("Forbidden: only drivers have finished rides to watch");
    }
    // Another driver's ride reads as nothing, not as an error: the screen
    // remembers the ride it finished across reloads, and a remembered id
    // from a different account must not crash the map. Nothing is revealed.
    const ride = await ctx.db.get(args.rideId);
    if (!ride || ride.operatorId !== actor.operatorId) {
      return null;
    }
    if (ride.status !== "completed") {
      return null;
    }
    const commuter = await ctx.db.get(ride.commuterId);
    return {
      _id: ride._id,
      ...(ride.completedAt === undefined
        ? {}
        : { completedAt: ride.completedAt }),
      ...(ride.demoMode === undefined ? {} : { demoMode: ride.demoMode }),
      dropoffAddress: ride.dropoff.address,
      fare: ride.fare,
      ...(ride.paidAt === undefined ? {} : { paidAt: ride.paidAt }),
      ...(commuter ? { passengerName: commuter.name } : {}),
      ...(ride.paymentMethod === undefined
        ? {}
        : { paymentMethod: ride.paymentMethod }),
      pickupAddress: ride.pickup.address,
      settlement: settlementOf(ride),
    };
  },
});

/**
 * The server's clock (fixoct47).
 *
 * The passenger's cancel window is measured from `acceptedAt`, which is
 * server time. A phone whose clock runs ahead of the server's by a minute or
 * more used to see the window as closed the moment the driver accepted. The
 * screen calls this once to learn its offset from the server.
 *
 * It is a mutation, not a query: a query must not read the wall clock, and
 * its result would be cached.
 */
export const serverTime = mutation({
  args: {},
  returns: v.number(),
  handler: async () => Date.now(),
});

export const cancel = mutation({
  args: {
    sessionToken: v.string(),
    id: v.id("rides"),
  },
  handler: async (ctx, args) => {
    const { userId, role } = await requireAuth(ctx, args.sessionToken);

    const ride = await ctx.db.get(args.id);
    if (!ride) {
      throw new Error("Ride not found");
    }

    // Admins can cancel any ride; commuters/operators can only cancel their own
    if (role !== "admin") {
      const commuter = await ctx.db.get(ride.commuterId);
      const operator = ride.operatorId
        ? await ctx.db.get(ride.operatorId)
        : null;
      const isCommuterOwner = commuter?.userId === userId;
      const isOperatorOwner = operator?.userId === userId;
      if (!(isCommuterOwner || isOperatorOwner)) {
        throw new Error("Forbidden: you cannot cancel this ride");
      }

      // fixoct46: a passenger may cancel while no driver has taken the ride,
      // and for one minute after a driver accepts. After that the driver is
      // already on the way, and the passenger's screen has disabled the
      // button. The driver is not bound by this — they cancel a no-show.
      if (
        isCommuterOwner &&
        !isOperatorOwner &&
        !commuterCanCancel(ride, Date.now())
      ) {
        throw new Error(
          ride.status === "accepted"
            ? "The 1-minute window to cancel has passed. Your driver is on the way."
            : `A ride that is ${ride.status} can no longer be cancelled.`
        );
      }
    }

    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: "cancelled",
      cancelledAt: now,
      updatedAt: now,
    });

    // The driver's shift is not touched. Whether they are on shift is their
    // own decision, and it used to be rewritten here — so a driver who
    // cancelled a ride silently went back on shift, and a driver who completed
    // one silently went offline.
  },
});

/**
 * Finishes a ride.
 *
 * The trip is started by the rider's confirmation, so a ride that is only
 * accepted has not begun and cannot end. A cash ride is settled by the driver
 * confirming the handover, and the completion and that settlement are one
 * transaction — the write lives in `convex/rideCompletion.ts`.
 */
export const complete = mutation({
  args: {
    sessionToken: v.string(),
    id: v.id("rides"),
    operatorId: v.id("operators"),
    /** The driver has the fare in hand. Required for a cash ride. */
    cashCollected: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.rideCompletion.complete, {
      operatorId: args.operatorId,
      rideId: args.id,
      sessionToken: args.sessionToken,
      ...(args.cashCollected === undefined
        ? {}
        : { cashCollected: args.cashCollected }),
    });

    // The driver's shift is deliberately left alone — see `rides.accept`.
  },
});

/**
 * The passenger confirms the driver, and the ride starts.
 *
 * The confirmation used to be a local animation on the passenger's screen
 * that never reached the server, so the driver had no way of knowing the
 * passenger was ready and the "arriving" phase existed nowhere but the UI.
 * It now starts the ride: the trip is under way once the passenger confirms,
 * and the driver does not have a separate step for it.
 *
 * A confirmation that arrives while the driver is demonstrably still on the
 * way is refused, because the ride becoming `inProgress` switches the road
 * drawn on both maps from the pickup to the drop-off — and a driver three
 * kilometres away would be sent to the wrong place. A driver whose position
 * is missing or stale is not judged: a missing fix must never lock a
 * passenger out of a trip.
 */
export const confirm = mutation({
  args: {
    sessionToken: v.string(),
    id: v.id("rides"),
  },
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.sessionToken);
    if (actor.role !== "commuter" || !actor.commuterId) {
      throw new Error("Forbidden: only passengers can confirm a ride");
    }

    const ride = await ctx.db.get(args.id);
    if (!ride) {
      throw new Error("Ride not found");
    }
    if (ride.commuterId !== actor.commuterId) {
      throw new Error("Forbidden: this ride does not belong to you");
    }

    // Confirming twice is not a mistake to punish: the button can be pressed
    // twice, and the retry after a slow connection is not a second ride.
    //
    // A driver may have started the trip already, and the passenger's
    // confirmation then records that they are in the car. Either order ends
    // with the same two facts on the ride.
    if (ride.status === "inProgress") {
      if (ride.confirmedAt === undefined) {
        const now = Date.now();
        await ctx.db.patch(args.id, { confirmedAt: now, updatedAt: now });
      }
      return;
    }
    if (ride.status !== "accepted") {
      throw new Error(`A ride that is ${ride.status} cannot be confirmed.`);
    }

    // The lifecycle table is the only description of where a ride may go, and
    // this is the one place the passenger writes a status.
    if (!canTransition(ride.status, "inProgress")) {
      throw new Error(
        `A ride that is ${ride.status} cannot become inProgress.`
      );
    }

    if (driverIsStillOnTheWay(ride)) {
      throw new Error("Your driver is still on the way.");
    }

    const now = Date.now();
    await ctx.db.patch(args.id, {
      confirmedAt: now,
      status: "inProgress",
      updatedAt: now,
    });

    // The trip has begun: the vehicle sets off along the road.
    await startRideSimulation(ctx, ride);
  },
});

export const updateOperatorLocation = mutation({
  args: {
    sessionToken: v.string(),
    rideId: v.id("rides"),
    latitude: v.number(),
    longitude: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId, role } = await requireAuth(ctx, args.sessionToken);

    const ride = await ctx.db.get(args.rideId);
    if (!ride) {
      throw new Error("Ride not found");
    }

    if (role !== "operator" && role !== "admin") {
      throw new Error("Forbidden: only operators can update operator location");
    }

    if (role === "operator") {
      const operator = await ctx.db
        .query("operators")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (!operator || ride.operatorId !== operator._id) {
        throw new Error("Forbidden: this ride is not assigned to you");
      }
    }

    // During a demo trip the vehicle is driven along the road by the
    // simulation, and a GPS fix would drag it off. The write is ignored
    // rather than refused, so the older builds that keep sending carry on.
    // A live trip keeps following GPS.
    if (ride.status === "inProgress" && isDemoRide(ride)) {
      return;
    }

    await ctx.db.patch(args.rideId, {
      operatorLocation: {
        latitude: args.latitude,
        longitude: args.longitude,
        updatedAt: Date.now(),
      },
      updatedAt: Date.now(),
    });
  },
});

export const updateCommuterLocation = mutation({
  args: {
    sessionToken: v.string(),
    rideId: v.id("rides"),
    latitude: v.number(),
    longitude: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId, role } = await requireAuth(ctx, args.sessionToken);

    const ride = await ctx.db.get(args.rideId);
    if (!ride) {
      throw new Error("Ride not found");
    }

    if (role !== "commuter" && role !== "admin") {
      throw new Error("Forbidden: only commuters can update commuter location");
    }

    if (role === "commuter") {
      const commuter = await ctx.db
        .query("commuters")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (!commuter || ride.commuterId !== commuter._id) {
        throw new Error("Forbidden: this ride does not belong to you");
      }
    }

    // During a demo trip the vehicle is driven along the road by the
    // simulation, and a GPS fix would drag it off. The write is ignored
    // rather than refused, so the older builds that keep sending carry on.
    // A live trip keeps following GPS.
    if (ride.status === "inProgress" && isDemoRide(ride)) {
      return;
    }

    await ctx.db.patch(args.rideId, {
      commuterLocation: {
        latitude: args.latitude,
        longitude: args.longitude,
        updatedAt: Date.now(),
      },
      updatedAt: Date.now(),
    });
  },
});

// ─── Internal helpers ─────────────────────────────────────────────────────────

const ADMIN_STATUSES: RideStatus[] = [
  "pending",
  "accepted",
  "inProgress",
  "completed",
  "cancelled",
];
// A ride is normally started by the passenger's confirmation, and ended by the
// driver through `rides.complete`, which carries the payment side effects.
//
// fixoct45: the driver can no longer start a ride the passenger has not
// confirmed — `updateStatus` refuses it. "inProgress" stays on this list only
// for the legacy no-op in `legacyStartIsRedundant` and for a ride that is
// already confirmed. A passenger who never shows is cancelled through
// `rides.cancel`, which the driver may call on their own ride.
// Cancellations go through `rides.cancel` so the driver is always released in
// the same place.
const OPERATOR_STATUSES: RideStatus[] = ["inProgress"];
// A passenger cancels through `rides.cancel`, which records when the request
// was dropped.
const COMMUTER_STATUSES: RideStatus[] = ["cancelled"];

function allowedStatusesFor(
  role: "commuter" | "operator" | "admin"
): RideStatus[] {
  if (role === "admin") {
    return ADMIN_STATUSES;
  }
  if (role === "operator") {
    return OPERATOR_STATUSES;
  }
  return COMMUTER_STATUSES;
}
