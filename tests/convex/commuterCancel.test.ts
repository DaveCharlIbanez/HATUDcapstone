import { expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import {
  COMMUTER_CANCEL_GRACE_MS,
  commuterCanCancel,
  commuterCancelDeadline,
} from "../../convex/lib/cancellation";
import { createTest, seedAccount, seedRide } from "./helpers";

// fixoct46: the passenger may cancel for one minute after a driver accepts.

async function seedPair(t: ReturnType<typeof createTest>) {
  const commuter = await seedAccount(t, {
    email: "grace-rider@example.com",
    name: "Louie Igop",
    phone: "+639000000601",
    role: "commuter",
  });
  const operator = await seedAccount(t, {
    email: "grace-driver@example.com",
    name: "John Doe",
    phone: "+639000000602",
    role: "operator",
  });
  return { commuter, operator };
}

test("the rule: pending always, accepted for one minute, then never", () => {
  const acceptedAt = 1_000_000;
  const accepted = { acceptedAt, status: "accepted" };

  expect(COMMUTER_CANCEL_GRACE_MS).toBe(60_000);
  expect(commuterCanCancel({ status: "pending" }, acceptedAt)).toBe(true);
  expect(commuterCanCancel(accepted, acceptedAt)).toBe(true);
  expect(commuterCanCancel(accepted, acceptedAt + 59_999)).toBe(true);
  expect(commuterCanCancel(accepted, acceptedAt + 60_000)).toBe(false);
  expect(commuterCanCancel({ status: "accepted" }, acceptedAt)).toBe(false);
  expect(
    commuterCanCancel({ acceptedAt, status: "inProgress" }, acceptedAt)
  ).toBe(false);
  expect(commuterCancelDeadline(accepted)).toBe(acceptedAt + 60_000);
  expect(commuterCancelDeadline({ status: "pending" })).toBeNull();
});

test("accepting a ride records when, which starts the window", async () => {
  const t = createTest();
  const { commuter, operator } = await seedPair(t);
  const rideId = await seedRide(t, commuter.commuterId);

  const before = Date.now();
  await t.mutation(api.rides.accept, {
    sessionToken: operator.sessionToken,
    id: rideId,
    operatorId: operator.operatorId,
  });

  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(ride?.acceptedAt).toBeGreaterThanOrEqual(before);

  // Straight after the accept, the passenger is inside the window.
  await t.mutation(api.rides.cancel, {
    sessionToken: commuter.sessionToken,
    id: rideId,
  });
  const cancelled = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(cancelled?.status).toBe("cancelled");
});

test("the passenger can still cancel while no driver has accepted", async () => {
  const t = createTest();
  const { commuter } = await seedPair(t);
  const rideId = await seedRide(t, commuter.commuterId);

  await t.mutation(api.rides.cancel, {
    sessionToken: commuter.sessionToken,
    id: rideId,
  });

  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(ride?.status).toBe("cancelled");
});

test("after the minute has passed the passenger's cancel is refused", async () => {
  const t = createTest();
  const { commuter, operator } = await seedPair(t);
  const rideId = await seedRide(t, commuter.commuterId, {
    acceptedAt: Date.now() - COMMUTER_CANCEL_GRACE_MS - 1000,
    operatorId: operator.operatorId,
    status: "accepted",
  });

  await expect(
    t.mutation(api.rides.cancel, {
      sessionToken: commuter.sessionToken,
      id: rideId,
    })
  ).rejects.toThrow("1-minute window to cancel has passed");

  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(ride?.status).toBe("accepted");
});

test("a ride accepted before the window existed cannot be cancelled by the passenger", async () => {
  const t = createTest();
  const { commuter, operator } = await seedPair(t);
  const rideId = await seedRide(t, commuter.commuterId, {
    operatorId: operator.operatorId,
    status: "accepted",
  });

  await expect(
    t.mutation(api.rides.cancel, {
      sessionToken: commuter.sessionToken,
      id: rideId,
    })
  ).rejects.toThrow("window to cancel has passed");
});

test("the passenger cannot cancel a trip that is under way", async () => {
  const t = createTest();
  const { commuter, operator } = await seedPair(t);
  const rideId = await seedRide(t, commuter.commuterId, {
    acceptedAt: Date.now(),
    operatorId: operator.operatorId,
    status: "inProgress",
  });

  await expect(
    t.mutation(api.rides.cancel, {
      sessionToken: commuter.sessionToken,
      id: rideId,
    })
  ).rejects.toThrow("can no longer be cancelled");
});

test("the driver can still cancel after the passenger's window has closed", async () => {
  const t = createTest();
  const { commuter, operator } = await seedPair(t);
  const rideId = await seedRide(t, commuter.commuterId, {
    acceptedAt: Date.now() - COMMUTER_CANCEL_GRACE_MS - 1000,
    operatorId: operator.operatorId,
    status: "accepted",
  });

  await t.mutation(api.rides.cancel, {
    sessionToken: operator.sessionToken,
    id: rideId,
  });

  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(ride?.status).toBe("cancelled");
});

// fixoct47: the screen measures its clock against the server's, because the
// window is server time and a phone's clock can run ahead of it.
test("the server reports its own clock", async () => {
  const t = createTest();
  const before = Date.now();
  const serverNow = await t.mutation(api.rides.serverTime, {});
  expect(serverNow).toBeGreaterThanOrEqual(before);
  expect(serverNow).toBeLessThanOrEqual(Date.now());
});
