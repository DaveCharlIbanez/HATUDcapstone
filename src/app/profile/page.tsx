"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import {
  FaCog,
  FaCreditCard,
  FaEdit,
  FaHistory,
  FaMapMarkedAlt,
  FaMapMarkerAlt,
  FaStar,
  FaUser,
} from "react-icons/fa";
import {
  SettingsGroup,
  SettingsLinkRow,
  SettingsSection,
} from "@/components/SettingsSection";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/authContext";
import {
  formatDate,
  formatMonthYear,
  formatPeso,
  paymentMethodLabel,
  RIDE_STATUS_LABELS,
  RIDE_STATUS_STYLES,
} from "@/lib/format";
import { api } from "../../../convex/_generated/api";

/**
 * The outstanding balance.
 *
 * A cash ride is settled by a handover with the driver, so it is never an
 * outstanding balance: showing it as one would send the passenger to a
 * payment page to pay cash through it.
 */
function OutstandingBalance({
  due,
}: {
  due: { amount: number; method: string; rideId: string } | null | undefined;
}) {
  if (!due) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)]/30 p-4">
        <p className="text-[var(--text-muted)] text-sm">Outstanding balance</p>
        <p className="mt-1 font-bold text-2xl text-[var(--foreground)]">
          {formatPeso(0)}
        </p>
      </div>
    );
  }

  if (due.method === "cash") {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)]/30 p-4">
        <p className="text-[var(--text-muted)] text-sm">Outstanding balance</p>
        <p className="mt-1 font-bold text-2xl text-[var(--foreground)]">
          {formatPeso(0)}
        </p>
        <p className="mt-2 text-[var(--text-muted)] text-sm">
          Your last trip is paid in cash to your driver.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)]/30 p-5">
      <p className="text-[var(--text-muted)] text-sm">Outstanding balance</p>
      <p className="mt-1 font-bold text-2xl text-[var(--foreground)]">
        {formatPeso(due.amount)}
      </p>
      <Link
        className="mt-3 inline-flex rounded-lg bg-sky-500 px-4 py-2 font-semibold text-sm text-white transition-colors hover:bg-sky-400"
        href={`/payment?ride=${due.rideId}`}
      >
        Pay now
      </Link>
    </div>
  );
}

