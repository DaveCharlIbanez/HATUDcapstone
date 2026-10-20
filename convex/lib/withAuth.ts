import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export type Role = "commuter" | "operator" | "admin";

/**
 * The identity behind a session token, plus the id of the role profile that
 * belongs to it. The profile id is resolved server-side — clients never send
 * one, so they cannot ask for someone else's record.
 */
export interface Actor {
  adminId?: Id<"admins">;
  commuterId?: Id<"commuters">;
  operatorId?: Id<"operators">;
  role: Role;
  userId: Id<"users">;
}

export interface RideAccess {
  actor: Actor;
  isAdmin: boolean;
  ride: Doc<"rides">;
}

type Ctx = MutationCtx | QueryCtx;

async function resolveSession(ctx: Ctx, token: string) {
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .first();

  if (!session || session.isRevoked || Date.now() > session.expiresAt) {
    throw new Error("Unauthorized: invalid or expired session");
  }

  const user = await ctx.db.get(session.userId);
  if (!user) {
    throw new Error("Unauthorized: user not found");
  }

  return { userId: session.userId as Id<"users">, role: user.role };
}

/**
 * Resolves a session token to an actor, including the id of the caller's own
 * role profile.
 */
export async function resolveActor(ctx: Ctx, token: string): Promise<Actor> {
  const { userId, role } = await resolveSession(ctx, token);
  const actor: Actor = { userId, role };

  if (role === "commuter") {
    const profile = await ctx.db
      .query("commuters")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (profile) {
      actor.commuterId = profile._id;
    }
  } else if (role === "operator") {
    const profile = await ctx.db
      .query("operators")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (profile) {
      actor.operatorId = profile._id;
    }
  } else {
    const profile = await ctx.db
      .query("admins")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (profile) {
      actor.adminId = profile._id;
    }
  }

  return actor;
}

export async function requireAuth(ctx: Ctx, token: string) {
  const { userId, role } = await resolveSession(ctx, token);
  return { userId, role };
}

export async function requireRole(ctx: Ctx, token: string, expectedRole: Role) {
  const { userId, role } = await resolveSession(ctx, token);
  if (role !== expectedRole) {
    throw new Error(`Forbidden: requires ${expectedRole} role`);
  }
  return { userId };
}

export async function requireOwnership(
  ctx: Ctx,
  token: string,
  resourceUserId: Id<"users">
) {
  const { userId, role } = await resolveSession(ctx, token);
  if (role === "admin") {
    return;
  }
  if (userId !== resourceUserId) {
    throw new Error("Forbidden: you do not own this resource");
  }
}

export async function requireOperatorOwnership(
  ctx: Ctx,
  token: string,
  operatorId: Id<"operators">
) {
  const { userId, role } = await resolveSession(ctx, token);
  if (role === "admin") {
    return;
  }
  const operator = await ctx.db.get(operatorId);
  if (!operator || operator.userId !== userId) {
    throw new Error("Forbidden: you do not own this operator profile");
  }
}

export async function requireCommuterOwnership(
  ctx: Ctx,
  token: string,
  commuterId: Id<"commuters">
) {
  const { userId, role } = await resolveSession(ctx, token);
  if (role === "admin") {
    return;
  }
  const commuter = await ctx.db.get(commuterId);
  if (!commuter || commuter.userId !== userId) {
    throw new Error("Forbidden: you do not own this commuter profile");
  }
}

/**
 * Gate for reading a ride the caller takes part in. Admins bypass the
 * participation check; everyone else must be the ride's commuter or its
 * assigned operator.
 */
export async function requireRideParticipant(
  ctx: Ctx,
  token: string,
  rideId: Id<"rides">
): Promise<RideAccess> {
  const actor = await resolveActor(ctx, token);
  const ride = await ctx.db.get(rideId);

  if (!ride) {
    throw new Error("Ride not found");
  }

  if (actor.role === "admin") {
    return { actor, ride, isAdmin: true };
  }

  if (
    actor.role === "commuter" &&
    (!actor.commuterId || ride.commuterId !== actor.commuterId)
  ) {
    throw new Error("Forbidden: you are not part of this ride");
  }

  if (
    actor.role === "operator" &&
    (!actor.operatorId || ride.operatorId !== actor.operatorId)
  ) {
    throw new Error("Forbidden: you are not assigned to this ride");
  }

  return { actor, ride, isAdmin: false };
}
