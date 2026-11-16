import { expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { hashPassword } from "../../convex/lib/password";
import { createTest, seedAccount } from "./helpers";

/**
 * Changing a password.
 *
 * The current password has to be given, so that nobody who finds a phone with
 * the app open can lock the owner out. The other sessions on the account are
 * ended, because a password change that leaves a stolen session alive has not
 * really changed anything.
 */

const CURRENT_PASSWORD = "Password1";
const NEW_PASSWORD = "NewPassword2";

test("a password can be changed with the current one", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "changer@example.com",
    name: "Changer",
    phone: "+639000000701",
    role: "commuter",
  });

  // The seeded account has a known hash; set one we control.
  await t.run(async (ctx) => {
    const user = await ctx.db.get(commuter.userId);
    if (user) {
      await ctx.db.patch(user._id, {
        passwordHash: await hashPassword(CURRENT_PASSWORD),
      });
    }
  });

  await t.mutation(api.auth.changePassword, {
    currentPassword: CURRENT_PASSWORD,
    newPassword: NEW_PASSWORD,
    sessionToken: commuter.sessionToken,
  });

  // The new password works, and the old one does not.
  await expect(
    t.mutation(api.auth.login, {
      email: commuter.email,
      password: NEW_PASSWORD,
    })
  ).resolves.toBeTruthy();

  await expect(
    t.mutation(api.auth.login, {
      email: commuter.email,
      password: CURRENT_PASSWORD,
    })
  ).rejects.toThrow();
});

test("the wrong current password is refused", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "wrong-current@example.com",
    name: "Wrong Current",
    phone: "+639000000702",
    role: "commuter",
  });

  await t.run(async (ctx) => {
    const user = await ctx.db.get(commuter.userId);
    if (user) {
      await ctx.db.patch(user._id, {
        passwordHash: await hashPassword(CURRENT_PASSWORD),
      });
    }
  });

  await expect(
    t.mutation(api.auth.changePassword, {
      currentPassword: "NotThePassword1",
      newPassword: NEW_PASSWORD,
      sessionToken: commuter.sessionToken,
    })
  ).rejects.toThrow("current password is not right");
});

test("a weak new password is refused", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "weak-new@example.com",
    name: "Weak New",
    phone: "+639000000703",
    role: "commuter",
  });

  await t.run(async (ctx) => {
    const user = await ctx.db.get(commuter.userId);
    if (user) {
      await ctx.db.patch(user._id, {
        passwordHash: await hashPassword(CURRENT_PASSWORD),
      });
    }
  });

  await expect(
    t.mutation(api.auth.changePassword, {
      currentPassword: CURRENT_PASSWORD,
      newPassword: "short",
      sessionToken: commuter.sessionToken,
    })
  ).rejects.toThrow("at least 8 characters");
});

test("changing the password ends the other sessions but not this one", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "sessions@example.com",
    name: "Sessions",
    phone: "+639000000704",
    role: "commuter",
  });

  await t.run(async (ctx) => {
    const user = await ctx.db.get(commuter.userId);
    if (user) {
      await ctx.db.patch(user._id, {
        passwordHash: await hashPassword(CURRENT_PASSWORD),
      });
    }
    // A second session, on another device.
    await ctx.db.insert("sessions", {
      createdAt: Date.now(),
      expiresAt: Date.now() + 3_600_000,
      isRevoked: false,
      token: "another-device-token",
      userId: commuter.userId,
    });
  });

  await t.mutation(api.auth.changePassword, {
    currentPassword: CURRENT_PASSWORD,
    newPassword: NEW_PASSWORD,
    sessionToken: commuter.sessionToken,
  });

  // The other device is signed out.
  await expect(
    t.query(api.auth.getSession, { sessionToken: "another-device-token" })
  ).resolves.toBeNull();

  // This one is not.
  const session = await t.query(api.auth.getSession, {
    sessionToken: commuter.sessionToken,
  });
  expect(session?.email).toBe(commuter.email);
});

test("a driver can change their password too", async () => {
  const t = createTest();
  const driver = await seedAccount(t, {
    email: "driver-password@example.com",
    name: "Driver Password",
    phone: "+639000000705",
    role: "operator",
  });

  await t.run(async (ctx) => {
    const user = await ctx.db.get(driver.userId);
    if (user) {
      await ctx.db.patch(user._id, {
        passwordHash: await hashPassword(CURRENT_PASSWORD),
      });
    }
  });

  await t.mutation(api.auth.changePassword, {
    currentPassword: CURRENT_PASSWORD,
    newPassword: NEW_PASSWORD,
    sessionToken: driver.sessionToken,
  });

  await expect(
    t.mutation(api.auth.login, {
      email: driver.email,
      password: NEW_PASSWORD,
    })
  ).resolves.toBeTruthy();
});

test("a signed-out caller cannot change a password", async () => {
  const t = createTest();

  await expect(
    t.mutation(api.auth.changePassword, {
      currentPassword: CURRENT_PASSWORD,
      newPassword: NEW_PASSWORD,
      sessionToken: "not-a-real-token",
    })
  ).rejects.toThrow();
});
