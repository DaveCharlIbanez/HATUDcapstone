import { expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { settlementOf } from "../../convex/lib/settlement";
import { createTest, seedAccount, seedRide } from "./helpers";

// fixoct48: the driver sees a finished ride, and whether it has been paid.

async function seedTrio(t: ReturnType<typeof createTest>) {
  const commuter = await seedAccount(t, {
    email: "settle-rider@example.com",
    name: "Louie Igop",
    phone: "+639000000701",
    role: "commuter",
  });
  const operator = await seedAccount(t, {
    email: "settle-driver@example.com",
    name: "John Doe",
    phone: "+639000000702",
    role: "operator",
  });
  const other = await seedAccount(t, {
    email: "settle-other@example.com",
    name: "Other Driver",
    phone: "+639000000703",
    role: "operator",
  });
  return { commuter, operator, other };
}

test("the settlement rule", () => {
  expect(settlementOf({ paymentMethod: "cash" })).toBe("cashCollected");
  expect(settlementOf({ paymentMethod: "gcash" })).toBe("awaitingPayment");
  expect(
    settlementOf({ paymentMethod: "maya", paymentStatus: "pending" })
  ).toBe("awaitingPayment");
  expect(settlementOf({ paymentMethod: "maya", paymentStatus: "paid" })).toBe(
    "paid"
  );
  expect(
    settlementOf({ paymentMethod: "gcash", paymentStatus: "failed" })
  ).toBe("failed");
  // A ride from before the choice was a GCash ride.
  expect(settlementOf({})).toBe("awaitingPayment");
});

test("a finished GCash ride is awaiting payment, then paid", async () => {
  const t = createTest();
  const { commuter, operator } = await seedTrio(t);
  const rideId = await seedRide(t, commuter.commuterId, {
    completedAt: Date.now(),
    operatorId: operator.operatorId,
    paymentMethod: "gcash",
    status: "completed",
  });

  const before = await t.query(api.rides.getFinishedForOperator, {
    sessionToken: operator.sessionToken,
    rideId,
  });
  expect(before?.settlement).toBe("awaitingPayment");
  expect(before?.passengerName).toBe("Louie Igop");

  await t.run(async (ctx) => {
    await ctx.db.patch(rideId, { paidAt: Date.now(), paymentStatus: "paid" });
  });

  const after = await t.query(api.rides.getFinishedForOperator, {
    sessionToken: operator.sessionToken,
    rideId,
  });
  expect(after?.settlement).toBe("paid");
  expect(after?.paidAt).toBeGreaterThan(0);
});

test("a finished cash ride shows as collected", async () => {
  const t = createTest();
  const { commuter, operator } = await seedTrio(t);
  const rideId = await seedRide(t, commuter.commuterId, {
    completedAt: Date.now(),
    operatorId: operator.operatorId,
    paymentMethod: "cash",
    status: "completed",
  });

  const ride = await t.query(api.rides.getFinishedForOperator, {
    sessionToken: operator.sessionToken,
    rideId,
  });
  expect(ride?.settlement).toBe("cashCollected");
});

test("a ride that is not finished yet returns nothing", async () => {
  const t = createTest();
  const { commuter, operator } = await seedTrio(t);
  const rideId = await seedRide(t, commuter.commuterId, {
    operatorId: operator.operatorId,
    status: "inProgress",
  });

  const ride = await t.query(api.rides.getFinishedForOperator, {
    sessionToken: operator.sessionToken,
    rideId,
  });
  expect(ride).toBeNull();
});

test("another driver sees nothing of someone else's ride", async () => {
  const t = createTest();
  const { commuter, operator, other } = await seedTrio(t);
  const rideId = await seedRide(t, commuter.commuterId, {
    completedAt: Date.now(),
    operatorId: operator.operatorId,
    status: "completed",
  });

  const ride = await t.query(api.rides.getFinishedForOperator, {
    sessionToken: other.sessionToken,
    rideId,
  });
  expect(ride).toBeNull();
});

test("a passenger cannot use the driver's view", async () => {
  const t = createTest();
  const { commuter, operator } = await seedTrio(t);
  const rideId = await seedRide(t, commuter.commuterId, {
    completedAt: Date.now(),
    operatorId: operator.operatorId,
    status: "completed",
  });

  await expect(
    t.query(api.rides.getFinishedForOperator, {
      sessionToken: commuter.sessionToken,
      rideId,
    })
  ).rejects.toThrow("Forbidden");
});
