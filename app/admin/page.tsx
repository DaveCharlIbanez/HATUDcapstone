"use client";

import { useState } from "react";
import Link from "next/link";
import { FaUsers, FaChartLine, FaClipboardList, FaShieldAlt, FaStar, FaMapMarkerAlt, FaUserCheck, FaExclamationTriangle } from "react-icons/fa";

const adminMetrics = [
  { label: "Active Drivers", value: "128", icon: FaUsers },
  { label: "Pending Approvals", value: "12", icon: FaShieldAlt },
  { label: "Live Trips", value: "46", icon: FaChartLine },
  { label: "Popular Drivers", value: "34", icon: FaStar },
];

const driverCredentials = [
  { name: "Ahmad Hassan", rating: 4.8, trips: 245, verified: true, status: "pending" },
  { name: "Sara Ahmed", rating: 4.9, trips: 312, verified: true, status: "pending" },
  { name: "Omar Mohamed", rating: 4.6, trips: 189, verified: false, status: "pending" },
];

const dropoutReasons = [
  { reason: "Long wait times", percentage: 35, count: 1240 },
  { reason: "High prices", percentage: 28, count: 995 },
  { reason: "Poor driver behavior", percentage: 18, count: 640 },
  { reason: "Technical issues", percentage: 12, count: 426 },
  { reason: "Safety concerns", percentage: 7, count: 249 },
];

export default function AdminPage() {
  const [expandedSections, setExpandedSections] = useState({
    drivers: false,
    maps: false,
    dropout: false,
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleApproveDriver = (driverName) => {
    alert(`Driver ${driverName} has been approved!`);
  };

  const handleRejectDriver = (driverName) => {
    alert(`Driver ${driverName} has been rejected.`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <header className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-sky-400">Admin Panel</p>
            <h1 className="mt-2 text-3xl font-semibold">Hatud Operations</h1>
            <p className="mt-2 max-w-2xl text-slate-400">Monitor fleet activity, manage operator approvals, and review trips from a single, clean admin workspace.</p>
          </div>
          <Link href="/operator" className="btn btn-secondary max-w-max rounded-full">
            Operator Dashboard
          </Link>
        </header>

        {/* Metrics Section */}
        <section className="mt-6 grid gap-4 sm:grid-cols-4">
          {adminMetrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} className="cursor-pointer rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-sm transition hover:border-sky-500 hover:bg-slate-800">
                <div className="flex items-center justify-between">
                  <p className="text-sm uppercase tracking-[0.16em] text-slate-500">{metric.label}</p>
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-800 text-sky-400">
                    <Icon />
                  </span>
                </div>
                <p className="mt-6 text-4xl font-semibold text-slate-100">{metric.value}</p>
                <p className="mt-2 text-sm text-slate-400">Updated just now</p>
              </div>
            );
          })}
        </section>

        {/* Driver Credentials & Approval Section */}
        <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
          <button 
            onClick={() => toggleSection('drivers')}
            className="flex w-full cursor-pointer items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-800 text-sky-400">
                <FaUserCheck />
              </span>
              <div className="text-left">
                <p className="font-semibold text-slate-100">Driver Credentials & Approvals</p>
                <p className="text-sm text-slate-500">Review and approve pending driver applications</p>
              </div>
            </div>
            <span className={`text-sky-400 transition ${expandedSections.drivers ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>

          {expandedSections.drivers && (
            <div className="mt-6 space-y-4">
              {driverCredentials.map((driver) => (
                <div key={driver.name} className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
                  <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="flex-1">
                      <p className="font-semibold text-slate-100">{driver.name}</p>
                      <div className="mt-2 flex items-center gap-4 text-sm text-slate-400">
                        <span>⭐ Rating: {driver.rating}</span>
                        <span>🚗 Trips: {driver.trips}</span>
                        <span>{driver.verified ? '✓ Verified' : '⚠ Not Verified'}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveDriver(driver.name)}
                        className="rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleRejectDriver(driver.name)}
                        className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Map Management Section */}
        <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
          <button 
            onClick={() => toggleSection('maps')}
            className="flex w-full cursor-pointer items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-800 text-sky-400">
                <FaMapMarkerAlt />
              </span>
              <div className="text-left">
                <p className="font-semibold text-slate-100">Map Management</p>
                <p className="text-sm text-slate-500">Edit routes, zones, and service areas</p>
              </div>
            </div>
            <span className={`text-sky-400 transition ${expandedSections.maps ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>

          {expandedSections.maps && (
            <div className="mt-6 space-y-4">
              <button className="w-full rounded-2xl bg-sky-600 px-4 py-3 font-semibold text-white hover:bg-sky-700 transition">
                Edit Service Zones
              </button>
              <button className="w-full rounded-2xl bg-sky-600 px-4 py-3 font-semibold text-white hover:bg-sky-700 transition">
                Manage Route Restrictions
              </button>
              <button className="w-full rounded-2xl bg-sky-600 px-4 py-3 font-semibold text-white hover:bg-sky-700 transition">
                View Live Trip Map
              </button>
            </div>
          )}
        </section>

        {/* Customer Dropout Analysis Section */}
        <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
          <button 
            onClick={() => toggleSection('dropout')}
            className="flex w-full cursor-pointer items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-800 text-red-400">
                <FaExclamationTriangle />
              </span>
              <div className="text-left">
                <p className="font-semibold text-slate-100">Customer Dropout Analysis</p>
                <p className="text-sm text-slate-500">Reasons why clients stop using the app</p>
              </div>
            </div>
            <span className={`text-sky-400 transition ${expandedSections.dropout ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>

          {expandedSections.dropout && (
            <div className="mt-6 space-y-4">
              {dropoutReasons.map((item) => (
                <div key={item.reason} className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-slate-100">{item.reason}</p>
                      <p className="mt-1 text-sm text-slate-400">Total: {item.count} users</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-red-500">{item.percentage}%</p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-700">
                    <div
                      className="h-full bg-red-500"
                      style={{ width: `${item.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Quick Actions Section */}
        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="cursor-pointer rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-sm transition hover:border-sky-500 hover:bg-slate-800">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-800 text-sky-400">
                <FaClipboardList />
              </span>
              <div>
                <p className="font-semibold text-slate-100">Review Requests</p>
                <p className="text-sm text-slate-500">Approve new driver activity</p>
              </div>
            </div>
            <button className="btn btn-primary mt-6 w-full rounded-3xl text-sm">
              Open
            </button>
          </div>

          <div className="cursor-pointer rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-sm transition hover:border-sky-500 hover:bg-slate-800">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-800 text-sky-400">
                <FaUsers />
              </span>
              <div>
                <p className="font-semibold text-slate-100">Manage Accounts</p>
                <p className="text-sm text-slate-500">Update operator status</p>
              </div>
            </div>
            <button className="btn btn-primary mt-6 w-full rounded-3xl text-sm">
              Open
            </button>
          </div>

          <div className="cursor-pointer rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-sm transition hover:border-sky-500 hover:bg-slate-800">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-800 text-sky-400">
                <FaChartLine />
              </span>
              <div>
                <p className="font-semibold text-slate-100">View Reports</p>
                <p className="text-sm text-slate-500">See earnings summaries</p>
              </div>
            </div>
            <button className="btn btn-primary mt-6 w-full rounded-3xl text-sm">
              Open
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
