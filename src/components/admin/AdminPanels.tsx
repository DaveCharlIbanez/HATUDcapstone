"use client";

import type { ReactNode } from "react";
import { FaCheck, FaStar } from "react-icons/fa";
import { formatDate, formatPeso, vehicleLabel } from "@/lib/format";
import type {
  AdminDashboard,
  AdminDriverRow,
} from "../../../convex/adminQueries";
import { DetailRow, EmptyState, StatusPill } from "./DetailRow";

type Driver = AdminDashboard["drivers"][number];

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

export function DriversPanel({ drivers }: { drivers: Driver[] }) {
  const online = drivers.filter((driver) => driver.isAvailable);

  if (online.length === 0) {
    return <EmptyState message="No drivers are online right now." />;
  }

  return (
    <div className="space-y-3">
      {online.map((driver) => {
        const position = coordinates(driver.currentLocation);
        return (
          <DetailRow
            key={driver._id}
            meta={
              <>
                <MetaItem>{driver.vehicleInfo.model}</MetaItem>
                <MetaSeparator />
                <MetaItem>{driver.vehicleInfo.plateNumber}</MetaItem>
                <MetaSeparator />
                <MetaItem>Licence {driver.licenseNumber}</MetaItem>
                <MetaSeparator />
                <MetaItem>
                  <FaStar className="mr-1 inline text-amber-400" />
                  {driver.averageRating > 0 ? driver.averageRating : "—"} (
                  {driver.ratingCount})
                </MetaItem>
                {position ? (
                  <>
                    <MetaSeparator />
                    <MetaItem>{position}</MetaItem>
                  </>
                ) : null}
              </>
            }
            title={driver.name}
            trailing={<StatusPill tone="emerald">Online</StatusPill>}
          />
        );
      })}
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
                <MetaItem>{vehicleLabel(ride.vehicleType)}</MetaItem>
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
          title={`${formatPeso(ride.fare)} · ${vehicleLabel(ride.vehicleType)}`}
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

  return (
    <div className="space-y-3">
      {payments.map((payment) => (
        <DetailRow
          key={payment._id}
          meta={
            <>
              <MetaItem>{payment.riderName}</MetaItem>
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
                key={row.type}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-[var(--foreground)] text-sm">
                    {vehicleLabel(row.type)}
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
