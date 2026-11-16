"use client";

import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { COMMUTER_CANCEL_GRACE_MS } from "../../../convex/lib/cancellation";

/**
 * The passenger's cancel button once a driver has accepted (fixoct46).
 *
 * The passenger has one minute after the driver accepts to change their mind.
 * The message counts it down; when it runs out the button turns grey and is
 * disabled, and the message says why. The server enforces the same rule from
 * `convex/lib/cancellation.ts`, so a stale screen cannot get around it.
 *
 * fixoct47: the deadline is server time, so the countdown runs on the
 * server's clock (the phone's clock plus a measured offset). A phone whose
 * clock ran ahead of the server's showed the window as already closed.
 */

/** Below this, the phone and the server are treated as agreeing. */
const OFFSET_NOISE_MS = 1500;

/**
 * How far the server's clock is ahead of the phone's, in milliseconds.
 * Null until it has been measured. A failed measurement falls back to 0.
 */
function useServerClockOffset(): number | null {
  const serverTime = useMutation(api.rides.serverTime);
  const [offset, setOffset] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    const sentAt = Date.now();
    serverTime({})
      .then((serverNow) => {
        const receivedAt = Date.now();
        // The server read its clock roughly halfway through the round trip.
        const measured = serverNow - (sentAt + receivedAt) / 2;
        if (live) {
          setOffset(Math.abs(measured) < OFFSET_NOISE_MS ? 0 : measured);
        }
      })
      .catch(() => {
        if (live) {
          setOffset(0);
        }
      });
    return () => {
      live = false;
    };
  }, [serverTime]);
  return offset;
}

/** The server's time, ticking once a second until `until`, then stopping. */
function useServerNowUntil(until: number | null, offset: number): number {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    setNow(Date.now() + offset);
    if (until === null || Date.now() + offset >= until) {
      return;
    }
    const timer = window.setInterval(() => {
      const current = Date.now() + offset;
      setNow(current);
      if (current >= until) {
        window.clearInterval(timer);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [until, offset]);
  return now;
}

function secondsLabel(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `0:${String(Math.min(seconds, 59)).padStart(2, "0")}`;
}

type GraceState =
  | { kind: "checking" }
  | { kind: "open"; remaining: number }
  | { kind: "closed" }
  | { kind: "unavailable" };

function graceState(
  deadline: number | null,
  offset: number | null,
  now: number
): GraceState {
  // A ride without an accept time (accepted by a backend that predates the
  // window) has no window to count — say so, instead of claiming it passed.
  if (deadline === null) {
    return { kind: "unavailable" };
  }
  if (offset === null) {
    return { kind: "checking" };
  }
  const remaining = deadline - now;
  return remaining > 0 ? { kind: "open", remaining } : { kind: "closed" };
}

function message(state: GraceState, graceMinutes: number): string {
  switch (state.kind) {
    case "checking":
      return "Checking how long you have to cancel…";
    case "open":
      return `You can cancel within ${graceMinutes} minute of your driver accepting. ${secondsLabel(state.remaining)} left.`;
    case "closed":
      return `The ${graceMinutes}-minute cancellation window has passed. Your driver is on the way.`;
    default:
      return "This ride can no longer be cancelled. Your driver is on the way.";
  }
}

export function CancelGrace({
  deadline,
  onCancel,
}: {
  /** When the window closes (server time), or null when the ride has none. */
  deadline: number | null;
  onCancel: () => void;
}) {
  const offset = useServerClockOffset();
  const now = useServerNowUntil(deadline, offset ?? 0);
  const state = graceState(deadline, offset, now);
  const open = state.kind === "open";
  const graceMinutes = COMMUTER_CANCEL_GRACE_MS / 60_000;

  return (
    <div className="space-y-2">
      <p
        aria-live="polite"
        className={`rounded-2xl px-3 py-2 text-center text-xs ${
          open || state.kind === "checking"
            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
            : "bg-[var(--surface-strong)] text-[var(--text-muted)]"
        }`}
      >
        {message(state, graceMinutes)}
      </p>
      <button
        aria-disabled={!open}
        className="w-full rounded-3xl border border-red-500/40 py-3 font-semibold text-red-600 text-sm transition hover:bg-red-500/10 disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-[var(--border)] disabled:bg-[var(--surface-muted)] disabled:text-[var(--text-muted)] dark:text-red-400"
        disabled={!open}
        onClick={open ? onCancel : undefined}
        type="button"
      >
        {state.kind === "open"
          ? `Cancel ride (${secondsLabel(state.remaining)})`
          : "Cancel ride"}
      </button>
    </div>
  );
}
