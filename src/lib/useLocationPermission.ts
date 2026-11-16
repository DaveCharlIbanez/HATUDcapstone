"use client";

import { useCallback, useEffect, useState } from "react";
import { describeGeolocationError } from "./geolocation";

/**
 * Whether the app may know where the user is.
 *
 * There are two separate questions hiding behind "location", and the app has
 * to tell them apart:
 *
 * 1. **Is the permission granted?** On Android this is the runtime
 *    permission. Capacitor's bridge asks for it when the WebView first asks
 *    for a position, and the native dialog appears.
 * 2. **Can a position be read?** A cold GPS can take a while, and a device
 *    indoors may never get a fix. That is not a refusal, and telling a user
 *    to change their settings when the problem is a missing fix sends them
 *    to the wrong place.
 *
 * Only a refusal — the browser's `PERMISSION_DENIED` — is a refusal. A
 * timeout or an unavailable position is reported separately.
 */
export type LocationPermissionState =
  /** Not asked yet. */
  | "unknown"
  /** The dialog is up. */
  | "asking"
  /** The permission is granted. */
  | "granted"
  /** The permission was refused. */
  | "denied"
  /** The permission is fine, but no position could be read. */
  | "unavailable"
  /** The device or browser cannot do geolocation at all. */
  | "unsupported";

export interface UseLocationPermissionOptions {
  /** Called once, when the permission is granted. */
  onGranted?: () => void;
}

export interface UseLocationPermissionResult {
  /** The message to show, or null when there is nothing to say. */
  error: string | null;
  /** Asks for the permission. Safe to call more than once. */
  request: () => void;
  state: LocationPermissionState;
}

/**
 * The state machine behind the location prompt.
 *
 * The heavy lifting is the `request` function, which is exported on its own so
 * it can be tested without a browser.
 */
export function useLocationPermission(
  options: UseLocationPermissionOptions = {}
): UseLocationPermissionResult {
  const { onGranted } = options;
  const [state, setState] = useState<LocationPermissionState>("unknown");
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setState("unsupported");
      setError("This device cannot share a location.");
      return;
    }

    setState("asking");
    setError(null);

    navigator.geolocation.getCurrentPosition(
      () => {
        setState("granted");
        setError(null);
        onGranted?.();
      },
      (failure) => {
        // Only a refusal is a refusal. A timeout or an unavailable position
        // means the permission is fine and the device simply could not find
        // the user.
        if (failure.code === failure.PERMISSION_DENIED) {
          setState("denied");
          setError(describeGeolocationError(failure.code));
          return;
        }
        setState("unavailable");
        setError(
          failure.code === failure.TIMEOUT
            ? "Your location took too long to arrive. Please try again."
            : "Your location could not be determined right now. Please try again."
        );
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 15_000 }
    );
  }, [onGranted]);

  // A permission that was granted in a previous session is granted now, and
  // there is no reason to ask again.
  useEffect(() => {
    let cancelled = false;

    async function readPermission() {
      if (typeof navigator === "undefined" || !navigator.permissions) {
        return;
      }
      try {
        const status = await navigator.permissions.query({
          name: "geolocation",
        });
        if (cancelled) {
          return;
        }
        if (status.state === "granted") {
          setState("granted");
        }
      } catch {
        // The Permissions API does not know about geolocation here. It is an
        // optimisation, not a requirement.
      }
    }

    readPermission().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return { error, request, state };
}
