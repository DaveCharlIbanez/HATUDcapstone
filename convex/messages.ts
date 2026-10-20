import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./lib/withAuth";

const MAX_MESSAGE_LENGTH = 500;
const MESSAGE_RETENTION_DAYS = 3;
const MESSAGE_RETENTION_MS = MESSAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

interface RideAccessResult {
  isAdmin: boolean;
  ride: unknown;
  role: string;
  userId: Id<"users">;
}

async function validateRideAccess(
  ctx: QueryCtx | MutationCtx,
  args: { rideId: Id<"rides">; sessionToken: string }
): Promise<RideAccessResult> {
  const auth = await requireAuth(ctx, args.sessionToken);
  const { userId, role } = auth;

  const ride = await ctx.db.get(args.rideId);
  if (!ride) {
    throw new Error("Ride not found");
  }

  const isCommuter = role === "commuter";
  const isOperator = role === "operator";
  const isAdmin = role === "admin";

  if (isAdmin) {
    return { ride, role, userId, isAdmin: true };
  }

  if (isCommuter) {
    const commuter = await ctx.db
      .query("commuters")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!commuter || ride.commuterId !== commuter._id) {
      throw new Error("Forbidden: you are not part of this ride");
    }
  }

  if (isOperator) {
    const operator = await ctx.db
      .query("operators")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!operator || ride.operatorId !== operator._id) {
      throw new Error("Forbidden: you are not assigned to this ride");
    }
  }

  return { ride, role, userId, isAdmin: false };
}

export const getByRide = query({
  args: {
    rideId: v.id("rides"),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const { isAdmin } = await validateRideAccess(ctx, args);

    const ride = await ctx.db.get(args.rideId);
    if (!ride) {
      throw new Error("Ride not found");
    }

    let messages = await ctx.db
      .query("messages")
      .withIndex("by_rideId", (q) => q.eq("rideId", args.rideId))
      .order("asc")
      .collect();

    if (!isAdmin) {
      const now = Date.now();
      const isRideEnded =
        ride.status === "completed" || ride.status === "cancelled";
      const cutoffTime = isRideEnded
        ? ride.updatedAt + MESSAGE_RETENTION_MS
        : now + MESSAGE_RETENTION_MS;

      messages = messages.filter((msg) => msg.createdAt <= cutoffTime);
    }

    return messages;
  },
});

export const send = mutation({
  args: {
    sessionToken: v.string(),
    rideId: v.id("rides"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const { role, userId } = await validateRideAccess(ctx, args);

    const ride = await ctx.db.get(args.rideId);
    if (!ride) {
      throw new Error("Ride not found");
    }

    if (ride.status !== "accepted" && ride.status !== "inProgress") {
      throw new Error("Cannot send messages for this ride status");
    }

    const sanitizedContent = args.content
      .replace(/<[^>]*>/g, "")
      .trim()
      .slice(0, MAX_MESSAGE_LENGTH);

    if (!sanitizedContent) {
      throw new Error("Message cannot be empty");
    }

    return await ctx.db.insert("messages", {
      rideId: args.rideId,
      senderId: userId,
      senderRole: role as "commuter" | "operator",
      content: sanitizedContent,
      read: false,
      createdAt: Date.now(),
    });
  },
});

export const markAsRead = mutation({
  args: {
    sessionToken: v.string(),
    rideId: v.id("rides"),
  },
  handler: async (ctx, args) => {
    const { role } = await validateRideAccess(ctx, args);

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_rideId", (q) => q.eq("rideId", args.rideId))
      .collect();

    const isCommuter = role === "commuter";
    const otherRole = isCommuter ? "operator" : "commuter";

    for (const msg of messages) {
      if (!msg.read && msg.senderRole === otherRole) {
        await ctx.db.patch(msg._id, { read: true });
      }
    }
  },
});

export const getUnreadCount = query({
  args: {
    rideId: v.id("rides"),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const { isAdmin } = await validateRideAccess(ctx, args);

    const ride = await ctx.db.get(args.rideId);
    if (!ride) {
      throw new Error("Ride not found");
    }

    let messages = await ctx.db
      .query("messages")
      .withIndex("by_rideId", (q) => q.eq("rideId", args.rideId))
      .collect();

    if (!isAdmin) {
      const isRideEnded =
        ride.status === "completed" || ride.status === "cancelled";
      const cutoffTime = isRideEnded
        ? ride.updatedAt + MESSAGE_RETENTION_MS
        : Date.now() + MESSAGE_RETENTION_MS;

      messages = messages.filter((msg) => msg.createdAt <= cutoffTime);
    }

    return messages.filter((m) => !m.read).length;
  },
});
