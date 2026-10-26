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
  FaSignOutAlt,
  FaStar,
  FaUser,
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
  vehicleLabel,
} from "@/lib/format";
import { api } from "../../../convex/_generated/api";

type ProfileTab = "profile" | "history" | "payment" | "settings";

const TABS: { id: ProfileTab; label: string; icon: typeof FaUser }[] = [
  { id: "profile", label: "Profile", icon: FaUser },
  { id: "history", label: "Ride History", icon: FaHistory },
  { id: "payment", label: "Payments", icon: FaCreditCard },
  { id: "settings", label: "Settings", icon: FaCog },
];

export default function ProfilePage() {
  const { sessionToken, user } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<ProfileTab>("profile");
  const [isEditing, setIsEditing] = useState(false);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [locationServices, setLocationServices] = useState(true);
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

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* Header */}
      <div className="border-[var(--border)] border-b bg-[var(--surface)]/50 backdrop-blur-lg">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-bold text-3xl text-[var(--foreground)]">
              My Profile
            </h1>
            <p className="mt-1 text-[var(--text-muted)] text-sm">
              Rider • {profile.completedRides} rides •{" "}
              {formatPeso(profile.totalSpent)} spent
            </p>
          </div>
          <Link
            className="inline-flex w-fit items-center gap-2 rounded-full bg-sky-500 px-5 py-2.5 font-semibold text-sm text-white transition-colors hover:bg-sky-400"
            href="/map"
          >
            <FaMapMarkedAlt />
            Book Ride
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          {/* Sidebar */}
          <div className="md:col-span-1">
            <div className="sticky top-20 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/50 p-4 backdrop-blur">
              <nav className="space-y-2">
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
                        activeTab === tab.id
                          ? "bg-sky-500/20 text-sky-600 dark:text-sky-300"
                          : "text-[var(--foreground)] hover:bg-[var(--surface-strong)]"
                      }`}
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      type="button"
                    >
                      <Icon className="text-lg" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="md:col-span-3">
            {/* Profile Tab */}
            {activeTab === "profile" && (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/50 p-8 backdrop-blur">
                <div className="mb-8 flex items-center justify-between">
                  <h2 className="font-bold text-2xl text-[var(--foreground)]">
                    Personal Information
                  </h2>
                  {!isEditing && (
                    <button
                      className="flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 font-semibold text-sm text-white transition-colors hover:bg-sky-400"
                      onClick={startEditing}
                      type="button"
                    >
                      <FaEdit />
                      Edit Profile
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-8 md:flex-row">
                  {/* Avatar */}
                  <div className="flex flex-col items-center">
                    <div className="mb-4 flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-slate-700 shadow-lg">
                      <FaUser className="text-4xl text-white" />
                    </div>
                    <button
                      className="text-sky-500 text-sm transition-colors hover:text-sky-400 dark:text-sky-400"
                      onClick={() =>
                        showToast(
                          "Change photo feature is coming soon.",
                          "info"
                        )
                      }
                      type="button"
                    >
                      Change Photo
                    </button>
                  </div>

                  {/* Form */}
                  <div className="flex-1 space-y-5">
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                      <div>
                        <label
                          className="mb-2 block font-semibold text-[var(--foreground)] text-sm"
                          htmlFor="name"
                        >
                          Full Name
                        </label>
                        {isEditing ? (
                          <input
                            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 px-4 py-2.5 text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                            id="name"
                            onChange={(e) =>
                              setDraft({ ...draft, name: e.target.value })
                            }
                            type="text"
                            value={draft.name}
                          />
                        ) : (
                          <p className="text-[var(--foreground)]">
                            {profile.name}
                          </p>
                        )}
                      </div>
                      <div>
                        <label
                          className="mb-2 block font-semibold text-[var(--foreground)] text-sm"
                          htmlFor="email"
                        >
                          Email
                        </label>
                        <p className="text-[var(--foreground)]">
                          {profile.email}
                        </p>
                        <p className="mt-1 text-[var(--text-muted)] text-xs">
                          Your email is your sign-in and cannot be edited here.
                        </p>
                      </div>
                      <div>
                        <label
                          className="mb-2 block font-semibold text-[var(--foreground)] text-sm"
                          htmlFor="phone"
                        >
                          Phone
                        </label>
                        {isEditing ? (
                          <input
                            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 px-4 py-2.5 text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                            id="phone"
                            onChange={(e) =>
                              setDraft({ ...draft, phone: e.target.value })
                            }
                            type="tel"
                            value={draft.phone}
                          />
                        ) : (
                          <p className="text-[var(--foreground)]">
                            {profile.phone}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="mb-2 block font-semibold text-[var(--foreground)] text-sm">
                          Member Since
                        </p>
                        <p className="text-[var(--foreground)]">
                          {formatMonthYear(profile.memberSince)}
                        </p>
                      </div>
                    </div>

                    {isEditing && (
                      <div className="flex gap-3 pt-4">
                        <button
                          className="flex-1 rounded-xl bg-sky-500 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-sky-400"
                          onClick={handleSaveProfile}
                          type="button"
                        >
                          Save Changes
                        </button>
                        <button
                          className="flex-1 rounded-xl border border-[var(--border)] px-5 py-2.5 font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-strong)]"
                          onClick={cancelEditing}
                          type="button"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Saved places */}
                {profile.savedLocations.length > 0 && (
                  <div className="mt-10">
                    <h3 className="font-bold text-[var(--foreground)] text-lg">
                      Saved Places
                    </h3>
                    <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {profile.savedLocations.map((location) => (
                        <li
                          className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)]/30 p-4"
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
                  </div>
                )}
              </div>
            )}

            {/* Ride History Tab */}
            {activeTab === "history" && (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/50 p-8 backdrop-blur">
                <h2 className="mb-6 font-bold text-2xl text-[var(--foreground)]">
                  Ride History
                </h2>
                {profile.history.length === 0 ? (
                  <p className="text-[var(--text-muted)]">
                    You have not booked a ride yet.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {profile.history.map((ride) => (
                      <div
                        className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)]/30 p-5 transition-colors hover:bg-[var(--surface-strong)]/50"
                        key={ride.id}
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className={`rounded-full px-3 py-1 font-semibold text-xs ${
                                RIDE_STATUS_STYLES[ride.status] ??
                                "bg-[var(--surface-muted)] text-[var(--foreground)]"
                              }`}
                            >
                              {RIDE_STATUS_LABELS[ride.status] ?? ride.status}
                            </div>
                            <span className="text-[var(--text-muted)] text-sm">
                              {formatDate(ride.createdAt)}
                            </span>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-[var(--foreground)]">
                              {formatPeso(ride.fare)}
                            </div>
                            <div className="text-[var(--text-muted)] text-sm">
                              {vehicleLabel(ride.vehicleType)}
                            </div>
                          </div>
                        </div>
                        <div className="mb-3 space-y-2">
                          <div className="flex items-center gap-2 text-[var(--foreground)] text-sm">
                            <FaMapMarkerAlt className="text-emerald-500" />
                            <span>{ride.pickupAddress}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[var(--foreground)] text-sm">
                            <FaMapMarkerAlt className="text-rose-500" />
                            <span>{ride.dropoffAddress}</span>
                          </div>
                        </div>
                        {ride.rating !== null && (
                          <div className="flex items-center gap-1 border-[var(--border)] border-t pt-3">
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
              </div>
            )}

            {/* Payment Tab */}
            {activeTab === "payment" && (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/50 p-8 backdrop-blur">
                <h2 className="mb-6 font-bold text-2xl text-[var(--foreground)]">
                  Payments
                </h2>

                <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)]/30 p-5">
                    <p className="text-[var(--text-muted)] text-sm">
                      Total spent
                    </p>
                    <p className="mt-1 font-bold text-2xl text-[var(--foreground)]">
                      {formatPeso(profile.totalSpent)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)]/30 p-5">
                    <p className="text-[var(--text-muted)] text-sm">
                      Outstanding balance
                    </p>
                    <p className="mt-1 font-bold text-2xl text-[var(--foreground)]">
                      {due ? formatPeso(due.amount) : formatPeso(0)}
                    </p>
                    {due && (
                      <Link
                        className="mt-3 inline-flex rounded-lg bg-sky-500 px-4 py-2 font-semibold text-sm text-white transition-colors hover:bg-sky-400"
                        href="/payment"
                      >
                        Pay now
                      </Link>
                    )}
                  </div>
                </div>

                <h3 className="mb-4 font-semibold text-[var(--foreground)]">
                  Transaction history
                </h3>
                {profile.payments.length === 0 ? (
                  <p className="text-[var(--text-muted)]">
                    No payments recorded yet.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {profile.payments.map((payment) => (
                      <div
                        className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-strong)]/30 p-5"
                        key={payment.id}
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              ₱
                            </span>
                          </div>
                          <div>
                            <div className="font-semibold text-[var(--foreground)]">
                              GCash • {payment.referenceNumber}
                            </div>
                            <div className="text-[var(--text-muted)] text-sm">
                              {formatDate(payment.createdAt)} • {payment.status}
                            </div>
                          </div>
                        </div>
                        <div className="font-semibold text-[var(--foreground)]">
                          {formatPeso(payment.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === "settings" && (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/50 p-8 backdrop-blur">
                <h2 className="mb-6 font-bold text-2xl text-[var(--foreground)]">
                  Settings
                </h2>
                <div className="space-y-6">
                  <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-strong)]/30 p-4">
                    <div>
                      <h3 className="font-semibold text-[var(--foreground)]">
                        Notifications
                      </h3>
                      <p className="text-[var(--text-muted)] text-sm">
                        Receive ride updates and promotions
                      </p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        checked={notifications}
                        className="peer sr-only"
                        onChange={() => setNotifications((prev) => !prev)}
                        type="checkbox"
                      />
                      <div className="peer h-6 w-11 rounded-full bg-[var(--surface-muted)] after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-sky-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-sky-500/30" />
                    </label>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-strong)]/30 p-4">
                    <div>
                      <h3 className="font-semibold text-[var(--foreground)]">
                        Location Services
                      </h3>
                      <p className="text-[var(--text-muted)] text-sm">
                        Allow access to your location
                      </p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        checked={locationServices}
                        className="peer sr-only"
                        onChange={() => setLocationServices((prev) => !prev)}
                        type="checkbox"
                      />
                      <div className="peer h-6 w-11 rounded-full bg-[var(--surface-muted)] after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-sky-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-sky-500/30" />
                    </label>
                  </div>

                  <ThemeSlider />

                  <hr className="border-[var(--border)]" />

                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)]/30 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-semibold text-[var(--foreground)]">
                          Signed in as
                        </h3>
                        <p className="text-[var(--text-muted)] text-sm">
                          {user?.name ?? user?.email}
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

                  <div className="space-y-2">
                    <button
                      className="w-full rounded-lg px-4 py-3 text-left font-medium text-rose-500 transition-colors hover:bg-rose-500/10 dark:text-rose-400"
                      onClick={() =>
                        showToast(
                          "Account deletion: please contact support.",
                          "error"
                        )
                      }
                      type="button"
                    >
                      Delete Account
                    </button>
                    <button
                      className="w-full rounded-lg px-4 py-3 text-left text-[var(--foreground)] transition-colors hover:bg-[var(--surface-strong)]"
                      onClick={() =>
                        showToast("Privacy policy coming soon.", "info")
                      }
                      type="button"
                    >
                      Privacy Policy
                    </button>
                    <button
                      className="w-full rounded-lg px-4 py-3 text-left text-[var(--foreground)] transition-colors hover:bg-[var(--surface-strong)]"
                      onClick={() =>
                        showToast("Terms of service coming soon.", "info")
                      }
                      type="button"
                    >
                      Terms of Service
                    </button>
                    <button
                      className="w-full rounded-lg px-4 py-3 text-left text-[var(--foreground)] transition-colors hover:bg-[var(--surface-strong)]"
                      onClick={() =>
                        showToast("Help & Support coming soon.", "info")
                      }
                      type="button"
                    >
                      Help &amp; Support
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <LogoutDialog
        isOpen={isLogoutOpen}
        onClose={() => setIsLogoutOpen(false)}
      />
    </div>
  );
}
