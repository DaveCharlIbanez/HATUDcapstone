/**
 * Shared display helpers for the rider and driver profile screens.
 */

/** Friendly names for the vehicle classes a ride can be booked with. */
export const VEHICLE_LABELS: Record<string, string> = {
  standard: "Standard",
  priority: "Priority",
  motorcycle_standard: "Motorcycle",
  motorcycle_with_pillion: "Motorcycle w/ Pillion",
  motorcycle_family: "Family",
};

/** Badge colours for a ride status. */
export const RIDE_STATUS_STYLES: Record<string, string> = {
  accepted: "bg-sky-500/20 text-sky-600 dark:text-sky-300",
  cancelled: "bg-rose-500/20 text-rose-600 dark:text-rose-300",
  completed: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300",
  inProgress: "bg-sky-500/20 text-sky-600 dark:text-sky-300",
  pending: "bg-amber-500/20 text-amber-600 dark:text-amber-300",
};

export const RIDE_STATUS_LABELS: Record<string, string> = {
  accepted: "Accepted",
  cancelled: "Cancelled",
  completed: "Completed",
  inProgress: "In progress",
  pending: "Pending",
};

export function formatPeso(amount: number): string {
  return `₱${amount.toLocaleString("en-PH", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}`;
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatMonthYear(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
  });
}

export function vehicleLabel(vehicleType: string | null): string {
  if (!vehicleType) {
    return "Ride";
  }
  return VEHICLE_LABELS[vehicleType] ?? vehicleType;
}
