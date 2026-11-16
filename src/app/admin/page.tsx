"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import {
  FaChartLine,
  FaClipboardList,
  FaExclamationTriangle,
  FaMapMarkerAlt,
  FaSignal,
  FaStar,
  FaUsers,
  FaWallet,
} from "react-icons/fa";
import { AppLoader } from "@/components/AppLoader";
import {
  ApprovalsPanel,
  CancellationsPanel,
  CompletedRidesPanel,
  FeedbackPanel,
  LiveRidesPanel,
  RevenuePanel,
  RidersPanel,
  UsersPanel,
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
import type {
  AdminDashboard,
  AdminDriverRow,
} from "../../../convex/adminQueries";

type PanelId =
  | "activeUsers"
  | "approvals"
  | "cancellations"
  | "completed"
  | "feedback"
  | "liveRides"
  | "revenue"
  | "riders";

type Metrics = AdminDashboard["metrics"];

/** The headline figure on each card, or a dash while the data loads. */
function metricValues(metrics: Metrics | undefined): Record<PanelId, string> {
  if (!metrics) {
    return {
      activeUsers: "—",
      approvals: "—",
      cancellations: "—",
      completed: "—",
      feedback: "—",
      liveRides: "—",
      revenue: "—",
      riders: "—",
    };
  }
  return {
    activeUsers: `${metrics.activeUsers} / ${metrics.totalUsers}`,
    approvals: String(metrics.pendingDrivers),
    cancellations: String(metrics.cancelledTrips),
    completed: String(metrics.completedTrips),
    feedback: String(metrics.ratingCount),
    liveRides: String(metrics.liveTrips),
    revenue: formatPeso(metrics.revenue),
    riders: String(metrics.riders),
  };
}

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
    return <AppLoader variant="full" />;
  }

  const metrics = dashboard?.metrics;
  const panels = dashboard;

  const value = metricValues(metrics);
  const activeUsersHint = metrics
    ? `${metrics.activeDrivers} ${metrics.activeDrivers === 1 ? "driver" : "drivers"} on shift · tap to filter`
    : "Commuters and operators with the app open";

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
            hint={activeUsersHint}
            icon={FaSignal}
            isOpen={openPanel === "activeUsers"}
            label="Active Users"
            onToggle={() => togglePanel("activeUsers")}
            value={value.activeUsers}
          >
            {body(
              <UsersPanel
                roster={panels?.userRoster ?? { commuters: [], operators: [] }}
              />
            )}
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
            hint="Settled payments"
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
                    byVehicleType: [{ cancelled: 0, completed: 0 }],
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
