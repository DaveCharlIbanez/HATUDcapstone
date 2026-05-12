import { fetchAction, fetchMutation, fetchQuery, preloadQuery } from "convex/nextjs";
import { getConvexUrl } from "./convexConfig";
import type {
  ConvexAuthSession,
  ConvexCommuterProfile,
  ConvexOperatorProfile,
  ConvexPaymentMethod,
  ConvexRide,
  ConvexUser,
} from "./convexConfig";

export { getConvexUrl };
export type {
  ConvexUser,
  ConvexAuthSession,
  ConvexOperatorProfile,
  ConvexCommuterProfile,
  ConvexRide,
  ConvexPaymentMethod,
};

/**
 * A thin wrapper for Convex queries from Next.js server components and route handlers.
 */
export async function convexQuery<Query extends unknown>(query: Query, ...args: any[]) {
  return fetchQuery(query, ...args);
}

/**
 * A thin wrapper for Convex mutations from Next.js server components and route handlers.
 */
export async function convexMutation<Mutation extends unknown>(mutation: Mutation, ...args: any[]) {
  return fetchMutation(mutation, ...args);
}

/**
 * A thin wrapper for Convex actions from Next.js server components and route handlers.
 */
export async function convexAction<Action extends unknown>(action: Action, ...args: any[]) {
  return fetchAction(action, ...args);
}

/**
 * Preload Convex query results for a React client component.
 */
export async function convexPreload<Query extends unknown>(query: Query, ...args: any[]) {
  return preloadQuery(query, ...args);
}

// Ensure the Convex URL is available as early as possible.
getConvexUrl();
