"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FaUserTie, FaChartLine, FaWallet, FaStar, FaPhoneAlt, FaEnvelope, FaRoute, FaRegClock, FaCog } from "react-icons/fa";
import { operatorProfile } from "@/src/lib/operatorProfile";

interface RideSummary {
  id: string;
  date: string;
  pickup: string;
  dropoff: string;
  fare: number;
  status: "completed" | "cancelled" | "pending";
}

const rideHistory: RideSummary[] = [
  {
    id: "OP-001",
    date: "Apr 15, 2026",
    pickup: "San Jose de Buenavista",
    dropoff: "Hamtic",
    fare: 95,
    status: "completed",
  },
  {
    id: "OP-002",
    date: "Apr 15, 2026",
    pickup: "Libertad",
    dropoff: "Patnongon",
    fare: 85,
    status: "completed",
  },
  {
    id: "OP-003",
    date: "Apr 14, 2026",
    pickup: "Cuartero",
    dropoff: "Tibiao",
    fare: 120,
    status: "pending",
  },
];

export default function OperatorProfilePage() {
  const router = useRouter();

  const handleCallRider = () => {
    window.location.href = "tel:+639123456789";
  };

  const handleMessageSupport = () => {
    window.location.href = "mailto:support@hatud.app";
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[.2em] text-sky-400">Operator</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-100">{operatorProfile.name}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400 sm:text-base">
              {operatorProfile.vehicle} • {operatorProfile.plate} • {operatorProfile.region}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/operator"
              className="inline-flex items-center justify-center rounded-full bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-sky-500/20 text-sky-400 shadow-sm">
                    <FaUserTie className="text-3xl" />
                  </div>
                  <div>
                    <p className="text-sm uppercase tracking-[.2em] text-slate-500">Operator Name</p>
                    <h2 className="mt-2 text-2xl font-semibold text-slate-100">Rodel Mercado</h2>
                    <p className="mt-1 text-sm text-slate-400">Antique Province • Driver ID: OP-1458</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="rounded-3xl border border-slate-700 bg-slate-800/50 p-4 text-center">
                    <p className="text-2xl font-semibold text-slate-100">4.9</p>
                    <p className="mt-1 text-sm text-slate-400">Rating</p>
                  </div>
                  <div className="rounded-3xl border border-slate-700 bg-slate-800/50 p-4 text-center">
                    <p className="text-2xl font-semibold text-slate-100">₱8.4k</p>
                    <p className="mt-1 text-sm text-slate-400">Weekly Earnings</p>
                  </div>
                  <div className="rounded-3xl border border-slate-700 bg-slate-800/50 p-4 text-center">
                    <p className="text-2xl font-semibold text-slate-100">27</p>
                    <p className="mt-1 text-sm text-slate-400">Rides Today</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-3xl border border-slate-700 bg-slate-800/50 p-4">
                  <p className="text-sm text-slate-400">Vehicle</p>
                  <p className="mt-2 text-base font-semibold text-slate-100">Toyota Veloz</p>
                </div>
                <div className="rounded-3xl border border-slate-700 bg-slate-800/50 p-4">
                  <p className="text-sm text-slate-400">Plate Number</p>
                  <p className="mt-2 text-base font-semibold text-slate-100">NJU 1245</p>
                </div>
                <div className="rounded-3xl border border-slate-700 bg-slate-800/50 p-4">
                  <p className="text-sm text-slate-400">Service Area</p>
                  <p className="mt-2 text-base font-semibold text-slate-100">Antique, PH</p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[.2em] text-slate-500">Contact</p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-100">Primary details</h3>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-800 px-4 py-2 text-sm text-slate-300">
                  <FaCog />
                  Operator settings
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-700 bg-slate-800/50 p-4">
                  <p className="text-xs uppercase tracking-[.2em] text-slate-500">Phone</p>
                  <p className="mt-2 text-sm font-semibold text-slate-100">+63 912 345 6789</p>
                </div>
                <div className="rounded-3xl border border-slate-700 bg-slate-800/50 p-4">
                  <p className="text-xs uppercase tracking-[.2em] text-slate-500">Email</p>
                  <p className="mt-2 text-sm font-semibold text-slate-100">rodel.mercado@hatud.app</p>
                </div>
                <div className="rounded-3xl border border-slate-700 bg-slate-800/50 p-4">
                  <p className="text-xs uppercase tracking-[.2em] text-slate-500">Shift start</p>
                  <p className="mt-2 text-sm font-semibold text-slate-100">6:00 AM</p>
                </div>
                <div className="rounded-3xl border border-slate-700 bg-slate-800/50 p-4">
                  <p className="text-xs uppercase tracking-[.2em] text-slate-500">Language</p>
                  <p className="mt-2 text-sm font-semibold text-slate-100">Filipino / English</p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={handleCallRider}
                  className="inline-flex items-center justify-center gap-2 rounded-3xl bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-700 border border-slate-700"
                >
                  <FaPhoneAlt /> Call Rider
                </button>
                <button
                  type="button"
                  onClick={handleMessageSupport}
                  className="inline-flex items-center justify-center gap-2 rounded-3xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
                >
                  <FaEnvelope /> Message Support
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/operator/map")}
                  className="inline-flex items-center justify-center gap-2 rounded-3xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
                >
                  <FaRoute /> Update Route
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[.2em] text-slate-500">Recent rides</p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-100">Ride history</h3>
                </div>
                <span className="rounded-full bg-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-[.2em] text-slate-400">
                  {rideHistory.length} items
                </span>
              </div>

              <div className="mt-6 space-y-4">
                {rideHistory.map((ride) => (
                  <div key={ride.id} className="rounded-3xl border border-slate-700 bg-slate-800/50 p-4 sm:flex sm:items-center sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
                        <span>{ride.id}</span>
                        <span>•</span>
                        <span>{ride.date}</span>
                      </div>
                      <div className="text-sm text-slate-300">
                        {ride.pickup} → {ride.dropoff}
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-4 sm:mt-0 sm:w-52">
                      <span className="rounded-2xl bg-slate-900 px-3 py-2 text-sm font-semibold text-sky-400 shadow-sm border border-slate-700">
                        ₱{ride.fare}
                      </span>
                      <span className={`rounded-2xl px-3 py-2 text-xs font-semibold uppercase ${
                        ride.status === "completed"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : ride.status === "pending"
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-red-500/20 text-red-400"
                      }`}>
                        {ride.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="rounded-3xl bg-sky-500/20 p-4 text-sky-400">
                  <FaChartLine className="text-2xl" />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[.2em] text-slate-500">Performance</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-100">92%</p>
                </div>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-700 bg-slate-800/50 p-4 text-center">
                  <p className="text-xs uppercase tracking-[.2em] text-slate-500">Acceptance</p>
                  <p className="mt-2 text-lg font-semibold text-slate-100">96%</p>
                </div>
                <div className="rounded-3xl border border-slate-700 bg-slate-800/50 p-4 text-center">
                  <p className="text-xs uppercase tracking-[.2em] text-slate-500">On-time</p>
                  <p className="mt-2 text-lg font-semibold text-slate-100">89%</p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="rounded-3xl bg-emerald-500/20 p-4 text-emerald-400">
                  <FaWallet className="text-2xl" />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[.2em] text-slate-500">Balance</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-100">₱12,840</p>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                <div className="rounded-3xl border border-slate-700 bg-slate-800/50 p-4">
                  <p className="text-xs uppercase tracking-[.2em] text-slate-500">Next payout</p>
                  <p className="mt-2 text-sm font-semibold text-slate-100">Apr 21, 2026</p>
                </div>
                <div className="rounded-3xl border border-slate-700 bg-slate-800/50 p-4">
                  <p className="text-xs uppercase tracking-[.2em] text-slate-500">Weekly earnings</p>
                  <p className="mt-2 text-sm font-semibold text-slate-100">₱8,400</p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
              <p className="text-sm uppercase tracking-[.2em] text-slate-500">Quick actions</p>
              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  onClick={() => router.push("/operator")}
                  className="w-full rounded-3xl bg-slate-800 border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-700"
                >
                  Update profile details
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/operator/map")}
                  className="w-full rounded-3xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
                >
                  Manage vehicle
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/operator")}
                  className="w-full rounded-3xl bg-slate-800 border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-700"
                >
                  View payout statement
                </button>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
