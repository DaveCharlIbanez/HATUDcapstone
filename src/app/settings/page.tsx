"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  FaBell,
  FaCamera,
  FaEnvelope,
  FaKey,
  FaLifeRing,
  FaLocationArrow,
  FaMobileAlt,
  FaPalette,
  FaSignOutAlt,
  FaUserCircle,
} from "react-icons/fa";
import { ChangePasswordCard } from "@/components/ChangePasswordCard";
import { LogoutDialog } from "@/components/LogoutDialog";
import { SettingsGroup, SettingsSection } from "@/components/SettingsSection";
import { TermsDialog } from "@/components/TermsDialog";
import { ThemeSlider } from "@/components/ThemeSlider";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/authContext";
import { useTheme } from "@/lib/themeContext";

/**
 * The state of a permission.
 *
 * `unknown` is a real answer: not every browser, and not every WebView, has
 * the Permissions API. Saying "unknown" is honest; saying "denied" would send
 * the reader to a setting that does not exist.
 */
type PermissionState = "denied" | "granted" | "prompt" | "unknown";

interface PermissionRow {
  description: string;
  icon: React.ReactNode;
  label: string;
  name: "camera" | "geolocation" | "notifications";
  request: () => Promise<void>;
}

const STATE_LABELS: Record<PermissionState, string> = {
  denied: "Refused",
  granted: "Allowed",
  prompt: "Not asked yet",
  unknown: "Not reported by this browser",
};

const STATE_STYLES: Record<PermissionState, string> = {
  denied: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  granted: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  prompt: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  unknown: "bg-[var(--surface-muted)] text-[var(--text-muted)]",
};

/**
 * Reads the real state of a permission.
 *
 * The Permissions API covers the location and the camera. Notifications have
 * their own, and have had for longer.
 */
async function readPermission(
  name: "camera" | "geolocation" | "notifications"
): Promise<PermissionState> {
  try {
    if (name === "notifications") {
      if (typeof Notification === "undefined") {
        return "unknown";
      }
      return Notification.permission as PermissionState;
    }
    if (typeof navigator === "undefined" || !navigator.permissions) {
      return "unknown";
    }
    const status = await navigator.permissions.query({ name });
    return status.state as PermissionState;
  } catch {
    // The Permissions API does not know about this one here.
    return "unknown";
  }
}

/**
 * Asks for a permission.
 *
 * The location is asked for with a single position read, which is what raises
 * the native dialog on Android. The camera is asked for by the document
 * capture sheet, which is where it is actually needed.
 */
async function requestPermission(
  name: "camera" | "geolocation" | "notifications"
): Promise<PermissionState> {
  try {
    if (name === "notifications") {
      if (typeof Notification === "undefined") {
        return "unknown";
      }
      return (await Notification.requestPermission()) as PermissionState;
    }
    if (name === "geolocation") {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        return "unknown";
      }
      await new Promise<void>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(),
          (failure) => reject(new Error(failure.message)),
          { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 }
        );
      });
      return "granted";
    }
    return "unknown";
  } catch {
    return "denied";
  }
}

/** What to say after asking for a permission. */
function messageForResult(result: PermissionState): string {
  if (result === "granted") {
    return "Permission allowed.";
  }
  if (result === "denied") {
    return "Permission refused. You can change it in your device settings.";
  }
  return "This browser does not report that permission.";
}

/**
 * One permission, with its real state and a way to ask for it.
 */
