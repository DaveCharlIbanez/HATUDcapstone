import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { action, mutation, query } from "./_generated/server";
import { emailProvider, otpEmailMessage } from "./lib/email";
import {
  generateOtpCode,
  hashOtp,
  MAX_OTP_ATTEMPTS,
  matchesOtp,
  newOtpSalt,
  OTP_TTL_MS,
  RESEND_COOLDOWN_MS,
} from "./lib/otp";
import { hashPassword, verifyPassword } from "./lib/password";
import { createAccountFromSignup } from "./lib/signupAccount";
import {
  isGmailAddress,
  isValidPhone,
  normaliseEmail,
  normalisePhone,
} from "./lib/signupRules";
import { requireAuth } from "./lib/withAuth";
import { clearPresence } from "./presence";
import { sandboxEnabled } from "./signupCodes";

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

/**
 * The password rules, checked on the server.
 */
function validatePassword(password: string): void {
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
  if (!UPPERCASE_LETTER.test(password)) {
    throw new Error("Password must contain at least one uppercase letter");
  }
  if (!DIGIT.test(password)) {
    throw new Error("Password must contain at least one number");
  }
}

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

/**
 * Asks for a sign-up code, and sends it to the address.
 *
 * This is the first half of signing up. It checks the rules, checks that the
 * address and the number are free, stores the pending sign-up with a hashed
 * code, and sends the code. No account exists yet.
 *
 * It is an action because it sends an email, and a Convex action is the only
 * kind of function that can make a network call.
 */
export const requestSignupCode = action({
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
  handler: async (
    ctx,
    args
  ): Promise<{
    email: string;
    expiresInSeconds: number;
    resendInSeconds: number;
  }> => {
    const email = normaliseEmail(args.email);

    if (!isGmailAddress(email)) {
      throw new Error("Use a Gmail address, for example you@gmail.com.");
    }
    if (!isValidPhone(args.phone)) {
      throw new Error(
        "Enter your 11-digit mobile number, for example 09171234567."
      );
    }
    validatePassword(args.password);

    if (args.role === "operator" && !(args.licenseNumber && args.vehicleInfo)) {
      throw new Error("Operator requires license number and vehicle info");
    }

    const phone = normalisePhone(args.phone);

    const takenEmail = await ctx.runQuery(internal.signupCodes.emailTaken, {
      email,
    });
    if (takenEmail) {
      throw new Error("Email already registered");
    }
    const takenPhone = await ctx.runQuery(internal.signupCodes.phoneTaken, {
      phone,
    });
    if (takenPhone) {
      throw new Error("Phone number already registered");
    }

    const waitMs = await ctx.runQuery(internal.signupCodes.resendWaitMs, {
      email,
    });
    if (waitMs > 0) {
      throw new Error(
        `Please wait ${Math.ceil(waitMs / 1000)} seconds before asking for another code.`
      );
    }

    const code = generateOtpCode();
    const salt = newOtpSalt();
    const codeHash = await hashOtp(code, salt);
    const passwordHash = await hashPassword(args.password);
    const expiresAt = Date.now() + OTP_TTL_MS;

    await ctx.runMutation(internal.signupCodes.create, {
      codeHash,
      email,
      expiresAt,
      licenseNumber: args.licenseNumber,
      name: args.name,
      passwordHash,
      phone,
      role: args.role,
      // The code is only kept in the clear when the deployment has
      // explicitly turned the sandbox on, so the mailbox can show it.
      sandboxCode: sandboxEnabled() ? code : undefined,
      salt,
      vehicleInfo: args.vehicleInfo,
    });

    await emailProvider().send(
      otpEmailMessage({
        code,
        name: args.name,
        to: email,
        validMinutes: Math.round(OTP_TTL_MS / 60_000),
      })
    );

    return {
      email,
      expiresInSeconds: Math.round(OTP_TTL_MS / 1000),
      resendInSeconds: Math.round(RESEND_COOLDOWN_MS / 1000),
    };
  },
});

/**
 * Verifies the code, and creates the account.
 *
 * The second half of signing up. The code has to be right, the terms have to
 * have been accepted, and only then does an account exist — all in one
 * transaction, so a code can never create an account on its own.
 */
