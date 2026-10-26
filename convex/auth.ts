import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { hashPassword, verifyPassword } from "./lib/password";

// MutationCtx used by rate-limiting helpers

// ─── Constants ────────────────────────────────────────────────────────────────

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_FAILED_ATTEMPTS = 10;
const SHORT_LOCK_THRESHOLD = 5;
const SHORT_LOCK_MS = 900_000; // 15 minutes
const LONG_LOCK_MS = 3_600_000; // 1 hour

const UPPERCASE_LETTER = /[A-Z]/;
const DIGIT = /[0-9]/;

// ─── Session helpers ──────────────────────────────────────────────────────────

function resolveLockDuration(failureCount: number): number | undefined {
  if (failureCount >= MAX_FAILED_ATTEMPTS) {
    return Date.now() + LONG_LOCK_MS;
  }
  if (failureCount >= SHORT_LOCK_THRESHOLD) {
    return Date.now() + SHORT_LOCK_MS;
  }
  return;
}

function generateSessionToken(): string {
  return crypto.randomUUID();
}

async function getProfileName(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  role: "commuter" | "operator" | "admin"
): Promise<string> {
  if (role === "commuter") {
    const profile = await ctx.db
      .query("commuters")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    return profile?.name ?? "";
  }
  if (role === "operator") {
    const profile = await ctx.db
      .query("operators")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    return profile?.name ?? "";
  }
  const profile = await ctx.db
    .query("admins")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
  return profile?.name ?? "";
}

// ─── Rate limiting helpers ────────────────────────────────────────────────────

async function checkRateLimit(ctx: MutationCtx, email: string) {
  const rec = await ctx.db
    .query("loginAttempts")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();
  if (rec?.lockedUntil && Date.now() < rec.lockedUntil) {
    const mins = Math.ceil((rec.lockedUntil - Date.now()) / 60_000);
    throw new Error(
      `Account locked. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`
    );
  }
}

async function recordFailedAttempt(ctx: MutationCtx, email: string) {
  const rec = await ctx.db
    .query("loginAttempts")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();

  // A lock that has already expired resets the counter, otherwise the user
  // re-locks on their next attempt hours later.
  const lockExpired =
    rec?.lockedUntil !== undefined && rec.lockedUntil <= Date.now();
  const previousCount = lockExpired ? 0 : (rec?.count ?? 0);
  const count = previousCount + 1;

  const lockedUntil = resolveLockDuration(count);

  if (rec) {
    await ctx.db.patch(rec._id, {
      count,
      lastAttemptAt: Date.now(),
      lockedUntil,
    });
  } else {
    await ctx.db.insert("loginAttempts", {
      email,
      count,
      lastAttemptAt: Date.now(),
      lockedUntil,
    });
  }
}

async function clearLoginAttempts(ctx: MutationCtx, email: string) {
  const rec = await ctx.db
    .query("loginAttempts")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();
  if (rec) {
    await ctx.db.patch(rec._id, {
      count: 0,
      lockedUntil: undefined,
      lastAttemptAt: Date.now(),
    });
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export const signup = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    password: v.string(),
    // Admin accounts cannot be created via public signup
    role: v.union(v.literal("commuter"), v.literal("operator")),
    licenseNumber: v.optional(v.string()),
    vehicleInfo: v.optional(
      v.object({
        plateNumber: v.string(),
        model: v.string(),
        color: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Server-side password strength validation
    if (args.password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }
    if (!UPPERCASE_LETTER.test(args.password)) {
      throw new Error("Password must contain at least one uppercase letter");
    }
    if (!DIGIT.test(args.password)) {
      throw new Error("Password must contain at least one number");
    }

    const existingEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (existingEmail) {
      throw new Error("Email already registered");
    }

    const existingPhone = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .first();
    if (existingPhone) {
      throw new Error("Phone number already registered");
    }

    const passwordHash = await hashPassword(args.password);
    const now = Date.now();

    const userId = await ctx.db.insert("users", {
      email: args.email,
      passwordHash,
      phone: args.phone,
      role: args.role,
      createdAt: now,
      updatedAt: now,
    });

    if (args.role === "commuter") {
      await ctx.db.insert("commuters", {
        userId,
        name: args.name,
        email: args.email,
        phone: args.phone,
        savedLocations: [],
        createdAt: now,
        updatedAt: now,
      });
    } else if (args.role === "operator") {
      if (!(args.licenseNumber && args.vehicleInfo)) {
        throw new Error("Operator requires license number and vehicle info");
      }
      await ctx.db.insert("operators", {
        userId,
        name: args.name,
        email: args.email,
        phone: args.phone,
        licenseNumber: args.licenseNumber,
        vehicleInfo: args.vehicleInfo,
        isAvailable: false,
        // A new driver waits for an admin to clear them before they can go
        // online or accept a ride.
        approvalStatus: "pending",
        currentLocation: undefined,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Auto-login: return a session token so the user is immediately logged in
    const token = generateSessionToken();
    await ctx.db.insert("sessions", {
      userId,
      token,
      expiresAt: now + SESSION_TTL_MS,
      createdAt: now,
      isRevoked: false,
    });

    return { sessionToken: token, role: args.role };
  },
});

export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    await checkRateLimit(ctx, args.email);

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      await recordFailedAttempt(ctx, args.email);
      throw new Error("Invalid email or password");
    }

    const { valid, needsRehash } = await verifyPassword(
      args.password,
      user.passwordHash
    );

    if (!valid) {
      await recordFailedAttempt(ctx, args.email);
      throw new Error("Invalid email or password");
    }

    // Transparent migration: legacy SHA-256 hashes are upgraded on first login.
    if (needsRehash) {
      await ctx.db.patch(user._id, {
        passwordHash: await hashPassword(args.password),
        updatedAt: Date.now(),
      });
    }

    await clearLoginAttempts(ctx, args.email);

    const token = generateSessionToken();
    const now = Date.now();
    await ctx.db.insert("sessions", {
      userId: user._id,
      token,
      expiresAt: now + SESSION_TTL_MS,
      createdAt: now,
      isRevoked: false,
    });

    // Record the sign-in on the user record.
    await ctx.db.patch(user._id, { updatedAt: now });

    const name = await getProfileName(ctx, user._id, user.role);

    return { sessionToken: token, role: user.role, name };
  },
});

export const logout = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
      .first();
    if (session) {
      await ctx.db.patch(session._id, { isRevoked: true });
    }
    // Idempotent — no error if session not found
  },
});

// ─── Queries ──────────────────────────────────────────────────────────────────

export const getSession = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
      .first();

    if (!session || session.isRevoked || Date.now() > session.expiresAt) {
      return null;
    }

    const user = await ctx.db.get(session.userId);
    if (!user) {
      return null;
    }

    const name = await getProfileName(ctx, user._id, user.role);

    return {
      userId: user._id,
      role: user.role,
      name,
      email: user.email,
    };
  },
});