function PermissionCard({
  description,
  icon,
  label,
  name,
  state,
  onRequest,
}: {
  description: string;
  icon: React.ReactNode;
  label: string;
  name: "camera" | "geolocation" | "notifications";
  state: PermissionState;
  onRequest: (name: "camera" | "geolocation" | "notifications") => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)]/40 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-muted)]/60 text-[var(--foreground)]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-[var(--foreground)]">{label}</p>
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${STATE_STYLES[state]}`}
          >
            {STATE_LABELS[state]}
          </span>
        </div>
        <p className="mt-1 text-[var(--text-muted)] text-sm">{description}</p>
      </div>
      <button
        className="min-h-11 shrink-0 rounded-full bg-sky-500 px-4 py-2 font-semibold text-sm text-white transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={state === "granted"}
        onClick={() => onRequest(name)}
        type="button"
      >
        {state === "granted" ? "On" : "Allow"}
      </button>
    </div>
  );
}

/** One line summing up the permissions, for the closed drop-down. */
function permissionsPreview(states: Record<string, PermissionState>): string {
  const values = Object.values(states);
  if (values.every((state) => state === "unknown")) {
    return "Location, camera and notifications";
  }
  const allowed = values.filter((state) => state === "granted").length;
  if (states.geolocation !== "granted") {
    return `${allowed} of ${values.length} allowed · location needs permission`;
  }
  return `${allowed} of ${values.length} allowed`;
}

const LINK_ROW =
  "flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left text-[var(--foreground)] text-sm transition-colors hover:bg-[var(--surface-strong)]";

/**
 * The app's settings, for passengers and drivers alike.
 *
 * Every setting lives here, grouped into drop-downs that each say what is set
 * right now, so on a phone the page is a short list rather than a long scroll.
 * The permissions are read from the platform, so what is shown is what is
 * actually true rather than a switch that goes nowhere.
 */
export default function SettingsPage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const isCommuter = user?.role === "commuter";
  const isOperator = user?.role === "operator";
  const [states, setStates] = useState<Record<string, PermissionState>>({
    camera: "unknown",
    geolocation: "unknown",
    notifications: "unknown",
  });

  const refresh = useCallback(async () => {
    const names = ["camera", "geolocation", "notifications"] as const;
    const entries = await Promise.all(
      names.map(async (name) => [name, await readPermission(name)] as const)
    );
    setStates(Object.fromEntries(entries));
  }, []);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  const handleRequest = async (
    name: "camera" | "geolocation" | "notifications"
  ) => {
    const result = await requestPermission(name);
    setStates((previous) => ({ ...previous, [name]: result }));
    showToast(messageForResult(result), result === "denied" ? "error" : "info");
    await refresh();
  };

  const rows: PermissionRow[] = [
    {
      description:
        "Shared with the driver you are riding with, only while the trip is under way.",
      icon: <FaLocationArrow />,
      label: "Location",
      name: "geolocation",
      request: () => handleRequest("geolocation"),
    },
    {
      description:
        "Used when a driver photographs their credentials, and never otherwise.",
      icon: <FaCamera />,
      label: "Camera",
      name: "camera",
      request: () => handleRequest("camera"),
    },
    {
      description:
        "Ride updates: when a driver accepts, and when a trip is completed.",
      icon: <FaBell />,
      label: "Notifications",
      name: "notifications",
      request: () => handleRequest("notifications"),
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <header>
          <h1 className="font-bold text-2xl text-[var(--foreground)]">
            Settings
          </h1>
          <p className="mt-1 text-[var(--text-muted)] text-sm">
            Tap a section to open it.
          </p>
        </header>

        <SettingsGroup>
          <SettingsSection
            icon={FaPalette}
            id="appearance"
            preview={theme === "dark" ? "Dark theme" : "Light theme"}
            title="Appearance"
          >
            <ThemeSlider />
          </SettingsSection>

          <SettingsSection
            icon={FaMobileAlt}
            id="permissions"
            preview={permissionsPreview(states)}
            title="App permissions"
          >
            <div className="space-y-3">
              {rows.map((row) => (
                <PermissionCard
                  description={row.description}
                  icon={row.icon}
                  key={row.name}
                  label={row.label}
                  name={row.name}
                  onRequest={handleRequest}
                  state={states[row.name] ?? "unknown"}
                />
              ))}
            </div>
          </SettingsSection>

          <SettingsSection
            icon={FaKey}
            id="security"
            preview="Change your password"
            title="Password & security"
          >
            <ChangePasswordCard embedded />
          </SettingsSection>

          <SettingsSection
            icon={FaUserCircle}
            id="account"
            preview={`Signed in as ${user?.name ?? user?.email ?? "you"}`}
            title="Account"
          >
            <div className="space-y-2">
              <button
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-5 py-2.5 font-semibold text-rose-600 transition hover:bg-rose-500/20 dark:text-rose-400"
                onClick={() => setIsLogoutOpen(true)}
                type="button"
              >
                <FaSignOutAlt />
                Sign out
              </button>
              {isCommuter ? (
                <button
                  className={`${LINK_ROW} text-rose-500 dark:text-rose-400`}
                  onClick={() =>
                    showToast(
                      "Account deletion: please contact support.",
                      "error"
                    )
                  }
                  type="button"
                >
                  Delete account
                </button>
              ) : null}
            </div>
          </SettingsSection>

          <SettingsSection
            icon={FaLifeRing}
            id="help"
            preview="Help, terms and privacy"
            title="Help & legal"
          >
            <div className="space-y-1">
              <Link className={LINK_ROW} href="/help">
                Help &amp; support
              </Link>
              {isOperator ? (
                <a
                  className={`${LINK_ROW} gap-2`}
                  href="mailto:support@hatud.app"
                >
                  <FaEnvelope className="text-[var(--text-muted)]" />
                  Message support
                </a>
              ) : null}
              <button
                className={LINK_ROW}
                onClick={() => setIsTermsOpen(true)}
                type="button"
              >
                Terms of service
              </button>
              <button
                className={LINK_ROW}
                onClick={() => showToast("Privacy policy coming soon.", "info")}
                type="button"
              >
                Privacy policy
              </button>
            </div>
          </SettingsSection>
        </SettingsGroup>
      </div>

      <LogoutDialog
        isOpen={isLogoutOpen}
        onClose={() => setIsLogoutOpen(false)}
      />

      {/* The terms, read-only. The acceptance happened at sign-up. */}
      <TermsDialog
        isOpen={isTermsOpen}
        onAccept={() => setIsTermsOpen(false)}
        onClose={() => setIsTermsOpen(false)}
        readOnly
      />
    </div>
  );
}
