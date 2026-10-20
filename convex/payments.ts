import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, query } from "./_generated/server";
import {
  gcashSandbox,
  type PaymentCurrency,
  type PaymentStatus,
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
  providerRef: string;
  referenceNumber: string;
  status: PaymentStatus;
}

/**
 * Ride payments.
 *
 * The amount is always taken from the ride record, never from the client.
 * The current provider is a GCash sandbox; swapping in the real gateway means
 * replacing the provider implementation in convex/lib/payments.ts and nothing
 * else.
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
 */
export const getDue = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.sessionToken);
    if (actor.role !== "commuter" || !actor.commuterId) {
      throw new Error("Forbidden: only passengers have rides to pay for");
    }
    const commuterId = actor.commuterId;

    const rides = await ctx.db
      .query("rides")
      .withIndex("by_commuterId", (q) => q.eq("commuterId", commuterId))
      .order("desc")
      .collect();

    const due = rides.find(
      (ride) => ride.status === "completed" && ride.paymentStatus !== "paid"
    );
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

    return {
      amount: ride.fare,
      referenceNumber: `HATUD-${args.rideId.slice(-8).toUpperCase()}`,
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
        providerRef: existing.providerRef,
        referenceNumber: existing.referenceNumber,
      };
    }

    const now = Date.now();
    const paymentId = await ctx.db.insert("payments", {
      rideId: args.rideId,
      commuterId: actor.commuterId,
      amount: ride.fare,
      currency: "PHP",
      provider: "gcash",
      providerRef: args.result.transactionId,
      referenceNumber: args.result.referenceNumber,
      status: args.result.status,
      ...(args.result.message === undefined
        ? {}
        : { failureReason: args.result.message }),
      createdAt: now,
      updatedAt: now,
    });

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
      providerRef: args.result.transactionId,
      referenceNumber: args.result.referenceNumber,
      ...(args.result.message === undefined
        ? {}
        : { failureReason: args.result.message }),
    };
  },
});

/**
 * Charge the fare for a completed ride through the configured provider.
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

    const result = await gcashSandbox.charge({
      amount: prepared.amount,
      currency: "PHP",
      description: "HATUD ride fare",
      referenceNumber: prepared.referenceNumber,
      ...(args.testNumber === undefined ? {} : { testNumber: args.testNumber }),
    });

    return await ctx.runMutation(internal.payments.record, {
      sessionToken: args.sessionToken,
      rideId: args.rideId,
      result,
    });
  },
});
