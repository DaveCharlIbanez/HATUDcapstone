"use client";

import type { ReactNode } from "react";
import { FaMobileAlt, FaMoneyBillWave, FaWallet } from "react-icons/fa";
import { DemoBadge } from "@/components/DemoBadge";
import type { PaymentMethod } from "../../../convex/lib/paymentMethods";

/**
 * How the rider pays for a ride, chosen when the ride is booked.
 *
 * The choice is made once, up front, because the driver has to know before
 * they accept whether they are collecting cash or whether the fare is settled
 * through a wallet.
 */

export interface PaymentMethodOption {
  /** What actually happens, said plainly. */
  description: string;
  icon: ReactNode;
  id: PaymentMethod;
  label: string;
}

/** The methods, in the order they are offered. */
export const PAYMENT_METHOD_OPTIONS: PaymentMethodOption[] = [
  {
    id: "gcash",
    label: "GCash",
    description: "Charged to your GCash number after the trip ends.",
    icon: <FaMobileAlt />,
  },
  {
    id: "maya",
    label: "Maya",
    description: "Charged to your Maya number after the trip ends.",
    icon: <FaWallet />,
  },
  {
    id: "cash",
    label: "Cash",
    description: "Hand the fare to your driver when the trip ends.",
    icon: <FaMoneyBillWave />,
  },
];

interface PaymentMethodPickerProps {
  /** How many passengers the ride carries. */
  capacity: number;
  /** The trip will be simulated. Said once more before booking. */
  demoMode?: boolean;
  /** What the ride will cost, so the choice is made against a number. */
  fare: number | null;
  /** The booking is in flight — the button must not be pressed again. */
  isBooking: boolean;
  onContinue: () => void;
  onSelect: (method: PaymentMethod) => void;
  /** The class of ride being booked. There is only one. */
  rideName: string;
  selected: PaymentMethod | null;
}

export function PaymentMethodPicker({
  capacity,
  demoMode = false,
  fare,
  isBooking,
  onContinue,
  onSelect,
  rideName,
  selected,
}: PaymentMethodPickerProps) {
  return (
    <>
      <h3 className="mb-1 font-semibold text-lg">How would you like to pay?</h3>
      <p className="mb-4 text-[var(--text-muted)] text-sm">
        Choose before you book. Your driver will know how they are getting paid.
      </p>

      {/* The ride is not a choice — there is one of them — so it is stated
          here, next to the fare, rather than given a step of its own. */}
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏍️</span>
          <div>
            <div className="font-semibold text-[var(--foreground)]">
              {rideName}
            </div>
            <div className="text-[var(--text-muted)] text-sm">
              {capacity} passenger(s)
            </div>
            {demoMode ? (
              <div className="mt-1 flex items-center gap-1.5 text-amber-700 text-xs dark:text-amber-300">
                <DemoBadge />
                Demo trip — the ride will be simulated
              </div>
            ) : null}
          </div>
        </div>
        <div className="font-bold text-[var(--foreground)] text-lg">
          {fare === null ? "—" : `₱${fare}`}
        </div>
      </div>

      <div className="space-y-3">
        {PAYMENT_METHOD_OPTIONS.map((option) => {
          const isSelected = selected === option.id;
          const inputId = `payment-method-${option.id}`;

          return (
            <div key={option.id}>
              <input
                checked={isSelected}
                className="peer sr-only"
                id={inputId}
                name="payment-method"
                onChange={() => onSelect(option.id)}
                type="radio"
                value={option.id}
              />
              <label
                className={`flex cursor-pointer items-center gap-4 rounded-2xl border-2 p-4 transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-sky-500/40 ${
                  isSelected
                    ? "border-sky-400 bg-[var(--surface)] shadow-lg shadow-sky-400/20"
                    : "border-slate-700 bg-[var(--surface)]/50 hover:border-sky-500/50"
                }`}
                htmlFor={inputId}
              >
                <div className="text-2xl text-sky-400">{option.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[var(--foreground)]">
                    {option.label}
                  </div>
                  <div className="text-[var(--text-muted)] text-sm">
                    {option.description}
                  </div>
                </div>
                <div
                  aria-hidden="true"
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    isSelected
                      ? "border-sky-400 bg-sky-400"
                      : "border-[var(--border)]"
                  }`}
                >
                  {isSelected ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-900" />
                  ) : null}
                </div>
              </label>
            </div>
          );
        })}
      </div>

      <button
        className="mt-4 w-full rounded-2xl border-2 border-sky-500/50 bg-sky-600 py-4 font-bold text-base text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)]"
        disabled={!selected || isBooking}
        onClick={onContinue}
        type="button"
      >
        {isBooking ? "Booking…" : "Book ride"}
      </button>
    </>
  );
}
