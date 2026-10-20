/**
 * TEMPORARY — delete during the fixoct20 Wave 1c cutover.
 *
 * The Android builds that were exported before this remediation call several
 * queries with no session token at all. These helpers keep those requests
 * working while their users move to the new build.
 *
 * They are deliberately separate from `withAuth.ts` so the cutover is a single
 * self-contained deletion rather than a hunt through the auth layer.
 *
 * Cutover checklist:
 *   1. ship the rebuilt APK and confirm the fleet has migrated,
 *   2. delete this file,
 *   3. change `sessionToken` from `v.optional(v.string())` to `v.string()` on
 *      the affected queries and drop the `*OrLegacy` calls in favour of the
 *      strict helpers in `withAuth.ts`,
 *   4. delete the superseded legacy queries.
 *
 * Note that the responses are always projected to the minimum a counterpart
 * needs, so the compatibility window never re-exposes phone numbers, licence
 * numbers, saved home addresses or live GPS coordinates.
 */

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  type Actor,
  type Role,
  requireRideParticipant,
  resolveActor,
} from "./withAuth";

type Ctx = MutationCtx | QueryCtx;

export interface LegacyRideAccess {
  /** Null when the request carried no session token (legacy client). */
  actor: Actor | null;
  isLegacy: boolean;
  ride: Doc<"rides">;
}

/**
 * A request is "legacy" only when it carries no token at all. A token that is
 * present but invalid must fail loudly rather than fall back.
 */
function isLegacyRequest(token: string | undefined): token is undefined {
  return !token;
}

export async function requireSelfOrLegacy(
  ctx: Ctx,
  token: string | undefined,
  targetUserId: Id<"users">
): Promise<void> {
  if (isLegacyRequest(token)) {
    return;
  }
  const actor = await resolveActor(ctx, token);
  if (actor.role === "admin") {
    return;
  }
  if (actor.userId !== targetUserId) {
    throw new Error("Forbidden: you do not own this resource");
  }
}

export async function requireRoleOrLegacy(
  ctx: Ctx,
  token: string | undefined,
  expectedRole: Role
): Promise<void> {
  if (isLegacyRequest(token)) {
    return;
  }
  const actor = await resolveActor(ctx, token);
  if (actor.role !== expectedRole) {
    throw new Error(`Forbidden: requires ${expectedRole} role`);
  }
}

export async function requireRideAccessOrLegacy(
  ctx: Ctx,
  token: string | undefined,
  rideId: Id<"rides">
): Promise<LegacyRideAccess> {
  if (isLegacyRequest(token)) {
    const ride = await ctx.db.get(rideId);
    if (!ride) {
      throw new Error("Ride not found");
    }
    return { ride, actor: null, isLegacy: true };
  }

  const { actor, ride } = await requireRideParticipant(ctx, token, rideId);
  return { ride, actor, isLegacy: false };
}

/**
 * A commuter profile is visible to the commuter themself, to an admin, and to
 * an operator who shares a ride with them.
 */
export async function requireCommuterVisibleOrLegacy(
  ctx: Ctx,
  token: string | undefined,
  commuterId: Id<"commuters">
): Promise<void> {
  if (isLegacyRequest(token)) {
    return;
  }
  const actor = await resolveActor(ctx, token);
  if (actor.role === "admin") {
    return;
  }
  if (actor.role === "commuter") {
    if (actor.commuterId !== commuterId) {
      throw new Error("Forbidden: you do not own this commuter profile");
    }
    return;
  }
  const rides = await ctx.db
    .query("rides")
    .withIndex("by_commuterId", (q) => q.eq("commuterId", commuterId))
    .collect();
  const sharesRide = rides.some((ride) => ride.operatorId === actor.operatorId);
  if (!sharesRide) {
    throw new Error("Forbidden: you do not own this commuter profile");
  }
}

/**
 * An operator profile is visible to the operator themself, to an admin, and to
 * a commuter who shares a ride with them.
 */
export async function requireOperatorVisibleOrLegacy(
  ctx: Ctx,
  token: string | undefined,
  operatorId: Id<"operators">
): Promise<void> {
  if (isLegacyRequest(token)) {
    return;
  }
  const actor = await resolveActor(ctx, token);
  if (actor.role === "admin") {
    return;
  }
  if (actor.role === "operator") {
    if (actor.operatorId !== operatorId) {
      throw new Error("Forbidden: you do not own this operator profile");
    }
    return;
  }
  const rides = await ctx.db
    .query("rides")
    .withIndex("by_operatorId", (q) => q.eq("operatorId", operatorId))
    .collect();
  const sharesRide = rides.some((ride) => ride.commuterId === actor.commuterId);
  if (!sharesRide) {
    throw new Error("Forbidden: you do not own this operator profile");
  }
}
