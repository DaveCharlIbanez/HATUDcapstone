import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getUserTheme = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
      .first();

    if (!session || session.isRevoked || Date.now() > session.expiresAt) {
      return null;
    }

    const user = await ctx.db.get(session.userId);
    if (!user) {
      return null;
    }

    return user.theme ?? "light";
  },
});

export const setUserTheme = mutation({
  args: {
    sessionToken: v.string(),
    theme: v.union(v.literal("light"), v.literal("dark")),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
      .first();

    if (!session || session.isRevoked || Date.now() > session.expiresAt) {
      throw new Error("Invalid or expired session");
    }

    const user = await ctx.db.get(session.userId);
    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(user._id, { theme: args.theme });
  },
});
