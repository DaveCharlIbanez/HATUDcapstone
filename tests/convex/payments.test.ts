import { expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { GCASH_SANDBOX_DECLINE_NUMBER } from "../../convex/lib/payments";
import { createTest, seedAccount, seedRide } from "./helpers";

async function seedCompletedRide(t: ReturnType<typeof createTest>) {
  const commuter = await seedAccount(t, {
    email: "payer@example.com",
    name: "Payer",
    phone: "+639000000201",
    role: "commuter",
  });
  const operator = await seedAccount(t, {
    email: "driver@example.com",
    name: "Driver",
    phone: "+639000000202",
    role: "operator",
  });
  const rideId = await seedRide(t, commuter.commuterId, {
    operatorId: operator.operatorId,
    status: "completed",
  });
  return { commuter, operator, rideId };
}

test("a completed ride can be paid and the amount comes from the ride", async () => {
  const t = createTest();
  const { commuter, rideId } = await seedCompletedRide(t);

  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));

  const payment = await t.action(api.payments.charge, {
    sessionToken: commuter.sessionToken,
    rideId,
  });

  expect(payment.status).toBe("SETTLED");
  expect(payment.amount).toBe(ride?.fare);
  expect(payment.currency).toBe("PHP");

  const updated = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(updated?.paymentStatus).toBe("paid");
  expect(updated?.paidAt).toBeGreaterThan(0);
});

test("the sandbox declines the designated test number and leaves the ride unpaid", async () => {
  const t = createTest();
  const { commuter, rideId } = await seedCompletedRide(t);

  const payment = await t.action(api.payments.charge, {
    sessionToken: commuter.sessionToken,
    rideId,
    testNumber: GCASH_SANDBOX_DECLINE_NUMBER,
  });

  expect(payment.status).toBe("FAILED");
  expect(payment.failureReason).toBeDefined();

  const updated = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(updated?.paymentStatus).toBe("failed");
  expect(updated?.paidAt).toBeUndefined();
});

test("paying twice does not charge twice", async () => {
  const t = createTest();
  const { commuter, rideId } = await seedCompletedRide(t);

  const first = await t.action(api.payments.charge, {
    sessionToken: commuter.sessionToken,
    rideId,
  });
  const second = await t.action(api.payments.charge, {
    sessionToken: commuter.sessionToken,
    rideId,
  });

  expect(second.id).toBe(first.id);
  expect(second.status).toBe("SETTLED");

  const payments = await t.run(async (ctx) => {
    const rows = await ctx.db.query("payments").collect();
    return rows.length;
  });
  expect(payments).toBe(1);
});

test("a ride that is still in progress cannot be paid for", async () => {
  const t = createTest();
  const { commuter, rideId } = await seedCompletedRide(t);

  await t.run(async (ctx) => {
    await ctx.db.patch(rideId, { status: "inProgress" });
  });

  await expect(
    t.action(api.payments.charge, {
      sessionToken: commuter.sessionToken,
      rideId,
    })
  ).rejects.toThrow("complete");
});

test("a passenger cannot pay for somebody else's ride", async () => {
  const t = createTest();
  const { rideId } = await seedCompletedRide(t);
  const stranger = await seedAccount(t, {
    email: "stranger-payer@example.com",
    name: "Stranger",
    phone: "+639000000203",
    role: "commuter",
  });

  await expect(
    t.action(api.payments.charge, {
      sessionToken: stranger.sessionToken,
      rideId,
    })
  ).rejects.toThrow("Forbidden");
});

test("a driver cannot pay for a ride", async () => {
  const t = createTest();
  const { operator, rideId } = await seedCompletedRide(t);

  await expect(
    t.action(api.payments.charge, {
      sessionToken: operator.sessionToken,
      rideId,
    })
  ).rejects.toThrow("Forbidden");
});

test("the due query reports the unpaid completed ride", async () => {
  const t = createTest();
  const { commuter, rideId } = await seedCompletedRide(t);

  const due = await t.query(api.payments.getDue, {
    sessionToken: commuter.sessionToken,
  });
  expect(due?.rideId).toBe(rideId);
  expect(due?.paymentStatus).toBe("unpaid");

  await t.action(api.payments.charge, {
    sessionToken: commuter.sessionToken,
    rideId,
  });

  const afterPayment = await t.query(api.payments.getDue, {
    sessionToken: commuter.sessionToken,
  });
  expect(afterPayment).toBeNull();
});
