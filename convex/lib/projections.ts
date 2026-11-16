/**
 * Role-scoped projections.
 *
 * A Convex document holds more than the other party on a ride is allowed to
 * see. Returning whole documents is how phone numbers, licence numbers, saved
 * home addresses and live GPS coordinates leak. Every function that crosses a
 * role boundary must project explicitly.
 */

import type { Doc, Id } from "../_generated/dataModel";
import { approvalStatusOf } from "./approval";

export type CommuterDoc = Doc<"commuters">;
export type OperatorDoc = Doc<"operators">;

export interface CommuterSelfView {
  _id: CommuterDoc["_id"];
  email: string;
  name: string;
  phone: string;
  savedLocations: CommuterDoc["savedLocations"];
}

export interface OperatorSelfView {
  _id: Id<"operators">;
  /** Where the driver is in the approval flow. */
  approvalStatus: "approved" | "pending" | "rejected";
  currentLocation: Doc<"operators">["currentLocation"];
  email: string;
  isAvailable: boolean;
  licenseNumber: string;
  name: string;
  phone: string;
  /** Why the last application was refused, if it was. */
  rejectionNote: string | null;
  vehicleInfo: Doc<"operators">["vehicleInfo"];
}

/** What a passenger may see of the driver they are matched with. */
export interface OperatorCounterpartView {
  _id: OperatorDoc["_id"];
  name: string;
  vehicleInfo: OperatorDoc["vehicleInfo"];
}

/**
 * The publicly visible operator record: enough to render a driver card and
 * their availability, without the licence number, phone number or live
 * position.
 */
export interface OperatorPublicView extends OperatorCounterpartView {
  isAvailable: boolean;
}

/** What a driver may see of the passenger they are matched with. */
export interface CommuterCounterpartView {
  _id: CommuterDoc["_id"];
  name: string;
  phone: string;
}

/**
 * The publicly visible commuter record: no email, no saved home addresses.
 */
export interface CommuterPublicView {
  _id: CommuterDoc["_id"];
  name: CommuterDoc["name"];
}

/**
 * What a driver may see of a passenger who has an open request.
 *
 * This is deliberately less than `CommuterCounterpartView`: the phone number
 * belongs to a counterpart on a ride the driver has accepted, not to every
 * passenger in the deployment who happens to have a request open.
 */
export interface CommuterQueueView {
  _id: CommuterDoc["_id"];
  name: CommuterDoc["name"];
}

export function projectCommuterSelf(commuter: CommuterDoc): CommuterSelfView {
  return {
    _id: commuter._id,
    name: commuter.name,
    email: commuter.email,
    phone: commuter.phone,
    savedLocations: commuter.savedLocations,
  };
}

export function projectOperatorSelf(operator: OperatorDoc): OperatorSelfView {
  return {
    _id: operator._id,
    approvalStatus: approvalStatusOf(operator),
    name: operator.name,
    email: operator.email,
    phone: operator.phone,
    licenseNumber: operator.licenseNumber,
    rejectionNote: operator.rejectionNote ?? null,
    vehicleInfo: operator.vehicleInfo,
    isAvailable: operator.isAvailable,
    currentLocation: operator.currentLocation,
  };
}

export function projectOperatorForCounterpart(
  operator: OperatorDoc
): OperatorCounterpartView {
  return {
    _id: operator._id,
    name: operator.name,
    vehicleInfo: operator.vehicleInfo,
  };
}

export function projectOperatorPublic(
  operator: OperatorDoc
): OperatorPublicView {
  return {
    ...projectOperatorForCounterpart(operator),
    isAvailable: operator.isAvailable,
  };
}

export function projectCommuterForCounterpart(
  commuter: CommuterDoc
): CommuterCounterpartView {
  return {
    _id: commuter._id,
    name: commuter.name,
    phone: commuter.phone,
  };
}

export function projectCommuterPublic(
  commuter: CommuterDoc
): CommuterPublicView {
  return {
    _id: commuter._id,
    name: commuter.name,
  };
}

/**
 * What a driver may see of a passenger who has an open request.
 *
 * This is deliberately less than `CommuterCounterpartView`: the phone number
 * belongs to a counterpart on a ride the driver has accepted, not to every
 * passenger in the deployment who happens to have a request open.
 */
export function projectCommuterForQueue(
  commuter: CommuterDoc
): CommuterQueueView {
  return {
    _id: commuter._id,
    name: commuter.name,
  };
}
