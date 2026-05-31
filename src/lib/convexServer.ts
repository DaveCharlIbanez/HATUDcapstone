import {
  fetchAction,
  fetchMutation,
  fetchQuery,
  preloadQuery,
} from "convex/nextjs";
import type { FunctionReference } from "convex/server";
import type {
  ConvexAuthSession,
  ConvexCommuterProfile,
  ConvexOperatorProfile,
  ConvexPaymentMethod,
  ConvexRide,
  ConvexUser,
} from "./convexConfig";
import { getConvexUrl } from "./convexConfig";

export type {
  ConvexAuthSession,
  ConvexCommuterProfile,
  ConvexOperatorProfile,
  ConvexPaymentMethod,
  ConvexRide,
  ConvexUser,
};
export { getConvexUrl };

/**
 * A thin wrapper for Convex queries from Next.js server components and route handlers.
 */
// @ts-expect-error - args type mismatch with Convex's complex generic signatures
export async function convexQuery(
  query: FunctionReference<"query">,
  ...args: any[]
): Promise<any> {
  // @ts-expect-error
  return fetchQuery(query, ...args);
}

/**
 * A thin wrapper for Convex mutations from Next.js server components and route handlers.
 */
// @ts-expect-error
export async function convexMutation(
  mutation: FunctionReference<"mutation">,
  ...args: any[]
): Promise<any> {
  // @ts-expect-error
  return fetchMutation(mutation, ...args);
}

/**
 * A thin wrapper for Convex actions from Next.js server components and route handlers.
 */
// @ts-expect-error
export async function convexAction(
  action: FunctionReference<"action">,
  ...args: any[]
): Promise<any> {
  // @ts-expect-error
  return fetchAction(action, ...args);
}

/**
 * Preload Convex query results for a React client component.
 */
// @ts-expect-error
export async function convexPreload(
  query: FunctionReference<"query">,
  ...args: any[]
): Promise<any> {
  // @ts-expect-error
  return preloadQuery(query, ...args);
}

// Ensure the Convex URL is available as early as possible.
getConvexUrl();
