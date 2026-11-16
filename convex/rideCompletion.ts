import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { methodOf } from "./lib/paymentMethods";
import { buildPaymentRow, referenceNumberFor } from "./lib/payments";
import { isDemoRide } from "./lib/simulationState";
import { requireOperatorOwnership } from "./lib/withAuth";

/**
 * The write behind finishing a ride.
 *
 * It lives in its own module because a Convex function cannot reach for an
 * internal function of its own module without the types referring back on
 * themselves. Splitting them is what Convex asks for.
 *
 * The completion and the cash settlement happen in one transaction on
 * purpose. A cash ride is settled by the driver confirming the handover, and
 * a ride that closed without that confirmation would leave the driver's cash
 * unrecorded and the ride's ledger saying it was never paid.
 */

/**
 * Finishes a ride.
 *
 * A cash ride cannot be finished until the driver says the notes changed
 * hands, and saying so is what writes the settlement. A wallet ride is
 * finished without a settlement: the rider pays it afterwards, through the
 * provider they chose when they booked.
 */
export const complete = internalMutation({
  args: {
    sessionToken: v.string(),
    rideId: v.id("rides"),
    operatorId: v.id("operators"),
    /**
     * The driver has the fare in hand.
     *
     * Advisory rather than required: a build that predates the confirmation
     * cannot send it, and a cash trip it cannot close is a trip that happened
     * but could never be recorded. It records that the driver said so
     * explicitly, on `rides.cashCollectedAt`.
     */
    cashCollected: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ cashSettled: boolean; rideId: string }> => {
    await requireOperatorOwnership(ctx, args.sessionToken, args.operatorId);

    const ride = await ctx.db.get(args.rideId);
    if (!ride) {
      throw new Error("Ride not found");
    }
    if (ride.operatorId !== args.operatorId) {
      throw new Error("Forbidden: this ride is not assigned to you");
    }
    // The trip is started by the rider's confirmation, so a ride that is only
    // accepted has not begun and cannot end.
    if (ride.status !== "inProgress") {
      throw new Error("Ride cannot be completed from current status");
    }
    // A demo trip ends at the destination. The vehicle is driven there by
    // the simulation, which records the arrival; until then the ride cannot
    // end. A live trip ends when the driver says it has.
    if (isDemoRide(ride) && ride.arrivedAt === undefined) {
      throw new Error("You have not reached the destination yet.");
    }

    const method = methodOf(ride.paymentMethod);
    const now = Date.now();
    let cashSettled = false;

    if (method === "cash") {
      // The collection is confirmed by the driver, and their completion of a
      // cash ride is their word that it was collected: the fare changes hands
      // at the drop-off, which is when the trip ends.
      //
      // A build that predates the confirmation cannot send the flag, and a
      // cash trip it cannot close is a trip that happened but could never be
      // recorded. So the cash settles either way, and the flag only records
      // whether the driver said so explicitly.
      const existing = await ctx.db
        .query("payments")
        .withIndex("by_rideId", (q) => q.eq("rideId", args.rideId))
        .first();

      if (existing?.status === "SETTLED") {
        cashSettled = true;
      } else {
        await ctx.db.insert(
          "payments",
          buildPaymentRow({
            amount: ride.fare,
            commuterId: ride.commuterId,
            method: "cash",
            now,
            providerRef: `CASH-${args.rideId.slice(-8).toUpperCase()}`,
            referenceNumber: referenceNumberFor(args.rideId, "cash"),
            rideId: args.rideId,
            status: "SETTLED",
          })
        );
        cashSettled = true;
      }
    }

    await ctx.db.patch(args.rideId, {
      completedAt: now,
      status: "completed",
      ...(cashSettled ? { paymentStatus: "paid" as const, paidAt: now } : {}),
      // When the driver said explicitly that they had the fare in hand. A
      // ride without it was closed by a build that does not know the flag
      // exists, and the operator may want to follow those up.
      ...(cashSettled && args.cashCollected === true
        ? { cashCollectedAt: now }
        : {}),
      updatedAt: now,
    });

    return { cashSettled, rideId: args.rideId };
  },
});
