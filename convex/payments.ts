import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalMutation, query } from "./_generated/server";
import {
  methodOf,
  type PaymentMethod,
  paymentMethodValidator,
} from "./lib/paymentMethods";
import {
  buildPaymentRow,
  type ChargeResult,
  type PaymentCurrency,
  type PaymentStatus,
  referenceNumberFor,
  WALLET_PROVIDERS,
} from "./lib/payments";
import { resolveActor } from "./lib/withAuth";

/**
 * The result of a charge, returned to the client.
 */
export interface ChargeSummary {
  amount: number;
  currency: PaymentCurrency;
  failureReason?: string;
  id: Id<"payments">;
  /** The method the ride was booked with, and therefore the one charged. */
  method: PaymentMethod;
  providerRef: string;
  referenceNumber: string;
  status: PaymentStatus;
}

/**
 * Ride payments.
 *
 * The amount is always taken from the ride record, never from the client, and
 * so is the method: the rider chose it when the ride was booked, and the
 * charge reads it from the ride rather than from the request. A client cannot
 * ask to be charged through a method it did not book.
 *
 * The current providers are GCash and Maya sandboxes; swapping in the real
 * gateways means replacing those implementations in convex/lib/payments.ts and
 * nothing else.
 *
 * The charge runs as an action because a gateway call may take time and may
 * reach out over the network. The action prepares the charge through an
 * internal mutation, talks to the provider, then records the outcome through
 * another internal mutation.
 */

const chargeResultValidator = v.object({
  transactionId: v.string(),
  referenceNumber: v.string(),
  amount: v.number(),
  currency: v.literal("PHP"),
  status: v.union(
    v.literal("PENDING"),
    v.literal("AUTHORIZED"),
    v.literal("SETTLED"),
    v.literal("FAILED"),
    v.literal("EXPIRED"),
    v.literal("REFUNDED")
  ),
  fee: v.number(),
  message: v.optional(v.string()),
});

/**
 * The passenger's most recent completed ride that still owes money, together
 * with any payment already recorded against it.
 *
 * A cash ride is settled by a handover with the driver rather than through the
 * app, so it is reported with its method and the page shows the handover
 * instead of a charge form.
 *
 * With `rideId`, it is that ride, even once it has been paid. The payment
 * page pins the ride it opened on: without that, paying made this query move
 * on to the next unpaid trip, and the "Rate your driver" button sent the
 * passenger to rate an older ride instead of the one they had just taken.
 */
export const getDue = query({
  args: {
    sessionToken: v.string(),
    rideId: v.optional(v.id("rides")),
  },
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.sessionToken);
    if (actor.role !== "commuter" || !actor.commuterId) {
      throw new Error("Forbidden: only passengers have rides to pay for");
    }
    const commuterId = actor.commuterId;

    let due: Doc<"rides"> | null = null;
    if (args.rideId) {
      const ride = await ctx.db.get(args.rideId);
      if (!ride || ride.commuterId !== commuterId) {
        throw new Error("Forbidden: this ride does not belong to you");
      }
      due = ride.status === "completed" ? ride : null;
    } else {
      const rides = await ctx.db
        .query("rides")
        .withIndex("by_commuterId", (q) => q.eq("commuterId", commuterId))
        .order("desc")
        .take(50);
      due =
        rides.find(
          (ride) => ride.status === "completed" && ride.paymentStatus !== "paid"
        ) ?? null;
    }
    if (!due) {
      return null;
    }

    const payment = await ctx.db
      .query("payments")
      .withIndex("by_rideId", (q) => q.eq("rideId", due._id))
      .first();

    return {
      rideId: due._id,
      amount: due.fare,
      distance: due.distance,
      method: methodOf(due.paymentMethod),
      pickupAddress: due.pickup.address,
      dropoffAddress: due.dropoff.address,
      paymentStatus: due.paymentStatus ?? "unpaid",
      lastPayment: payment ?? null,
    };
  },
});

/**
 * The receipt for a paid ride.
 */
export const getByRide = query({
  args: { sessionToken: v.string(), rideId: v.id("rides") },
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.sessionToken);
    if (actor.role !== "commuter" || !actor.commuterId) {
      throw new Error("Forbidden: only passengers have payments");
    }

    const ride = await ctx.db.get(args.rideId);
    if (!ride || ride.commuterId !== actor.commuterId) {
      throw new Error("Forbidden: this ride does not belong to you");
    }

    const payment = await ctx.db
      .query("payments")
      .withIndex("by_rideId", (q) => q.eq("rideId", args.rideId))
      .first();

    return payment ?? null;
  },
});

/**
 * Map a gateway status onto the ride's payment status.
 */
