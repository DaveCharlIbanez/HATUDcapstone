import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRideParticipant } from "./lib/withAuth";

const MAX_MESSAGE_LENGTH = 500;
const MESSAGE_RETENTION_DAYS = 3;
const MESSAGE_RETENTION_MS = MESSAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

/**
 * Messages are retained for three days after a ride ends. While a ride is
 * still running every message is visible.
 */
function visibleCutoff(rideStatus: string, rideUpdatedAt: number): number {
  const isRideEnded = rideStatus === "completed" || rideStatus === "cancelled";
  return isRideEnded
    ? rideUpdatedAt + MESSAGE_RETENTION_MS
    : Number.POSITIVE_INFINITY;
}

export const getByRide = query({
  args: {
    rideId: v.id("rides"),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const { ride, isAdmin } = await requireRideParticipant(
      ctx,
      args.sessionToken,
      args.rideId
    );

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_rideId", (q) => q.eq("rideId", args.rideId))
      .order("asc")
      .collect();

    if (isAdmin) {
      return messages;
    }

    const cutoffTime = visibleCutoff(ride.status, ride.updatedAt);
    return messages.filter((msg) => msg.createdAt <= cutoffTime);
  },
});

export const send = mutation({
  args: {
    sessionToken: v.string(),
    rideId: v.id("rides"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const { actor, ride } = await requireRideParticipant(
      ctx,
      args.sessionToken,
      args.rideId
    );

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
      senderId: actor.userId,
      senderRole: actor.role,
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
    const { actor } = await requireRideParticipant(
      ctx,
      args.sessionToken,
      args.rideId
    );

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_rideId", (q) => q.eq("rideId", args.rideId))
      .collect();

    const isCommuter = actor.role === "commuter";
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
    const { ride, isAdmin } = await requireRideParticipant(
      ctx,
      args.sessionToken,
      args.rideId
    );

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_rideId", (q) => q.eq("rideId", args.rideId))
      .collect();

    if (isAdmin) {
      return messages.filter((m) => !m.read).length;
    }

    const cutoffTime = visibleCutoff(ride.status, ride.updatedAt);
    return messages.filter((m) => !m.read && m.createdAt <= cutoffTime).length;
  },
});
