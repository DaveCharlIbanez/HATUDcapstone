"use client";

import Link from "next/link";
import { useState } from "react";
import { FaUser, FaHistory, FaCreditCard, FaCog, FaSignOutAlt, FaEdit, FaStar, FaMapMarkerAlt, FaClock, FaPhone, FaEnvelope, FaMapMarkedAlt } from "react-icons/fa";
import { commuterProfile } from "@/lib/commuterProfile";

interface Ride {
  id: string;
  date: string;
  from: string;
  to: string;
  vehicle: string;
  cost: number;
  status: "completed" | "cancelled";
  rating?: number;
}

interface PaymentMethod {
  id: string;
  type: "card" | "cash";
  last4?: string;
  brand?: string;
  isDefault: boolean;
}

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<"profile" | "history" | "payment" | "settings">("profile");
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
      rating: 5
    },
    {
      id: "2",
      date: "2024-01-14",
      from: "Sibalom",
      to: "San Jose de Buenavista",
      vehicle: "Skylab",
      cost: 45,
      status: "completed",
      rating: 4
    },
    {
      id: "3",
      date: "2024-01-13",
      from: "Pandan",
      to: "Libertad",
      vehicle: "Electric",
      cost: 85,
      status: "cancelled"
    }
  ];

  const paymentMethods: PaymentMethod[] = [
    {
      id: "1",
      type: "card",
      last4: "4567",
      brand: "Visa",
      isDefault: true
    },
    {
      id: "2",
      type: "cash",
      isDefault: false
    }
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
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-lg">
        <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">My Profile</h1>
            <p className="text-sm text-slate-400 mt-1">Rider • {commuterProfile.totalRides} rides • {commuterProfile.rating} ★</p>
          </div>
          <Link href="/Commuters" className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-400 transition-colors w-fit">
            <FaMapMarkedAlt />
            Book Ride
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

          {/* Sidebar */}
          <div className="md:col-span-1">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 backdrop-blur sticky top-20">
              <nav className="space-y-2">
                <button
                  onClick={() => setActiveTab("profile")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                    activeTab === "profile" ? "bg-sky-500/20 text-sky-300" : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <FaUser className="text-lg" />
                  Profile
                </button>
                <button
                  onClick={() => setActiveTab("history")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                    activeTab === "history" ? "bg-sky-500/20 text-sky-300" : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <FaHistory className="text-lg" />
                  Ride History
                </button>
                <button
                  onClick={() => setActiveTab("payment")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                    activeTab === "payment" ? "bg-sky-500/20 text-sky-300" : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <FaCreditCard className="text-lg" />
                  Payment
                </button>
                <button
                  onClick={() => setActiveTab("settings")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                    activeTab === "settings" ? "bg-sky-500/20 text-sky-300" : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <FaCog className="text-lg" />
                  Settings
                </button>
                <hr className="my-4 border-slate-700" />
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-rose-400 hover:bg-rose-500/10 transition-colors">
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
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-white">Personal Information</h2>
                  {!isEditing && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-2 px-5 py-2.5 bg-sky-500 text-white rounded-xl hover:bg-sky-400 transition-colors text-sm font-semibold"
                    >
                      <FaEdit />
                      Edit Profile
                    </button>
                  )}
                </div>

                <div className="flex flex-col md:flex-row gap-8">
                  {/* Avatar */}
                  <div className="flex flex-col items-center">
                    <div className="w-32 h-32 bg-gradient-to-br from-sky-500 to-slate-700 rounded-full flex items-center justify-center mb-4 shadow-lg">
                      <FaUser className="text-4xl text-white" />
                    </div>
                    <button className="text-sky-400 text-sm hover:text-sky-300 transition-colors">Change Photo</button>
                  </div>

                  {/* Form */}
                  <div className="flex-1 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">Full Name</label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                            className="w-full px-4 py-2.5 border border-slate-700 rounded-xl bg-slate-900/80 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                          />
                        ) : (
                          <p className="text-slate-100">{user.name}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">Email</label>
                        {isEditing ? (
                          <input
                            type="email"
                            value={editForm.email}
                            onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                            className="w-full px-4 py-2.5 border border-slate-700 rounded-xl bg-slate-900/80 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                          />
                        ) : (
                          <p className="text-slate-100">{user.email}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">Phone</label>
                        {isEditing ? (
                          <input
                            type="tel"
                            value={editForm.phone}
                            onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                            className="w-full px-4 py-2.5 border border-slate-700 rounded-xl bg-slate-900/80 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                          />
                        ) : (
                          <p className="text-slate-100">{user.phone}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">Member Since</label>
                        <p className="text-slate-100">Jan 2024</p>
                      </div>
                    </div>

                    {isEditing && (
                      <div className="flex gap-3 pt-4">
                        <button
                          onClick={handleSaveProfile}
                          className="flex-1 px-5 py-2.5 bg-sky-500 text-white font-semibold rounded-xl hover:bg-sky-400 transition-colors"
                        >
                          Save Changes
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="flex-1 px-5 py-2.5 border border-slate-700 text-slate-300 font-semibold rounded-xl hover:bg-slate-800 transition-colors"
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
                <h2 className="text-2xl font-bold text-white mb-6">Ride History</h2>
                <div className="space-y-4">
                  {rideHistory.map((ride) => (
                    <div key={ride.id} className="border border-slate-700 rounded-xl p-5 bg-slate-800/30 hover:bg-slate-800/50 transition-colors">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            ride.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                          }`}>
                            {ride.status}
                          </div>
                          <span className="text-sm text-slate-400">{ride.date}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-slate-100">₱{ride.cost}</div>
                          <div className="text-sm text-slate-400">{ride.vehicle}</div>
                        </div>
                      </div>
                      <div className="space-y-2 mb-3">
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                          <FaMapMarkerAlt className="text-emerald-400" />
                          <span>{ride.from}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                          <FaMapMarkerAlt className="text-rose-400" />
                          <span>{ride.to}</span>
                        </div>
                      </div>
                      {ride.rating && (
                        <div className="flex items-center gap-1 pt-3 border-t border-slate-700">
                          <span className="text-sm text-slate-400">Rating:</span>
                          {[...Array(5)].map((_, i) => (
                            <FaStar
                              key={i}
                              className={`text-sm ${i < ride.rating! ? 'text-amber-400' : 'text-slate-600'}`}
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
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">Payment Methods</h2>
                  <button className="px-4 py-2.5 bg-sky-500 text-white text-sm font-semibold rounded-xl hover:bg-sky-400 transition-colors">
                    + Add Method
                  </button>
                </div>
                <div className="space-y-4">
                  {paymentMethods.map((method) => (
                    <div key={method.id} className="flex items-center justify-between p-5 border border-slate-700 rounded-xl bg-slate-800/30">
                      <div className="flex items-center gap-4">
                        {method.type === 'card' ? (
                          <FaCreditCard className="text-2xl text-sky-400" />
                        ) : (
                          <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center">
                            <span className="text-emerald-400 font-bold">₱</span>
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-slate-100">
                            {method.type === 'card' ? `${method.brand} •••• ${method.last4}` : 'Cash'}
                          </div>
                          {method.isDefault && (
                            <span className="text-xs text-sky-400">Default Payment</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!method.isDefault && (
                          <button className="px-3 py-1 text-sm text-sky-400 hover:bg-sky-500/10 rounded-lg transition-colors">
                            Set Default
                          </button>
                        )}
                        <button className="px-3 py-1 text-sm text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">
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
                <h2 className="text-2xl font-bold text-white mb-6">Settings</h2>
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/30 border border-slate-700">
                    <div>
                      <h3 className="font-semibold text-slate-100">Notifications</h3>
                      <p className="text-sm text-slate-400">Receive ride updates and promotions</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-sky-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/30 border border-slate-700">
                    <div>
                      <h3 className="font-semibold text-slate-100">Location Services</h3>
                      <p className="text-sm text-slate-400">Allow access to your location</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-sky-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/30 border border-slate-700">
                    <div>
                      <h3 className="font-semibold text-slate-100">Dark Mode</h3>
                      <p className="text-sm text-slate-400">Currently enabled</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-sky-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                    </label>
                  </div>

                  <hr className="border-slate-700" />

                  <div className="space-y-2">
                    <button className="w-full text-left px-4 py-3 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors font-medium">
                      Delete Account
                    </button>
                    <button className="w-full text-left px-4 py-3 text-slate-300 hover:bg-slate-800 rounded-lg transition-colors">
                      Privacy Policy
                    </button>
                    <button className="w-full text-left px-4 py-3 text-slate-300 hover:bg-slate-800 rounded-lg transition-colors">
                      Terms of Service
                    </button>
                    <button className="w-full text-left px-4 py-3 text-slate-300 hover:bg-slate-800 rounded-lg transition-colors">
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
