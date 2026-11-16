"use client";

import { useMutation, useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { FaStar } from "react-icons/fa";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/authContext";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { DriverRating } from "./DriverRating";

const REASONS = [
  "Clean vehicle",
  "Safe driving",
  "Friendly driver",
  "On time pickup",
  "Good conversation",
  "Helpful with luggage",
];

const RATING_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Very Good",
  5: "Excellent",
};

/**
 * The five stars.
 */
function StarRating({
  onRate,
  rating,
}: {
  onRate: (value: number) => void;
  rating: number;
}) {
  const [hoverRating, setHoverRating] = useState(0);
  const stars = [1, 2, 3, 4, 5];

  return (
    <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--background)]/50 p-6">
      <h3 className="mb-4 text-center font-semibold text-[var(--foreground)] text-lg">
        Rate your driver
      </h3>
      <div className="mb-4 flex justify-center gap-2">
        {stars.map((star) => (
          <button
            aria-label={`Rate ${star} out of 5`}
            className="text-3xl transition-colors hover:scale-110"
            key={star}
            onClick={() => onRate(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            type="button"
          >
            <FaStar
              className={
                star <= (hoverRating || rating)
                  ? "text-yellow-400"
                  : "text-[var(--surface-muted)]"
              }
            />
          </button>
        ))}
      </div>
      <div className="text-center text-[var(--text-muted)] text-sm">
        {RATING_LABELS[hoverRating || rating] ?? "Tap a star to rate"}
      </div>
    </div>
  );
}

/**
 * Nothing is waiting to be rated.
 */
function NothingToRate() {
  return (
    <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--background)]/50 p-6 text-center">
      <p className="font-semibold text-[var(--foreground)] text-sm">
        There is no trip waiting to be rated
      </p>
      <p className="mt-1 text-[var(--text-muted)] text-sm">
        Every trip you have taken has been rated. Thank you.
      </p>
    </div>
  );
}

/**
 * The rating that was already left for this trip.
 */
function AlreadyRated({
  rating,
  comment,
}: {
  comment: string | null;
  rating: number;
}) {
  return (
    <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--background)]/50 p-6 text-center">
      <div className="mb-2 flex justify-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <FaStar
            className={
              star <= rating ? "text-yellow-400" : "text-[var(--surface-muted)]"
            }
            key={star}
          />
        ))}
      </div>
      <p className="font-semibold text-[var(--foreground)] text-sm">
        You have already rated this ride
      </p>
      {comment ? (
        <p className="mt-2 text-[var(--text-muted)] text-sm">{comment}</p>
      ) : null}
    </div>
  );
}