export default function ProfilePage() {
  const { sessionToken, user } = useAuth();
  const { showToast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState({ name: "", phone: "" });

  // The profile queries are passenger-scoped and reject other roles, so they
  // are skipped outright unless the session really is a passenger's.
  const isCommuter = user?.role === "commuter";
  const profile = useQuery(
    api.profile.commuterProfile,
    sessionToken && isCommuter ? { sessionToken } : "skip"
  );
  const due = useQuery(
    api.payments.getDue,
    sessionToken && isCommuter ? { sessionToken } : "skip"
  );
  const updateProfile = useMutation(api.commuters.update);

  const startEditing = () => {
    if (!profile) {
      return;
    }
    setDraft({ name: profile.name, phone: profile.phone });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const handleSaveProfile = async () => {
    if (!(profile && sessionToken)) {
      return;
    }
    if (!draft.name.trim()) {
      showToast("Your name cannot be empty.", "error");
      return;
    }

    try {
      await updateProfile({
        sessionToken,
        id: profile.id,
        name: draft.name.trim(),
        phone: draft.phone.trim(),
      });
      setIsEditing(false);
      showToast("Profile updated.", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Could not save your profile.",
        "error"
      );
    }
  };

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-[var(--foreground)]">
        <p className="text-[var(--text-muted)]">Loading your profile...</p>
      </div>
    );
  }

  const lastTrip = profile.history[0];
  const historyPreview = lastTrip
    ? `${profile.history.length} trips · last on ${formatDate(lastTrip.createdAt)}`
    : "No trips yet";
  const placesCount = profile.savedLocations.length;
  const paymentsPreview =
    due && due.method !== "cash"
      ? `${formatPeso(due.amount)} due`
      : `${formatPeso(profile.totalSpent)} spent · nothing due`;

  const inputClass =
    "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 px-4 py-2.5 text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-sky-500/50";

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* Header */}
      <div className="border-[var(--border)] border-b bg-[var(--surface)]/50 backdrop-blur-lg">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-slate-700">
              <FaUser className="text-white text-xl" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-bold text-[var(--foreground)] text-xl">
                {profile.name}
              </h1>
              <p className="truncate text-[var(--text-muted)] text-sm">
                Rider • {profile.completedRides} rides •{" "}
                {formatPeso(profile.totalSpent)} spent
              </p>
            </div>
          </div>
          <Link
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-sky-500 px-4 py-2 font-semibold text-sm text-white transition-colors hover:bg-sky-400"
            href="/map"
          >
            <FaMapMarkedAlt />
            Book
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-6">
        <SettingsGroup>
          <SettingsSection
            icon={FaUser}
            id="personal"
            preview={`${profile.phone} · member since ${formatMonthYear(profile.memberSince)}`}
            title="Personal information"
          >
            <div className="space-y-4">
              <div>
                <label
                  className="mb-1 block font-semibold text-[var(--foreground)] text-sm"
                  htmlFor="name"
                >
                  Full name
                </label>
                {isEditing ? (
                  <input
                    className={inputClass}
                    id="name"
                    onChange={(e) =>
                      setDraft({ ...draft, name: e.target.value })
                    }
                    type="text"
                    value={draft.name}
                  />
                ) : (
                  <p className="text-[var(--foreground)]">{profile.name}</p>
                )}
              </div>
              <div>
                <p className="mb-1 block font-semibold text-[var(--foreground)] text-sm">
                  Email
                </p>
                <p className="break-all text-[var(--foreground)]">
                  {profile.email}
                </p>
                <p className="mt-1 text-[var(--text-muted)] text-xs">
                  Your email is your sign-in and cannot be edited here.
                </p>
              </div>
              <div>
                <label
                  className="mb-1 block font-semibold text-[var(--foreground)] text-sm"
                  htmlFor="phone"
                >
                  Phone
                </label>
                {isEditing ? (
                  <input
                    className={inputClass}
                    id="phone"
                    onChange={(e) =>
                      setDraft({ ...draft, phone: e.target.value })
                    }
                    type="tel"
                    value={draft.phone}
                  />
                ) : (
                  <p className="text-[var(--foreground)]">{profile.phone}</p>
                )}
              </div>
              <div>
                <p className="mb-1 block font-semibold text-[var(--foreground)] text-sm">
                  Member since
                </p>
                <p className="text-[var(--foreground)]">
                  {formatMonthYear(profile.memberSince)}
                </p>
              </div>

              {isEditing ? (
                <div className="flex gap-3 pt-2">
                  <button
                    className="min-h-11 flex-1 rounded-xl bg-sky-500 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-sky-400"
                    onClick={handleSaveProfile}
                    type="button"
                  >
                    Save
                  </button>
                  <button
                    className="min-h-11 flex-1 rounded-xl border border-[var(--border)] px-5 py-2.5 font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-strong)]"
                    onClick={cancelEditing}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 font-semibold text-sm text-white transition-colors hover:bg-sky-400"
                  onClick={startEditing}
                  type="button"
                >
                  <FaEdit />
                  Edit profile
                </button>
              )}
            </div>
          </SettingsSection>

          <SettingsSection
            icon={FaMapMarkerAlt}
            id="places"
            preview={
              placesCount === 0
                ? "No saved places yet"
                : `${placesCount} saved ${placesCount === 1 ? "place" : "places"}`
            }
            title="Saved places"
          >
            {placesCount === 0 ? (
              <p className="text-[var(--text-muted)] text-sm">
                Places you save while booking show up here.
              </p>
            ) : (
              <ul className="space-y-3">
                {profile.savedLocations.map((location) => (
                  <li
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)]/30 p-3"
                    key={`${location.name}-${location.address}`}
                  >
                    <p className="font-semibold text-[var(--foreground)] text-sm">
                      {location.name}
                    </p>
                    <p className="mt-1 text-[var(--text-muted)] text-sm">
                      {location.address}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SettingsSection>

          <SettingsSection
            icon={FaHistory}
            id="history"
            preview={historyPreview}
            title="Ride history"
          >
            {profile.history.length === 0 ? (
              <p className="text-[var(--text-muted)] text-sm">
                You have not booked a ride yet.
              </p>
            ) : (
              <div className="space-y-3">
                {profile.history.map((ride) => (
                  <div
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)]/30 p-3"
                    key={ride.id}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 font-semibold text-xs ${
                            RIDE_STATUS_STYLES[ride.status] ??
                            "bg-[var(--surface-muted)] text-[var(--foreground)]"
                          }`}
                        >
                          {RIDE_STATUS_LABELS[ride.status] ?? ride.status}
                        </span>
                        <span className="truncate text-[var(--text-muted)] text-xs">
                          {formatDate(ride.createdAt)}
                        </span>
                      </div>
                      <span className="shrink-0 font-semibold text-[var(--foreground)]">
                        {formatPeso(ride.fare)}
                      </span>
                    </div>
                    <div className="space-y-1 text-[var(--foreground)] text-sm">
                      <div className="flex items-start gap-2">
                        <FaMapMarkerAlt className="mt-0.5 shrink-0 text-emerald-500" />
                        <span>{ride.pickupAddress}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <FaMapMarkerAlt className="mt-0.5 shrink-0 text-rose-500" />
                        <span>{ride.dropoffAddress}</span>
                      </div>
                    </div>
                    {ride.rating !== null && (
                      <div className="mt-2 flex items-center gap-1 border-[var(--border)] border-t pt-2">
                        <span className="text-[var(--text-muted)] text-sm">
                          Your rating:
                        </span>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <FaStar
                            className={`text-sm ${
                              star <= (ride.rating ?? 0)
                                ? "text-amber-400"
                                : "text-[var(--text-muted)]"
                            }`}
                            key={star}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SettingsSection>

          <SettingsSection
            icon={FaCreditCard}
            id="payments"
            preview={paymentsPreview}
            title="Payments"
          >
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)]/30 p-4">
                <p className="text-[var(--text-muted)] text-sm">Total spent</p>
                <p className="mt-1 font-bold text-2xl text-[var(--foreground)]">
                  {formatPeso(profile.totalSpent)}
                </p>
              </div>
              <OutstandingBalance due={due} />
            </div>

            <h3 className="mb-3 font-semibold text-[var(--foreground)]">
              Transaction history
            </h3>
            {profile.payments.length === 0 ? (
              <p className="text-[var(--text-muted)] text-sm">
                No payments recorded yet.
              </p>
            ) : (
              <div className="space-y-3">
                {profile.payments.map((payment) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)]/30 p-3"
                    key={payment.id}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-[var(--foreground)] text-sm">
                        {paymentMethodLabel(payment.provider)} •{" "}
                        {payment.referenceNumber}
                      </div>
                      <div className="text-[var(--text-muted)] text-xs">
                        {formatDate(payment.createdAt)} • {payment.status}
                      </div>
                    </div>
                    <div className="shrink-0 font-semibold text-[var(--foreground)]">
                      {formatPeso(payment.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SettingsSection>

          <SettingsLinkRow
            href="/settings"
            icon={FaCog}
            preview="Theme, permissions, password, sign out"
            title="Settings"
          />
        </SettingsGroup>
      </div>
    </div>
  );
}
