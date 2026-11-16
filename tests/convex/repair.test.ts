import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { createTest, seedAccount, seedRide } from "./helpers";

// fixoct51 part 2: removing driver accounts that are not real drivers.

const KEY = "test-repair-key";

beforeEach(() => {
  vi.stubEnv("REPAIR_KEY", KEY);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

test("deletes a driver's account and keeps their past rides", async () => {
  const t = createTest();
  const admin = await seedAccount(t, {
    email: "admin@example.com",
    name: "Admin",
    phone: "+639000000601",
    role: "admin",
  });
  const rider = await seedAccount(t, {
    email: "rider@example.com",
    name: "Rider",
    phone: "+639000000602",
    role: "commuter",
  });
  const ghost = await seedAccount(t, {
    email: "ghost@example.com",
    name: "Ghost Driver",
    phone: "+639000000603",
    role: "operator",
  });
  const rideId = await seedRide(t, rider.commuterId, {
    operatorId: ghost.operatorId,
    status: "cancelled",
  });
  await t.mutation(api.presence.heartbeat, {
    sessionToken: ghost.sessionToken,
  });

  const result = await t.mutation(internal.repair.deleteOperatorAccounts, {
    emails: ["ghost@example.com", "nobody@example.com"],
    repairKey: KEY,
  });
  expect(result).toEqual({
    notFound: ["nobody@example.com"],
    removed: [{ email: "ghost@example.com", keptRides: 1 }],
  });

  await t.run(async (ctx) => {
    expect(await ctx.db.get(ghost.userId)).toBeNull();
    expect(await ctx.db.get(ghost.operatorId)).toBeNull();
    expect(await ctx.db.query("presence").collect()).toHaveLength(0);
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", ghost.userId))
      .collect();
    expect(sessions).toHaveLength(0);
    expect(await ctx.db.get(rideId)).not.toBeNull();
  });

  // The dashboard still loads, and the driver is gone from every list.
  const dashboard = await t.query(api.adminQueries.getDashboard, {
    sessionToken: admin.sessionToken,
  });
  expect(dashboard.drivers).toHaveLength(0);
  expect(dashboard.userRoster.operators).toHaveLength(0);
  expect(dashboard.metrics.totalUsers).toBe(1);
});

test("refuses a commuter, a live ride, and a wrong key", async () => {
  const t = createTest();
  const rider = await seedAccount(t, {
    email: "rider@example.com",
    name: "Rider",
    phone: "+639000000611",
    role: "commuter",
  });
  const busy = await seedAccount(t, {
    email: "busy@example.com",
    name: "Busy Driver",
    phone: "+639000000612",
    role: "operator",
  });
  await seedRide(t, rider.commuterId, {
    operatorId: busy.operatorId,
    status: "inProgress",
  });

  await expect(
    t.mutation(internal.repair.deleteOperatorAccounts, {
      emails: ["rider@example.com"],
      repairKey: KEY,
    })
  ).rejects.toThrow("not an operator");
  await expect(
    t.mutation(internal.repair.deleteOperatorAccounts, {
      emails: ["busy@example.com"],
      repairKey: KEY,
    })
  ).rejects.toThrow("has a live ride");
  await expect(
    t.mutation(internal.repair.deleteOperatorAccounts, {
      emails: ["busy@example.com"],
      repairKey: "wrong",
    })
  ).rejects.toThrow("Forbidden");
});
