"use client";

import { useQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

/**
 * The ride the driver has just finished, followed until it is settled
 * (fixoct48).
 *
 * - `panelOpen`: the "Ride completed" card is on screen. The driver can put
 *   it away early; a GCash or Maya ride is still watched after that, so the
 *   payment popup still appears when the passenger pays.
 * - `announced`: the payment popup has been shown and closed for this ride.
 *
 * It is remembered for the browser session, so a reload in the middle of
 * waiting for a payment does not lose it. Storage can be unavailable (private
 * mode, blocked site data); every access is guarded and the screen works
 * without it.
 */
interface Watch {
  announced: boolean;
  panelOpen: boolean;
  rideId: Id<"rides">;
}

const STORAGE_KEY = "hatud.operator.finishedRide";

function load(): Watch | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Watch) : null;
  } catch {
    return null;
  }
}

function save(watch: Watch | null) {
  try {
    if (watch) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(watch));
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage is a convenience; the card still works for this page view.
  }
}

export function useFinishedRide(sessionToken: string | null) {
  const [watch, setWatchState] = useState<Watch | null>(null);

  // Read storage after mount, so the server render and the first client
  // render agree.
  useEffect(() => {
    setWatchState(load());
  }, []);

  const setWatch = useCallback((next: Watch | null) => {
    setWatchState(next);
    save(next);
  }, []);

  const ride = useQuery(
    api.rides.getFinishedForOperator,
    sessionToken && watch ? { sessionToken, rideId: watch.rideId } : "skip"
  );

  // A remembered ride that is not this driver's, or not finished, is dropped.
  useEffect(() => {
    if (watch && ride === null) {
      setWatch(null);
    }
  }, [ride, watch, setWatch]);

  const settled =
    ride?.settlement === "paid" || ride?.settlement === "cashCollected";

  /** The driver has just ended this ride. */
  const track = useCallback(
    (rideId: Id<"rides">) =>
      setWatch({ announced: false, panelOpen: true, rideId }),
    [setWatch]
  );

  /** "Done" / "Back to ride queue". A ride still owed keeps being watched. */
  const closePanel = useCallback(() => {
    if (!watch) {
      return;
    }
    if (settled || watch.announced) {
      setWatch(null);
    } else {
      setWatch({ ...watch, panelOpen: false });
    }
  }, [watch, settled, setWatch]);

  /** The driver closed the payment popup. */
  const closeDialog = useCallback(() => {
    if (!watch) {
      return;
    }
    // The card stays, now saying the payment was received, if it was open.
    setWatch(watch.panelOpen ? { ...watch, announced: true } : null);
  }, [watch, setWatch]);

  return {
    closeDialog,
    closePanel,
    /** The popup: a wallet payment has landed and has not been shown yet. */
    dialogOpen: Boolean(
      watch && ride?.settlement === "paid" && !watch.announced
    ),
    panelOpen: Boolean(watch?.panelOpen && ride),
    ride: ride ?? null,
    track,
  };
}
