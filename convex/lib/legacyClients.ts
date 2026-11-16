/**
 * TEMPORARY — delete when the fleet has migrated to the fixoct38 build.
 *
 * The Android builds that were exported before `fixoct38` are still on
 * phones, and they cannot be changed: the APK carries the web code as
 * bundled assets, so its screens are frozen at build time. What it *can* do
 * is call the server, and `fixoct38` made three of the calls it makes
 * fail:
 *
 *   1. it books a ride without sending a payment method, and the method
 *      became a required argument,
 *   2. it starts the trip with the driver's own "picked up" tap, and the
 *      passenger's confirmation became the only way to start one,
 *   3. it does not know that a cash ride needs its collection confirmed, and
 *      the completion began to refuse one.
 *
 * These helpers keep those requests working while their users move to the
 * new build. They are deliberately separate from `paymentMethods.ts` and
 * `withAuth.ts` so the cutover is a single self-contained deletion rather
 * than a hunt through the payment flow.
 *
 * Cutover checklist:
 *   1. ship the rebuilt APK (versionCode 4) and confirm the fleet has
 *      migrated,
 *   2. delete this file and the three calls to it,
 *   3. make `paymentMethod` required again on `rides.create` and on
 *      `rideBooking.insert`,
 *   4. drop "inProgress" from `OPERATOR_STATUSES` and remove the redundant
 *      start branch from `rides.updateStatus`,
 *   5. require `cashCollected` again on a cash completion.
 */

import { methodOf, type PaymentMethod } from "./paymentMethods";
import type { Role } from "./withAuth";

/**
 * The method a ride is booked with.
 *
 * A client that predates the choice sends no method at all, and a ride that
 * predates the choice has none stored. Both are GCash, because GCash is what
 * they were settled through.
 */
export function bookedMethod(method: PaymentMethod | undefined): PaymentMethod {
  return methodOf(method);
}

/**
 * Whether the driver's legacy "picked up" tap is redundant.
 *
 * The trip is started by the passenger's confirmation now, so a driver on a
 * build that predates that taps "picked up" *after* the passenger has
 * confirmed — and the ride is already under way. The tap has to succeed: an
 * error for a trip that is running correctly sends the driver looking for a
 * problem that is not there.
 */
export function legacyStartIsRedundant(
  role: Role,
  ride: { status: string },
  requested: string
): boolean {
  return (
    role === "operator" &&
    requested === "inProgress" &&
    ride.status === "inProgress"
  );
}
