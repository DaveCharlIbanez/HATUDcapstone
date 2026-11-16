import { expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { createTest, seedAccount, seedRide } from "./helpers";

// The leading bytes of a real PNG.
const PNG_BYTES: Uint8Array<ArrayBuffer> = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

async function setApproval(
  t: ReturnType<typeof createTest>,
  operatorId: Parameters<typeof Object>[0] extends never ? never : string,
  approvalStatus: "approved" | "pending" | "rejected"
) {
  await t.run(async (ctx) => {
    await ctx.db.patch(operatorId as never, {
      approvalStatus,
      updatedAt: Date.now(),
    });
  });
}

test("the dashboard counts the fleet and lists the records behind it", async () => {
  const t = createTest();
  const admin = await seedAccount(t, {
    email: "admin@example.com",
    name: "Admin",
    phone: "+639000000401",
    role: "admin",
  });
  const commuter = await seedAccount(t, {
    email: "rider@example.com",
    name: "Rider",
    phone: "+639000000402",
    role: "commuter",
  });
  const operator = await seedAccount(t, {
    email: "driver@example.com",
    name: "Driver",
    phone: "+639000000403",
    role: "operator",
  });

  await seedRide(t, commuter.commuterId, {
    operatorId: operator.operatorId,
    status: "inProgress",
  });
  await seedRide(t, commuter.commuterId, { status: "completed" });
  await seedRide(t, commuter.commuterId, { status: "cancelled" });
  // A driver counts as active only with the app open (fixoct51).
  await t.mutation(api.presence.heartbeat, {
    sessionToken: operator.sessionToken,
  });

  const dashboard = await t.query(api.adminQueries.getDashboard, {
    sessionToken: admin.sessionToken,
  });

  expect(dashboard.metrics.activeDrivers).toBe(1);
  expect(dashboard.metrics.liveTrips).toBe(1);
  expect(dashboard.metrics.completedTrips).toBe(1);
  expect(dashboard.metrics.cancelledTrips).toBe(1);
  expect(dashboard.metrics.riders).toBe(1);
  expect(dashboard.metrics.pendingDrivers).toBe(0);

  expect(dashboard.liveRides).toHaveLength(1);
  expect(dashboard.liveRides[0]?.commuterName).toBe("Rider");
  expect(dashboard.liveRides[0]?.driverName).toBe("Driver");
  expect(dashboard.recentRides).toHaveLength(1);
  expect(dashboard.riders).toHaveLength(1);
  expect(dashboard.riders[0]?.rides).toBe(3);

  expect(dashboard.cancellations.cancelled).toBe(1);
  expect(dashboard.cancellations.completed).toBe(1);
  expect(dashboard.cancellations.rate).toBe(0.5);
});

test("a driver with no approval status counts as approved", async () => {
  const t = createTest();
  const admin = await seedAccount(t, {
    email: "admin2@example.com",
    name: "Admin Two",
    phone: "+639000000404",
    role: "admin",
  });
  const operator = await seedAccount(t, {
    email: "legacy-driver@example.com",
    name: "Legacy Driver",
    phone: "+639000000405",
    role: "operator",
  });

  const dashboard = await t.query(api.adminQueries.getDashboard, {
    sessionToken: admin.sessionToken,
  });

  const row = dashboard.drivers.find(
    (driver) => driver._id === operator.operatorId
  );
  expect(row?.approvalStatus).toBe("approved");
  expect(dashboard.metrics.pendingDrivers).toBe(0);
  expect(dashboard.metrics.approvedDrivers).toBe(1);
});

test("a non-admin cannot read the dashboard", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "nosy-rider@example.com",
    name: "Nosy Rider",
    phone: "+639000000406",
    role: "commuter",
  });

  await expect(
    t.query(api.adminQueries.getDashboard, {
      sessionToken: commuter.sessionToken,
    })
  ).rejects.toThrow("Forbidden");
});

