import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <section className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-8 shadow-xl shadow-slate-200/20 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.36em] text-sky-500">Ride Booking App</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-50 sm:text-5xl">
                Book rides, track drivers, and manage your fleet in one app.
              </h1>
              <p className="mt-6 max-w-xl text-slate-600 dark:text-slate-400">
                Quickly request a ride, choose the best vehicle, and follow your driver in real time. Operator and admin views are also available for fleet management.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link href="/Commuters" className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                  Book a Ride
                </Link>
                <Link href="/operator" className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                  Operator Dashboard
                </Link>
                <Link href="/admin" className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                  Admin Panel
                </Link>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-3xl border border-slate-200/80 bg-slate-50 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="text-sm text-slate-500">Fast booking</p>
                <h2 className="mt-3 text-2xl font-semibold text-slate-950 dark:text-slate-50">Pickup & dropoff</h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Search destinations and choose the best route in seconds.</p>
              </div>
              <div className="rounded-3xl border border-slate-200/80 bg-slate-50 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="text-sm text-slate-500">Vehicle selection</p>
                <h2 className="mt-3 text-2xl font-semibold text-slate-950 dark:text-slate-50">Flexible options</h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Choose from tricycles, skylabs, electric cars, or luxury rides.</p>
              </div>
              <div className="rounded-3xl border border-slate-200/80 bg-slate-50 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="text-sm text-slate-500">Live tracking</p>
                <h2 className="mt-3 text-2xl font-semibold text-slate-950 dark:text-slate-50">Track drivers</h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Follow your booked ride from search to completion.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
