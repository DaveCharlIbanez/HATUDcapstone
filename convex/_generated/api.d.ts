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
import type * as crons from "../crons.js";
import type * as feedback from "../feedback.js";
import type * as lib_fare from "../lib/fare.js";
import type * as lib_legacyAccess from "../lib/legacyAccess.js";
import type * as lib_password from "../lib/password.js";
import type * as lib_payments from "../lib/payments.js";
import type * as lib_projections from "../lib/projections.js";
import type * as lib_withAuth from "../lib/withAuth.js";
import type * as messages from "../messages.js";
import type * as operators from "../operators.js";
import type * as payments from "../payments.js";
import type * as rides from "../rides.js";
import type * as seed from "../seed.js";
import type * as theme from "../theme.js";

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
  crons: typeof crons;
  feedback: typeof feedback;
  "lib/fare": typeof lib_fare;
  "lib/legacyAccess": typeof lib_legacyAccess;
  "lib/password": typeof lib_password;
  "lib/payments": typeof lib_payments;
  "lib/projections": typeof lib_projections;
  "lib/withAuth": typeof lib_withAuth;
  messages: typeof messages;
  operators: typeof operators;
  payments: typeof payments;
  rides: typeof rides;
  seed: typeof seed;
  theme: typeof theme;
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