export const verifySignupCode = mutation({
  args: {
    email: v.string(),
    code: v.string(),
    // The terms have to be accepted before an account exists. The tick box
    // on the client is a courtesy; this is the control.
    acceptedTerms: v.boolean(),
    // The version that was accepted, so an acceptance is never recorded
    // without saying which terms it was for.
    acceptedTermsVersion: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ role: "commuter" | "operator"; sessionToken: string }> => {
    if (!args.acceptedTerms) {
      throw new Error(
        "You must accept the Terms and Conditions to create an account"
      );
    }

    const email = normaliseEmail(args.email);
    const pending = await ctx.runQuery(internal.signupCodes.pending, { email });

    if (!pending) {
      throw new Error(
        "That code has expired or has already been used. Ask for a new one."
      );
    }

    if (pending.attempts >= MAX_OTP_ATTEMPTS) {
      throw new Error("Too many wrong attempts. Ask for a new code.");
    }

    const matches = await matchesOtp(
      args.code.trim(),
      pending.salt,
      pending.codeHash
    );
    if (!matches) {
      const attempts = await ctx.runMutation(
        internal.signupCodes.recordAttempt,
        {
          id: pending.id as Id<"signupCodes">,
        }
      );
      const left = Math.max(0, MAX_OTP_ATTEMPTS - attempts);
      throw new Error(
        left > 0
          ? `That code is not right. ${left} attempt${left === 1 ? "" : "s"} left.`
          : "Too many wrong attempts. Ask for a new code."
      );
    }

    // The address and the number are checked again here, in a transaction,
    // where the answer counts. Two codes for the same address can be
    // requested, but only one account can exist.
    const takenEmail = await ctx.runQuery(internal.signupCodes.emailTaken, {
      email,
    });
    if (takenEmail) {
      throw new Error("Email already registered");
    }
    const takenPhone = await ctx.runQuery(internal.signupCodes.phoneTaken, {
      phone: pending.phone,
    });
    if (takenPhone) {
      throw new Error("Phone number already registered");
    }

    const created = await createAccountFromSignup(ctx, {
      acceptedTermsVersion: args.acceptedTermsVersion,
      email: pending.email,
      licenseNumber: pending.licenseNumber,
      name: pending.name,
      passwordHash:
        (await ctx.db.get(pending.id as Id<"signupCodes">))?.passwordHash ?? "",
      phone: pending.phone,
      role: pending.role,
      vehicleInfo: pending.vehicleInfo,
    });

    await ctx.runMutation(internal.signupCodes.markUsed, {
      id: pending.id as Id<"signupCodes">,
    });

    return { role: created.role, sessionToken: created.sessionToken };
  },
});

/**
 * Changes the password of the signed-in account.
 *
 * The current password has to be given, so that nobody who finds a phone with
 * the app open can lock the owner out of their own account. The session is
 * left alone: changing a password is not a sign-out.
 */
export const changePassword = mutation({
  args: {
    sessionToken: v.string(),
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  returns: v.object({ changed: v.boolean(), role: v.string() }),
  handler: async (ctx, args) => {
    const { userId, role } = await requireAuth(ctx, args.sessionToken);

    validatePassword(args.newPassword);

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("Account not found");
    }

    const check = await verifyPassword(args.currentPassword, user.passwordHash);
    if (!check.valid) {
      throw new Error("Your current password is not right");
    }

    await ctx.db.patch(userId, {
      passwordHash: await hashPassword(args.newPassword),
      updatedAt: Date.now(),
    });

    // Every other session on this account is ended, so a password change
    // actually locks out anyone who had copied it.
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    for (const session of sessions) {
      if (session.token !== args.sessionToken) {
        await ctx.db.patch(session._id, { isRevoked: true });
      }
    }

    return { changed: true, role };
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
      // Logging out takes the user offline at once, and a driver off shift
      // (fixoct51): a driver who has signed out is not taking rides.
      await clearPresence(ctx, session.userId);
      const operator = await ctx.db
        .query("operators")
        .withIndex("by_userId", (q) => q.eq("userId", session.userId))
        .first();
      if (operator?.isAvailable) {
        await ctx.db.patch(operator._id, {
          isAvailable: false,
          updatedAt: Date.now(),
        });
      }
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
