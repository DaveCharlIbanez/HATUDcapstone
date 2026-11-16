"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import {
  FaBook,
  FaCog,
  FaHeadset,
  FaMapMarkedAlt,
  FaStar,
  FaTimes,
  FaTruck,
  FaUser,
} from "react-icons/fa";
import { useAuth } from "@/lib/authContext";
import { useTheme } from "@/lib/themeContext";
import { api } from "../../convex/_generated/api";
import { useAppShell } from "./AppShell";
import { HatudLogo } from "./HatudLogo";
import { ThemeToggle } from "./ThemeToggle";

type CommuterProfile = FunctionReturnType<typeof api.profile.commuterProfile>;
type OperatorProfile = FunctionReturnType<typeof api.profile.operatorProfile>;
type AdminDashboard = FunctionReturnType<typeof api.adminQueries.getDashboard>;

interface AppDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  pathname: string;
}

interface Metric {
  label: string;
  value: string;
}

interface DrawerSummary {
  metrics: Metric[];
  name: string;
  roleLabel: string;
  status: string | null;
}

function formatPeso(amount: number): string {
  return `₱${amount.toLocaleString("en-PH")}`;
}

/** What the rides entry is called, for each role. */
function ridesLabelForRole(role: string | undefined): string {
  if (role === "operator") {
    return "See available rides";
  }
  if (role === "admin") {
    return "Operations";
  }
  return "Book a ride";
}

/** Where the rides entry goes, for each role. */
function ridesHrefForRole(role: string | undefined): string {
  if (role === "operator") {
    return "/operator/map";
  }
  if (role === "admin") {
    return "/admin";
  }
  return "/map";
}

/** The icon on the rides entry, for each role. */
function ridesIconForRole(role: string | undefined): React.ReactNode {
  if (role === "operator") {
    return <FaTruck />;
  }
  if (role === "admin") {
    return <FaCog />;
  }
  return <FaBook />;
}

/**
 * The user's own numbers.
 *
 * The wordmark at the top of the drawer is not a label — it is the
 * dashboard, and it says something about the person reading it.
 */
function useDrawerSummary(isOpen: boolean): DrawerSummary | null {
  const { sessionToken, user } = useAuth();

  // The numbers are only read while the drawer is open. The admin's
  // dashboard reads every table, and it has no business running on every
  // screen the admin visits.
  const commuter = useQuery(
    api.profile.commuterProfile,
    isOpen && sessionToken && user?.role === "commuter"
      ? { sessionToken }
      : "skip"
  );
  const operator = useQuery(
    api.profile.operatorProfile,
    isOpen && sessionToken && user?.role === "operator"
      ? { sessionToken }
      : "skip"
  );
  const admin = useQuery(
    api.adminQueries.getDashboard,
    isOpen && sessionToken && user?.role === "admin" ? { sessionToken } : "skip"
  );

  if (!user) {
    return null;
  }

  if (user.role === "commuter" && commuter) {
    return commuterSummary(commuter);
  }

  if (user.role === "operator" && operator) {
    return operatorSummary(operator);
  }

  if (user.role === "admin" && admin) {
    return adminSummary(user.name, admin);
  }

  return null;
}

/** A passenger's own numbers. */
function commuterSummary(profile: CommuterProfile): DrawerSummary {
  const rated = profile.history.filter((ride) => ride.rating !== null);
  const averageGiven =
    rated.length === 0
      ? 0
      : Math.round(
          (rated.reduce((total, ride) => total + (ride.rating ?? 0), 0) /
            rated.length) *
            10
        ) / 10;
  const saved = profile.savedLocations.length;

  return {
    metrics: [
      { label: "Trips", value: String(profile.completedRides) },
      { label: "Spent", value: formatPeso(profile.totalSpent) },
      { label: "Rating", value: averageGiven > 0 ? String(averageGiven) : "—" },
    ],
    name: profile.name,
    roleLabel: "Passenger",
    status: saved > 0 ? `${saved} saved place${saved === 1 ? "" : "s"}` : null,
  };
}

/** A driver's own numbers. */
function operatorSummary(profile: OperatorProfile): DrawerSummary {
  return {
    metrics: [
      { label: "Trips", value: String(profile.completedRides) },
      { label: "Earned", value: formatPeso(profile.totalEarnings) },
      {
        label: "Rating",
        value:
          profile.ratingCount > 0
            ? `${profile.averageRating} (${profile.ratingCount})`
            : "—",
      },
    ],
    name: profile.name,
    roleLabel: "Driver",
    status: profile.isAvailable ? "On shift" : "Off shift",
  };
}

