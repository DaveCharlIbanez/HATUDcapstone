"use client";

import { type ReactNode, useState } from "react";
import { FaCheck, FaStar } from "react-icons/fa";
import {
  formatDate,
  formatPeso,
  formatSince,
  paymentMethodLabel,
} from "@/lib/format";
import type {
  AdminDashboard,
  AdminDriverRow,
} from "../../../convex/adminQueries";
import { DetailRow, EmptyState, StatusPill } from "./DetailRow";

function coordinates(
  location: { latitude: number; longitude: number } | null
): string | null {
  if (!location) {
    return null;
  }
  return `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
}

function MetaSeparator() {
  return <span aria-hidden="true">·</span>;
}

function MetaItem({ children }: { children: ReactNode }) {
  return <span>{children}</span>;
}

type UserCategory = "both" | "commuter" | "operator";

const CATEGORIES: { id: UserCategory; label: string; noun: string }[] = [
  { id: "both", label: "Both", noun: "users" },
  { id: "commuter", label: "Commuters", noun: "commuters" },
  { id: "operator", label: "Operators", noun: "operators" },
];

const CATEGORY_BY_ID = Object.fromEntries(
  CATEGORIES.map((entry) => [entry.id, entry])
) as Record<UserCategory, (typeof CATEGORIES)[number]>;

type UserRow = AdminDashboard["userRoster"]["commuters"][number];

function rowsFor(
  roster: AdminDashboard["userRoster"],
  category: UserCategory
): UserRow[] {
  if (category === "commuter") {
    return roster.commuters;
  }
  if (category === "operator") {
    return roster.operators;
  }
  // Same order as each list: online first, then the most recently seen.
  return [...roster.commuters, ...roster.operators].sort(
    (a, b) =>
      Number(b.isOnline) - Number(a.isOnline) ||
      (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0) ||
      a.name.localeCompare(b.name)
  );
}

function presenceLabel(user: UserRow): string {
  if (user.isOnline) {
    return `Seen ${formatSince(user.lastSeenAt ?? Date.now())}`;
  }
  return user.lastSeenAt === null
    ? "Never seen in the app"
    : `Last seen ${formatSince(user.lastSeenAt)}`;
}

function UserStatusPill({ user }: { user: UserRow }) {
  if (!user.isOnline) {
    return <StatusPill tone="slate">Offline</StatusPill>;
  }
  if (user.role === "operator") {
    return (
      <StatusPill tone={user.isAvailable ? "emerald" : "sky"}>
        {user.isAvailable ? "On shift" : "Online · off shift"}
      </StatusPill>
    );
  }
  return <StatusPill tone="emerald">Online</StatusPill>;
}

function UserList({
  showRole,
  users,
}: {
  showRole: boolean;
  users: UserRow[];
}) {
  return (
    <div className="space-y-3">
      {users.map((user) => (
        <DetailRow
          key={user.userId}
          meta={
            <>
              {showRole ? (
                <>
                  <MetaItem>
                    {user.role === "commuter" ? "Commuter" : "Operator"}
                  </MetaItem>
                  <MetaSeparator />
                </>
              ) : null}
              <MetaItem>{user.email}</MetaItem>
              <MetaSeparator />
              <MetaItem>{presenceLabel(user)}</MetaItem>
            </>
          }
          title={user.name}
          trailing={<UserStatusPill user={user} />}
        />
      ))}
    </div>
  );
}

function AllUsers({
  noun,
  showRole,
  users,
}: {
  noun: string;
  showRole: boolean;
  users: UserRow[];
}) {
  if (users.length === 0) {
    return <EmptyState message={`There are no ${noun} yet.`} />;
  }
  return (
    <div className="space-y-2">
      <p className="font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wide">
        All {noun} ({users.length})
      </p>
      <UserList showRole={showRole} users={users} />
    </div>
  );
}

/**
 * Who is using the app (fixoct51): one list for commuters and operators,
 * filtered by category, with the whole roster behind a button at the bottom.
 */
export function UsersPanel({
  roster,
}: {
  roster: AdminDashboard["userRoster"];
}) {
  const [category, setCategory] = useState<UserCategory>("both");
  const [showAll, setShowAll] = useState(false);

  const selected = CATEGORY_BY_ID[category];
  const everyone = rowsFor(roster, category);
  const active = everyone.filter((user) => user.isOnline);
  const onShift = rowsFor(roster, "operator").filter(
    (user) => user.isOnline && user.isAvailable
  ).length;
  const showRole = category === "both";

  return (
    <div className="space-y-4">
      <fieldset className="grid grid-cols-3 gap-1 rounded-2xl border-0 bg-[var(--surface-strong)] p-1">
        <legend className="sr-only">Show which users</legend>
        {CATEGORIES.map((entry) => {
          const isSelected = entry.id === category;
          const count = rowsFor(roster, entry.id).filter(
            (user) => user.isOnline
          ).length;
          return (
            <button
              aria-pressed={isSelected}
              className={`min-h-11 rounded-xl px-2 py-2 font-semibold text-sm transition ${
                isSelected
                  ? "bg-sky-600 text-white shadow"
                  : "text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
              }`}
              key={entry.id}
              onClick={() => {
                setCategory(entry.id);
                setShowAll(false);
              }}
              type="button"
            >
              {entry.label}
              <span className="ml-1 tabular-nums opacity-80">({count})</span>
            </button>
          );
        })}
      </fieldset>

      <p className="text-[var(--text-muted)] text-sm">
        <span className="font-semibold text-[var(--foreground)] tabular-nums">
          {active.length}
        </span>{" "}
        of {everyone.length} {selected.noun} online
        {category === "commuter" ? null : (
          <>
            {" "}
            · {onShift} {onShift === 1 ? "driver" : "drivers"} on shift
          </>
        )}
      </p>

      {active.length === 0 ? (
        <EmptyState
          message={`No ${selected.noun} have the app open right now.`}
        />
      ) : (
        <UserList showRole={showRole} users={active} />
      )}

      <button
        aria-expanded={showAll}
        className="w-full rounded-2xl border border-[var(--border)] py-3 font-semibold text-[var(--foreground)] text-sm transition hover:bg-[var(--surface-strong)]"
        onClick={() => setShowAll((current) => !current)}
        type="button"
      >
        {showAll
          ? `Hide all ${selected.noun}`
          : `See all ${selected.noun} (${everyone.length})`}
      </button>

      {showAll ? (
        <AllUsers noun={selected.noun} showRole={showRole} users={everyone} />
      ) : null}
    </div>
  );
}

export function LiveRidesPanel({
  liveRides,
}: {
  liveRides: AdminDashboard["liveRides"];
}) {
  if (liveRides.length === 0) {
    return <EmptyState message="No trips are in progress." />;
  }

  return (
    <div className="space-y-3">
      {liveRides.map((ride) => {
        const driverPosition = coordinates(ride.operatorLocation);
        const riderPosition = coordinates(ride.commuterLocation);
        return (
          <DetailRow
            key={ride._id}
            meta={
              <>
                <MetaItem>{ride.pickupAddress}</MetaItem>
                <MetaSeparator />
                <MetaItem>{ride.dropoffAddress}</MetaItem>
                <MetaSeparator />
                <MetaSeparator />
                <MetaItem>{formatPeso(ride.fare)}</MetaItem>
                {driverPosition ? (
                  <>
                    <MetaSeparator />
                    <MetaItem>Driver at {driverPosition}</MetaItem>
                  </>
                ) : null}
                {riderPosition ? (
                  <>
                    <MetaSeparator />
                    <MetaItem>Rider at {riderPosition}</MetaItem>
                  </>
                ) : null}
              </>
            }
            title={
              <span className="flex flex-wrap items-center gap-2">
                {ride.driverName ?? "Waiting for a driver"}
                <span className="font-normal text-[var(--text-muted)]">
                  for {ride.commuterName}
                </span>
              </span>
            }
            trailing={
              <StatusPill tone="sky">
                {ride.status === "inProgress" ? "In progress" : "Accepted"}
              </StatusPill>
            }
          />
        );
      })}
    </div>
  );
}

export function RidersPanel({ riders }: { riders: AdminDashboard["riders"] }) {
  if (riders.length === 0) {
    return <EmptyState message="No riders have signed up yet." />;
  }

  return (
    <div className="space-y-3">
      {riders.map((rider) => (
        <DetailRow
          key={rider._id}
          meta={
            <>
              <MetaItem>{rider.email}</MetaItem>
              <MetaSeparator />
              <MetaItem>{rider.phone}</MetaItem>
              <MetaSeparator />
              <MetaItem>{rider.rides} rides</MetaItem>
              <MetaSeparator />
              <MetaItem>{formatPeso(rider.spent)} spent</MetaItem>
              <MetaSeparator />
              <MetaItem>Joined {formatDate(rider.createdAt)}</MetaItem>
            </>
          }
          title={rider.name}
          trailing={<StatusPill tone="slate">Rider</StatusPill>}
        />
      ))}
    </div>
  );
}

const DOCUMENT_LABELS: Record<string, string> = {
  insurance: "Insurance",
  license: "Licence",
  officialReceipt: "Official receipt",
  registration: "Registration",
};

/**
 * The checklist of the four credential documents an applicant has to have
 * uploaded, so the admin can see what is missing before deciding.
 */
function DocumentChecklist({ driver }: { driver: AdminDriverRow }) {
  const uploaded = new Set(driver.documentKinds);
  const kinds = Object.keys(DOCUMENT_LABELS);

  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {kinds.map((kind) => {
        const isUploaded = uploaded.has(kind);
        return (
          <li
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold text-xs ${
              isUploaded
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
            }`}
            key={kind}
          >
            {isUploaded ? <FaCheck className="text-[10px]" /> : null}
            {DOCUMENT_LABELS[kind]}
          </li>
        );
      })}
    </ul>
  );
}

