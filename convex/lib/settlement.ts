/**
 * Where a finished ride's payment stands, as the driver sees it (fixoct48).
 *
 * - A cash ride is settled by the driver at the drop-off: "cashCollected".
 * - A GCash or Maya ride is settled by the passenger afterwards. Until the
 *   payment lands it is "awaitingPayment"; then it is "paid".
 * - A wallet payment that was attempted and failed is "failed", and is still
 *   owed.
 *
 * It is a pure function so the server's answer and the driver's screen use the
 * same rule.
 */
export type Settlement =
  | "cashCollected"
  | "awaitingPayment"
  | "paid"
  | "failed";

export function settlementOf(ride: {
  paymentMethod?: string;
  paymentStatus?: string;
}): Settlement {
  // A ride without a method predates the choice and was settled by GCash.
  const method = ride.paymentMethod ?? "gcash";
  if (method === "cash") {
    return "cashCollected";
  }
  if (ride.paymentStatus === "paid") {
    return "paid";
  }
  if (ride.paymentStatus === "failed") {
    return "failed";
  }
  return "awaitingPayment";
}
