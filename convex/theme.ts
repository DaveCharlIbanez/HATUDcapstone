import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth, resolveSessionOrNull } from "./lib/withAuth";

/**
 * The theme preference of the signed-in user.
 *
 * This deliberately does not throw for an unknown, revoked or expired
 * session: it answers "no preference" instead. The theme provider sits in the
 * root layout, so a throw here would take down the whole app on start-up
 * whenever a stale token was still in local storage.
 */
export const getUserTheme = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const session = await resolveSessionOrNull(ctx, args.sessionToken);
    if (!session) {
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
    const { userId } = await requireAuth(ctx, args.sessionToken);
    await ctx.db.patch(userId, { theme: args.theme });
  },
});
