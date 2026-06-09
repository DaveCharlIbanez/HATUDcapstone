/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as adminQueries from "../adminQueries.js";
import type * as admins from "../admins.js";
import type * as auth from "../auth.js";
import type * as commuters from "../commuters.js";
import type * as feedback from "../feedback.js";
import type * as lib_withAuth from "../lib/withAuth.js";
import type * as operators from "../operators.js";
import type * as rides from "../rides.js";
import type * as seed from "../seed.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  adminQueries: typeof adminQueries;
  admins: typeof admins;
  auth: typeof auth;
  commuters: typeof commuters;
  feedback: typeof feedback;
  "lib/withAuth": typeof lib_withAuth;
  operators: typeof operators;
  rides: typeof rides;
  seed: typeof seed;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
