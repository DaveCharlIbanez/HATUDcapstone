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
import type * as documents from "../documents.js";
import type * as feedback from "../feedback.js";
import type * as lib_approval from "../lib/approval.js";
import type * as lib_arrival from "../lib/arrival.js";
import type * as lib_cancellation from "../lib/cancellation.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_fare from "../lib/fare.js";
import type * as lib_imageType from "../lib/imageType.js";
import type * as lib_legacyAccess from "../lib/legacyAccess.js";
import type * as lib_legacyClients from "../lib/legacyClients.js";
import type * as lib_otp from "../lib/otp.js";
import type * as lib_password from "../lib/password.js";
import type * as lib_paymentMethods from "../lib/paymentMethods.js";
import type * as lib_payments from "../lib/payments.js";
import type * as lib_projections from "../lib/projections.js";
import type * as lib_rideState from "../lib/rideState.js";
import type * as lib_routeProgress from "../lib/routeProgress.js";
import type * as lib_routing from "../lib/routing.js";
import type * as lib_settlement from "../lib/settlement.js";
import type * as lib_signupAccount from "../lib/signupAccount.js";
import type * as lib_signupRules from "../lib/signupRules.js";
import type * as lib_simulationState from "../lib/simulationState.js";
import type * as lib_withAuth from "../lib/withAuth.js";
import type * as messages from "../messages.js";
import type * as operators from "../operators.js";
import type * as payments from "../payments.js";
import type * as presence from "../presence.js";
import type * as profile from "../profile.js";
import type * as repair from "../repair.js";
import type * as rideBooking from "../rideBooking.js";
import type * as rideCompletion from "../rideCompletion.js";
import type * as rideSimulation from "../rideSimulation.js";
import type * as rideSimulationRoute from "../rideSimulationRoute.js";
import type * as rides from "../rides.js";
import type * as routeCache from "../routeCache.js";
import type * as routeDistances from "../routeDistances.js";
import type * as seed from "../seed.js";
import type * as signupCodes from "../signupCodes.js";
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
  documents: typeof documents;
  feedback: typeof feedback;
  "lib/approval": typeof lib_approval;
  "lib/arrival": typeof lib_arrival;
  "lib/cancellation": typeof lib_cancellation;
  "lib/email": typeof lib_email;
  "lib/fare": typeof lib_fare;
  "lib/imageType": typeof lib_imageType;
  "lib/legacyAccess": typeof lib_legacyAccess;
  "lib/legacyClients": typeof lib_legacyClients;
  "lib/otp": typeof lib_otp;
  "lib/password": typeof lib_password;
  "lib/paymentMethods": typeof lib_paymentMethods;
  "lib/payments": typeof lib_payments;
  "lib/projections": typeof lib_projections;
  "lib/rideState": typeof lib_rideState;
  "lib/routeProgress": typeof lib_routeProgress;
  "lib/routing": typeof lib_routing;
  "lib/settlement": typeof lib_settlement;
  "lib/signupAccount": typeof lib_signupAccount;
  "lib/signupRules": typeof lib_signupRules;
  "lib/simulationState": typeof lib_simulationState;
  "lib/withAuth": typeof lib_withAuth;
  messages: typeof messages;
  operators: typeof operators;
  payments: typeof payments;
  presence: typeof presence;
  profile: typeof profile;
  repair: typeof repair;
  rideBooking: typeof rideBooking;
  rideCompletion: typeof rideCompletion;
  rideSimulation: typeof rideSimulation;
  rideSimulationRoute: typeof rideSimulationRoute;
  rides: typeof rides;
  routeCache: typeof routeCache;
  routeDistances: typeof routeDistances;
  seed: typeof seed;
  signupCodes: typeof signupCodes;
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
