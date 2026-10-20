import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { internalMutation } from "./_generated/server";
import { hashPassword } from "./lib/password";

/**
 * Development seeding.
 *
 * These functions are internal — they cannot be called from a client at all.
 * They additionally require the `seedKey` argument to match the `SEED_KEY`
 * environment variable configured on the deployment, so a leaked function
 * reference is not enough to wipe the database.
 *
 * Required deployment environment variables:
 *   SEED_KEY              shared secret passed as the `seedKey` argument
 *   SEED_ADMIN_PASSWORD   password for the seeded admin account
 *   SEED_USER_PASSWORD    password for the seeded commuter/operator accounts
 *
 * Usage (note the `internal.` prefix):
 *   npx convex env set SEED_KEY "$(openssl rand -hex 16)"
 *   npx convex env set SEED_ADMIN_PASSWORD "<admin password>"
 *   npx convex env set SEED_USER_PASSWORD "<user password>"
 *   npx convex run internal.seed.forceReset '{"seedKey":"<the key you set>"}'
 */

interface SeedCredentials {
  adminPassword: string;
  userPassword: string;
}

function requireSeedKey(provided: string): void {
  const expected = process.env.SEED_KEY;
  if (!expected) {
    throw new Error(
      "Seeding is disabled: SEED_KEY is not set on this deployment."
    );
  }
  if (provided !== expected) {
    throw new Error("Forbidden: invalid seed key");
  }
}

function requireSeedCredentials(): SeedCredentials {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const userPassword = process.env.SEED_USER_PASSWORD;
  if (!(adminPassword && userPassword)) {
    throw new Error(
      "Seeding is disabled: SEED_ADMIN_PASSWORD and SEED_USER_PASSWORD must be set on this deployment."
    );
  }
  return { adminPassword, userPassword };
}

async function seedDatabase(ctx: MutationCtx): Promise<void> {
  const { adminPassword, userPassword } = requireSeedCredentials();
  const now = Date.now();

  const passwordHashAdmin = await hashPassword(adminPassword);
  const passwordHashDefault = await hashPassword(userPassword);

  const adminUserId = await ctx.db.insert("users", {
    email: "admin@hatud.com",
    passwordHash: passwordHashAdmin,
    phone: "+639123456789",
    role: "admin",
    createdAt: now,
    updatedAt: now,
  });

  await ctx.db.insert("admins", {
    userId: adminUserId,
    name: "Admin User",
    email: "admin@hatud.com",
    permissions: [
      "view_all",
      "manage_users",
      "view_analytics",
      "approve_operators",
    ],
    createdAt: now,
    updatedAt: now,
  });

  const commuter1UserId = await ctx.db.insert("users", {
    email: "commuter1@hatud.com",
    passwordHash: passwordHashDefault,
    phone: "+639234567890",
    role: "commuter",
    createdAt: now,
    updatedAt: now,
  });

  await ctx.db.insert("commuters", {
    userId: commuter1UserId,
    name: "Juan dela Cruz",
    email: "commuter1@hatud.com",
    phone: "+639234567890",
    savedLocations: [
      {
        name: "Home",
        address: "123 Mabini St, San Jose, Antique",
        latitude: 10.5944,
        longitude: 121.9494,
      },
      {
        name: "Work",
        address: "456 Cervantes St, San Jose, Antique",
        latitude: 10.5923,
        longitude: 121.9476,
      },
    ],
    createdAt: now,
    updatedAt: now,
  });

  const commuter2UserId = await ctx.db.insert("users", {
    email: "commuter2@hatud.com",
    passwordHash: passwordHashDefault,
    phone: "+639345678901",
    role: "commuter",
    createdAt: now,
    updatedAt: now,
  });

  await ctx.db.insert("commuters", {
    userId: commuter2UserId,
    name: "Maria Santos",
    email: "commuter2@hatud.com",
    phone: "+639345678901",
    savedLocations: [
      {
        name: "School",
        address: "789 University Ave, Sibalom, Antique",
        latitude: 10.5132,
        longitude: 121.9423,
      },
    ],
    createdAt: now,
    updatedAt: now,
  });

  const operator1UserId = await ctx.db.insert("users", {
    email: "operator1@hatud.com",
    passwordHash: passwordHashDefault,
    phone: "+639456789012",
    role: "operator",
    createdAt: now,
    updatedAt: now,
  });

  const operator1Id = await ctx.db.insert("operators", {
    userId: operator1UserId,
    name: "Roberto Reyes",
    email: "operator1@hatud.com",
    phone: "+639456789012",
    licenseNumber: "DR-2024-001",
    vehicleInfo: {
      plateNumber: "ABC 123",
      model: "Yamaha NMAX 155",
      color: "White",
    },
    isAvailable: true,
    currentLocation: { latitude: 10.5944, longitude: 121.9494 },
    createdAt: now,
    updatedAt: now,
  });

  const operator2UserId = await ctx.db.insert("users", {
    email: "operator2@hatud.com",
    passwordHash: passwordHashDefault,
    phone: "+639567890123",
    role: "operator",
    createdAt: now,
    updatedAt: now,
  });

  const operator2Id = await ctx.db.insert("operators", {
    userId: operator2UserId,
    name: "Antonio Mendoza",
    email: "operator2@hatud.com",
    phone: "+639567890123",
    licenseNumber: "DR-2024-002",
    vehicleInfo: {
      plateNumber: "DEF 456",
      model: "Honda PCX 160",
      color: "Blue",
    },
    isAvailable: true,
    currentLocation: { latitude: 10.5912, longitude: 121.9456 },
    createdAt: now,
    updatedAt: now,
  });

  const commuters = await ctx.db
    .query("commuters")
    .withIndex("by_email")
    .collect();

  const [firstCommuter, secondCommuter] = commuters;
  if (!(firstCommuter && secondCommuter)) {
    return;
  }

  const ride1 = await ctx.db.insert("rides", {
    commuterId: firstCommuter._id,
    operatorId: operator1Id,
    pickup: {
      address: "123 Mabini St, San Jose, Antique",
      latitude: 10.5944,
      longitude: 121.9494,
    },
    dropoff: {
      address: "456 Cervantes St, San Jose, Antique",
      latitude: 10.5923,
      longitude: 121.9476,
    },
    vehicleType: "priority",
    status: "inProgress",
    fare: 85.5,
    distance: 2.3,
    createdAt: now,
    updatedAt: now,
  });

  await ctx.db.insert("feedback", {
    rideId: ride1,
    commuterId: firstCommuter._id,
    operatorId: operator1Id,
    rating: 5,
    comment: "Great ride!",
    createdAt: now,
  });

  await ctx.db.insert("rides", {
    commuterId: secondCommuter._id,
    operatorId: operator2Id,
    pickup: {
      address: "789 University Ave, Sibalom, Antique",
      latitude: 10.5132,
      longitude: 121.9423,
    },
    dropoff: {
      address: "123 Mabini St, San Jose, Antique",
      latitude: 10.5944,
      longitude: 121.9494,
    },
    vehicleType: "standard",
    status: "pending",
    fare: 245.0,
    distance: 12.5,
    createdAt: now,
    updatedAt: now,
  });

  await ctx.db.insert("rides", {
    commuterId: firstCommuter._id,
    operatorId: operator1Id,
    pickup: {
      address: "456 Cervantes St, San Jose, Antique",
      latitude: 10.5923,
      longitude: 121.9476,
    },
    dropoff: {
      address: "Shopping Mall, San Jose, Antique",
      latitude: 10.5901,
      longitude: 121.9512,
    },
    vehicleType: "standard",
    status: "completed",
    fare: 65.0,
    distance: 1.8,
    createdAt: now - 3_600_000,
    updatedAt: now - 3_600_000,
  });
}