export default function FeedbackPage() {
  const { sessionToken } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // The trip to rate. The payment page sends the one it just paid for, so
  // the passenger rates the trip they settled rather than whichever one
  // happens to be the newest.
  const searchParams = useSearchParams();
  const rideId = searchParams.get("ride") as Id<"rides"> | null;

  const ride = useQuery(
    api.rides.getLatestCompletedForMe,
    sessionToken ? { sessionToken, ...(rideId ? { rideId } : {}) } : "skip"
  );

  const driver = useQuery(
    api.operators.getForRide,
    sessionToken && ride?.operatorId
      ? { sessionToken, rideId: ride._id }
      : "skip"
  );

  const existing = useQuery(
    api.feedback.getForRide,
    sessionToken && ride ? { sessionToken, rideId: ride._id } : "skip"
  );

  // Every ride is rated afresh. The form starts empty whenever the ride it is
  // about changes, so nothing chosen for one trip is carried onto the next.
  const formRideId = ride?._id ?? null;
  useEffect(() => {
    if (formRideId === null) {
      return;
    }
    setRating(0);
    setFeedback("");
    setSelectedReasons([]);
    setSubmitting(false);
  }, [formRideId]);

  const createFeedback = useMutation(api.feedback.create);
  const dismissRatingPrompt = useMutation(api.rides.dismissRatingPrompt);

  const toggleReason = (reason: string) => {
    setSelectedReasons((prev) =>
      prev.includes(reason)
        ? prev.filter((r) => r !== reason)
        : [...prev, reason]
    );
  };

  const handleSubmitFeedback = async () => {
    if (!(ride && sessionToken) || rating === 0) {
      return;
    }
    setSubmitting(true);

    const comment = [selectedReasons.join(", "), feedback.trim()]
      .filter((part) => part.length > 0)
      .join(" — ");

    try {
      await createFeedback({
        sessionToken,
        rideId: ride._id,
        commuterId: ride.commuterId,
        rating,
        ...(comment.length > 0 ? { comment } : {}),
      });
      showToast("Thank you for your feedback!", "success");
      router.push("/map");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Could not submit feedback.",
        "error"
      );
      setSubmitting(false);
    }
  };

  // A ride can only be rated once. The page says so rather than letting the
  // submission fail with a raw error.
  const alreadyRated = existing !== undefined && existing !== null;

  // Rating is optional. Skipping is saved on the ride, so the dashboard does
  // not ask about this trip again.
  const handleSkip = async () => {
    if (ride && sessionToken && !alreadyRated) {
      try {
        await dismissRatingPrompt({ rideId: ride._id, sessionToken });
      } catch (error) {
        console.error("Could not skip the rating:", error);
      }
    }
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-[var(--background)] p-4">
      <div className="mx-auto max-w-md">
        <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)]/90 p-6 shadow-xl backdrop-blur">
          <div className="mb-6 text-center">
            <h1 className="mb-2 font-bold text-2xl text-[var(--foreground)]">
              Rate Your Ride
            </h1>
            <p className="text-[var(--text-muted)]">How was your experience?</p>
          </div>

          {ride ? null : <NothingToRate />}

          <div className="mb-6 flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--background)]/50 p-4">
            <div className="text-4xl">🛵</div>
            <div className="flex-1">
              <div className="font-semibold text-[var(--foreground)]">
                {driver?.name ?? "Your driver"}
              </div>
              <div className="text-[var(--text-muted)] text-sm">
                {driver?.vehicleInfo.model ?? "—"} •{" "}
                {driver?.vehicleInfo.plateNumber ?? "—"}
              </div>
              <div className="mt-1 flex items-center gap-1">
                <ErrorBoundary
                  fallback={
                    <span className="text-[var(--foreground)] text-sm">
                      New
                    </span>
                  }
                >
                  <DriverRating
                    operatorId={ride?.operatorId}
                    sessionToken={sessionToken}
                  />
                </ErrorBoundary>
              </div>
            </div>
          </div>

          {alreadyRated && existing ? (
            <AlreadyRated comment={existing.comment} rating={existing.rating} />
          ) : null}

          {alreadyRated ? null : (
            <StarRating onRate={setRating} rating={rating} />
          )}

          <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--background)]/50 p-4">
            <h3 className="mb-3 font-semibold text-[var(--foreground)] text-lg">
              What went well?
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {REASONS.map((reason) => (
                <button
                  aria-pressed={selectedReasons.includes(reason)}
                  className={`rounded-lg border p-3 text-sm transition-all ${
                    selectedReasons.includes(reason)
                      ? "border-sky-500 bg-sky-500/10 text-sky-400"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--border)]"
                  }`}
                  key={reason}
                  onClick={() => toggleReason(reason)}
                  type="button"
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--background)]/50 p-4">
            <h3 className="mb-3 font-semibold text-[var(--foreground)] text-lg">
              Additional Comments
            </h3>
            <textarea
              className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--foreground)] transition-colors placeholder:text-[var(--text-muted)] focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              onChange={(event) => setFeedback(event.target.value)}
              placeholder="Tell us more about your experience..."
              rows={3}
              value={feedback}
            />
          </div>

          {alreadyRated ? null : (
            <button
              className="w-full rounded-xl bg-sky-500 py-4 font-semibold text-white shadow-lg shadow-sky-500/20 transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={rating === 0 || submitting || !ride}
              onClick={handleSubmitFeedback}
              type="button"
            >
              {submitting ? "Submitting…" : "Submit Feedback"}
            </button>
          )}

          <button
            className="mt-3 min-h-11 w-full py-2 text-[var(--text-muted)] text-sm transition-colors hover:text-[var(--foreground)]"
            onClick={handleSkip}
            type="button"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
