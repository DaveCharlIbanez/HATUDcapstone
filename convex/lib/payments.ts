/**
 * Payment provider seam.
 *
 * The app talks to a `PaymentProvider` and never to a gateway directly, so a
 * real GCash / Maya / PayMongo integration can replace the sandbox without
 * touching the payment flow. The field names mirror a wallet's own transaction
 * payload so the swap is a mechanical change.
 *
 * Cash is deliberately not a provider. There is no gateway to call for a
 * handover of notes, and pretending otherwise would hide the only part of the
 * flow that a human is actually involved in.
 */

import type { Id } from "../_generated/dataModel";
import type { PaymentMethod } from "./paymentMethods";

export const GCASH_SANDBOX_DECLINE_NUMBER = "09179000000";

export const MAYA_SANDBOX_DECLINE_NUMBER = "09179000001";

export type PaymentCurrency = "PHP";

export type PaymentStatus =
  | "PENDING"
  | "AUTHORIZED"
  | "SETTLED"
  | "FAILED"
  | "EXPIRED"
  | "REFUNDED";

export interface ChargeRequest {
  /** Amount charged to the passenger, in pesos. */
  amount: number;
  currency: PaymentCurrency;
  description: string;
  /** Our own identifier for the charge. */
  referenceNumber: string;
  /** The wallet number the passenger entered. Sandbox only. */
  testNumber?: string;
}

export interface ChargeResult {
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
  charge(request: ChargeRequest): Promise<ChargeResult>;
  /** The method this provider settles. */
  readonly method: PaymentMethod;
  readonly name: string;
}

const SANDBOX_LATENCY_MS = 400;

/**
 * Builds a sandbox provider for a wallet.
 *
 * Nothing leaves the machine: the charge is simulated, and the designated test
 * number for that wallet always fails so the failure path can be shown.
 */
function sandboxProvider(
  method: Extract<PaymentMethod, "gcash" | "maya">,
  declineNumber: string
): PaymentProvider {
  return {
    method,
    name: `${method}-sandbox`,

    async charge(request: ChargeRequest): Promise<ChargeResult> {
      await new Promise((resolve) => setTimeout(resolve, SANDBOX_LATENCY_MS));

      const declined = request.testNumber === declineNumber;

      return {
        transactionId: `${method.toUpperCase().slice(0, 2)}-${crypto.randomUUID()}`,
        referenceNumber: request.referenceNumber,
        amount: request.amount,
        currency: request.currency,
        status: declined ? "FAILED" : "SETTLED",
        fee: 0,
        ...(declined
          ? {
              message: "Insufficient balance. Please try another account.",
            }
          : {}),
      };
    },
  };
}

/** Sandbox GCash. */
export const gcashSandbox: PaymentProvider = sandboxProvider(
  "gcash",
  GCASH_SANDBOX_DECLINE_NUMBER
);

/** Sandbox Maya. */
export const mayaSandbox: PaymentProvider = sandboxProvider(
  "maya",
  MAYA_SANDBOX_DECLINE_NUMBER
);

/**
 * The wallet providers, by the method they settle.
 *
 * Cash is not in here: it is settled by a handover, not by a gateway.
 */
export const WALLET_PROVIDERS: Record<
  Extract<PaymentMethod, "gcash" | "maya">,
  PaymentProvider
> = {
  gcash: gcashSandbox,
  maya: mayaSandbox,
};

/**
 * The row a settled payment is written as.
 *
 * Two different things settle a ride — a wallet charge and a cash handover —
 * and they write the same kind of row. The row is built in one place so the
 * two can never drift apart, and so the ledger reads the same whichever way
 * the money moved.
 */
export interface PaymentRowInput {
  amount: number;
  commuterId: Id<"commuters">;
  /** Why it failed, when it failed. */
  failureReason?: string;
  method: PaymentMethod;
  now: number;
  providerRef: string;
  referenceNumber: string;
  rideId: Id<"rides">;
  status: PaymentStatus;
}

export function buildPaymentRow(input: PaymentRowInput) {
  return {
    rideId: input.rideId,
    commuterId: input.commuterId,
    amount: input.amount,
    currency: "PHP" as const,
    provider: input.method,
    providerRef: input.providerRef,
    referenceNumber: input.referenceNumber,
    status: input.status,
    ...(input.failureReason === undefined
      ? {}
      : { failureReason: input.failureReason }),
    createdAt: input.now,
    updatedAt: input.now,
  };
}

/**
 * The reference a settlement is recorded under.
 *
 * The wallet settles against `HATUD-…`; a cash handover gets `HATUD-CASH-…`
 * so the two are never confused in the ledger.
 */
export function referenceNumberFor(
  rideId: string,
  method: PaymentMethod
): string {
  const tail = rideId.slice(-8).toUpperCase();
  return method === "cash" ? `HATUD-CASH-${tail}` : `HATUD-${tail}`;
}