export function ApprovalsPanel({
  drivers,
  isSaving,
  onApprove,
  onReject,
  onReview,
}: {
  drivers: AdminDriverRow[];
  isSaving: string | null;
  onApprove: (driver: AdminDriverRow) => void;
  onReject: (driver: AdminDriverRow) => void;
  onReview: (driver: AdminDriverRow) => void;
}) {
  const waiting = drivers.filter(
    (driver) =>
      driver.approvalStatus === "pending" ||
      driver.approvalStatus === "rejected"
  );

  if (waiting.length === 0) {
    return <EmptyState message="No drivers are waiting for approval." />;
  }

  return (
    <div className="space-y-3">
      {waiting.map((driver) => {
        const isRejected = driver.approvalStatus === "rejected";
        const isComplete = driver.missingDocuments.length === 0;
        return (
          <div
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4"
            key={driver._id}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-[var(--foreground)] text-sm">
                {driver.name}
              </p>
              <StatusPill tone={isRejected ? "rose" : "amber"}>
                {isRejected ? "Rejected" : "Pending"}
              </StatusPill>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[var(--text-muted)] text-sm">
              <span>{driver.email}</span>
              <span aria-hidden="true">·</span>
              <span>{driver.phone}</span>
              <span aria-hidden="true">·</span>
              <span>Licence {driver.licenseNumber}</span>
              <span aria-hidden="true">·</span>
              <span>
                {driver.vehicleInfo.model} ({driver.vehicleInfo.color})
              </span>
              <span aria-hidden="true">·</span>
              <span>Plate {driver.vehicleInfo.plateNumber}</span>
              <span aria-hidden="true">·</span>
              <span>Applied {formatDate(driver.createdAt)}</span>
            </div>

            <DocumentChecklist driver={driver} />

            {driver.rejectionNote ? (
              <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-rose-600 text-sm dark:text-rose-400">
                {driver.rejectionNote}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="flex-1 rounded-full border border-[var(--border)] px-4 py-2.5 font-semibold text-[var(--foreground)] text-sm transition hover:bg-[var(--surface-muted)]"
                onClick={() => onReview(driver)}
                type="button"
              >
                Review documents
              </button>
              <button
                className="flex-1 rounded-full bg-emerald-600 px-4 py-2.5 font-semibold text-sm text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSaving === driver._id || !isComplete}
                onClick={() => onApprove(driver)}
                type="button"
              >
                Approve
              </button>
              <button
                className="flex-1 rounded-full bg-rose-600 px-4 py-2.5 font-semibold text-sm text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSaving === driver._id}
                onClick={() => onReject(driver)}
                type="button"
              >
                Reject
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CompletedRidesPanel({
  recentRides,
}: {
  recentRides: AdminDashboard["recentRides"];
}) {
  if (recentRides.length === 0) {
    return <EmptyState message="No trips have been completed yet." />;
  }

  return (
    <div className="space-y-3">
      {recentRides.map((ride) => (
        <DetailRow
          key={ride._id}
          meta={
            <>
              <MetaItem>{ride.commuterName}</MetaItem>
              <MetaSeparator />
              <MetaItem>{ride.driverName ?? "No driver"}</MetaItem>
              <MetaSeparator />
              <MetaItem>{ride.pickupAddress}</MetaItem>
              <MetaSeparator />
              <MetaItem>{ride.dropoffAddress}</MetaItem>
              <MetaSeparator />
              <MetaItem>{formatDate(ride.createdAt)}</MetaItem>
            </>
          }
          title={formatPeso(ride.fare)}
          trailing={<StatusPill tone="emerald">Completed</StatusPill>}
        />
      ))}
    </div>
  );
}

export function RevenuePanel({
  payments,
}: {
  payments: AdminDashboard["payments"];
}) {
  if (payments.length === 0) {
    return <EmptyState message="No settled payments recorded yet." />;
  }

  // The revenue is read by method: cash collected by a driver and a wallet
  // charge are different money, and an operator needs to know which is which.
  const byMethod = new Map<string, number>();
  for (const payment of payments) {
    byMethod.set(
      payment.provider,
      (byMethod.get(payment.provider) ?? 0) + payment.amount
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {[...byMethod.entries()].map(([method, total]) => (
          <span
            className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-xs"
            key={method}
          >
            {paymentMethodLabel(method)} · {formatPeso(total)}
          </span>
        ))}
      </div>

      {payments.map((payment) => (
        <DetailRow
          key={payment._id}
          meta={
            <>
              <MetaItem>{payment.riderName}</MetaItem>
              <MetaSeparator />
              <MetaItem>{paymentMethodLabel(payment.provider)}</MetaItem>
              <MetaSeparator />
              <MetaItem>{payment.referenceNumber}</MetaItem>
              <MetaSeparator />
              <MetaItem>{formatDate(payment.createdAt)}</MetaItem>
            </>
          }
          title={formatPeso(payment.amount)}
          trailing={<StatusPill tone="emerald">Settled</StatusPill>}
        />
      ))}
    </div>
  );
}

export function FeedbackPanel({
  feedback,
}: {
  feedback: AdminDashboard["feedback"];
}) {
  if (feedback.length === 0) {
    return <EmptyState message="No ratings have been left yet." />;
  }

  return (
    <div className="space-y-3">
      {feedback.map((entry) => (
        <DetailRow
          key={entry._id}
          meta={
            <>
              <MetaItem>{entry.riderName}</MetaItem>
              <MetaSeparator />
              <MetaItem>rated {entry.driverName}</MetaItem>
              <MetaSeparator />
              <MetaItem>{formatDate(entry.createdAt)}</MetaItem>
              {entry.comment ? (
                <>
                  <MetaSeparator />
                  <MetaItem>{entry.comment}</MetaItem>
                </>
              ) : null}
            </>
          }
          title={
            <span className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <FaStar
                  className={`text-sm ${
                    star <= entry.rating
                      ? "text-amber-400"
                      : "text-[var(--text-muted)]"
                  }`}
                  key={star}
                />
              ))}
            </span>
          }
          trailing={<StatusPill tone="sky">{entry.rating}/5</StatusPill>}
        />
      ))}
    </div>
  );
}

export function CancellationsPanel({
  cancellations,
}: {
  cancellations: AdminDashboard["cancellations"];
}) {
  const ratePercent = Math.round(cancellations.rate * 100);
  const waitSeconds =
    cancellations.averageWaitMs === null
      ? null
      : Math.round(cancellations.averageWaitMs / 1000);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-3">
          <p className="text-[var(--text-muted)] text-xs uppercase tracking-[0.16em]">
            Cancelled
          </p>
          <p className="mt-1 font-semibold text-2xl text-[var(--foreground)]">
            {cancellations.cancelled}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-3">
          <p className="text-[var(--text-muted)] text-xs uppercase tracking-[0.16em]">
            Completed
          </p>
          <p className="mt-1 font-semibold text-2xl text-[var(--foreground)]">
            {cancellations.completed}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-3">
          <p className="text-[var(--text-muted)] text-xs uppercase tracking-[0.16em]">
            Cancel rate
          </p>
          <p className="mt-1 font-semibold text-2xl text-[var(--foreground)]">
            {ratePercent}%
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-3">
          <p className="text-[var(--text-muted)] text-xs uppercase tracking-[0.16em]">
            Avg wait
          </p>
          <p className="mt-1 font-semibold text-2xl text-[var(--foreground)]">
            {waitSeconds === null ? "—" : `${waitSeconds}s`}
          </p>
        </div>
      </div>

      {cancellations.byVehicleType.length === 0 ? (
        <EmptyState message="No cancelled trips to analyse yet." />
      ) : (
        <div className="space-y-3">
          {cancellations.byVehicleType.map((row) => {
            const total = row.cancelled + row.completed;
            const share = total === 0 ? 0 : (row.cancelled / total) * 100;
            return (
              <div
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4"
                key="all"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-[var(--foreground)] text-sm">
                    All rides
                  </p>
                  <p className="font-semibold text-[var(--foreground)] text-sm">
                    {row.cancelled} cancelled · {row.completed} completed
                  </p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                  <div
                    className="h-full bg-rose-500"
                    style={{ width: `${share}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
