import { expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { createTest, seedAccount } from "./helpers";

/**
 * The theme provider lives in the root layout. If its query threw for a
 * stale token, the failure would escape every error boundary and take the
 * whole app down on start-up — so a read must answer "no preference"
 * instead of failing.
 */
test("the theme query answers null for an expired or unknown session", async () => {
  const t = createTest();

  await expect(
    t.query(api.theme.getUserTheme, { sessionToken: "not-a-session" })
  ).resolves.toBeNull();
});

test("the theme query answers null for a revoked session", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "themed@example.com",
    name: "Theme User",
    phone: "+639000000301",
    role: "commuter",
  });

  await t.run(async (ctx) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", commuter.sessionToken))
      .first();
    if (session) {
      await ctx.db.patch(session._id, { isRevoked: true });
    }
  });

  await expect(
    t.query(api.theme.getUserTheme, { sessionToken: commuter.sessionToken })
  ).resolves.toBeNull();
});

test("the theme query answers null for an expired session", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "themed2@example.com",
    name: "Theme User Two",
    phone: "+639000000302",
    role: "commuter",
  });

  await t.run(async (ctx) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", commuter.sessionToken))
      .first();
    if (session) {
      await ctx.db.patch(session._id, { expiresAt: Date.now() - 1 });
    }
  });

  await expect(
    t.query(api.theme.getUserTheme, { sessionToken: commuter.sessionToken })
  ).resolves.toBeNull();
});

test("the theme query still returns the stored preference", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "themed3@example.com",
    name: "Theme User Three",
    phone: "+639000000303",
    role: "commuter",
  });

  await t.mutation(api.theme.setUserTheme, {
    sessionToken: commuter.sessionToken,
    theme: "dark",
  });

  await expect(
    t.query(api.theme.getUserTheme, { sessionToken: commuter.sessionToken })
  ).resolves.toBe("dark");
});

test("the theme query defaults to light when no preference is set", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "themed4@example.com",
    name: "Theme User Four",
    phone: "+639000000304",
    role: "commuter",
  });

  await expect(
    t.query(api.theme.getUserTheme, { sessionToken: commuter.sessionToken })
  ).resolves.toBe("light");
});
