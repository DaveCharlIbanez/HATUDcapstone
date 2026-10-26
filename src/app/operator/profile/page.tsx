"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  FaChartLine,
  FaEdit,
  FaEnvelope,
  FaPhoneAlt,
  FaRoute,
  FaSignOutAlt,
  FaUserTie,
  FaWallet,
} from "react-icons/fa";
import { LogoutDialog } from "@/components/LogoutDialog";
import { ThemeSlider } from "@/components/ThemeSlider";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/authContext";
import {
  formatDate,
  formatMonthYear,
  formatPeso,
  RIDE_STATUS_LABELS,
  RIDE_STATUS_STYLES,
} from "@/lib/format";
import { api } from "../../../../convex/_generated/api";

interface VehicleDraft {
  color: string;
  model: string;
  plateNumber: string;
}

const SERVICE_AREA = "Antique, PH";

export default function OperatorProfilePage() {
  const router = useRouter();
  const { sessionToken, user } = useAuth();
  const { showToast } = useToast();
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [phoneDraft, setPhoneDraft] = useState("");
  const [vehicleDraft, setVehicleDraft] = useState<VehicleDraft>({
    color: "",
    model: "",
    plateNumber: "",
  });

  // The profile query is driver-scoped and rejects other roles, so it is
  // skipped outright unless the session really is a driver's.
  const isOperator = user?.role === "operator";
  const profile = useQuery(
    api.profile.operatorProfile,
    sessionToken && isOperator ? { sessionToken } : "skip"
  );
  const updateProfile = useMutation(api.operators.update);

  const startEditing = () => {
    if (!profile) {
      return;
    }
    setNameDraft(profile.name);
    setPhoneDraft(profile.phone);
    setVehicleDraft({
      color: profile.vehicleInfo.color,
      model: profile.vehicleInfo.model,
      plateNumber: profile.vehicleInfo.plateNumber,
    });
    setIsEditing(true);
  };

  const handleSaveProfile = async () => {
    if (!(profile && sessionToken)) {
      return;
    }
    if (!nameDraft.trim()) {
      showToast("Your name cannot be empty.", "error");
      return;
    }
    if (!(vehicleDraft.plateNumber.trim() && vehicleDraft.model.trim())) {
      showToast("Your plate number and vehicle model are required.", "error");
      return;
    }

    try {
      await updateProfile({
        sessionToken,
        id: profile.id,
        name: nameDraft.trim(),
        phone: phoneDraft.trim(),
        vehicleInfo: {
          color: vehicleDraft.color.trim(),
          model: vehicleDraft.model.trim(),
          plateNumber: vehicleDraft.plateNumber.trim(),
        },
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

  const handleMessageSupport = () => {
    window.location.href = "mailto:support@hatud.app";
  };

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-[var(--foreground)]">
        <p className="text-[var(--text-muted)]">Loading your profile...</p>
      </div>
    );
  }

  const averageFare =
    profile.completedRides > 0
      ? Math.round(profile.totalEarnings / profile.completedRides)
      : 0;

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-sky-500 text-sm uppercase tracking-[.2em] dark:text-sky-400">
              Operator
            </p>
            <h1 className="mt-2 font-semibold text-3xl text-[var(--foreground)] tracking-tight">
              {profile.name}
            </h1>
            <p className="mt-2 max-w-2xl text-[var(--text-muted)] text-sm sm:text-base">
              {profile.vehicleInfo.model} • {profile.vehicleInfo.plateNumber} •{" "}
              {SERVICE_AREA}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              className="inline-flex items-center justify-center rounded-full bg-sky-600 px-4 py-3 font-semibold text-sm text-white shadow-sm transition hover:bg-sky-500"
              href="/operator/map"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-sky-500/20 text-sky-500 shadow-sm dark:text-sky-400">
                    <FaUserTie className="text-3xl" />
                  </div>
                  <div>
                    <p className="text-[var(--text-muted)] text-sm uppercase tracking-[.2em]">
                      Operator Name
                    </p>
                    <h2 className="mt-2 font-semibold text-2xl text-[var(--foreground)]">
                      {profile.name}
                    </h2>
                    <p className="mt-1 text-[var(--text-muted)] text-sm">
                      Licence {profile.licenseNumber} • Member since{" "}
                      {formatMonthYear(profile.memberSince)}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-4 text-center">
                    <p className="font-semibold text-2xl text-[var(--foreground)]">
                      {profile.averageRating > 0
                        ? profile.averageRating.toFixed(1)
                        : "—"}
                    </p>
                    <p className="mt-1 text-[var(--text-muted)] text-sm">
                      Rating
                    </p>
                  </div>
                  <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-4 text-center">
                    <p className="font-semibold text-2xl text-[var(--foreground)]">
                      {formatPeso(profile.totalEarnings)}
                    </p>
                    <p className="mt-1 text-[var(--text-muted)] text-sm">
                      Total Earnings
                    </p>
                  </div>
                  <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-4 text-center">
                    <p className="font-semibold text-2xl text-[var(--foreground)]">
                      {profile.completedRides}
                    </p>
                    <p className="mt-1 text-[var(--text-muted)] text-sm">
                      Completed Rides
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-4">
                  <p className="text-[var(--text-muted)] text-sm">Vehicle</p>
                  <p className="mt-2 font-semibold text-[var(--foreground)] text-base">
                    {profile.vehicleInfo.model}
                  </p>
                </div>
                <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-4">
                  <p className="text-[var(--text-muted)] text-sm">
                    Plate Number
                  </p>
                  <p className="mt-2 font-semibold text-[var(--foreground)] text-base">
                    {profile.vehicleInfo.plateNumber}
                  </p>
                </div>
                <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-4">
                  <p className="text-[var(--text-muted)] text-sm">
                    Licence Number
                  </p>
                  <p className="mt-2 font-semibold text-[var(--foreground)] text-base">
                    {profile.licenseNumber}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[var(--text-muted)] text-sm uppercase tracking-[.2em]">
                    Contact
                  </p>
                  <h3 className="mt-2 font-semibold text-[var(--foreground)] text-xl">
                    Primary details
                  </h3>
                </div>
                {isEditing ? (
                  <div className="flex gap-2">
                    <button
                      className="rounded-full bg-sky-600 px-4 py-2 font-semibold text-sm text-white transition hover:bg-sky-500"
                      onClick={handleSaveProfile}
                      type="button"
                    >
                      Save
                    </button>
                    <button
                      className="rounded-full border border-[var(--border)] px-4 py-2 font-semibold text-[var(--foreground)] text-sm transition hover:bg-[var(--surface-strong)]"
                      onClick={() => setIsEditing(false)}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-strong)] px-4 py-2 text-[var(--foreground)] text-sm"
                    onClick={startEditing}
                    type="button"
                  >
                    <FaEdit />
                    Edit Profile
                  </button>
                )}
              </div>

              {isEditing ? (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      className="mb-2 block font-semibold text-[var(--foreground)] text-sm"
                      htmlFor="operator-name"
                    >
                      Full Name
                    </label>
                    <input
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 px-4 py-2.5 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                      id="operator-name"
                      onChange={(e) => setNameDraft(e.target.value)}
                      type="text"
                      value={nameDraft}
                    />
                  </div>
                  <div>
                    <label
                      className="mb-2 block font-semibold text-[var(--foreground)] text-sm"
                      htmlFor="operator-phone"
                    >
                      Phone
                    </label>
                    <input
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 px-4 py-2.5 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                      id="operator-phone"
                      onChange={(e) => setPhoneDraft(e.target.value)}
                      type="tel"
                      value={phoneDraft}
                    />
                  </div>
                  <div>
                    <label
                      className="mb-2 block font-semibold text-[var(--foreground)] text-sm"
                      htmlFor="operator-vehicle"
                    >
                      Vehicle Model
                    </label>
                    <input
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 px-4 py-2.5 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                      id="operator-vehicle"
                      onChange={(e) =>
                        setVehicleDraft({
                          ...vehicleDraft,
                          model: e.target.value,
                        })
                      }
                      type="text"
                      value={vehicleDraft.model}
                    />
                  </div>
                  <div>
                    <label
                      className="mb-2 block font-semibold text-[var(--foreground)] text-sm"
                      htmlFor="operator-plate"
                    >
                      Plate Number
                    </label>
                    <input
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 px-4 py-2.5 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                      id="operator-plate"
                      onChange={(e) =>
                        setVehicleDraft({
                          ...vehicleDraft,
                          plateNumber: e.target.value,
                        })
                      }
                      type="text"
                      value={vehicleDraft.plateNumber}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label
                      className="mb-2 block font-semibold text-[var(--foreground)] text-sm"
                      htmlFor="operator-color"
                    >
                      Vehicle Colour
                    </label>
                    <input
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 px-4 py-2.5 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                      id="operator-color"
                      onChange={(e) =>
                        setVehicleDraft({
                          ...vehicleDraft,
                          color: e.target.value,
                        })
                      }
                      type="text"
                      value={vehicleDraft.color}
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-4">
                    <p className="text-[var(--text-muted)] text-xs uppercase tracking-[.2em]">
                      Phone
                    </p>
                    <p className="mt-2 font-semibold text-[var(--foreground)] text-sm">
                      {profile.phone}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-4">
                    <p className="text-[var(--text-muted)] text-xs uppercase tracking-[.2em]">
                      Email
                    </p>
                    <p className="mt-2 font-semibold text-[var(--foreground)] text-sm">
                      {profile.email}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-4">
                    <p className="text-[var(--text-muted)] text-xs uppercase tracking-[.2em]">
                      Vehicle Colour
                    </p>
                    <p className="mt-2 font-semibold text-[var(--foreground)] text-sm">
                      {profile.vehicleInfo.color}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-4">
                    <p className="text-[var(--text-muted)] text-xs uppercase tracking-[.2em]">
                      Member Since
                    </p>
                    <p className="mt-2 font-semibold text-[var(--foreground)] text-sm">
                      {formatMonthYear(profile.memberSince)}
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 font-semibold text-[var(--foreground)] text-sm transition hover:bg-[var(--surface-muted)]"
                  onClick={handleMessageSupport}
                  type="button"
                >
                  <FaEnvelope /> Message Support
                </button>
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-3xl bg-sky-600 px-4 py-3 font-semibold text-sm text-white transition hover:bg-sky-500"
                  onClick={() => router.push("/operator/map")}
                  type="button"
                >
                  <FaRoute /> Update Route
                </button>
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 font-semibold text-[var(--foreground)] text-sm transition hover:bg-[var(--surface-muted)]"
                  onClick={() =>
                    showToast("Payout statements coming soon.", "info")
                  }
                  type="button"
                >
                  <FaPhoneAlt /> View payout statement
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[var(--text-muted)] text-sm uppercase tracking-[.2em]">
                    Recent rides
                  </p>
                  <h3 className="mt-2 font-semibold text-[var(--foreground)] text-xl">
                    Ride history
                  </h3>
                </div>
                <span className="rounded-full bg-[var(--surface-strong)] px-3 py-2 font-semibold text-[var(--text-muted)] text-xs uppercase tracking-[.2em]">
                  {profile.history.length} items
                </span>
              </div>

              {profile.history.length === 0 ? (
                <p className="mt-6 text-[var(--text-muted)]">
                  You have not taken a ride yet.
                </p>
              ) : (
                <div className="mt-6 space-y-4">
                  {profile.history.map((ride) => (
                    <div
                      className="rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-4 sm:flex sm:items-center sm:justify-between"
                      key={ride.id}
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-[var(--text-muted)] text-sm">
                          <span>{ride.commuterName}</span>
                          <span>•</span>
                          <span>{formatDate(ride.createdAt)}</span>
                        </div>
                        <div className="text-[var(--foreground)] text-sm">
                          {ride.pickupAddress} → {ride.dropoffAddress}
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-4 sm:mt-0 sm:w-52">
                        <span className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-semibold text-sky-500 text-sm shadow-sm dark:text-sky-400">
                          {formatPeso(ride.fare)}
                        </span>
                        <span
                          className={`rounded-2xl px-3 py-2 font-semibold text-xs uppercase ${
                            RIDE_STATUS_STYLES[ride.status] ??
                            "bg-[var(--surface-muted)] text-[var(--foreground)]"
                          }`}
                        >
                          {RIDE_STATUS_LABELS[ride.status] ?? ride.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="rounded-3xl bg-sky-500/20 p-4 text-sky-500 dark:text-sky-400">
                  <FaChartLine className="text-2xl" />
                </div>
                <div>
                  <p className="text-[var(--text-muted)] text-sm uppercase tracking-[.2em]">
                    Performance
                  </p>
                  <p className="mt-2 font-semibold text-2xl text-[var(--foreground)]">
                    {profile.ratingCount > 0
                      ? `${profile.averageRating.toFixed(1)} / 5`
                      : "No ratings yet"}
                  </p>
                </div>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-4 text-center">
                  <p className="text-[var(--text-muted)] text-xs uppercase tracking-[.2em]">
                    Ratings received
                  </p>
                  <p className="mt-2 font-semibold text-[var(--foreground)] text-lg">
                    {profile.ratingCount}
                  </p>
                </div>
                <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-4 text-center">
                  <p className="text-[var(--text-muted)] text-xs uppercase tracking-[.2em]">
                    Completed rides
                  </p>
                  <p className="mt-2 font-semibold text-[var(--foreground)] text-lg">
                    {profile.completedRides}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="rounded-3xl bg-emerald-500/20 p-4 text-emerald-500 dark:text-emerald-400">
                  <FaWallet className="text-2xl" />
                </div>
                <div>
                  <p className="text-[var(--text-muted)] text-sm uppercase tracking-[.2em]">
                    Earnings
                  </p>
                  <p className="mt-2 font-semibold text-2xl text-[var(--foreground)]">
                    {formatPeso(profile.totalEarnings)}
                  </p>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-4">
                  <p className="text-[var(--text-muted)] text-xs uppercase tracking-[.2em]">
                    Average fare
                  </p>
                  <p className="mt-2 font-semibold text-[var(--foreground)] text-sm">
                    {formatPeso(averageFare)}
                  </p>
                </div>
                <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-4">
                  <p className="text-[var(--text-muted)] text-xs uppercase tracking-[.2em]">
                    Status
                  </p>
                  <p className="mt-2 font-semibold text-[var(--foreground)] text-sm">
                    {profile.isAvailable ? "Online" : "Offline"}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
              <p className="text-[var(--text-muted)] text-sm uppercase tracking-[.2em]">
                Quick actions
              </p>
              <div className="mt-4 space-y-3">
                <button
                  className="w-full rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 font-semibold text-[var(--foreground)] text-sm transition hover:bg-[var(--surface-muted)]"
                  onClick={() => router.push("/operator/map")}
                  type="button"
                >
                  Go to Dashboard
                </button>
                <button
                  className="w-full rounded-3xl bg-sky-600 px-4 py-3 font-semibold text-sm text-white transition hover:bg-sky-500"
                  onClick={startEditing}
                  type="button"
                >
                  Manage vehicle
                </button>
                <button
                  className="w-full rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 font-semibold text-[var(--foreground)] text-sm transition hover:bg-[var(--surface-muted)]"
                  onClick={() =>
                    showToast("Payout statements coming soon.", "info")
                  }
                  type="button"
                >
                  View payout statement
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
              <p className="text-[var(--text-muted)] text-sm uppercase tracking-[.2em]">
                Settings
              </p>
              <div className="mt-4 space-y-4">
                <ThemeSlider />

                <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-[var(--foreground)] text-sm">
                        Signed in as
                      </p>
                      <p className="text-[var(--text-muted)] text-sm">
                        {profile.name}
                      </p>
                    </div>
                    <button
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-5 py-2.5 font-semibold text-rose-600 transition hover:bg-rose-500/20 dark:text-rose-400"
                      onClick={() => setIsLogoutOpen(true)}
                      type="button"
                    >
                      <FaSignOutAlt />
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>

      <LogoutDialog
        isOpen={isLogoutOpen}
        onClose={() => setIsLogoutOpen(false)}
      />
    </div>
  );
}
