"use client";

import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  FaChartLine,
  FaClipboardList,
  FaExclamationTriangle,
  FaMapMarkerAlt,
  FaShieldAlt,
  FaStar,
  FaUserCheck,
  FaUsers,
} from "react-icons/fa";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/authContext";
import { api } from "../../../convex/_generated/api";

export default function AdminPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout, sessionToken } = useAuth();
  const { showToast } = useToast();
  const [expandedSections, setExpandedSections] = useState({
    drivers: false,
    maps: false,
    dropout: false,
  });

  const metrics = useQuery(
    api.adminQueries.getMetrics,
    sessionToken ? { sessionToken } : "skip"
  );
  const pendingDrivers = useQuery(
    api.adminQueries.getPendingDrivers,
    sessionToken ? { sessionToken } : "skip"
  );
  const _allRides = useQuery(
    api.adminQueries.getAllRides,
    sessionToken ? { sessionToken } : "skip"
  );

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleApproveDriver = (driverName: string) => {
    showToast(`Driver ${driverName} has been approved!`, "info");
  };

  const handleRejectDriver = (driverName: string) => {
    showToast(`Driver ${driverName} has been rejected.`, "info");
  };

  const adminMetrics = metrics
    ? [
        {
          label: "Active Drivers",
          value: metrics.activeDrivers.toString(),
          icon: FaUsers,
        },
        {
          label: "Pending Approvals",
          value: metrics.pendingApprovals.toString(),
          icon: FaShieldAlt,
        },
        {
          label: "Live Trips",
          value: metrics.liveTrips.toString(),
          icon: FaChartLine,
        },
        {
          label: "Popular Drivers",
          value: metrics.popularDrivers.toString(),
          icon: FaStar,
        },
      ]
    : [
        { label: "Active Drivers", value: "...", icon: FaUsers },
        { label: "Pending Approvals", value: "...", icon: FaShieldAlt },
        { label: "Live Trips", value: "...", icon: FaChartLine },
        { label: "Popular Drivers", value: "...", icon: FaStar },
      ];

  const dropoutReasons = [
    { reason: "Long wait times", percentage: 35, count: 1240 },
    { reason: "High prices", percentage: 28, count: 995 },
    { reason: "Poor driver behavior", percentage: 18, count: 640 },
    { reason: "Technical issues", percentage: 12, count: 426 },
    { reason: "Safety concerns", percentage: 7, count: 249 },
  ];

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-[var(--foreground)]">
        <p className="text-[var(--text-muted)]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <header className="flex flex-col gap-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sky-400 text-sm uppercase tracking-[0.2em]">
              Admin Panel
            </p>
            <h1 className="mt-2 font-semibold text-3xl">Hatud Operations</h1>
            <p className="mt-2 max-w-2xl text-[var(--text-muted)]">
              Monitor fleet activity, manage operator approvals, and review
              trips from a single, clean admin workspace.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              className="btn btn-secondary max-w-max rounded-full text-rose-400 hover:text-rose-300"
              onClick={logout}
              type="button"
            >
              Logout
            </button>
          </div>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-4">
          {adminMetrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div
                className="cursor-pointer rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm transition hover:border-sky-500 hover:bg-[var(--surface-strong)]"
                key={metric.label}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[var(--text-muted)] text-sm uppercase tracking-[0.16em]">
                    {metric.label}
                  </p>
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--surface-strong)] text-sky-400">
                    <Icon />
                  </span>
                </div>
                <p className="mt-6 font-semibold text-4xl text-[var(--foreground)]">
                  {metric.value}
                </p>
                <p className="mt-2 text-[var(--text-muted)] text-sm">
                  Updated just now
                </p>
              </div>
            );
          })}
        </section>

        <section className="mt-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <button
            className="flex w-full cursor-pointer items-center justify-between"
            onClick={() => toggleSection("drivers")}
            type="button"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--surface-strong)] text-sky-400">
                <FaUserCheck />
              </span>
              <div className="text-left">
                <p className="font-semibold text-[var(--foreground)]">
                  Driver Credentials & Approvals
                </p>
                <p className="text-[var(--text-muted)] text-sm">
                  Review and approve pending driver applications
                </p>
              </div>
            </div>
            <span
              className={`text-sky-400 transition ${expandedSections.drivers ? "rotate-180" : ""}`}
            >
              ▼
            </span>
          </button>

          {expandedSections.drivers && (
            <div className="mt-6 space-y-4">
              {pendingDrivers && pendingDrivers.length > 0 ? (
                pendingDrivers.map((driver) => (
                  <div
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4"
                    key={driver._id}
                  >
                    <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                      <div className="flex-1">
                        <p className="font-semibold text-[var(--foreground)]">
                          {driver.name}
                        </p>
                        <p className="text-[var(--text-muted)] text-sm">
                          {driver.email}
                        </p>
                        <div className="mt-2 flex items-center gap-4 text-[var(--text-muted)] text-sm">
                          <span>License: {driver.licenseNumber}</span>
                          <span>
                            Vehicle: {driver.vehicleInfo?.model} (
                            {driver.vehicleInfo?.color})
                          </span>
                          <span>Plate: {driver.vehicleInfo?.plateNumber}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="rounded-full bg-green-600 px-4 py-2 font-semibold text-sm text-white transition hover:bg-green-700"
                          onClick={() => handleApproveDriver(driver.name)}
                          type="button"
                        >
                          Approve
                        </button>
                        <button
                          className="rounded-full bg-red-600 px-4 py-2 font-semibold text-sm text-white transition hover:bg-red-700"
                          onClick={() => handleRejectDriver(driver.name)}
                          type="button"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-4 text-center text-[var(--text-muted)]">
                  No drivers pending approval
                </p>
              )}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <button
            className="flex w-full cursor-pointer items-center justify-between"
            onClick={() => toggleSection("maps")}
            type="button"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--surface-strong)] text-sky-400">
                <FaMapMarkerAlt />
              </span>
              <div className="text-left">
                <p className="font-semibold text-[var(--foreground)]">
                  Map Management
                </p>
                <p className="text-[var(--text-muted)] text-sm">
                  Edit routes, zones, and service areas
                </p>
              </div>
            </div>
            <span
              className={`text-sky-400 transition ${expandedSections.maps ? "rotate-180" : ""}`}
            >
              ▼
            </span>
          </button>

          {expandedSections.maps && (
            <div className="mt-6 space-y-4">
              <button
                className="w-full rounded-2xl bg-sky-600 px-4 py-3 font-semibold text-white transition hover:bg-sky-700"
                onClick={() =>
                  showToast("Service zone editor coming soon.", "info")
                }
                type="button"
              >
                Edit Service Zones
              </button>
              <button
                className="w-full rounded-2xl bg-sky-600 px-4 py-3 font-semibold text-white transition hover:bg-sky-700"
                onClick={() =>
                  showToast("Route restrictions coming soon.", "info")
                }
                type="button"
              >
                Manage Route Restrictions
              </button>
              <button
                className="w-full rounded-2xl bg-sky-600 px-4 py-3 font-semibold text-white transition hover:bg-sky-700"
                onClick={() => router.push("/map")}
                type="button"
              >
                View Live Trip Map
              </button>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <button
            className="flex w-full cursor-pointer items-center justify-between"
            onClick={() => toggleSection("dropout")}
            type="button"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--surface-strong)] text-red-400">
                <FaExclamationTriangle />
              </span>
              <div className="text-left">
                <p className="font-semibold text-[var(--foreground)]">
                  Customer Dropout Analysis
                </p>
                <p className="text-[var(--text-muted)] text-sm">
                  Reasons why clients stop using the app
                </p>
              </div>
            </div>
            <span
              className={`text-sky-400 transition ${expandedSections.dropout ? "rotate-180" : ""}`}
            >
              ▼
            </span>
          </button>

          {expandedSections.dropout && (
            <div className="mt-6 space-y-4">
              {dropoutReasons.map((item) => (
                <div
                  className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4"
                  key={item.reason}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-[var(--foreground)]">
                        {item.reason}
                      </p>
                      <p className="mt-1 text-[var(--text-muted)] text-sm">
                        Total: {item.count} users
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-2xl text-red-500">
                        {item.percentage}%
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                    <div
                      className="h-full bg-red-500"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="cursor-pointer rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm transition hover:border-sky-500 hover:bg-[var(--surface-strong)]">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--surface-strong)] text-sky-400">
                <FaClipboardList />
              </span>
              <div>
                <p className="font-semibold text-[var(--foreground)]">
                  Review Requests
                </p>
                <p className="text-[var(--text-muted)] text-sm">
                  Approve new driver activity
                </p>
              </div>
            </div>
            <button
              className="btn btn-primary mt-6 w-full rounded-3xl text-sm"
              onClick={() => toggleSection("drivers")}
              type="button"
            >
              Open
            </button>
          </div>

          <div className="cursor-pointer rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm transition hover:border-sky-500 hover:bg-[var(--surface-strong)]">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--surface-strong)] text-sky-400">
                <FaUsers />
              </span>
              <div>
                <p className="font-semibold text-[var(--foreground)]">
                  Manage Accounts
                </p>
                <p className="text-[var(--text-muted)] text-sm">
                  Update operator status
                </p>
              </div>
            </div>
            <button
              className="btn btn-primary mt-6 w-full rounded-3xl text-sm"
              onClick={() =>
                showToast("Account management coming soon.", "info")
              }
              type="button"
            >
              Open
            </button>
          </div>

          <div className="cursor-pointer rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm transition hover:border-sky-500 hover:bg-[var(--surface-strong)]">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--surface-strong)] text-sky-400">
                <FaChartLine />
              </span>
              <div>
                <p className="font-semibold text-[var(--foreground)]">
                  View Reports
                </p>
                <p className="text-[var(--text-muted)] text-sm">
                  See earnings summaries
                </p>
              </div>
            </div>
            <button
              className="btn btn-primary mt-6 w-full rounded-3xl text-sm"
              onClick={() => showToast("Reports coming soon.", "info")}
              type="button"
            >
              Open
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
