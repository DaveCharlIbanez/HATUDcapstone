"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import {
  FaChartLine,
  FaCog,
  FaEdit,
  FaHistory,
  FaMotorcycle,
  FaUserTie,
  FaWallet,
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
  const { sessionToken, user } = useAuth();
  const { showToast } = useToast();

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

  const lastRide = profile.history[0];
  const historyPreview = lastRide
    ? `${profile.history.length} rides · last on ${formatDate(lastRide.createdAt)}`
    : "No rides yet";
  const ratingText =
    profile.ratingCount > 0 ? profile.averageRating.toFixed(1) : "—";

  const inputClass =
    "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 px-4 py-2.5 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-sky-500/50";
  const tileClass =
    "rounded-xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-3";
  const tileLabel =
    "text-[var(--text-muted)] text-xs uppercase tracking-[.15em]";
  const tileValue = "mt-1 font-semibold text-[var(--foreground)] text-sm";

  const field = (
    id: string,
    label: string,
    value: string,
    onChange: (next: string) => void,
    type = "text"
  ) => (
    <div>
      <label
        className="mb-1 block font-semibold text-[var(--foreground)] text-sm"
        htmlFor={id}
      >
        {label}
      </label>
      <input
        className={inputClass}
        id={id}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        value={value}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        {/* The summary stays visible: who, what they drive, and three numbers. */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-500/20 text-sky-500 dark:text-sky-400">
                <FaUserTie className="text-xl" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sky-500 text-xs uppercase tracking-[.2em] dark:text-sky-400">
                  Operator
                </p>
                <h1 className="truncate font-semibold text-[var(--foreground)] text-xl">
                  {profile.name}
                </h1>
                <p className="truncate text-[var(--text-muted)] text-sm">
                  {profile.vehicleInfo.model} •{" "}
                  {profile.vehicleInfo.plateNumber} • {SERVICE_AREA}
                </p>
              </div>
            </div>
            <Link
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-sky-600 px-4 py-2 font-semibold text-sm text-white shadow-sm transition hover:bg-sky-500"
              href="/operator/map"
            >
              Dashboard
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className={tileClass}>
              <p className="font-semibold text-[var(--foreground)] text-lg">
                {ratingText}
              </p>
              <p className="text-[var(--text-muted)] text-xs">Rating</p>
            </div>
            <div className={tileClass}>
              <p className="truncate font-semibold text-[var(--foreground)] text-lg">
                {formatPeso(profile.totalEarnings)}
              </p>
              <p className="text-[var(--text-muted)] text-xs">Earnings</p>
            </div>
            <div className={tileClass}>
              <p className="font-semibold text-[var(--foreground)] text-lg">
                {profile.completedRides}
              </p>
              <p className="text-[var(--text-muted)] text-xs">Rides</p>
            </div>
          </div>
        </section>

        <SettingsGroup>
          <SettingsSection
            icon={FaMotorcycle}
            id="vehicle"
            preview={`${profile.vehicleInfo.model} · ${profile.vehicleInfo.plateNumber} · ${profile.vehicleInfo.color}`}
            title="Profile & vehicle"
          >
            {isEditing ? (
              <div className="space-y-3">
                {field("operator-name", "Full name", nameDraft, setNameDraft)}
                {field(
                  "operator-phone",
                  "Phone",
                  phoneDraft,
                  setPhoneDraft,
                  "tel"
                )}
                {field(
                  "operator-vehicle",
                  "Vehicle model",
                  vehicleDraft.model,
                  (model) => setVehicleDraft({ ...vehicleDraft, model })
                )}
                {field(
                  "operator-plate",
                  "Plate number",
                  vehicleDraft.plateNumber,
                  (plateNumber) =>
                    setVehicleDraft({ ...vehicleDraft, plateNumber })
                )}
                {field(
                  "operator-color",
                  "Vehicle colour",
                  vehicleDraft.color,
                  (color) => setVehicleDraft({ ...vehicleDraft, color })
                )}
                <div className="flex gap-3 pt-1">
                  <button
                    className="min-h-11 flex-1 rounded-xl bg-sky-600 px-4 py-2 font-semibold text-sm text-white transition hover:bg-sky-500"
                    onClick={handleSaveProfile}
                    type="button"
                  >
                    Save
                  </button>
                  <button
                    className="min-h-11 flex-1 rounded-xl border border-[var(--border)] px-4 py-2 font-semibold text-[var(--foreground)] text-sm transition hover:bg-[var(--surface-strong)]"
                    onClick={() => setIsEditing(false)}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className={tileClass}>
                    <p className={tileLabel}>Phone</p>
                    <p className={tileValue}>{profile.phone}</p>
                  </div>
                  <div className={tileClass}>
                    <p className={tileLabel}>Email</p>
                    <p className={`${tileValue} break-all`}>{profile.email}</p>
                  </div>
                  <div className={tileClass}>
                    <p className={tileLabel}>Vehicle</p>
                    <p className={tileValue}>
                      {profile.vehicleInfo.model} · {profile.vehicleInfo.color}
                    </p>
                  </div>
                  <div className={tileClass}>
                    <p className={tileLabel}>Plate number</p>
                    <p className={tileValue}>
                      {profile.vehicleInfo.plateNumber}
                    </p>
                  </div>
                  <div className={tileClass}>
                    <p className={tileLabel}>Licence number</p>
                    <p className={tileValue}>{profile.licenseNumber}</p>
                  </div>
                  <div className={tileClass}>
                    <p className={tileLabel}>Member since</p>
                    <p className={tileValue}>
                      {formatMonthYear(profile.memberSince)}
                    </p>
                  </div>
                </div>
                <button
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2 font-semibold text-sm text-white transition hover:bg-sky-500"
                  onClick={startEditing}
                  type="button"
                >
                  <FaEdit />
                  Edit profile & vehicle
                </button>
              </div>
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
                You have not taken a ride yet.
              </p>
            ) : (
              <div className="space-y-3">
                {profile.history.map((ride) => (
                  <div className={tileClass} key={ride.id}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-[var(--text-muted)] text-xs">
                        {ride.commuterName} • {formatDate(ride.createdAt)}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 font-semibold text-xs uppercase ${
                          RIDE_STATUS_STYLES[ride.status] ??
                          "bg-[var(--surface-muted)] text-[var(--foreground)]"
                        }`}
                      >
                        {RIDE_STATUS_LABELS[ride.status] ?? ride.status}
                      </span>
                    </div>
                    <div className="mt-2 flex items-end justify-between gap-3">
                      <p className="min-w-0 text-[var(--foreground)] text-sm">
                        {ride.pickupAddress} → {ride.dropoffAddress}
                      </p>
                      <span className="shrink-0 font-semibold text-sky-500 text-sm dark:text-sky-400">
                        {formatPeso(ride.fare)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SettingsSection>

          <SettingsSection
            icon={FaChartLine}
            id="performance"
            preview={
              profile.ratingCount > 0
                ? `${profile.averageRating.toFixed(1)} / 5 from ${profile.ratingCount} ${profile.ratingCount === 1 ? "rating" : "ratings"}`
                : "No ratings yet"
            }
            title="Performance"
          >
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className={tileClass}>
                <p className={tileLabel}>Ratings received</p>
                <p className="mt-1 font-semibold text-[var(--foreground)] text-lg">
                  {profile.ratingCount}
                </p>
              </div>
              <div className={tileClass}>
                <p className={tileLabel}>Completed rides</p>
                <p className="mt-1 font-semibold text-[var(--foreground)] text-lg">
                  {profile.completedRides}
                </p>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            icon={FaWallet}
            id="earnings"
            preview={`${formatPeso(profile.totalEarnings)} · ${formatPeso(averageFare)} average fare`}
            title="Earnings"
          >
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className={tileClass}>
                  <p className={tileLabel}>Average fare</p>
                  <p className={tileValue}>{formatPeso(averageFare)}</p>
                </div>
                <div className={tileClass}>
                  <p className={tileLabel}>Status</p>
                  <p className={tileValue}>
                    {profile.isAvailable ? "Online" : "Offline"}
                  </p>
                </div>
              </div>
              <button
                className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-2 font-semibold text-[var(--foreground)] text-sm transition hover:bg-[var(--surface-muted)]"
                onClick={() =>
                  showToast("Payout statements coming soon.", "info")
                }
                type="button"
              >
                View payout statement
              </button>
            </div>
          </SettingsSection>

          <SettingsLinkRow
            href="/settings"
            icon={FaCog}
            preview="Theme, password, support, sign out"
            title="Settings"
          />
        </SettingsGroup>
      </div>
    </div>
  );
}
