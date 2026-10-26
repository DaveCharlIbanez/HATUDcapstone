"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import {
  FaChartLine,
  FaClipboardList,
  FaExclamationTriangle,
  FaMapMarkerAlt,
  FaStar,
  FaUserCheck,
  FaUsers,
  FaWallet,
} from "react-icons/fa";
import {
  ApprovalsPanel,
  CancellationsPanel,
  CompletedRidesPanel,
  DriversPanel,
  FeedbackPanel,
  LiveRidesPanel,
  RevenuePanel,
  RidersPanel,
} from "@/components/admin/AdminPanels";
import { PanelSkeleton } from "@/components/admin/DetailRow";
import { DocumentViewer } from "@/components/admin/DocumentViewer";
import { MetricDisclosure } from "@/components/admin/MetricDisclosure";
import { LogoutDialog } from "@/components/LogoutDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/authContext";
import { formatPeso } from "@/lib/format";
import { api } from "../../../convex/_generated/api";
import type { AdminDriverRow } from "../../../convex/adminQueries";

type PanelId =
  | "approvals"
  | "cancellations"
  | "completed"
  | "drivers"
  | "feedback"
  | "liveRides"
  | "revenue"
  | "riders";

export default function AdminPage() {
  const { isLoading: authLoading, sessionToken, user } = useAuth();
  const { showToast } = useToast();
  const [openPanel, setOpenPanel] = useState<PanelId | null>(null);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [reviewingDriver, setReviewingDriver] = useState<AdminDriverRow | null>(
    null
  );
  const [savingDriverId, setSavingDriverId] = useState<string | null>(null);

  const dashboard = useQuery(
    api.adminQueries.getDashboard,
    sessionToken ? { sessionToken } : "skip"
  );
  const setOperatorApproval = useMutation(api.admins.setOperatorApproval);

  const togglePanel = (panel: PanelId) => {
    setOpenPanel((current) => (current === panel ? null : panel));
  };

  const handleApproval = async (
    driver: AdminDriverRow,
    approvalStatus: "approved" | "rejected",
    note?: string
  ) => {
    if (!sessionToken) {
      return;
    }
    setSavingDriverId(driver._id);
    try {
      await setOperatorApproval({
        sessionToken,
        id: driver._id,
        approvalStatus,
        note,
      });
      setReviewingDriver(null);
      showToast(
        `${driver.name} has been ${approvalStatus === "approved" ? "approved" : "rejected"}.`,
        "success"
      );
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Could not update the driver.",
        "error"
      );
    } finally {
      setSavingDriverId(null);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-[var(--foreground)]">
        <p className="text-[var(--text-muted)]">Loading...</p>
      </div>
    );
  }

  const metrics = dashboard?.metrics;
  const panels = dashboard;

  const value = {
    approvals: metrics ? String(metrics.pendingDrivers) : "—",
    cancellations: metrics ? String(metrics.cancelledTrips) : "—",
    completed: metrics ? String(metrics.completedTrips) : "—",
    drivers: metrics ? String(metrics.activeDrivers) : "—",
    feedback: metrics ? String(metrics.ratingCount) : "—",
    liveRides: metrics ? String(metrics.liveTrips) : "—",
    revenue: metrics ? formatPeso(metrics.revenue) : "—",
    riders: metrics ? String(metrics.riders) : "—",
  };

  const body = (content: React.ReactNode) =>
    panels ? content : <PanelSkeleton />;

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <header className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sky-500 text-sm uppercase tracking-[0.2em] dark:text-sky-400">
                Admin Panel
              </p>
              <h1 className="mt-2 font-semibold text-3xl text-[var(--foreground)]">
                Hatud Operations
              </h1>
              <p className="mt-2 text-[var(--text-muted)]">
                Tap any metric to see the records behind it.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="flex h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-2">
                <ThemeToggle />
              </div>
              <button
                className="inline-flex h-11 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 font-semibold text-rose-600 transition hover:bg-rose-500/20 dark:text-rose-400"
                onClick={() => setIsLogoutOpen(true)}
                type="button"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <div className="mt-4 space-y-3">
          <MetricDisclosure
            hint="Drivers who are online right now"
            icon={FaUserCheck}
            isOpen={openPanel === "drivers"}
            label="Active Drivers"
            onToggle={() => togglePanel("drivers")}
            value={value.drivers}
          >
            {body(<DriversPanel drivers={panels?.drivers ?? []} />)}
          </MetricDisclosure>

          <MetricDisclosure
            hint="Trips that are accepted or in progress"
            icon={FaMapMarkerAlt}
            isOpen={openPanel === "liveRides"}
            label="Live Trips"
            onToggle={() => togglePanel("liveRides")}
            value={value.liveRides}
          >
            {body(<LiveRidesPanel liveRides={panels?.liveRides ?? []} />)}
          </MetricDisclosure>

          <MetricDisclosure
            hint="Riders registered on the platform"
            icon={FaUsers}
            isOpen={openPanel === "riders"}
            label="Registered Riders"
            onToggle={() => togglePanel("riders")}
            value={value.riders}
          >
            {body(<RidersPanel riders={panels?.riders ?? []} />)}
          </MetricDisclosure>

          <MetricDisclosure
            hint="Driver applications waiting for a decision"
            icon={FaClipboardList}
            isOpen={openPanel === "approvals"}
            label="Driver Approvals"
            onToggle={() => togglePanel("approvals")}
            value={value.approvals}
          >
            {body(
              <ApprovalsPanel
                drivers={panels?.drivers ?? []}
                isSaving={savingDriverId}
                onApprove={(driver) => handleApproval(driver, "approved")}
                onReject={(driver) => handleApproval(driver, "rejected")}
                onReview={setReviewingDriver}
              />
            )}
          </MetricDisclosure>

          <MetricDisclosure
            hint="Trips that finished and were paid"
            icon={FaChartLine}
            isOpen={openPanel === "completed"}
            label="Completed Trips"
            onToggle={() => togglePanel("completed")}
            value={value.completed}
          >
            {body(
              <CompletedRidesPanel recentRides={panels?.recentRides ?? []} />
            )}
          </MetricDisclosure>

          <MetricDisclosure
            hint="Settled GCash payments"
            icon={FaWallet}
            isOpen={openPanel === "revenue"}
            label="Revenue"
            onToggle={() => togglePanel("revenue")}
            value={value.revenue}
          >
            {body(<RevenuePanel payments={panels?.payments ?? []} />)}
          </MetricDisclosure>

          <MetricDisclosure
            hint="Ratings left by riders"
            icon={FaStar}
            isOpen={openPanel === "feedback"}
            label="Ratings &amp; Feedback"
            onToggle={() => togglePanel("feedback")}
            value={value.feedback}
          >
            {body(<FeedbackPanel feedback={panels?.feedback ?? []} />)}
          </MetricDisclosure>

          <MetricDisclosure
            hint="Why requests were dropped before a ride started"
            icon={FaExclamationTriangle}
            isOpen={openPanel === "cancellations"}
            label="Cancellation Analysis"
            onToggle={() => togglePanel("cancellations")}
            value={value.cancellations}
          >
            {body(
              <CancellationsPanel
                cancellations={
                  panels?.cancellations ?? {
                    averageWaitMs: null,
                    byVehicleType: [],
                    cancelled: 0,
                    completed: 0,
                    rate: 0,
                  }
                }
              />
            )}
          </MetricDisclosure>
        </div>
      </div>

      <LogoutDialog
        isOpen={isLogoutOpen}
        onClose={() => setIsLogoutOpen(false)}
      />

      {reviewingDriver ? (
        <DocumentViewer
          driver={reviewingDriver}
          isOpen
          onApprove={(driver, note) => handleApproval(driver, "approved", note)}
          onClose={() => setReviewingDriver(null)}
          onReject={(driver, note) => handleApproval(driver, "rejected", note)}
        />
      ) : null}
    </div>
  );
}
