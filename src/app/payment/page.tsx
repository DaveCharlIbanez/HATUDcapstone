"use client";

import { useAction, useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  FaArrowLeft,
  FaCheckCircle,
  FaMobileAlt,
  FaReceipt,
  FaRedo,
} from "react-icons/fa";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/authContext";
import { paymentMethodLabel } from "@/lib/format";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  GCASH_SANDBOX_DECLINE_NUMBER,
  MAYA_SANDBOX_DECLINE_NUMBER,
} from "../../../convex/lib/payments";

type PaymentState = "idle" | "processing" | "succeeded" | "failed";

/** A wallet the fare can be charged to. */
type WalletMethod = "gcash" | "maya";

/**
 * How each wallet is presented.
 *
 * The method is not chosen here: the rider chose it when they booked, and the
 * ride carries it. This page only has to say which wallet it is and ask for
 * the number that will be charged.
 */
const WALLET_COPY: Record<
  WalletMethod,
  { declineNumber: string; numberLabel: string; title: string }
> = {
  gcash: {
    declineNumber: GCASH_SANDBOX_DECLINE_NUMBER,
    numberLabel: "GCash number",
    title: "Pay with GCash",
  },
  maya: {
    declineNumber: MAYA_SANDBOX_DECLINE_NUMBER,
    numberLabel: "Maya number",
    title: "Pay with Maya",
  },
};

/**
 * The receipt, once the wallet has taken the money.
 */
function SucceededPanel({
  amount,
  label,
  rideId,
}: {
  amount: number;
  label: string;
  rideId: string;
}) {
  const router = useRouter();

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
      <FaReceipt className="mx-auto mb-3 text-3xl text-emerald-400" />
      <h2 className="font-bold text-lg">Payment received</h2>
      <p className="mt-1 text-[var(--text-muted)] text-sm">
        ₱{amount} paid via {label}. Thanks for riding with HATUD.
      </p>
      <button
        className="mt-4 w-full rounded-2xl bg-sky-500 py-3 font-semibold text-white transition hover:bg-sky-400"
        onClick={() => router.push(`/feedback?ride=${rideId}`)}
        type="button"
      >
        Rate your driver
      </button>
    </div>
  );
}

/**
 * A ride that is paid in cash.
 *
 * There is nothing to pay here: the fare changes hands with the driver at
 * the drop-off, and the driver confirms it. Saying so plainly is better than
 * showing a form that would charge nothing.
 */
function CashPanel({ amount, rideId }: { amount: number; rideId: string }) {
  const router = useRouter();

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="mb-1 font-semibold text-lg">Pay in cash</h2>
      <p className="mb-4 text-[var(--text-muted)] text-sm">
        You chose to pay this trip in cash. Hand <strong>₱{amount}</strong> to
        your driver when the trip ends — they confirm it on their side, and
        there is nothing to pay here.
      </p>
      <button
        className="w-full rounded-2xl border border-[var(--border)] py-3 font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-strong)]"
        onClick={() => router.push(`/feedback?ride=${rideId}`)}
        type="button"
      >
        Rate your driver
      </button>
    </div>
  );
}

/**
 * The charge form, for the wallet the ride was booked with.
 */
function WalletPanel({
  failureReason,
  number,
  onNumberChange,
  onPay,
  paymentState,
  wallet,
}: {
  failureReason: string | null;
  number: string;
  onNumberChange: (value: string) => void;
  onPay: () => void;
  paymentState: PaymentState;
  wallet: (typeof WALLET_COPY)[WalletMethod];
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="mb-1 font-semibold text-lg">{wallet.title}</h2>
      <p className="mb-4 text-[var(--text-muted)] text-sm">
        Sandbox mode — no real money moves. Enter any number, or{" "}
        {wallet.declineNumber} to see a declined payment.
      </p>

      <label
        className="mb-1 block font-medium text-[var(--foreground)] text-sm"
        htmlFor="wallet-number"
      >
        {wallet.numberLabel}
      </label>
      <div className="relative">
        <FaMobileAlt className="absolute top-3 left-3 text-[var(--text-muted)]" />
        <input
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] py-2.5 pr-4 pl-9 text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          id="wallet-number"
          inputMode="numeric"
          onChange={(event) => onNumberChange(event.target.value)}
          placeholder="0917 000 0000"
          type="tel"
          value={number}
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
        onClick={onPay}
        type="button"
      >
        {paymentState === "processing" ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Processing…
          </>
        ) : (
          <>
            <FaRedo className={paymentState === "failed" ? "" : "hidden"} />
            Pay
          </>
        )}
      </button>
    </div>
  );
}

export default function PaymentPage() {
  const { sessionToken } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const [walletNumber, setWalletNumber] = useState("");
  const [paymentState, setPaymentState] = useState<PaymentState>("idle");
  const [failureReason, setFailureReason] = useState<string | null>(null);

  // The ride this page is about, fixed for as long as the page is open.
  //
  // The map sends the trip it is showing. Without one, the page takes the
  // newest unpaid trip once and then holds on to it. Paying makes the query
  // move on to the next unpaid trip, and before the ride was pinned the
  // "Rate your driver" button followed it — so the passenger was sent to rate
  // an older ride, with its old rating, instead of the one they had just paid.
  const searchParams = useSearchParams();
  const [pinnedRideId, setPinnedRideId] = useState<Id<"rides"> | null>(
    () => searchParams.get("ride") as Id<"rides"> | null
  );

  const due = useQuery(
    api.payments.getDue,
    sessionToken
      ? { sessionToken, ...(pinnedRideId ? { rideId: pinnedRideId } : {}) }
      : "skip"
  );

  useEffect(() => {
    if (!pinnedRideId && due) {
      setPinnedRideId(due.rideId);
    }
  }, [due, pinnedRideId]);
  const createPayment = useAction(api.payments.charge);

  // The ride carries the method it was booked with. A ride that predates the
  // choice is read as GCash, which is what it was settled through.
  const method = due?.method ?? "gcash";
  const isCash = method === "cash";
  const wallet = WALLET_COPY[method as WalletMethod] ?? WALLET_COPY.gcash;

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
        ...(walletNumber.trim() ? { testNumber: walletNumber.trim() } : {}),
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

  // Still loading, or switching over to the pinned ride.
  if (!sessionToken || due === undefined) {
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

  // What the page shows below the summary. The method is not chosen here:
  // it was chosen when the ride was booked, so this page only reports it.
  const panel = (() => {
    // A wallet ride that is already paid — just now, or on an earlier visit —
    // shows its receipt and the way on to rating this same ride.
    if (
      paymentState === "succeeded" ||
      (!isCash && due.paymentStatus === "paid")
    ) {
      return (
        <SucceededPanel
          amount={due.amount}
          label={paymentMethodLabel(method)}
          rideId={due.rideId}
        />
      );
    }
    if (isCash) {
      return <CashPanel amount={due.amount} rideId={due.rideId} />;
    }
    return (
      <WalletPanel
        failureReason={failureReason}
        number={walletNumber}
        onNumberChange={setWalletNumber}
        onPay={handlePay}
        paymentState={paymentState}
        wallet={wallet}
      />
    );
  })();
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
            <div className="flex justify-between text-[var(--text-muted)]">
              <span>Paying with</span>
              <span className="font-medium text-[var(--foreground)]">
                {paymentMethodLabel(method)}
              </span>
            </div>
            <div className="flex justify-between border-[var(--border)] border-t pt-3 font-bold text-lg">
              <span>Total</span>
              <span>₱{due.amount}</span>
            </div>
          </div>
        </div>

        {panel}

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
