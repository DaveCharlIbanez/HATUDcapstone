"use client";

import Link from "next/link";
import { useAuth } from "@/lib/authContext";

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <section className="rounded-[2rem] border border-slate-800 bg-slate-900/90 p-8 shadow-slate-950/20 shadow-xl backdrop-blur">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="text-sky-400 text-sm uppercase tracking-[0.36em]">
                Ride Booking App
              </p>
              <h1 className="mt-4 font-semibold text-4xl text-slate-50 tracking-tight sm:text-5xl">
                Book rides, track drivers, and manage your fleet in one app.
              </h1>
              <p className="mt-6 max-w-xl text-slate-400">
                Quickly request a ride, choose the best vehicle, and follow your
                driver in real time. Operator and admin views are also available
                for fleet management.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  className="inline-flex items-center justify-center rounded-full bg-sky-500 px-6 py-3 font-semibold text-sm text-white transition hover:bg-sky-400"
                  href="/login"
                >
                  Sign In
                </Link>
                <Link
                  className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900 px-6 py-3 font-semibold text-slate-100 text-sm transition hover:bg-slate-800"
                  href="/signup"
                >
                  Sign Up
                </Link>
              </div>

              {user && (
                <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                  <p className="text-slate-400 text-sm">
                    Welcome back, {user.name}
                  </p>
                  <Link
                    className="mt-2 inline-flex items-center justify-center rounded-full bg-sky-500/20 px-4 py-2 font-medium text-sky-400 text-sm transition hover:bg-sky-500/30"
                    href={`/${user.role === "admin" ? "admin" : user.role === "operator" ? "operator" : "Commuters"}`}
                  >
                    Go to Dashboard
                  </Link>
                </div>
              )}
            </div>

            <div className="grid gap-4">
              <div className="rounded-3xl border border-slate-800 bg-slate-950/50 p-6 shadow-sm">
                <p className="text-slate-500 text-sm">Fast booking</p>
                <h2 className="mt-3 font-semibold text-2xl text-slate-50">
                  Pickup & dropoff
                </h2>
                <p className="mt-2 text-slate-400 text-sm">
                  Search destinations and choose the best route in seconds.
                </p>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-950/50 p-6 shadow-sm">
                <p className="text-slate-500 text-sm">Vehicle selection</p>
                <h2 className="mt-3 font-semibold text-2xl text-slate-50">
                  Flexible options
                </h2>
                <p className="mt-2 text-slate-400 text-sm">
                  Choose from tricycles, skylabs, electric cars, or luxury
                  rides.
                </p>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-950/50 p-6 shadow-sm">
                <p className="text-slate-500 text-sm">Live tracking</p>
                <h2 className="mt-3 font-semibold text-2xl text-slate-50">
                  Track drivers
                </h2>
                <p className="mt-2 text-slate-400 text-sm">
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
