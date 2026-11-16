import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { type MutationCtx, mutation } from "./_generated/server";
import { resolveSessionOrNull } from "./lib/withAuth";

/**
 * Who has the app open (fixoct51).
 *
 * `operators.isAvailable` is a driver's shift switch: it stays on when the app
 * is closed, the phone kills it, or the session runs out. Presence is the
 * other half — a heartbeat from every signed-in app — so "online" can mean the
 * app is actually open.
 */

/** A user seen within this window is online. */
export const ONLINE_WINDOW_MS = 2 * 60 * 1000;

/** A beat this soon after the last one is not written. */
const MIN_WRITE_INTERVAL_MS = 20 * 1000;

export const heartbeat = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const session = await resolveSessionOrNull(ctx, args.sessionToken);
    if (!session) {
      // A stale token is not an error worth surfacing on a timer.
      return null;
    }
    const now = Date.now();
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_userId", (q) => q.eq("userId", session.userId))
      .unique();
    if (existing) {
      if (now - existing.lastSeenAt >= MIN_WRITE_INTERVAL_MS) {
        await ctx.db.patch(existing._id, {
          lastSeenAt: now,
          role: session.role,
        });
      }
      return null;
    }
    await ctx.db.insert("presence", {
      lastSeenAt: now,
      role: session.role,
      userId: session.userId,
    });
    return null;
  },
});

/** Marks a user offline at once, e.g. when they log out. */
export async function clearPresence(ctx: MutationCtx, userId: Id<"users">) {
  const rows = await ctx.db
    .query("presence")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(10);
  for (const row of rows) {
    await ctx.db.delete(row._id);
  }
}
