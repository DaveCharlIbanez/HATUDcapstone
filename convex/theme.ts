import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./lib/withAuth";

export const getUserTheme = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx, args.sessionToken);
    const user = await ctx.db.get(userId);
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
    const { userId } = await requireAuth(ctx, args.sessionToken);
    await ctx.db.patch(userId, { theme: args.theme });
  },
});
