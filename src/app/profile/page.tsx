"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { ThemeSlider } from "@/components/ThemeSlider";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/authContext";
import { commuterProfile } from "@/lib/commuterProfile";

interface Ride {
  cost: number;
  date: string;
  from: string;
  id: string;
  rating?: number;
  status: "completed" | "cancelled";
  to: string;
  vehicle: string;
}

interface PaymentMethod {
  brand?: string;
  id: string;
  isDefault: boolean;
  last4?: string;
  type: "card" | "cash";
}

export default function ProfilePage() {
  const _router = useRouter();
  const { logout } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<
    "profile" | "history" | "payment" | "settings"
  >("profile");
  const [isEditing, setIsEditing] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [locationServices, setLocationServices] = useState(true);

  // Mock user data
  const [user, setUser] = useState(commuterProfile);
  const [editForm, setEditForm] = useState(user);

  const rideHistory: Ride[] = [
    {
      id: "1",
      date: "2024-01-15",
      from: "San Jose de Buenavista",
      to: "Hamtic",
      vehicle: "Motorcycle w/ Pillion",
      cost: 75,
      status: "completed",
      rating: 5,
    },
    {
      id: "2",
      date: "2024-01-14",
      from: "Sibalom",
      to: "San Jose de Buenavista",
      vehicle: "Standard",
      cost: 45,
      status: "completed",
      rating: 4,
    },
    {
      id: "3",
      date: "2024-01-13",
      from: "Pandan",
      to: "Libertad",
      vehicle: "Family",
      cost: 85,
      status: "cancelled",
    },
  ];

  const paymentMethods: PaymentMethod[] = [
    {
      id: "1",
      type: "card",
      last4: "4567",
      brand: "Visa",
      isDefault: true,
    },
    {
      id: "2",
      type: "cash",
      isDefault: false,
    },
  ];

  const handleSaveProfile = () => {
    setUser(editForm);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditForm(user);
    setIsEditing(false);
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* Header */}
      <div className="border-[var(--border)] border-b bg-[var(--surface)]/50 backdrop-blur-lg">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-bold text-3xl text-white">My Profile</h1>
            <p className="mt-1 text-[var(--text-muted)] text-sm">
              Rider • {commuterProfile.totalRides} rides •{" "}
              {commuterProfile.rating} ★
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
                <button
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
                    activeTab === "profile"
                      ? "bg-sky-500/20 text-sky-300"
                      : "text-[var(--foreground)] hover:bg-[var(--surface-strong)]"
                  }`}
                  onClick={() => setActiveTab("profile")}
                  type="button"
                >
                  <FaUser className="text-lg" />
                  Profile
                </button>
                <button
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
                    activeTab === "history"
                      ? "bg-sky-500/20 text-sky-300"
                      : "text-[var(--foreground)] hover:bg-[var(--surface-strong)]"
                  }`}
                  onClick={() => setActiveTab("history")}
                  type="button"
                >
                  <FaHistory className="text-lg" />
                  Ride History
                </button>
                <button
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
                    activeTab === "payment"
                      ? "bg-sky-500/20 text-sky-300"
                      : "text-[var(--foreground)] hover:bg-[var(--surface-strong)]"
                  }`}
                  onClick={() => setActiveTab("payment")}
                  type="button"
                >
                  <FaCreditCard className="text-lg" />
                  Payment
                </button>
                <button
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
                    activeTab === "settings"
                      ? "bg-sky-500/20 text-sky-300"
                      : "text-[var(--foreground)] hover:bg-[var(--surface-strong)]"
                  }`}
                  onClick={() => setActiveTab("settings")}
                  type="button"
                >
                  <FaCog className="text-lg" />
                  Settings
                </button>
                <hr className="my-4 border-[var(--border)]" />
                <button
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-rose-400 transition-colors hover:bg-rose-500/10"
                  onClick={logout}
                  type="button"
                >
                  <FaSignOutAlt className="text-lg" />
                  Sign Out
                </button>
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="md:col-span-3">
            {/* Profile Tab */}
            {activeTab === "profile" && (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/50 p-8 backdrop-blur">
                <div className="mb-8 flex items-center justify-between">
                  <h2 className="font-bold text-2xl text-white">
                    Personal Information
                  </h2>
                  {!isEditing && (
                    <button
                      className="flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 font-semibold text-sm text-white transition-colors hover:bg-sky-400"
                      onClick={() => setIsEditing(true)}
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
                      className="text-sky-400 text-sm transition-colors hover:text-sky-300"
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
                            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 px-4 py-2.5 text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                            id="name"
                            onChange={(e) =>
                              setEditForm({ ...editForm, name: e.target.value })
                            }
                            type="text"
                            value={editForm.name}
                          />
                        ) : (
                          <p className="text-[var(--foreground)]">
                            {user.name}
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
                        {isEditing ? (
                          <input
                            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 px-4 py-2.5 text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                email: e.target.value,
                              })
                            }
                            type="email"
                            value={editForm.email}
                          />
                        ) : (
                          <p className="text-[var(--foreground)]">
                            {user.email}
                          </p>
                        )}
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
                            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 px-4 py-2.5 text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                phone: e.target.value,
                              })
                            }
                            type="tel"
                            value={editForm.phone}
                          />
                        ) : (
                          <p className="text-[var(--foreground)]">
                            {user.phone}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="mb-2 block font-semibold text-[var(--foreground)] text-sm">
                          Member Since
                        </p>
                        <p className="text-[var(--foreground)]">Jan 2024</p>
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
                          onClick={handleCancelEdit}
                          type="button"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Ride History Tab */}
            {activeTab === "history" && (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/50 p-8 backdrop-blur">
                <h2 className="mb-6 font-bold text-2xl text-white">
                  Ride History
                </h2>
                <div className="space-y-4">
                  {rideHistory.map((ride) => (
                    <div
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)]/30 p-5 transition-colors hover:bg-[var(--surface-strong)]/50"
                      key={ride.id}
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`rounded-full px-3 py-1 font-semibold text-xs ${
                              ride.status === "completed"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-rose-500/20 text-rose-300"
                            }`}
                          >
                            {ride.status}
                          </div>
                          <span className="text-[var(--text-muted)] text-sm">
                            {ride.date}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-[var(--foreground)]">
                            ₱{ride.cost}
                          </div>
                          <div className="text-[var(--text-muted)] text-sm">
                            {ride.vehicle}
                          </div>
                        </div>
                      </div>
                      <div className="mb-3 space-y-2">
                        <div className="flex items-center gap-2 text-[var(--foreground)] text-sm">
                          <FaMapMarkerAlt className="text-emerald-400" />
                          <span>{ride.from}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[var(--foreground)] text-sm">
                          <FaMapMarkerAlt className="text-rose-400" />
                          <span>{ride.to}</span>
                        </div>
                      </div>
                      {ride.rating && (
                        <div className="flex items-center gap-1 border-[var(--border)] border-t pt-3">
                          <span className="text-[var(--text-muted)] text-sm">
                            Rating:
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
              </div>
            )}

            {/* Payment Tab */}
            {activeTab === "payment" && (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/50 p-8 backdrop-blur">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="font-bold text-2xl text-white">
                    Payment Methods
                  </h2>
                  <button
                    className="rounded-xl bg-sky-500 px-4 py-2.5 font-semibold text-sm text-white transition-colors hover:bg-sky-400"
                    onClick={() =>
                      showToast("Payment methods coming soon.", "info")
                    }
                    type="button"
                  >
                    + Add Method
                  </button>
                </div>
                <div className="space-y-4">
                  {paymentMethods.map((method) => (
                    <div
                      className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-strong)]/30 p-5"
                      key={method.id}
                    >
                      <div className="flex items-center gap-4">
                        {method.type === "card" ? (
                          <FaCreditCard className="text-2xl text-sky-400" />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20">
                            <span className="font-bold text-emerald-400">
                              ₱
                            </span>
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-[var(--foreground)]">
                            {method.type === "card"
                              ? `${method.brand} •••• ${method.last4}`
                              : "Cash"}
                          </div>
                          {method.isDefault && (
                            <span className="text-sky-400 text-xs">
                              Default Payment
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!method.isDefault && (
                          <button
                            className="rounded-lg px-3 py-1 text-sky-400 text-sm transition-colors hover:bg-sky-500/10"
                            onClick={() =>
                              showToast("Set as default coming soon.", "info")
                            }
                            type="button"
                          >
                            Set Default
                          </button>
                        )}
                        <button
                          className="rounded-lg px-3 py-1 text-rose-400 text-sm transition-colors hover:bg-rose-500/10"
                          onClick={() =>
                            showToast(
                              "Remove payment method coming soon.",
                              "info"
                            )
                          }
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === "settings" && (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/50 p-8 backdrop-blur">
                <h2 className="mb-6 font-bold text-2xl text-white">Settings</h2>
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

                  <div className="space-y-2">
                    <button
                      className="w-full rounded-lg px-4 py-3 text-left font-medium text-rose-400 transition-colors hover:bg-rose-500/10"
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
    </div>
  );
}
