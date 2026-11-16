import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { ONLINE_WINDOW_MS } from "../../convex/presence";
import { createTest, seedAccount } from "./helpers";

// fixoct51: "Active Drivers" counted every driver whose shift switch was on,
// including ones whose app had been closed for weeks.

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

async function seedFleet(t: ReturnType<typeof createTest>) {
  const admin = await seedAccount(t, {
    email: "admin@example.com",
    name: "Admin",
    phone: "+639000000501",
    role: "admin",
  });
  const rider = await seedAccount(t, {
    email: "rider@example.com",
    name: "Rider",
    phone: "+639000000502",
    role: "commuter",
  });
  const idleRider = await seedAccount(t, {
    email: "idle@example.com",
    name: "Idle Rider",
    phone: "+639000000503",
    role: "commuter",
  });
  // Three drivers, all with the shift switch on, as on the live deployment.
  const onDriver = await seedAccount(t, {
    email: "on@example.com",
    name: "On Driver",
    phone: "+639000000504",
    role: "operator",
  });
  const closedApp = await seedAccount(t, {
    email: "closed@example.com",
    name: "Closed App",
    phone: "+639000000505",
    role: "operator",
  });
  const neverSeen = await seedAccount(t, {
    email: "never@example.com",
    name: "Never Seen",
    phone: "+639000000506",
    role: "operator",
  });
  return { admin, closedApp, idleRider, neverSeen, onDriver, rider };
}

test("only drivers on shift with the app open count as active", async () => {
  const t = createTest();
  const fleet = await seedFleet(t);

  // The closed app beat once, long ago.
  await t.mutation(api.presence.heartbeat, {
    sessionToken: fleet.closedApp.sessionToken,
  });
  vi.advanceTimersByTime(ONLINE_WINDOW_MS + 60_000);
  await t.mutation(api.presence.heartbeat, {
    sessionToken: fleet.onDriver.sessionToken,
  });
  await t.mutation(api.presence.heartbeat, {
    sessionToken: fleet.rider.sessionToken,
  });

  const dashboard = await t.query(api.adminQueries.getDashboard, {
    sessionToken: fleet.admin.sessionToken,
  });

  expect(dashboard.metrics.activeDrivers).toBe(1);
  const byName = new Map(dashboard.drivers.map((d) => [d.name, d]));
  expect(byName.get("On Driver")?.isOnline).toBe(true);
  expect(byName.get("Closed App")?.isOnline).toBe(false);
  expect(byName.get("Closed App")?.lastSeenAt).not.toBeNull();
  expect(byName.get("Never Seen")?.isOnline).toBe(false);
  expect(byName.get("Never Seen")?.lastSeenAt).toBeNull();

  // Active users: one commuter and one operator, out of 2 + 3 accounts.
  expect(dashboard.metrics.activeUsers).toBe(2);
  expect(dashboard.metrics.totalUsers).toBe(5);
  // The roster lists everyone, online first.
  const { commuters, operators } = dashboard.userRoster;
  expect(commuters.map((u) => [u.name, u.isOnline])).toEqual([
    ["Rider", true],
    ["Idle Rider", false],
  ]);
  expect(operators.map((u) => [u.name, u.isOnline])).toEqual([
    ["On Driver", true],
    ["Closed App", false],
    ["Never Seen", false],
  ]);
  expect(operators[0]?.isAvailable).toBe(true);
  expect(operators[1]?.lastSeenAt).not.toBeNull();
  expect(operators[2]?.lastSeenAt).toBeNull();
  expect(commuters.every((u) => u.role === "commuter")).toBe(true);
});

test("an online driver goes stale once the heartbeats stop", async () => {
  const t = createTest();
  const fleet = await seedFleet(t);
  await t.mutation(api.presence.heartbeat, {
    sessionToken: fleet.onDriver.sessionToken,
  });
  const before = await t.query(api.adminQueries.getDashboard, {
    sessionToken: fleet.admin.sessionToken,
  });
  expect(before.metrics.activeDrivers).toBe(1);

  vi.advanceTimersByTime(ONLINE_WINDOW_MS + 1000);
  const after = await t.query(api.adminQueries.getDashboard, {
    sessionToken: fleet.admin.sessionToken,
  });
  expect(after.metrics.activeDrivers).toBe(0);
  expect(after.metrics.activeUsers).toBe(0);
});

test("logging out takes a driver offline and off shift", async () => {
  const t = createTest();
  const fleet = await seedFleet(t);
  await t.mutation(api.presence.heartbeat, {
    sessionToken: fleet.onDriver.sessionToken,
  });

  await t.mutation(api.auth.logout, {
    sessionToken: fleet.onDriver.sessionToken,
  });

  const operator = await t.run(
    async (ctx) => await ctx.db.get(fleet.onDriver.operatorId)
  );
  expect(operator?.isAvailable).toBe(false);
  const dashboard = await t.query(api.adminQueries.getDashboard, {
    sessionToken: fleet.admin.sessionToken,
  });
  expect(dashboard.metrics.activeDrivers).toBe(0);
  expect(dashboard.metrics.activeUsers).toBe(0);
});

test("a heartbeat with a stale token is ignored, not an error", async () => {
  const t = createTest();
  await expect(
    t.mutation(api.presence.heartbeat, { sessionToken: "no-such-token" })
  ).resolves.toBeNull();
});
