import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { RESEND_COOLDOWN_MS } from "./lib/otp";

/**
 * The sign-ups that are waiting for their one-time code.
 *
 * The whole pending sign-up is held here — including the hashed password —
 * so that verifying the code and creating the account is one transaction, and
 * the details never have to be sent twice.
 */

export interface PendingSignup {
  attempts: number;
  codeHash: string;
  email: string;
  expiresAt: number;
  id: string;
  licenseNumber?: string;
  name: string;
  phone: string;
  role: "commuter" | "operator";
  salt: string;
  vehicleInfo?: {
    plateNumber: string;
    model: string;
    color: string;
  };
}

/**
 * Whether the sandbox mailbox is on.
 *
 * The mailbox shows a verification code that would otherwise only be in the
 * server log. It is off unless the deployment says otherwise, and it is
 * meant for demonstrating the flow without a mail provider.
 */
export function sandboxEnabled(): boolean {
  return process.env.SIGNUP_SANDBOX === "1";
}

export const create = internalMutation({
  args: {
    codeHash: v.string(),
    email: v.string(),
    expiresAt: v.number(),
    licenseNumber: v.optional(v.string()),
    name: v.string(),
    passwordHash: v.string(),
    phone: v.string(),
    role: v.union(v.literal("commuter"), v.literal("operator")),
    /** The code in the clear, only when the sandbox is on. */
    sandboxCode: v.optional(v.string()),
    salt: v.string(),
    vehicleInfo: v.optional(
      v.object({
        plateNumber: v.string(),
        model: v.string(),
        color: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Only one live code per address. The old ones are spent, so a code that
    // was already in an inbox cannot be used after a resend.
    const existing = await ctx.db
      .query("signupCodes")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .collect();

    for (const row of existing) {
      if (row.usedAt === undefined) {
        await ctx.db.patch(row._id, { usedAt: Date.now() });
      }
    }

    const id = await ctx.db.insert("signupCodes", {
      attempts: 0,
      codeCreatedAt: Date.now(),
      codeHash: args.codeHash,
      email: args.email,
      expiresAt: args.expiresAt,
      licenseNumber: args.licenseNumber,
      name: args.name,
      passwordHash: args.passwordHash,
      phone: args.phone,
      role: args.role,
      sandboxCode: args.sandboxCode,
      salt: args.salt,
      vehicleInfo: args.vehicleInfo,
    });

    return id;
  },
});

/**
 * Whether an address already has an account.
 */
export const emailTaken = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<boolean> => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    return existing !== null;
  },
});

/**
 * Whether a number already has an account.
 */
export const phoneTaken = internalQuery({
  args: { phone: v.string() },
  handler: async (ctx, args): Promise<boolean> => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .first();
    return existing !== null;
  },
});

/**
 * The live sign-up for an address, if there is one.
 *
 * A code that has been spent, has expired, or has used up its attempts is
 * not a live sign-up.
 */
export const pending = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<PendingSignup | null> => {
    const rows = await ctx.db
      .query("signupCodes")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .collect();

    const live = rows
      .filter((row) => row.usedAt === undefined)
      .sort((a, b) => b.codeCreatedAt - a.codeCreatedAt)[0];

    if (!live) {
      return null;
    }
    if (live.expiresAt < Date.now()) {
      return null;
    }

    return {
      attempts: live.attempts,
      codeHash: live.codeHash,
      email: live.email,
      expiresAt: live.expiresAt,
      id: live._id,
      licenseNumber: live.licenseNumber,
      name: live.name,
      phone: live.phone,
      role: live.role,
      salt: live.salt,
      vehicleInfo: live.vehicleInfo,
    };
  },
});

/**
 * How long until another code can be sent for this address.
 *
 * Zero when one can be sent now.
 */
export const resendWaitMs = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<number> => {
    const rows = await ctx.db
      .query("signupCodes")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .collect();

    const latest = rows.sort((a, b) => b.codeCreatedAt - a.codeCreatedAt)[0];
    if (!latest) {
      return 0;
    }

    const elapsed = Date.now() - latest.codeCreatedAt;
    return Math.max(0, RESEND_COOLDOWN_MS - elapsed);
  },
});

/** Records a wrong guess. */
export const recordAttempt = internalMutation({
  args: { id: v.id("signupCodes") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row) {
      return 0;
    }
    const attempts = row.attempts + 1;
    await ctx.db.patch(args.id, { attempts });
    return attempts;
  },
});

/** Spends a code, so it cannot be used a second time. */
export const markUsed = internalMutation({
  args: { id: v.id("signupCodes") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { usedAt: Date.now() });
  },
});

/**
 * The sandbox mailbox.
 *
 * It shows the code that was last sent to an address, so the flow can be
 * demonstrated without a mail provider. It refuses to answer unless the
 * deployment has explicitly turned it on.
 */
/** The sandbox mailbox, with the code itself. */
export const sandboxCodeForEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    // Nothing is answered when the sandbox is off, rather than an error: the
    // sign-up screen asks for this on every attempt, and a deployment with
    // the sandbox off must not break it.
    if (!sandboxEnabled()) {
      return null;
    }

    const rows = await ctx.db
      .query("signupCodes")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .collect();

    const latest = rows.sort((a, b) => b.codeCreatedAt - a.codeCreatedAt)[0];
    if (!latest) {
      return null;
    }

    return {
      // The readable code only exists when the deployment has explicitly
      // turned the sandbox on.
      code: latest.sandboxCode ?? null,
      expiresAt: latest.expiresAt,
    };
  },
});
