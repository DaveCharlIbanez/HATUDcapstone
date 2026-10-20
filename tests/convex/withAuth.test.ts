import { expect, test } from "vitest";
import {
  requireAuth,
  requireCommuterOwnership,
  requireOperatorOwnership,
  requireOwnership,
  requireRole,
} from "../../convex/lib/withAuth";
import { createTest, seedAccount } from "./helpers";

test("requireAuth resolves the session to a user identity", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "commuter@example.com",
    name: "Commuter One",
    phone: "+639000000001",
    role: "commuter",
  });

  const actor = await t.run(
    async (ctx) => await requireAuth(ctx, commuter.sessionToken)
  );

  expect(actor.userId).toBe(commuter.userId);
  expect(actor.role).toBe("commuter");
});

test("requireAuth rejects an unknown token", async () => {
  const t = createTest();

  await expect(
    t.run(async (ctx) => await requireAuth(ctx, "not-a-real-token"))
  ).rejects.toThrow("Unauthorized");
});

test("requireAuth rejects a revoked session", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "revoked@example.com",
    name: "Revoked User",
    phone: "+639000000002",
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
    t.run(async (ctx) => await requireAuth(ctx, commuter.sessionToken))
  ).rejects.toThrow("Unauthorized");
});

test("requireAuth rejects an expired session", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "expired@example.com",
    name: "Expired User",
    phone: "+639000000003",
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
    t.run(async (ctx) => await requireAuth(ctx, commuter.sessionToken))
  ).rejects.toThrow("Unauthorized");
});

test("requireRole allows the matching role and rejects the others", async () => {
  const t = createTest();
  const operator = await seedAccount(t, {
    email: "operator@example.com",
    name: "Operator One",
    phone: "+639000000004",
    role: "operator",
  });

  const allowed = await t.run(
    async (ctx) => await requireRole(ctx, operator.sessionToken, "operator")
  );
  expect(allowed.userId).toBe(operator.userId);

  await expect(
    t.run(async (ctx) => await requireRole(ctx, operator.sessionToken, "admin"))
  ).rejects.toThrow("Forbidden");
});

test("requireOperatorOwnership allows the owning operator", async () => {
  const t = createTest();
  const operator = await seedAccount(t, {
    email: "owner@example.com",
    name: "Owner",
    phone: "+639000000005",
    role: "operator",
  });

  await expect(
    t.run(
      async (ctx) =>
        await requireOperatorOwnership(
          ctx,
          operator.sessionToken,
          operator.operatorId as never
        )
    )
  ).resolves.toBeNull();
});

test("requireOperatorOwnership rejects a different operator", async () => {
  const t = createTest();
  const owner = await seedAccount(t, {
    email: "owner2@example.com",
    name: "Owner Two",
    phone: "+639000000006",
    role: "operator",
  });
  const other = await seedAccount(t, {
    email: "other@example.com",
    name: "Other",
    phone: "+639000000007",
    role: "operator",
  });

  await expect(
    t.run(
      async (ctx) =>
        await requireOperatorOwnership(
          ctx,
          other.sessionToken,
          owner.operatorId as never
        )
    )
  ).rejects.toThrow("Forbidden");
});

test("requireOperatorOwnership lets admins bypass ownership", async () => {
  const t = createTest();
  const operator = await seedAccount(t, {
    email: "operator3@example.com",
    name: "Operator Three",
    phone: "+639000000008",
    role: "operator",
  });
  const admin = await seedAccount(t, {
    email: "admin@example.com",
    name: "Admin",
    phone: "+639000000009",
    role: "admin",
  });

  await expect(
    t.run(
      async (ctx) =>
        await requireOperatorOwnership(
          ctx,
          admin.sessionToken,
          operator.operatorId as never
        )
    )
  ).resolves.toBeNull();
});

test("requireCommuterOwnership rejects a different commuter", async () => {
  const t = createTest();
  const owner = await seedAccount(t, {
    email: "commuter2@example.com",
    name: "Commuter Two",
    phone: "+639000000010",
    role: "commuter",
  });
  const other = await seedAccount(t, {
    email: "commuter3@example.com",
    name: "Commuter Three",
    phone: "+639000000011",
    role: "commuter",
  });

  await expect(
    t.run(
      async (ctx) =>
        await requireCommuterOwnership(
          ctx,
          other.sessionToken,
          owner.commuterId as never
        )
    )
  ).rejects.toThrow("Forbidden");
});

test("requireOwnership allows the owner and admins, rejects others", async () => {
  const t = createTest();
  const owner = await seedAccount(t, {
    email: "commuter4@example.com",
    name: "Commuter Four",
    phone: "+639000000012",
    role: "commuter",
  });
  const other = await seedAccount(t, {
    email: "commuter5@example.com",
    name: "Commuter Five",
    phone: "+639000000013",
    role: "commuter",
  });
  const admin = await seedAccount(t, {
    email: "admin2@example.com",
    name: "Admin Two",
    phone: "+639000000014",
    role: "admin",
  });

  await expect(
    t.run(
      async (ctx) =>
        await requireOwnership(ctx, owner.sessionToken, owner.userId)
    )
  ).resolves.toBeNull();

  await expect(
    t.run(
      async (ctx) =>
        await requireOwnership(ctx, admin.sessionToken, owner.userId)
    )
  ).resolves.toBeNull();

  await expect(
    t.run(
      async (ctx) =>
        await requireOwnership(ctx, other.sessionToken, owner.userId)
    )
  ).rejects.toThrow("Forbidden");
});
