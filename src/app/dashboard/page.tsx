"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { FaArrowRight, FaMapMarkedAlt, FaStar } from "react-icons/fa";
import { useAuth } from "@/lib/authContext";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type CommuterProfile = FunctionReturnType<typeof api.profile.commuterProfile>;
type OperatorProfile = FunctionReturnType<typeof api.profile.operatorProfile>;
type AdminDashboard = FunctionReturnType<typeof api.adminQueries.getDashboard>;

function formatPeso(amount: number): string {
  return `₱${amount.toLocaleString("en-PH")}`;
}

/** What the dashboard is called, for each role. */
function headingForRole(role: string | undefined): string {
  if (role === "operator") {
    return "Your shift";
  }
  if (role === "admin") {
    return "Operations";
  }
  return "Your rides";
}

/**
 * One metric.
 */
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-4">
      <p className="font-bold text-2xl text-[var(--foreground)]">{value}</p>
      <p className="mt-0.5 text-[var(--text-muted)] text-xs">{label}</p>
    </div>
  );
}

/**
 * The thing that needs doing next.
 */
function NextAction({
  description,
  href,
  label,
}: {
  description: string;
  href: string;
  label: string;
}) {
  return (
    <Link
      className="flex items-center justify-between gap-4 rounded-2xl border border-sky-500/30 bg-sky-500/10 p-5 transition-colors hover:bg-sky-500/15"
      href={href}
    >
      <div className="min-w-0">
        <p className="font-semibold text-[var(--foreground)]">{label}</p>
        <p className="mt-1 text-[var(--text-muted)] text-sm">{description}</p>
      </div>
      <FaArrowRight className="shrink-0 text-sky-500" />
    </Link>
  );
}

/**
 * Asks once for a rating of the trip that just ended.
 *
 * Rating is optional, so this sits apart from the next action and can be
 * put away. "Not now" is saved on the ride, so it is not asked again.
 */
function RatePrompt({
  rideId,
  sessionToken,
}: {
  rideId: Id<"rides">;
  sessionToken: string;
}) {
  const dismiss = useMutation(api.rides.dismissRatingPrompt);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <FaStar className="shrink-0 text-amber-400" />
        <div className="min-w-0">
          <p className="font-semibold text-[var(--foreground)]">
            How was your trip?
          </p>
          <p className="text-[var(--text-muted)] text-sm">
            Rating your driver is optional.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          className="min-h-11 flex-1 rounded-full px-4 py-2 font-semibold text-[var(--text-muted)] text-sm transition-colors hover:bg-[var(--surface-strong)] hover:text-[var(--foreground)] sm:flex-none"
          onClick={() => {
            dismiss({ rideId, sessionToken }).catch(console.error);
          }}
          type="button"
        >
          Not now
        </button>
        <Link
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-sky-500 px-5 py-2 font-semibold text-sm text-white transition-colors hover:bg-sky-400 sm:flex-none"
          href={`/feedback?ride=${rideId}`}
        >
          Rate
        </Link>
      </div>
    </div>
  );
}

/**
 * A passenger's dashboard.
 */
