/**
 * Shared display helpers for the rider and driver profile screens.
 */

/**
 * Friendly names for the ways a ride can be paid for.
 *
 * The rider chooses one when they book, and the ride carries it for its whole
 * life — the driver has to know before they accept whether they are
 * collecting cash.
 */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
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

/**
 * The name of the way a ride is paid for.
 *
 * A ride that predates the choice has no method, and it is read as GCash —
 * which is what it was settled through.
 */
export function paymentMethodLabel(method: string | null | undefined): string {
  if (!method) {
    return "Not recorded";
  }
  return PAYMENT_METHOD_LABELS[method] ?? method;
}

/**
 * How long a road takes, said as an estimate.
 *
 * The router measures the road as it draws it. The public server has no live
 * traffic, so the number is the time the road takes at its own speed profile
 * and not a promise about the traffic on it — which is why it is always
 * "about", and never a bare number.
 */
export function formatEta(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || seconds <= 0) {
    return "";
  }

  const minutes = Math.round(seconds / 60);

  if (seconds < 60) {
    return "less than a minute";
  }
  if (minutes < 60) {
    return `about ${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (remainder === 0) {
    return `about ${hours} h`;
  }
  return `about ${hours} h ${remainder} min`;
}

/**
 * A distance, said the way a driver would say it.
 *
 * Below a kilometre it is in metres, because "140 m" is more use to somebody
 * looking for a house than "0.14 km".
 */
export function formatDistance(meters: number | null | undefined): string {
  if (meters === null || meters === undefined || meters <= 0) {
    return "";
  }
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * How long ago a moment was, briefly: "just now", "45s ago", "3 min ago",
 * "2 h ago", or the date when it is more than a day back.
 */
export function formatSince(
  timestamp: number,
  now: number = Date.now()
): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 10) {
    return "just now";
  }
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours} h ago`;
  }
  return formatDate(timestamp);
}
