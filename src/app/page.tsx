"use client";

import Link from "next/link";
import { useAuth } from "@/lib/authContext";

function dashboardForRole(role: string): string {
  if (role === "admin") {
    return "admin";
  }
  if (role === "operator") {
    return "operator";
  }
  return "map";
}

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-8 shadow-xl backdrop-blur">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="text-[var(--accent)] text-sm uppercase tracking-[0.36em]">
                Ride Booking App
              </p>
              <h1 className="mt-4 font-semibold text-4xl tracking-tight sm:text-5xl">
                Book rides, track drivers, and manage your fleet in one app.
              </h1>
              <p className="mt-6 max-w-xl text-[var(--text-muted)]">
                Quickly request a ride, choose the best vehicle, and follow your
                driver in real time. Operator and admin views are also available
                for fleet management.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  className="inline-flex items-center justify-center rounded-full bg-[var(--btn-primary)] px-6 py-3 font-semibold text-sm text-white transition hover:bg-[var(--btn-primary-hover)]"
                  href="/login"
                >
                  Sign In
                </Link>
                <Link
                  className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-6 py-3 font-semibold text-sm transition hover:bg-[var(--surface-muted)]"
                  href="/signup"
                >
                  Sign Up
                </Link>
              </div>

              {user && (
                <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/50 p-4">
                  <p className="text-[var(--text-muted)] text-sm">
                    Welcome back, {user.name}
                  </p>
                  <Link
                    className="mt-2 inline-flex items-center justify-center rounded-full bg-[var(--accent)]/20 px-4 py-2 font-medium text-[var(--accent)] text-sm transition hover:bg-[var(--accent)]/30"
                    href={`/${dashboardForRole(user.role)}`}
                  >
                    Go to Dashboard
                  </Link>
                </div>
              )}
            </div>

            <div className="grid gap-4">
              <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)]/50 p-6 shadow-sm">
                <p className="text-[var(--text-muted)] text-sm">Fast booking</p>
                <h2 className="mt-3 font-semibold text-2xl">
                  Pickup & dropoff
                </h2>
                <p className="mt-2 text-[var(--text-muted)] text-sm">
                  Search destinations and choose the best route in seconds.
                </p>
              </div>
              <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)]/50 p-6 shadow-sm">
                <p className="text-[var(--text-muted)] text-sm">
                  Vehicle selection
                </p>
                <h2 className="mt-3 font-semibold text-2xl">
                  Flexible options
                </h2>
                <p className="mt-2 text-[var(--text-muted)] text-sm">
                  Choose from standard motorcycles, with pillion, or family
                  rides.
                </p>
              </div>
              <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)]/50 p-6 shadow-sm">
                <p className="text-[var(--text-muted)] text-sm">
                  Live tracking
                </p>
                <h2 className="mt-3 font-semibold text-2xl">Track drivers</h2>
                <p className="mt-2 text-[var(--text-muted)] text-sm">
                  Follow your booked ride from search to completion.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