function CommuterDashboard({
  profile,
  sessionToken,
}: {
  profile: CommuterProfile;
  sessionToken: string;
}) {
  // The trip that still needs something. It is here, on the dashboard, and not
  // on the map: the map greets you with the trip you have just finished, not
  // with one from last week.
  const pending = useQuery(api.rides.getTripNeedingAttention, { sessionToken });

  const history = profile.history.slice(0, 3);

  // Paying is the only thing a passenger has to do. Rating is offered
  // separately, below, and can be put away.
  const pendingAction = pending?.needsPayment
    ? {
        description: "A trip is waiting to be paid for.",
        href: `/payment?ride=${pending.rideId}`,
        label: "Pay for your ride",
      }
    : {
        description:
          "Everything is settled. Book your next ride whenever you are ready.",
        href: "/map",
        label: "Book a ride",
      };

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric label="Trips taken" value={String(profile.completedRides)} />
        <Metric label="Total spent" value={formatPeso(profile.totalSpent)} />
        <Metric
          label="Saved places"
          value={String(profile.savedLocations.length)}
        />
      </div>

      <NextAction
        description={pendingAction.description}
        href={pendingAction.href}
        label={pendingAction.label}
      />

      {pending?.needsRating ? (
        <RatePrompt rideId={pending.rideId} sessionToken={sessionToken} />
      ) : null}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-5">
        <h2 className="font-semibold text-[var(--foreground)]">
          Your recent trips
        </h2>
        {history.length === 0 ? (
          <p className="mt-2 text-[var(--text-muted)] text-sm">
            You have not taken a trip yet. The map is waiting.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {history.map((ride) => (
              <li
                className="flex items-start justify-between gap-3 border-[var(--border)] border-t pt-3 first:border-t-0 first:pt-0"
                key={ride.id}
              >
                <div className="min-w-0">
                  <p className="truncate text-[var(--foreground)] text-sm">
                    {ride.pickupAddress} → {ride.dropoffAddress}
                  </p>
                  <p className="text-[var(--text-muted)] text-xs capitalize">
                    {ride.status.replace("inProgress", "in progress")}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold text-[var(--foreground)] text-sm">
                    {formatPeso(ride.fare)}
                  </p>
                  {ride.rating ? (
                    <p className="flex items-center justify-end gap-1 text-[var(--text-muted)] text-xs">
                      <FaStar className="text-yellow-400" />
                      {ride.rating}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/**
 * A driver's dashboard.
 */
function OperatorDashboard({ profile }: { profile: OperatorProfile }) {
  const history = profile.history.slice(0, 3);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric label="Trips taken" value={String(profile.completedRides)} />
        <Metric
          label="Total earned"
          value={formatPeso(profile.totalEarnings)}
        />
        <Metric
          label="Rating"
          value={profile.ratingCount > 0 ? String(profile.averageRating) : "—"}
        />
      </div>

      <NextAction
        description={
          profile.isAvailable
            ? "You are on shift. Open requests are waiting for a driver."
            : "Go on shift to start taking rides."
        }
        href="/operator/map"
        label={profile.isAvailable ? "See available rides" : "Go on shift"}
      />

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-5">
        <h2 className="font-semibold text-[var(--foreground)]">
          Your recent trips
        </h2>
        {history.length === 0 ? (
          <p className="mt-2 text-[var(--text-muted)] text-sm">
            You have not completed a trip yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {history.map((ride) => (
              <li
                className="flex items-start justify-between gap-3 border-[var(--border)] border-t pt-3 first:border-t-0 first:pt-0"
                key={ride.id}
              >
                <div className="min-w-0">
                  <p className="truncate text-[var(--foreground)] text-sm">
                    {ride.pickupAddress} → {ride.dropoffAddress}
                  </p>
                  <p className="text-[var(--text-muted)] text-xs capitalize">
                    {ride.status.replace("inProgress", "in progress")}
                  </p>
                </div>
                <p className="shrink-0 font-semibold text-[var(--foreground)] text-sm">
                  {formatPeso(ride.fare)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/**
 * The administrator's dashboard.
 */
function AdminDashboardView({ dashboard }: { dashboard: AdminDashboard }) {
  const metrics = dashboard.metrics;
  const pending = metrics.pendingDrivers;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric label="Riders" value={String(metrics.riders)} />
        <Metric label="Active drivers" value={String(metrics.activeDrivers)} />
        <Metric
          label="Completed trips"
          value={String(metrics.completedTrips)}
        />
      </div>

      <NextAction
        description={
          pending > 0
            ? `${pending} driver application${pending === 1 ? "" : "s"} waiting to be reviewed.`
            : "Every driver application has been reviewed."
        }
        href="/admin"
        label={pending > 0 ? "Review driver applications" : "Open operations"}
      />

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-5">
        <h2 className="font-semibold text-[var(--foreground)]">Recent trips</h2>
        {dashboard.recentRides.length === 0 ? (
          <p className="mt-2 text-[var(--text-muted)] text-sm">
            No trips have been completed yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {dashboard.recentRides.slice(0, 3).map((ride) => (
              <li
                className="flex items-start justify-between gap-3 border-[var(--border)] border-t pt-3 first:border-t-0 first:pt-0"
                key={ride._id}
              >
                <div className="min-w-0">
                  <p className="truncate text-[var(--foreground)] text-sm">
                    {ride.commuterName} · {ride.driverName ?? "No driver"}
                  </p>
                  <p className="text-[var(--text-muted)] text-xs capitalize">
                    {ride.status}
                  </p>
                </div>
                <p className="shrink-0 font-semibold text-[var(--foreground)] text-sm">
                  {formatPeso(ride.fare)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/**
 * The landing page.
 *
 * Everyone lands here. The drawer carries the navigation, and these three
 * containers say what is going on: the numbers, what needs doing next, and
 * what just happened.
 */
export default function DashboardPage() {
  const { sessionToken, user } = useAuth();

  const commuter = useQuery(
    api.profile.commuterProfile,
    sessionToken && user?.role === "commuter" ? { sessionToken } : "skip"
  );
  const operator = useQuery(
    api.profile.operatorProfile,
    sessionToken && user?.role === "operator" ? { sessionToken } : "skip"
  );
  const admin = useQuery(
    api.adminQueries.getDashboard,
    sessionToken && user?.role === "admin" ? { sessionToken } : "skip"
  );

  const heading = headingForRole(user?.role);

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-300">
            <FaMapMarkedAlt />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-2xl text-[var(--foreground)]">
              {heading}
            </h1>
            <p className="truncate text-[var(--text-muted)] text-sm">
              {user?.name
                ? `Good to see you, ${user.name}.`
                : "Welcome to HATUD."}
            </p>
          </div>
        </header>

        {commuter && sessionToken ? (
          <CommuterDashboard profile={commuter} sessionToken={sessionToken} />
        ) : null}
        {operator ? <OperatorDashboard profile={operator} /> : null}
        {admin ? <AdminDashboardView dashboard={admin} /> : null}
      </div>
    </div>
  );
}