test("approving a driver clears them from the pending list", async () => {
  const t = createTest();
  const admin = await seedAccount(t, {
    email: "admin3@example.com",
    name: "Admin Three",
    phone: "+639000000407",
    role: "admin",
  });
  const operator = await seedAccount(t, {
    email: "applicant@example.com",
    name: "Applicant",
    phone: "+639000000408",
    role: "operator",
  });
  await setApproval(t, operator.operatorId, "pending");

  const before = await t.query(api.adminQueries.getDashboard, {
    sessionToken: admin.sessionToken,
  });
  expect(before.metrics.pendingDrivers).toBe(1);

  await t.mutation(api.admins.setOperatorApproval, {
    sessionToken: admin.sessionToken,
    id: operator.operatorId,
    approvalStatus: "approved",
  });

  const after = await t.query(api.adminQueries.getDashboard, {
    sessionToken: admin.sessionToken,
  });
  expect(after.metrics.pendingDrivers).toBe(0);
  expect(after.metrics.approvedDrivers).toBe(1);
});

test("only an admin can approve a driver", async () => {
  const t = createTest();
  const operator = await seedAccount(t, {
    email: "self-approver@example.com",
    name: "Self Approver",
    phone: "+639000000409",
    role: "operator",
  });
  const target = await seedAccount(t, {
    email: "target@example.com",
    name: "Target",
    phone: "+639000000410",
    role: "operator",
  });

  await expect(
    t.mutation(api.admins.setOperatorApproval, {
      sessionToken: operator.sessionToken,
      id: target.operatorId,
      approvalStatus: "approved",
    })
  ).rejects.toThrow("Forbidden");
});

test("a pending driver cannot go online or accept a ride", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "waiting-rider@example.com",
    name: "Waiting Rider",
    phone: "+639000000411",
    role: "commuter",
  });
  const operator = await seedAccount(t, {
    email: "waiting-driver@example.com",
    name: "Waiting Driver",
    phone: "+639000000412",
    role: "operator",
  });
  await setApproval(t, operator.operatorId, "pending");

  await expect(
    t.mutation(api.operators.setAvailability, {
      sessionToken: operator.sessionToken,
      id: operator.operatorId,
      isAvailable: true,
    })
  ).rejects.toThrow("not approved");

  const rideId = await seedRide(t, commuter.commuterId, {
    operatorId: operator.operatorId,
  });

  await expect(
    t.mutation(api.rides.accept, {
      sessionToken: operator.sessionToken,
      id: rideId,
      operatorId: operator.operatorId,
    })
  ).rejects.toThrow("not approved");
});

test("an approved driver can go online again", async () => {
  const t = createTest();
  const operator = await seedAccount(t, {
    email: "cleared-driver@example.com",
    name: "Cleared Driver",
    phone: "+639000000413",
    role: "operator",
  });
  await setApproval(t, operator.operatorId, "pending");

  await expect(
    t.mutation(api.operators.setAvailability, {
      sessionToken: operator.sessionToken,
      id: operator.operatorId,
      isAvailable: true,
    })
  ).rejects.toThrow("not approved");

  await setApproval(t, operator.operatorId, "approved");

  await t.mutation(api.operators.setAvailability, {
    sessionToken: operator.sessionToken,
    id: operator.operatorId,
    isAvailable: true,
  });

  const stored = await t.run(
    async (ctx) => await ctx.db.get(operator.operatorId)
  );
  expect(stored?.isAvailable).toBe(true);
});

test("the dashboard reports which documents each driver uploaded", async () => {
  const t = createTest();
  const admin = await seedAccount(t, {
    email: "count-admin@example.com",
    name: "Count Admin",
    phone: "+639000000513",
    role: "admin",
  });
  const driver = await seedAccount(t, {
    email: "counted-driver@example.com",
    name: "Counted Driver",
    phone: "+639000000514",
    role: "operator",
  });
  await t.run(async (ctx) => {
    await ctx.db.patch(driver.operatorId, { approvalStatus: "pending" });
  });

  for (const kind of ["license", "insurance"] as const) {
    const storageId = await t.run(async (ctx) => {
      const id = await ctx.storage.store(
        new Blob([PNG_BYTES], { type: "image/png" })
      );
      return String(id);
    });
    await t.action(api.documents.registerDocument, {
      sessionToken: driver.sessionToken,
      kind,
      storageId,
    });
  }

  const dashboard = await t.query(api.adminQueries.getDashboard, {
    sessionToken: admin.sessionToken,
  });
  const row = dashboard.drivers.find(
    (entry) => entry._id === driver.operatorId
  );
  expect(row?.documentCount).toBe(2);
  expect(row?.missingDocuments).toHaveLength(2);
  expect(row?.missingDocuments).toContain("registration");
  expect(row?.missingDocuments).toContain("officialReceipt");
});
