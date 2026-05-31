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
import { commuterProfile } from "@/lib/commuterProfile";
import { useAuth } from "@/lib/authContext";

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
  const router = useRouter();
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState<
    "profile" | "history" | "payment" | "settings"
  >("profile");
  const [isEditing, setIsEditing] = useState(false);

  // Mock user data
  const [user, setUser] = useState(commuterProfile);
  const [editForm, setEditForm] = useState(user);

  const rideHistory: Ride[] = [
    {
      id: "1",
      date: "2024-01-15",
      from: "San Jose de Buenavista",
      to: "Hamtic",
      vehicle: "Tricycle",
      cost: 75,
      status: "completed",
      rating: 5,
    },
    {
      id: "2",
      date: "2024-01-14",
      from: "Sibalom",
      to: "San Jose de Buenavista",
      vehicle: "Skylab",
      cost: 45,
      status: "completed",
      rating: 4,
    },
    {
      id: "3",
      date: "2024-01-13",
      from: "Pandan",
      to: "Libertad",
      vehicle: "Electric",
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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="border-slate-800 border-b bg-slate-900/50 backdrop-blur-lg">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-bold text-3xl text-white">My Profile</h1>
            <p className="mt-1 text-slate-400 text-sm">
              Rider • {commuterProfile.totalRides} rides •{" "}
              {commuterProfile.rating} ★
            </p>
          </div>
          <Link
            className="inline-flex w-fit items-center gap-2 rounded-full bg-sky-500 px-5 py-2.5 font-semibold text-sm text-white transition-colors hover:bg-sky-400"
            href="/Commuters"
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
            <div className="sticky top-20 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 backdrop-blur">
              <nav className="space-y-2">
                <button
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
                    activeTab === "profile"
                      ? "bg-sky-500/20 text-sky-300"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                  onClick={() => setActiveTab("profile")}
                >
                  <FaUser className="text-lg" />
                  Profile
                </button>
                <button
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
                    activeTab === "history"
                      ? "bg-sky-500/20 text-sky-300"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                  onClick={() => setActiveTab("history")}
                >
                  <FaHistory className="text-lg" />
                  Ride History
                </button>
                <button
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
                    activeTab === "payment"
                      ? "bg-sky-500/20 text-sky-300"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                  onClick={() => setActiveTab("payment")}
                >
                  <FaCreditCard className="text-lg" />
                  Payment
                </button>
                <button
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
                    activeTab === "settings"
                      ? "bg-sky-500/20 text-sky-300"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                  onClick={() => setActiveTab("settings")}
                >
                  <FaCog className="text-lg" />
                  Settings
                </button>
                <hr className="my-4 border-slate-700" />
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
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 backdrop-blur">
                <div className="mb-8 flex items-center justify-between">
                  <h2 className="font-bold text-2xl text-white">
                    Personal Information
                  </h2>
                  {!isEditing && (
                    <button
                      className="flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 font-semibold text-sm text-white transition-colors hover:bg-sky-400"
                      onClick={() => setIsEditing(true)}
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
                        alert("Change photo feature is coming soon.")
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
                        <label className="mb-2 block font-semibold text-slate-300 text-sm">
                          Full Name
                        </label>
                        {isEditing ? (
                          <input
                            className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                            onChange={(e) =>
                              setEditForm({ ...editForm, name: e.target.value })
                            }
                            type="text"
                            value={editForm.name}
                          />
                        ) : (
                          <p className="text-slate-100">{user.name}</p>
                        )}
                      </div>
                      <div>
                        <label className="mb-2 block font-semibold text-slate-300 text-sm">
                          Email
                        </label>
                        {isEditing ? (
                          <input
                            className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
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
                          <p className="text-slate-100">{user.email}</p>
                        )}
                      </div>
                      <div>
                        <label className="mb-2 block font-semibold text-slate-300 text-sm">
                          Phone
                        </label>
                        {isEditing ? (
                          <input
                            className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
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
                          <p className="text-slate-100">{user.phone}</p>
                        )}
                      </div>
                      <div>
                        <label className="mb-2 block font-semibold text-slate-300 text-sm">
                          Member Since
                        </label>
                        <p className="text-slate-100">Jan 2024</p>
                      </div>
                    </div>

                    {isEditing && (
                      <div className="flex gap-3 pt-4">
                        <button
                          className="flex-1 rounded-xl bg-sky-500 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-sky-400"
                          onClick={handleSaveProfile}
                        >
                          Save Changes
                        </button>
                        <button
                          className="flex-1 rounded-xl border border-slate-700 px-5 py-2.5 font-semibold text-slate-300 transition-colors hover:bg-slate-800"
                          onClick={handleCancelEdit}
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
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 backdrop-blur">
                <h2 className="mb-6 font-bold text-2xl text-white">
                  Ride History
                </h2>
                <div className="space-y-4">
                  {rideHistory.map((ride) => (
                    <div
                      className="rounded-xl border border-slate-700 bg-slate-800/30 p-5 transition-colors hover:bg-slate-800/50"
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
                          <span className="text-slate-400 text-sm">
                            {ride.date}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-slate-100">
                            ₱{ride.cost}
                          </div>
                          <div className="text-slate-400 text-sm">
                            {ride.vehicle}
                          </div>
                        </div>
                      </div>
                      <div className="mb-3 space-y-2">
                        <div className="flex items-center gap-2 text-slate-300 text-sm">
                          <FaMapMarkerAlt className="text-emerald-400" />
                          <span>{ride.from}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-300 text-sm">
                          <FaMapMarkerAlt className="text-rose-400" />
                          <span>{ride.to}</span>
                        </div>
                      </div>
                      {ride.rating && (
                        <div className="flex items-center gap-1 border-slate-700 border-t pt-3">
                          <span className="text-slate-400 text-sm">
                            Rating:
                          </span>
                          {[...Array(5)].map((_, i) => (
                            <FaStar
                              className={`text-sm ${i < ride.rating! ? "text-amber-400" : "text-slate-600"}`}
                              key={i}
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
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 backdrop-blur">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="font-bold text-2xl text-white">
                    Payment Methods
                  </h2>
                  <button className="rounded-xl bg-sky-500 px-4 py-2.5 font-semibold text-sm text-white transition-colors hover:bg-sky-400">
                    + Add Method
                  </button>
                </div>
                <div className="space-y-4">
                  {paymentMethods.map((method) => (
                    <div
                      className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/30 p-5"
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
                          <div className="font-semibold text-slate-100">
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
                          <button className="rounded-lg px-3 py-1 text-sky-400 text-sm transition-colors hover:bg-sky-500/10">
                            Set Default
                          </button>
                        )}
                        <button className="rounded-lg px-3 py-1 text-rose-400 text-sm transition-colors hover:bg-rose-500/10">
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
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 backdrop-blur">
                <h2 className="mb-6 font-bold text-2xl text-white">Settings</h2>
                <div className="space-y-6">
                  <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/30 p-4">
                    <div>
                      <h3 className="font-semibold text-slate-100">
                        Notifications
                      </h3>
                      <p className="text-slate-400 text-sm">
                        Receive ride updates and promotions
                      </p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        className="peer sr-only"
                        defaultChecked
                        type="checkbox"
                      />
                      <div className="peer h-6 w-11 rounded-full bg-slate-700 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-sky-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-sky-500/30" />
                    </label>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/30 p-4">
                    <div>
                      <h3 className="font-semibold text-slate-100">
                        Location Services
                      </h3>
                      <p className="text-slate-400 text-sm">
                        Allow access to your location
                      </p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        className="peer sr-only"
                        defaultChecked
                        type="checkbox"
                      />
                      <div className="peer h-6 w-11 rounded-full bg-slate-700 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-sky-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-sky-500/30" />
                    </label>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/30 p-4">
                    <div>
                      <h3 className="font-semibold text-slate-100">
                        Dark Mode
                      </h3>
                      <p className="text-slate-400 text-sm">
                        Currently enabled
                      </p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        className="peer sr-only"
                        defaultChecked
                        type="checkbox"
                      />
                      <div className="peer h-6 w-11 rounded-full bg-slate-700 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-sky-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-sky-500/30" />
                    </label>
                  </div>

                  <hr className="border-slate-700" />

                  <div className="space-y-2">
                    <button className="w-full rounded-lg px-4 py-3 text-left font-medium text-rose-400 transition-colors hover:bg-rose-500/10">
                      Delete Account
                    </button>
                    <button className="w-full rounded-lg px-4 py-3 text-left text-slate-300 transition-colors hover:bg-slate-800">
                      Privacy Policy
                    </button>
                    <button className="w-full rounded-lg px-4 py-3 text-left text-slate-300 transition-colors hover:bg-slate-800">
                      Terms of Service
                    </button>
                    <button className="w-full rounded-lg px-4 py-3 text-left text-slate-300 transition-colors hover:bg-slate-800">
                      Help & Support
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
