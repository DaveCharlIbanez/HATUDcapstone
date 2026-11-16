/**
 * The payment methods a ride can be booked with.
 *
 * The rider chooses a method when the ride is booked, and the ride carries it
 * for its whole life. The choice is made once, up front, because the driver
 * has to know before they accept whether they are collecting cash or whether
 * the fare is settled through a wallet.
 *
 * This file is the only place the list lives. The schema, the booking, the
 * charge and the screens all read it, so a method cannot exist in one place
 * and be missing from another.
 */

import { v } from "convex/values";

/** The methods a ride can be booked with, in the order they are offered. */
export const PAYMENT_METHODS = ["gcash", "maya", "cash"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** The argument validator for a payment method. */
export const paymentMethodValidator = v.union(
  v.literal("gcash"),
  v.literal("maya"),
  v.literal("cash")
);

/**
 * The method a ride that predates the choice is settled by.
 *
 * Those rides were all settled through GCash, because GCash was the only
 * thing the app could do. Reading them as GCash keeps them payable instead of
 * stranding them.
 */
export const DEFAULT_PAYMENT_METHOD: PaymentMethod = "gcash";

/**
 * True when the money moves through a wallet rather than through the driver.
 *
 * A cash ride is settled by a handover, so it is never charged through the
 * app and it never appears as an outstanding balance.
 */
export function isElectronic(method: PaymentMethod): boolean {
  return method !== "cash";
}

/**
 * The method a ride was booked with, or the legacy default when it has none.
 */
export function methodOf(
  method: PaymentMethod | null | undefined
): PaymentMethod {
  return method ?? DEFAULT_PAYMENT_METHOD;
}