function paymentStatusFor(
  status: PaymentStatus
): "paid" | "pending" | "failed" {
  if (status === "SETTLED") {
    return "paid";
  }
  if (status === "PENDING" || status === "AUTHORIZED") {
    return "pending";
  }
  return "failed";
}

/**
 * The validated amount and reference for a charge.
 */
export interface PreparedCharge {
  amount: number;
  /** The method the ride was booked with — the one that will be charged. */
  method: PaymentMethod;
  referenceNumber: string;
}

/**
 * Validate the charge and work out the amount. No writes happen here.
 */
export const prepare = internalMutation({
  args: { sessionToken: v.string(), rideId: v.id("rides") },
  handler: async (ctx, args): Promise<PreparedCharge> => {
    const actor = await resolveActor(ctx, args.sessionToken);
    if (actor.role !== "commuter" || !actor.commuterId) {
      throw new Error("Forbidden: only passengers pay for a ride");
    }

    const ride = await ctx.db.get(args.rideId);
    if (!ride) {
      throw new Error("Ride not found");
    }
    if (ride.commuterId !== actor.commuterId) {
      throw new Error("Forbidden: this ride does not belong to you");
    }
    if (ride.status !== "completed") {
      throw new Error("A ride can only be paid for once it is complete");
    }

    const method = methodOf(ride.paymentMethod);

    return {
      amount: ride.fare,
      method,
      referenceNumber: referenceNumberFor(args.rideId, method),
    };
  },
});

/**
 * Record the gateway's answer. Re-charging a ride that already settled
 * returns the payment that succeeded instead of creating a second one.
 */
export const record = internalMutation({
  args: {
    sessionToken: v.string(),
    rideId: v.id("rides"),
    method: paymentMethodValidator,
    result: chargeResultValidator,
  },
  handler: async (ctx, args): Promise<ChargeSummary> => {
    const actor = await resolveActor(ctx, args.sessionToken);
    if (actor.role !== "commuter" || !actor.commuterId) {
      throw new Error("Forbidden: only passengers pay for a ride");
    }

    const ride = await ctx.db.get(args.rideId);
    if (!ride || ride.commuterId !== actor.commuterId) {
      throw new Error("Forbidden: this ride does not belong to you");
    }

    const existing = await ctx.db
      .query("payments")
      .withIndex("by_rideId", (q) => q.eq("rideId", args.rideId))
      .first();
    if (existing?.status === "SETTLED") {
      return {
        id: existing._id,
        status: existing.status,
        amount: existing.amount,
        currency: existing.currency,
        method: existing.provider,
        providerRef: existing.providerRef,
        referenceNumber: existing.referenceNumber,
      };
    }

    const now = Date.now();
    const paymentId = await ctx.db.insert(
      "payments",
      buildPaymentRow({
        amount: ride.fare,
        commuterId: actor.commuterId,
        ...(args.result.message === undefined
          ? {}
          : { failureReason: args.result.message }),
        method: args.method,
        now,
        providerRef: args.result.transactionId,
        referenceNumber: args.result.referenceNumber,
        rideId: args.rideId,
        status: args.result.status,
      })
    );

    const paid = args.result.status === "SETTLED";
    await ctx.db.patch(args.rideId, {
      paymentStatus: paymentStatusFor(args.result.status),
      paidAt: paid ? now : undefined,
      updatedAt: now,
    });

    return {
      id: paymentId,
      status: args.result.status,
      amount: ride.fare,
      currency: "PHP" as const,
      method: args.method,
      providerRef: args.result.transactionId,
      referenceNumber: args.result.referenceNumber,
      ...(args.result.message === undefined
        ? {}
        : { failureReason: args.result.message }),
    };
  },
});

/**
 * Charge the fare for a completed ride through the provider the ride was
 * booked with.
 */
export const charge = action({
  args: {
    sessionToken: v.string(),
    rideId: v.id("rides"),
    testNumber: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ChargeSummary> => {
    const prepared = await ctx.runMutation(internal.payments.prepare, {
      sessionToken: args.sessionToken,
      rideId: args.rideId,
    });

    if (prepared.method === "cash") {
      throw new Error(
        "This ride is paid in cash — hand the fare to your driver at the drop-off."
      );
    }

    const provider = WALLET_PROVIDERS[prepared.method];

    const result: ChargeResult = await provider.charge({
      amount: prepared.amount,
      currency: "PHP",
      description: "HATUD ride fare",
      referenceNumber: prepared.referenceNumber,
      ...(args.testNumber === undefined ? {} : { testNumber: args.testNumber }),
    });

    return await ctx.runMutation(internal.payments.record, {
      sessionToken: args.sessionToken,
      rideId: args.rideId,
      method: prepared.method,
      result,
    });
  },
});