export const seed = internalMutation({
  args: { seedKey: v.string() },
  handler: async (ctx, args) => {
    requireSeedKey(args.seedKey);

    const existingUsers = await ctx.db.query("users").first();
    if (existingUsers) {
      return { message: "Seed already exists" };
    }

    await seedDatabase(ctx);
    return { message: "Seed completed successfully" };
  },
});

export const clearAllRides = internalMutation({
  args: { seedKey: v.string() },
  handler: async (ctx, args) => {
    requireSeedKey(args.seedKey);

    const rides = await ctx.db.query("rides").collect();
    for (const ride of rides) {
      await ctx.db.delete(ride._id);
    }
    return { message: "All rides cleared" };
  },
});

export const forceReset = internalMutation({
  args: { seedKey: v.string() },
  handler: async (ctx, args) => {
    requireSeedKey(args.seedKey);

    // Order matters only for readability — Convex has no foreign keys — but
    // every table is cleared so no orphaned rows survive the reset.
    const messages = await ctx.db.query("messages").collect();
    for (const message of messages) {
      await ctx.db.delete(message._id);
    }
    const sessions = await ctx.db.query("sessions").collect();
    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }
    const loginAttempts = await ctx.db.query("loginAttempts").collect();
    for (const attempt of loginAttempts) {
      await ctx.db.delete(attempt._id);
    }
    const feedbacks = await ctx.db.query("feedback").collect();
    for (const feedback of feedbacks) {
      await ctx.db.delete(feedback._id);
    }
    const rides = await ctx.db.query("rides").collect();
    for (const ride of rides) {
      await ctx.db.delete(ride._id);
    }
    const operators = await ctx.db.query("operators").collect();
    for (const operator of operators) {
      await ctx.db.delete(operator._id);
    }
    const commuters = await ctx.db.query("commuters").collect();
    for (const commuter of commuters) {
      await ctx.db.delete(commuter._id);
    }
    const admins = await ctx.db.query("admins").collect();
    for (const admin of admins) {
      await ctx.db.delete(admin._id);
    }
    const users = await ctx.db.query("users").collect();
    for (const user of users) {
      await ctx.db.delete(user._id);
    }

    await seedDatabase(ctx);
    return { message: "Database reset and re-seeded successfully" };
  },
});
