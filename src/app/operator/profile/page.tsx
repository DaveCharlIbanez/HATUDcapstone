"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  FaChartLine,
  FaCog,
  FaEnvelope,
  FaPhoneAlt,
  FaRoute,
  FaSignOutAlt,
  FaUserTie,
  FaWallet,
} from "react-icons/fa";
import { ThemeSlider } from "@/components/ThemeSlider";
import { useAuth } from "@/lib/authContext";
import { operatorProfile } from "@/lib/operatorProfile";

interface RideSummary {
  date: string;
  dropoff: string;
  fare: number;
  id: string;
  pickup: string;
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
  const { logout, user, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!(authLoading || user)) {
      router.push("/login");
      return;
    }
    if (!authLoading && user && user.role !== "operator") {
      if (user.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/map");
      }
    }
  }, [user, authLoading, router]);

  const handleCallRider = () => {
    window.location.href = "tel:+639123456789";
  };

  const handleMessageSupport = () => {
    window.location.href = "mailto:support@hatud.app";
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-sky-400 text-sm uppercase tracking-[.2em]">
              Operator
            </p>
            <h1 className="mt-2 font-semibold text-3xl text-[var(--foreground)] tracking-tight">
              {operatorProfile.name}
            </h1>
            <p className="mt-2 max-w-2xl text-[var(--text-muted)] text-sm sm:text-base">
              {operatorProfile.vehicle} • {operatorProfile.plate} •
              {operatorProfile.region}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              className="inline-flex items-center justify-center rounded-full bg-sky-600 px-4 py-3 font-semibold text-sm text-white shadow-sm transition hover:bg-sky-500"
              href="/operator"
            >
              Back to Dashboard
            </Link>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-4 py-3 font-semibold text-rose-400 text-sm shadow-sm transition hover:bg-rose-500/20"
              onClick={logout}
            >
              <FaSignOutAlt />
              Sign Out
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-sky-500/20 text-sky-400 shadow-sm">
                    <FaUserTie className="text-3xl" />
                  </div>
                  <div>
                    <p className="text-[var(--text-muted)] text-sm uppercase tracking-[.2em]">
                      Operator Name
                    </p>
                    <h2 className="mt-2 font-semibold text-2xl text-[var(--foreground)]">
                      Rodel Mercado
                    </h2>
                    <p className="mt-1 text-[var(--text-muted)] text-sm">
                      Antique Province • Driver ID: OP-1458
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-4 text-center">
                    <p className="font-semibold text-2xl text-[var(--foreground)]">
                      4.9
                    </p>
                    <p className="mt-1 text-[var(--text-muted)] text-sm">
                      Rating
                    </p>
                  </div>
                  <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-4 text-center">
                    <p className="font-semibold text-2xl text-[var(--foreground)]">
                      ₱8.4k
                    </p>
                    <p className="mt-1 text-[var(--text-muted)] text-sm">
                      Weekly Earnings
                    </p>
                  </div>
                  <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-4 text-center">
                    <p className="font-semibold text-2xl text-[var(--foreground)]">
                      27
                    </p>
                    <p className="mt-1 text-[var(--text-muted)] text-sm">
                      Rides Today
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-4">
                  <p className="text-[var(--text-muted)] text-sm">Vehicle</p>
                  <p className="mt-2 font-semibold text-[var(--foreground)] text-base">
                    Yamaha NMAX 155
                  </p>
                </div>
                <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-4">
                  <p className="text-[var(--text-muted)] text-sm">
                    Plate Number
                  </p>
                  <p className="mt-2 font-semibold text-[var(--foreground)] text-base">
                    NJU 1245
                  </p>
                </div>
                <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-4">
                  <p className="text-[var(--text-muted)] text-sm">
                    Service Area
                  </p>
                  <p className="mt-2 font-semibold text-[var(--foreground)] text-base">
                    Antique, PH
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
                <div className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-strong)] px-4 py-2 text-[var(--foreground)] text-sm">
                  <FaCog />
                  Operator settings
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-4">
                  <p className="text-[var(--text-muted)] text-xs uppercase tracking-[.2em]">
                    Phone
                  </p>
                  <p className="mt-2 font-semibold text-[var(--foreground)] text-sm">
                    +63 912 345 6789
                  </p>
                </div>
                <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-4">
                  <p className="text-[var(--text-muted)] text-xs uppercase tracking-[.2em]">
                    Email
                  </p>
                  <p className="mt-2 font-semibold text-[var(--foreground)] text-sm">
                    rodel.mercado@hatud.app
                  </p>
                </div>
                <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-4">
                  <p className="text-[var(--text-muted)] text-xs uppercase tracking-[.2em]">
                    Shift start
                  </p>
                  <p className="mt-2 font-semibold text-[var(--foreground)] text-sm">
                    6:00 AM
                  </p>
                </div>
                <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-4">
                  <p className="text-[var(--text-muted)] text-xs uppercase tracking-[.2em]">
                    Language
                  </p>
                  <p className="mt-2 font-semibold text-[var(--foreground)] text-sm">
                    Filipino / English
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 font-semibold text-[var(--foreground)] text-sm transition hover:bg-[var(--surface-muted)]"
                  onClick={handleCallRider}
                  type="button"
                >
                  <FaPhoneAlt /> Call Rider
                </button>
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-3xl bg-sky-600 px-4 py-3 font-semibold text-sm text-white transition hover:bg-sky-500"
                  onClick={handleMessageSupport}
                  type="button"
                >
                  <FaEnvelope /> Message Support
                </button>
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-3xl bg-emerald-600 px-4 py-3 font-semibold text-sm text-white transition hover:bg-emerald-500"
                  onClick={() => router.push("/operator")}
                  type="button"
                >
                  <FaRoute /> Update Route
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
                  {rideHistory.length} items
                </span>
              </div>

              <div className="mt-6 space-y-4">
                {rideHistory.map((ride) => (
                  <div
                    className="rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-4 sm:flex sm:items-center sm:justify-between"
                    key={ride.id}
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-[var(--text-muted)] text-sm">
                        <span>{ride.id}</span>
                        <span>•</span>
                        <span>{ride.date}</span>
                      </div>
                      <div className="text-[var(--foreground)] text-sm">
                        {ride.pickup} → {ride.dropoff}
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-4 sm:mt-0 sm:w-52">
                      <span className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-semibold text-sky-400 text-sm shadow-sm">
                        ₱{ride.fare}
                      </span>
                      <span
                        className={`rounded-2xl px-3 py-2 font-semibold text-xs uppercase ${
                          ride.status === "completed"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : ride.status === "pending"
                              ? "bg-amber-500/20 text-amber-400"
                              : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {ride.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="rounded-3xl bg-sky-500/20 p-4 text-sky-400">
                  <FaChartLine className="text-2xl" />
                </div>
                <div>
                  <p className="text-[var(--text-muted)] text-sm uppercase tracking-[.2em]">
                    Performance
                  </p>
                  <p className="mt-2 font-semibold text-2xl text-[var(--foreground)]">
                    92%
                  </p>
                </div>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-4 text-center">
                  <p className="text-[var(--text-muted)] text-xs uppercase tracking-[.2em]">
                    Acceptance
                  </p>
                  <p className="mt-2 font-semibold text-[var(--foreground)] text-lg">
                    96%
                  </p>
                </div>
                <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-4 text-center">
                  <p className="text-[var(--text-muted)] text-xs uppercase tracking-[.2em]">
                    On-time
                  </p>
                  <p className="mt-2 font-semibold text-[var(--foreground)] text-lg">
                    89%
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="rounded-3xl bg-emerald-500/20 p-4 text-emerald-400">
                  <FaWallet className="text-2xl" />
                </div>
                <div>
                  <p className="text-[var(--text-muted)] text-sm uppercase tracking-[.2em]">
                    Balance
                  </p>
                  <p className="mt-2 font-semibold text-2xl text-[var(--foreground)]">
                    ₱12,840
                  </p>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-4">
                  <p className="text-[var(--text-muted)] text-xs uppercase tracking-[.2em]">
                    Next payout
                  </p>
                  <p className="mt-2 font-semibold text-[var(--foreground)] text-sm">
                    Apr 21, 2026
                  </p>
                </div>
                <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-4">
                  <p className="text-[var(--text-muted)] text-xs uppercase tracking-[.2em]">
                    Weekly earnings
                  </p>
                  <p className="mt-2 font-semibold text-[var(--foreground)] text-sm">
                    ₱8,400
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
                  onClick={() => router.push("/operator")}
                  type="button"
                >
                  Go to Dashboard
                </button>
                <button
                  className="w-full rounded-3xl bg-sky-600 px-4 py-3 font-semibold text-sm text-white transition hover:bg-sky-500"
                  onClick={() => router.push("/operator/profile")}
                  type="button"
                >
                  Manage vehicle
                </button>
                <button
                  className="w-full rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 font-semibold text-[var(--foreground)] text-sm transition hover:bg-[var(--surface-muted)]"
                  onClick={() => alert("Payout statements coming soon.")}
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
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
