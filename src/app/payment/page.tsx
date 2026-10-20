"use client";

import { useAction, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  FaArrowLeft,
  FaCheckCircle,
  FaMobileAlt,
  FaReceipt,
  FaRedo,
} from "react-icons/fa";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/authContext";
import { api } from "../../../convex/_generated/api";

const GCASH_SANDBOX_DECLINE_NUMBER = "09179000000";

type PaymentState = "idle" | "processing" | "succeeded" | "failed";

export default function PaymentPage() {
  const { sessionToken } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const [gcashNumber, setGcashNumber] = useState("");
  const [paymentState, setPaymentState] = useState<PaymentState>("idle");
  const [failureReason, setFailureReason] = useState<string | null>(null);

  const due = useQuery(
    api.payments.getDue,
    sessionToken ? { sessionToken } : "skip"
  );
  const createPayment = useAction(api.payments.charge);

  const handlePay = async () => {
    if (!(due && sessionToken)) {
      return;
    }
    setPaymentState("processing");
    setFailureReason(null);

    try {
      const payment = await createPayment({
        sessionToken,
        rideId: due.rideId,
        ...(gcashNumber.trim() ? { testNumber: gcashNumber.trim() } : {}),
      });

      if (payment.status === "SETTLED") {
        setPaymentState("succeeded");
        showToast("Payment successful.", "success");
        return;
      }

      setPaymentState("failed");
      setFailureReason(
        payment.failureReason ?? "The payment was declined. Please try again."
      );
    } catch (error) {
      setPaymentState("failed");
      setFailureReason(
        error instanceof Error
          ? error.message
          : "Payment failed. Please try again."
      );
    }
  };

  if (!sessionToken) {
    return null;
  }

  if (!due) {
    return (
      <div className="min-h-screen bg-[var(--background)] p-4 text-[var(--foreground)]">
        <div className="mx-auto max-w-md space-y-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-center">
            <FaCheckCircle className="mx-auto mb-3 text-3xl text-emerald-400" />
            <h1 className="font-bold text-lg">Nothing to pay</h1>
            <p className="mt-1 text-[var(--text-muted)] text-sm">
              You have no completed rides awaiting payment.
            </p>
          </div>
          <button
            className="w-full rounded-2xl border border-[var(--border)] py-3 text-[var(--text-muted)] transition hover:text-[var(--foreground)]"
            onClick={() => router.push("/map")}
            type="button"
          >
            ← Back to the map
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] p-4 text-[var(--foreground)]">
      <div className="mx-auto max-w-md space-y-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h1 className="mb-4 font-bold text-xl">Payment</h1>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-[var(--text-muted)]">
              <span>Pickup</span>
              <span className="max-w-[60%] text-right">
                {due.pickupAddress}
              </span>
            </div>
            <div className="flex justify-between text-[var(--text-muted)]">
              <span>Dropoff</span>
              <span className="max-w-[60%] text-right">
                {due.dropoffAddress}
              </span>
            </div>
            <div className="flex justify-between text-[var(--text-muted)]">
              <span>Distance</span>
              <span>{due.distance} km</span>
            </div>
            <div className="flex justify-between border-[var(--border)] border-t pt-3 font-bold text-lg">
              <span>Total</span>
              <span>₱{due.amount}</span>
            </div>
          </div>
        </div>

        {paymentState === "succeeded" ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
            <FaReceipt className="mx-auto mb-3 text-3xl text-emerald-400" />
            <h2 className="font-bold text-lg">Payment received</h2>
            <p className="mt-1 text-[var(--text-muted)] text-sm">
              ₱{due.amount} paid via GCash. Thanks for riding with HATUD.
            </p>
            <button
              className="mt-4 w-full rounded-2xl bg-sky-500 py-3 font-semibold text-white transition hover:bg-sky-400"
              onClick={() => router.push("/feedback")}
              type="button"
            >
              Rate your driver
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="mb-1 font-semibold text-lg">Pay with GCash</h2>
            <p className="mb-4 text-[var(--text-muted)] text-sm">
              Sandbox mode — no real money moves. Enter any number, or{" "}
              {GCASH_SANDBOX_DECLINE_NUMBER} to see a declined payment.
            </p>

            <label
              className="mb-1 block font-medium text-[var(--foreground)] text-sm"
              htmlFor="gcash-number"
            >
              GCash number
            </label>
            <div className="relative">
              <FaMobileAlt className="absolute top-3 left-3 text-[var(--text-muted)]" />
              <input
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] py-2.5 pr-4 pl-9 text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                id="gcash-number"
                inputMode="numeric"
                onChange={(event) => setGcashNumber(event.target.value)}
                placeholder="0917 000 0000"
                type="tel"
                value={gcashNumber}
              />
            </div>

            {paymentState === "failed" && failureReason && (
              <p
                className="mt-3 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-red-300 text-sm"
                role="alert"
              >
                {failureReason}
              </p>
            )}

            <button
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-500 py-4 font-semibold text-lg text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={paymentState === "processing"}
              onClick={handlePay}
              type="button"
            >
              {paymentState === "processing" ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Processing…
                </>
              ) : (
                <>
                  <FaRedo
                    className={paymentState === "failed" ? "" : "hidden"}
                  />
                  Pay ₱{due.amount}
                </>
              )}
            </button>
          </div>
        )}

        <button
          className="flex w-full items-center justify-center gap-2 py-2 text-[var(--text-muted)] text-sm transition hover:text-[var(--foreground)]"
          onClick={() => router.back()}
          type="button"
        >
          <FaArrowLeft /> Back
        </button>
      </div>
    </div>
  );
}
