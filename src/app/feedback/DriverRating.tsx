"use client";

import { useQuery } from "convex/react";
import { FaStar } from "react-icons/fa";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface DriverRatingProps {
  operatorId: Id<"operators"> | undefined;
  sessionToken: string | null;
}

/**
 * The driver's average rating.
 *
 * It is a nice-to-have, so it lives in its own component: the page wraps it
 * in an error boundary, and a failure here leaves the rating form working.
 */
export function DriverRating({ operatorId, sessionToken }: DriverRatingProps) {
  const driverRating = useQuery(
    api.feedback.getAverageForOperator,
    sessionToken && operatorId ? { sessionToken, operatorId } : "skip"
  );

  if (!driverRating || driverRating.count === 0) {
    return <span className="text-[var(--foreground)] text-sm">New</span>;
  }

  return (
    <span className="flex items-center gap-1 text-[var(--foreground)] text-sm">
      <FaStar className="text-yellow-400" />
      {driverRating.average} ({driverRating.count})
    </span>
  );
}
