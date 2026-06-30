import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
// MutationCtx used by rate-limiting helpers

// ─── Constants ────────────────────────────────────────────────────────────────

const PBKDF2_ITERATIONS = 200_000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ─── Password helpers ─────────────────────────────────────────────────────────

async function hashPasswordPBKDF2(password: string): Promise<string> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const saltB64 = btoa(String.fromCharCode(...saltBytes));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations: PBKDF2_ITERATIONS },
    keyMaterial,
    256
  );
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(bits)));
  return `pbkdf2:${PBKDF2_ITERATIONS}:${saltB64}:${hashB64}`;
}

async function verifyPasswordPBKDF2(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const [, iterStr, saltB64, expectedB64] = parts;
  if (saltB64 === undefined || expectedB64 === undefined) return false;

  // Guard against a tampered iteration count in the stored hash
  const iterations = Number(iterStr);
  if (!Number.isInteger(iterations) || iterations < 100_000) return false;

  const saltBytes = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations },
    keyMaterial,
    256
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits))) === expectedB64;
}

// Only used for migrating legacy SHA-256 hashes on first login
async function hashSHA256Legacy(password: string): Promise<string> {
  const data = new TextEncoder().encode(password + "hatud_salt_2024");
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Session helpers ──────────────────────────────────────────────────────────

function generateSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const h = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ─── Rate limiting helpers ────────────────────────────────────────────────────

async function checkRateLimit(ctx: MutationCtx, email: string) {
  const rec = await ctx.db
    .query("loginAttempts")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();
  if (rec?.lockedUntil && Date.now() < rec.lockedUntil) {
    const mins = Math.ceil((rec.lockedUntil - Date.now()) / 60_000);
    throw new Error(`Account locked. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`);
  }
}

async function recordFailedAttempt(ctx: MutationCtx, email: string) {
  const rec = await ctx.db
    .query("loginAttempts")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();
  const count = (rec?.count ?? 0) + 1;
  const lockedUntil =
    count >= 10 ? Date.now() + 3_600_000
    : count >= 5 ? Date.now() + 900_000
    : undefined;
  if (rec) {
    await ctx.db.patch(rec._id, { count, lastAttemptAt: Date.now(), lockedUntil });
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
    if (args.password.length < 8)
      throw new Error("Password must be at least 8 characters");
    if (!/[A-Z]/.test(args.password))
      throw new Error("Password must contain at least one uppercase letter");
    if (!/[0-9]/.test(args.password))
      throw new Error("Password must contain at least one number");

    const existingEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (existingEmail) throw new Error("Email already registered");

    const existingPhone = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .first();
    if (existingPhone) throw new Error("Phone number already registered");

    const passwordHash = await hashPasswordPBKDF2(args.password);
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

    let valid = await verifyPasswordPBKDF2(args.password, user.passwordHash);

    // Transparent migration: if old SHA-256 hash, verify then re-hash with PBKDF2
    if (!valid && !user.passwordHash.startsWith("pbkdf2:")) {
      const legacyHash = await hashSHA256Legacy(args.password);
      if (legacyHash === user.passwordHash) {
        valid = true;
        const newHash = await hashPasswordPBKDF2(args.password);
        await ctx.db.patch(user._id, { passwordHash: newHash, updatedAt: Date.now() });
      }
    }

    if (!valid) {
      await recordFailedAttempt(ctx, args.email);
      throw new Error("Invalid email or password");
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

    // Fetch display name from the role-specific profile table
    const profileTable =
      user.role === "commuter" ? "commuters"
      : user.role === "operator" ? "operators"
      : "admins";
    const profile = await ctx.db
      .query(profileTable)
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    const name = (profile as any)?.name ?? "";

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
    if (!user) return null;

    const profileTable =
      user.role === "commuter" ? "commuters"
      : user.role === "operator" ? "operators"
      : "admins";
    const profile = await ctx.db
      .query(profileTable)
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    return {
      userId: user._id,
      role: user.role,
      name: (profile as any)?.name ?? "",
      email: user.email,
    };
  },
});
