/**
 * Payment provider seam.
 *
 * The app talks to a `PaymentProvider` and never to a gateway directly, so a
 * real GCash / Maya / PayMongo integration can replace the sandbox without
 * touching the payment flow. The field names mirror GCash's own transaction
 * payload so the swap is a mechanical change.
 */

export const GCASH_SANDBOX_DECLINE_NUMBER = "09179000000";

export type PaymentCurrency = "PHP";

export type PaymentStatus =
  | "PENDING"
  | "AUTHORIZED"
  | "SETTLED"
  | "FAILED"
  | "EXPIRED"
  | "REFUNDED";

export interface GcashChargeRequest {
  /** Amount charged to the passenger, in pesos. */
  amount: number;
  currency: PaymentCurrency;
  description: string;
  /** Our own identifier for the charge. */
  referenceNumber: string;
  /** The GCash number the passenger entered. Sandbox only. */
  testNumber?: string;
}

export interface GcashChargeResult {
  amount: number;
  currency: PaymentCurrency;
  /** Gateway fee, in pesos. */
  fee: number;
  /** Human readable reason, present when the charge failed. */
  message?: string;
  referenceNumber: string;
  status: PaymentStatus;
  /** The gateway's transaction id. */
  transactionId: string;
}

export interface PaymentProvider {
  charge(request: GcashChargeRequest): Promise<GcashChargeResult>;
  readonly name: string;
}

const SANDBOX_LATENCY_MS = 400;

/**
 * Sandbox GCash. Nothing leaves the machine: the charge is simulated, and the
 * designated test number always fails so the failure path can be demonstrated.
 */
export const gcashSandbox: PaymentProvider = {
  name: "gcash-sandbox",

  async charge(request: GcashChargeRequest): Promise<GcashChargeResult> {
    await new Promise((resolve) => setTimeout(resolve, SANDBOX_LATENCY_MS));

    const declined = request.testNumber === GCASH_SANDBOX_DECLINE_NUMBER;

    return {
      transactionId: `GC-${crypto.randomUUID()}`,
      referenceNumber: request.referenceNumber,
      amount: request.amount,
      currency: request.currency,
      status: declined ? "FAILED" : "SETTLED",
      fee: 0,
      ...(declined
        ? { message: "Insufficient balance. Please try another account." }
        : {}),
    };
  },
};
