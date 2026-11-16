/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { PaymentMethod } from "../../convex/lib/paymentMethods";
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
  email: string;
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
      return { email: options.email, userId, sessionToken, commuterId };
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
      return { email: options.email, userId, sessionToken, operatorId };
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
    return { email: options.email, userId, sessionToken, adminId };
  });
}

export async function seedRide(
  t: ReturnType<typeof createTest>,
  commuterId: Id<"commuters">,
  overrides: {
    /** When a driver accepted. Starts the passenger's cancel window. */
    acceptedAt?: number;
    /** When the trip ended. The map only carries a trip the passenger has just finished. */
    completedAt?: number;
    /** A demo trip, driven by the server instead of GPS. */
    demoMode?: boolean;
    operatorId?: Id<"operators">;
    /** How the passenger is paying for the trip. */
    paymentMethod?: PaymentMethod;
    status?: "pending" | "accepted" | "inProgress" | "completed" | "cancelled";
  } = {}
): Promise<Id<"rides">> {
  return await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("rides", {
      commuterId,
      ...(overrides.acceptedAt === undefined
        ? {}
        : { acceptedAt: overrides.acceptedAt }),
      completedAt: overrides.completedAt,
      ...(overrides.demoMode ? { demoMode: true } : {}),
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
      paymentMethod: overrides.paymentMethod ?? "gcash",
      createdAt: now,
      updatedAt: now,
    });
  });
}

/**
 * Signs up, the way the app does: ask for a code, read it back out of the
 * sandbox mailbox, and verify it.
 *
 * The code is only ever stored hashed, so the sandbox mailbox is the only
 * way a test can see it — which is exactly what it is for.
 */
export async function signUp(
  t: ReturnType<typeof createTest>,
  options: {
    acceptedTerms?: boolean;
    email?: string;
    password?: string;
    phone?: string;
    role?: "commuter" | "operator";
  } = {}
): Promise<{ sessionToken: string; role: string }> {
  const email = options.email ?? "signup.tester@gmail.com";
  const phone = options.phone ?? "09171234567";
  const password = options.password ?? "Password1";

  const role = options.role ?? "commuter";

  await t.action(api.auth.requestSignupCode, {
    email,
    name: "Signup Tester",
    password,
    phone,
    role,
    // A driver has to say what they drive.
    licenseNumber: role === "operator" ? "DR-2026-001" : undefined,
    vehicleInfo:
      role === "operator"
        ? { color: "Blue", model: "Honda PCX 160", plateNumber: "ABC 123" }
        : undefined,
  });

  const sandbox = await t.query(api.signupCodes.sandboxCodeForEmail, { email });
  if (!sandbox?.code) {
    throw new Error("The sandbox mailbox did not hold a code");
  }

  return await t.mutation(api.auth.verifySignupCode, {
    acceptedTerms: options.acceptedTerms ?? true,
    acceptedTermsVersion: "1.0",
    code: sandbox.code,
    email,
  });
}

/**
 * Marks a ride as finished at a given time.
 *
 * The map only carries a trip the passenger has just come back from, so a
 * test that wants the map to show a finished trip has to say when it ended.
 */
export async function setCompletedAt(
  t: ReturnType<typeof createTest>,
  rideId: string,
  completedAt: number
): Promise<void> {
  await t.run(async (ctx) => {
    await ctx.db.patch(rideId as Id<"rides">, { completedAt });
  });
}

/**
 * Marks a started trip as having reached the destination.
 *
 * A ride can only be ended once the simulated vehicle has arrived. Tests
 * that are about what happens when a ride ends, not about the drive, use
 * this to skip the drive.
 */
export async function markArrived(
  t: ReturnType<typeof createTest>,
  rideId: Id<"rides">
): Promise<void> {
  await t.run(async (ctx) => {
    await ctx.db.patch(rideId, { arrivedAt: Date.now() });
  });
}