/** The administrator's own numbers. */
function adminSummary(name: string, dashboard: AdminDashboard): DrawerSummary {
  const pending = dashboard.metrics.pendingDrivers;

  return {
    metrics: [
      { label: "Riders", value: String(dashboard.metrics.riders) },
      { label: "Drivers", value: String(dashboard.metrics.activeDrivers) },
      { label: "Trips", value: String(dashboard.metrics.completedTrips) },
    ],
    name,
    roleLabel: "Administrator",
    status: `${pending} driver${pending === 1 ? "" : "s"} to review`,
  };
}

/**
 * The dashboard head of the drawer.
 */
function DrawerHead({ summary }: { summary: DrawerSummary | null }) {
  const { theme } = useTheme();

  return (
    <div className="border-[var(--border)] border-b px-5 pt-5 pb-5">
      <div className="flex items-center gap-3">
        <HatudLogo className="w-14 shrink-0" decorative />
        <div className="min-w-0">
          <p className="font-bold text-2xl text-[var(--foreground)] tracking-tight">
            HATUD
          </p>
          <p className="mt-0.5 text-[var(--text-muted)] text-xs">
            A Kinaray-a Ride-Booking Hub
          </p>
        </div>
      </div>

      {summary ? (
        <>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-lg text-sky-600 dark:text-sky-300">
              <FaUser />
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-[var(--foreground)] text-sm">
                {summary.name}
              </p>
              <p className="text-[var(--text-muted)] text-xs">
                {summary.roleLabel}
                {summary.status ? ` · ${summary.status}` : ""}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {summary.metrics.map((metric) => (
              <div
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)]/40 px-2 py-2 text-center"
                key={metric.label}
              >
                <p className="truncate font-bold text-[var(--foreground)] text-sm">
                  {metric.value}
                </p>
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">
                  {metric.label}
                </p>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-[var(--text-muted)] text-xs">
          <FaStar className="text-yellow-400" />
          {theme === "light" ? "Light" : "Dark"} mode
        </span>
        <ThemeToggle />
      </div>
    </div>
  );
}

/**
 * One entry in the drawer's navigation.
 */
function DrawerLink({
  active,
  href,
  icon,
  label,
}: {
  active: boolean;
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  const { navigate } = useAppShell();

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    // A link that opens in a new tab is left to the browser.
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.button !== 0
    ) {
      return;
    }
    event.preventDefault();
    navigate(href);
  };

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 font-medium transition-colors ${
        active
          ? "bg-sky-500/15 text-sky-600 dark:text-sky-300"
          : "text-[var(--foreground)] hover:bg-[var(--surface-strong)]"
      }`}
      href={href}
      onClick={handleClick}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-muted)]/60 text-base">
        {icon}
      </span>
      {label}
    </Link>
  );
}

/**
 * The app's navigation.
 *
 * It is drawn over whatever screen the user is on, so it has to scroll: the
 * dashboard plus the navigation is taller than a small phone.
 */
export function AppDrawer({ isOpen, onClose, pathname }: AppDrawerProps) {
  const { user } = useAuth();
  const summary = useDrawerSummary(isOpen);

  const isOperator = user?.role === "operator";
  const ridesHref = ridesHrefForRole(user?.role);
  const ridesLabel = ridesLabelForRole(user?.role);
  const profileHref = isOperator ? "/operator/profile" : "/profile";

  const isActive = (href: string) => pathname === href;

  return (
    <div
      className={`fixed inset-0 z-[60] transition-opacity duration-300 ${
        isOpen ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      inert={!isOpen}
    >
      <button
        aria-label="Close the menu"
        className="absolute inset-0 bg-black/55 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
        type="button"
      />
      <nav
        aria-label="Main menu"
        className={`absolute inset-y-0 left-0 flex w-[min(85vw,320px)] flex-col overflow-y-auto overscroll-contain border-[var(--border)] border-r bg-[var(--surface)] shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          aria-label="Close the menu"
          className="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-strong)] hover:text-[var(--foreground)]"
          onClick={onClose}
          type="button"
        >
          <FaTimes />
        </button>

        <DrawerHead summary={summary} />

        <div className="space-y-1 p-3">
          <DrawerLink
            active={pathname === "/dashboard"}
            href="/dashboard"
            icon={<FaMapMarkedAlt />}
            label="Dashboard"
          />
          <DrawerLink
            active={isActive(ridesHref)}
            href={ridesHref}
            icon={ridesIconForRole(user?.role)}
            label={ridesLabel}
          />
          <DrawerLink
            active={isActive(profileHref)}
            href={profileHref}
            icon={<FaUser />}
            label="My profile"
          />
          <DrawerLink
            active={isActive("/settings")}
            href="/settings"
            icon={<FaCog />}
            label="Settings"
          />
          <DrawerLink
            active={isActive("/help")}
            href="/help"
            icon={<FaHeadset />}
            label="Help"
          />
        </div>
      </nav>
    </div>
  );
}
