/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import type { Id } from "../../convex/_generated/dataModel";
import schema from "../../convex/schema";

/**
 * Module map consumed by convex-test. The glob must include
 * `convex/_generated/**` so convex-test can derive the module root prefix.
 */
const modules = import.meta.glob("../../convex/**/*.ts");

export function createTest() {
  return convexTest(schema, modules);
}

export type Role = "commuter" | "operator" | "admin";

export interface Account {
  sessionToken: string;
  userId: Id<"users">;
}

export interface CommuterAccount extends Account {
  commuterId: Id<"commuters">;
}

export interface OperatorAccount extends Account {
  operatorId: Id<"operators">;
}

export interface AdminAccount extends Account {
  adminId: Id<"admins">;
}

export type SeededAccount = Account &
  Partial<{
    commuterId: Id<"commuters">;
    operatorId: Id<"operators">;
    adminId: Id<"admins">;
  }>;

interface SeedOptions {
  email: string;
  name: string;
  phone: string;
  role: Role;
}

const SESSION_TTL_MS = 60 * 60 * 1000;

/**
 * Creates a user plus a matching role profile and an active session.
 * Password hashes are irrelevant here — sessions are inserted directly.
 */
export async function seedAccount(
  t: ReturnType<typeof createTest>,
  options: SeedOptions & { role: "commuter" }
): Promise<SeededAccount & { commuterId: Id<"commuters"> }>;
export async function seedAccount(
  t: ReturnType<typeof createTest>,
  options: SeedOptions & { role: "operator" }
): Promise<SeededAccount & { operatorId: Id<"operators"> }>;
export async function seedAccount(
  t: ReturnType<typeof createTest>,
  options: SeedOptions & { role: "admin" }
): Promise<SeededAccount & { adminId: Id<"admins"> }>;
export async function seedAccount(
  t: ReturnType<typeof createTest>,
  options: SeedOptions
): Promise<SeededAccount>;
export async function seedAccount(
  t: ReturnType<typeof createTest>,
  options: SeedOptions
): Promise<SeededAccount> {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      email: options.email,
      passwordHash: "pbkdf2:200000:dGVzdA==:dGVzdA==",
      phone: options.phone,
      role: options.role,
      createdAt: now,
      updatedAt: now,
    });

    const sessionToken = `session-${options.email}`;

    if (options.role === "commuter") {
      const commuterId = await ctx.db.insert("commuters", {
        userId,
        name: options.name,
        email: options.email,
        phone: options.phone,
        savedLocations: [
          {
            name: "Home",
            address: "1 Home Street",
            latitude: 14.5995,
            longitude: 120.9842,
          },
        ],
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("sessions", {
        userId,
        token: sessionToken,
        expiresAt: now + SESSION_TTL_MS,
        createdAt: now,
        isRevoked: false,
      });
      return { userId, sessionToken, commuterId };
    }

    if (options.role === "operator") {
      const operatorId = await ctx.db.insert("operators", {
        userId,
        name: options.name,
        email: options.email,
        phone: options.phone,
        licenseNumber: `LIC-${options.email}`,
        vehicleInfo: {
          plateNumber: "ABC 123",
          model: "Toyota Vios",
          color: "White",
        },
        isAvailable: true,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("sessions", {
        userId,
        token: sessionToken,
        expiresAt: now + SESSION_TTL_MS,
        createdAt: now,
        isRevoked: false,
      });
      return { userId, sessionToken, operatorId };
    }

    const adminId = await ctx.db.insert("admins", {
      userId,
      name: options.name,
      email: options.email,
      permissions: ["rides:read", "users:read"],
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("sessions", {
      userId,
      token: sessionToken,
      expiresAt: now + SESSION_TTL_MS,
      createdAt: now,
      isRevoked: false,
    });
    return { userId, sessionToken, adminId };
  });
}

export async function seedRide(
  t: ReturnType<typeof createTest>,
  commuterId: Id<"commuters">,
  overrides: {
    operatorId?: Id<"operators">;
    status?: "pending" | "accepted" | "inProgress" | "completed" | "cancelled";
  } = {}
): Promise<Id<"rides">> {
  return await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("rides", {
      commuterId,
      operatorId: overrides.operatorId,
      pickup: {
        address: "Pickup Point",
        latitude: 14.5995,
        longitude: 120.9842,
      },
      dropoff: {
        address: "Dropoff Point",
        latitude: 14.65,
        longitude: 121.05,
      },
      vehicleType: "standard",
      status: overrides.status ?? "pending",
      fare: 30,
      distance: 5,
      createdAt: now,
      updatedAt: now,
    });
  });
}
