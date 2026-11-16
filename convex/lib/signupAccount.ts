import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { hashPassword } from "./password";

/**
 * Creating an account from a verified sign-up.
 *
 * The body of the old `auth.signup` mutation, extracted into a plain helper
 * so that the verification and the creation can happen in one transaction
 * without a Convex function reaching for a function of its own module.
 */

export interface SignupDetails {
  /** The version of the terms that were accepted. */
  acceptedTermsVersion: string;
  email: string;
  licenseNumber?: string;
  name: string;
  /** The password, when the caller has it. */
  password?: string;
  phone: string;
  role: "commuter" | "operator";
  vehicleInfo?: {
    plateNumber: string;
    model: string;
    color: string;
  };
}

export interface CreatedAccount {
  role: "commuter" | "operator";
  sessionToken: string;
  userId: Id<"users">;
}

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function generateSessionToken(): string {
  return crypto.randomUUID();
}

/**
 * Creates the user, the role profile and the session.
 *
 * The password is hashed here, so a caller that already has a hash — the
 * verification step — does not have to hash it again.
 */
export async function createAccountFromSignup(
  ctx: MutationCtx,
  details: SignupDetails & { passwordHash?: string }
): Promise<CreatedAccount> {
  const now = Date.now();
  let passwordHash = details.passwordHash;
  if (!passwordHash) {
    if (details.password === undefined) {
      throw new Error("A password or a password hash is required");
    }
    passwordHash = await hashPassword(details.password);
  }

  const userId = await ctx.db.insert("users", {
    acceptedTermsAt: now,
    acceptedTermsVersion: details.acceptedTermsVersion,
    createdAt: now,
    email: details.email,
    emailVerifiedAt: now,
    passwordHash,
    phone: details.phone,
    role: details.role,
    updatedAt: now,
  });

  if (details.role === "commuter") {
    await ctx.db.insert("commuters", {
      createdAt: now,
      email: details.email,
      name: details.name,
      phone: details.phone,
      savedLocations: [],
      updatedAt: now,
      userId,
    });
  } else {
    if (!(details.licenseNumber && details.vehicleInfo)) {
      throw new Error("Operator requires license number and vehicle info");
    }
    await ctx.db.insert("operators", {
      approvalStatus: "pending",
      createdAt: now,
      // A new driver waits for an admin to clear them before they can go
      // online or accept a ride.
      currentLocation: undefined,
      email: details.email,
      isAvailable: false,
      licenseNumber: details.licenseNumber,
      name: details.name,
      phone: details.phone,
      updatedAt: now,
      userId,
      vehicleInfo: details.vehicleInfo,
    });
  }

  // Auto-login: return a session token so the user is immediately logged in
  const token = generateSessionToken();
  await ctx.db.insert("sessions", {
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
    isRevoked: false,
    token,
    userId,
  });

  return { role: details.role, sessionToken: token, userId };
}
