"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FaStar } from "react-icons/fa";
import { useToast } from "@/components/Toast";

export default function FeedbackPage() {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [tip, setTip] = useState<number | null>(null);
  const router = useRouter();
  const { showToast } = useToast();

  const reasons = [
    "Clean vehicle",
    "Safe driving",
    "Friendly driver",
    "On time pickup",
    "Good conversation",
    "Helpful with luggage",
  ];

  const driver = {
    name: "Juan Dela Cruz",
    photo: "👨‍🚗",
    vehicle: "Toyota Vios",
    rating: 4.8,
  };

  const handleSubmitFeedback = () => {
    showToast("Thank you for your feedback!", "success");
    setTimeout(() => router.push("/Commuters"), 1000);
  };

  const toggleReason = (reason: string) => {
    setSelectedReasons((prev) =>
      prev.includes(reason)
        ? prev.filter((r) => r !== reason)
        : [...prev, reason]
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4">
      <div className="mx-auto max-w-md">
        <div className="rounded-[2rem] border border-slate-800 bg-slate-900/90 p-6 shadow-xl backdrop-blur">
          <div className="mb-6 text-center">
            <h1 className="mb-2 font-bold text-2xl text-slate-50">
              Rate Your Ride
            </h1>
            <p className="text-slate-400">How was your experience?</p>
          </div>

          <div className="mb-6 flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <div className="text-4xl">{driver.photo}</div>
            <div className="flex-1">
              <div className="font-semibold text-slate-100">{driver.name}</div>
              <div className="text-slate-400 text-sm">{driver.vehicle}</div>
              <div className="mt-1 flex items-center gap-1">
                <FaStar className="text-sm text-yellow-400" />
                <span className="text-slate-300 text-sm">{driver.rating}</span>
              </div>
            </div>
          </div>

          <div className="mb-6 rounded-xl border border-slate-800 bg-slate-950/50 p-6">
            <h3 className="mb-4 text-center font-semibold text-lg text-slate-200">
              Rate your driver
            </h3>
            <div className="mb-4 flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  className="text-3xl transition-colors hover:scale-110"
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                >
                  <FaStar
                    className={
                      star <= (hoverRating || rating)
                        ? "text-yellow-400"
                        : "text-slate-700"
                    }
                  />
                </button>
              ))}
            </div>
            <div className="text-center text-slate-400 text-sm">
              {rating === 1 && "Poor"}
              {rating === 2 && "Fair"}
              {rating === 3 && "Good"}
              {rating === 4 && "Very Good"}
              {rating === 5 && "Excellent"}
            </div>
          </div>

          <div className="mb-6 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <h3 className="mb-3 font-semibold text-lg text-slate-200">
              What went well?
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {reasons.map((reason) => (
                <button
                  className={`rounded-lg border p-3 text-sm transition-all ${
                    selectedReasons.includes(reason)
                      ? "border-sky-500 bg-sky-500/10 text-sky-400"
                      : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600"
                  }`}
                  key={reason}
                  onClick={() => toggleReason(reason)}
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <h3 className="mb-3 font-semibold text-lg text-slate-200">
              Additional Comments
            </h3>
            <textarea
              className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 transition-colors placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Tell us more about your experience..."
              rows={3}
              value={feedback}
            />
          </div>

          <div className="mb-6 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <h3 className="mb-3 font-semibold text-lg text-slate-200">
              Tip Your Driver
            </h3>
            <div className="flex gap-2">
              {[10, 20, 50, 100].map((amount) => (
                <button
                  className={`flex-1 rounded-lg border px-4 py-2 text-sm transition-colors ${
                    tip === amount
                      ? "border-sky-500 bg-sky-500/20 text-sky-400"
                      : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600"
                  }`}
                  key={amount}
                  onClick={() => setTip(amount)}
                  type="button"
                >
                  ₱{amount}
                </button>
              ))}
            </div>
            <div className="mt-3 text-center">
              <button
                className="text-sky-400 text-sm transition-colors hover:text-sky-300"
                onClick={() => setTip(null)}
                type="button"
              >
                No tip
              </button>
            </div>
          </div>

          <button
            className="w-full rounded-xl bg-sky-500 py-4 font-semibold text-white shadow-lg shadow-sky-500/20 transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={rating === 0}
            onClick={handleSubmitFeedback}
          >
            Submit Feedback
          </button>

          <button
            className="mt-3 w-full py-2 text-slate-500 text-sm transition-colors hover:text-slate-300"
            onClick={() => router.push("/Commuters")}
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
