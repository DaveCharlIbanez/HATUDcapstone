"use client";

import { FaLocationArrow } from "react-icons/fa";
import type { SimulatedVehicle } from "@/lib/useSimulatedVehicle";

/**
 * Puts the camera back on the moving vehicle (fixoct52).
 *
 * Touching the map during a demo trip hands it to the person, so they can
 * look around; this is the way back. It is only shown while a simulated trip
 * is under way and the camera is not following it.
 */
export function RecenterButton({
  className = "",
  trip,
}: {
  className?: string;
  trip: Pick<SimulatedVehicle, "isFollowing" | "isSimulating" | "recenter">;
}) {
  if (!trip.isSimulating || trip.isFollowing) {
    return null;
  }
  return (
    <button
      className={`inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)]/95 px-4 py-2 font-semibold text-[var(--foreground)] text-sm shadow-lg backdrop-blur transition hover:bg-[var(--surface-strong)] active:scale-95 motion-reduce:active:scale-100 ${className}`}
      onClick={trip.recenter}
      type="button"
    >
      <FaLocationArrow aria-hidden className="text-sky-500" />
      Re-center on ride
    </button>
  );
}
