import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

async function resolveSession(ctx: MutationCtx | QueryCtx, token: string) {
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .first();

  if (!session || session.isRevoked || Date.now() > session.expiresAt) {
    throw new Error("Unauthorized: invalid or expired session");
  }

  const user = await ctx.db.get(session.userId);
  if (!user) throw new Error("Unauthorized: user not found");

  return { userId: session.userId as Id<"users">, role: user.role };
}

export async function requireAuth(ctx: MutationCtx | QueryCtx, token: string) {
  return resolveSession(ctx, token);
}

export async function requireRole(
  ctx: MutationCtx | QueryCtx,
  token: string,
  expectedRole: "commuter" | "operator" | "admin"
) {
  const { userId, role } = await resolveSession(ctx, token);
  if (role !== expectedRole)
    throw new Error(`Forbidden: requires ${expectedRole} role`);
  return { userId };
}

export async function requireOwnership(
  ctx: MutationCtx | QueryCtx,
  token: string,
  resourceUserId: Id<"users">
) {
  const { userId, role } = await resolveSession(ctx, token);
  if (role === "admin") return;
  if (userId !== resourceUserId)
    throw new Error("Forbidden: you do not own this resource");
}

export async function requireOperatorOwnership(
  ctx: MutationCtx | QueryCtx,
  token: string,
  operatorId: Id<"operators">
) {
  const { userId, role } = await resolveSession(ctx, token);
  if (role === "admin") return;
  const operator = await ctx.db.get(operatorId);
  if (!operator || operator.userId !== userId)
    throw new Error("Forbidden: you do not own this operator profile");
}

export async function requireCommuterOwnership(
  ctx: MutationCtx | QueryCtx,
  token: string,
  commuterId: Id<"commuters">
) {
  const { userId, role } = await resolveSession(ctx, token);
  if (role === "admin") return;
  const commuter = await ctx.db.get(commuterId);
  if (!commuter || commuter.userId !== userId)
    throw new Error("Forbidden: you do not own this commuter profile");
}
