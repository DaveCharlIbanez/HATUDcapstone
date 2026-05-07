"use client";

import { useState } from "react";
import { FaStar, FaThumbsUp, FaComment } from "react-icons/fa";
import { useRouter } from "next/navigation";

export default function FeedbackPage() {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [tip, setTip] = useState<number | null>(null);
  const router = useRouter();

  const reasons = [
    "Clean vehicle",
    "Safe driving",
    "Friendly driver",
    "On time pickup",
    "Good conversation",
    "Helpful with luggage"
  ];

  const driver = {
    name: "Juan Dela Cruz",
    photo: "👨‍🚗",
    vehicle: "Toyota Vios",
    rating: 4.8
  };

  const handleSubmitFeedback = () => {
    // Mock feedback submission
    alert("Thank you for your feedback!");
    router.push("/Commuters");
  };

  const toggleReason = (reason: string) => {
    setSelectedReasons(prev =>
      prev.includes(reason)
        ? prev.filter(r => r !== reason)
        : [...prev, reason]
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">

        {/* HEADER */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-2">Rate Your Ride</h1>
          <p className="text-gray-600">How was your experience?</p>
        </div>

        {/* DRIVER INFO */}
        <div className="bg-white rounded-lg p-4 mb-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="text-4xl">{driver.photo}</div>
            <div className="flex-1">
              <div className="font-semibold">{driver.name}</div>
              <div className="text-sm text-gray-600">{driver.vehicle}</div>
              <div className="flex items-center gap-1 mt-1">
                <FaStar className="text-yellow-400 text-sm" />
                <span className="text-sm">{driver.rating}</span>
              </div>
            </div>
          </div>
        </div>

        {/* RATING */}
        <div className="bg-white rounded-lg p-6 mb-6 shadow-sm text-center">
          <h3 className="text-lg font-semibold mb-4">Rate your driver</h3>

          <div className="flex justify-center gap-2 mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="text-3xl transition-colors"
              >
                <FaStar
                  className={`${
                    star <= (hoverRating || rating)
                      ? "text-yellow-400"
                      : "text-gray-300"
                  }`}
                />
              </button>
            ))}
          </div>

          <div className="text-sm text-gray-600">
            {rating === 1 && "Poor"}
            {rating === 2 && "Fair"}
            {rating === 3 && "Good"}
            {rating === 4 && "Very Good"}
            {rating === 5 && "Excellent"}
          </div>
        </div>

        {/* POSITIVE FEEDBACK */}
        <div className="bg-white rounded-lg p-4 mb-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-3">What went well?</h3>

          <div className="grid grid-cols-2 gap-2">
            {reasons.map((reason) => (
              <button
                key={reason}
                onClick={() => toggleReason(reason)}
                className={`p-3 rounded-lg border text-sm transition-all ${
                  selectedReasons.includes(reason)
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-white text-gray-700"
                }`}
              >
                {reason}
              </button>
            ))}
          </div>
        </div>

        {/* ADDITIONAL COMMENTS */}
        <div className="bg-white rounded-lg p-4 mb-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-3">Additional Comments</h3>

          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Tell us more about your experience..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* TIPS */}
        <div className="bg-white rounded-lg p-4 mb-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-3">Tip Your Driver</h3>

          <div className="flex gap-2">
            {[10, 20, 50, 100].map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setTip(amount)}
                className={`flex-1 py-2 px-4 border rounded-lg transition-colors ${
                  tip === amount ? "border-blue-500 bg-blue-100 text-blue-700" : "border-gray-300 bg-white text-gray-700 hover:border-blue-500 hover:bg-blue-50"
                }`}
              >
                ₱{amount}
              </button>
            ))}
          </div>

          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={() => setTip(null)}
              className="text-blue-500 hover:underline text-sm"
            >
              No tip
            </button>
          </div>
        </div>

        {/* SUBMIT BUTTON */}
        <button
          onClick={handleSubmitFeedback}
          disabled={rating === 0}
          className="w-full bg-black text-white py-4 rounded-lg font-semibold text-lg hover:bg-gray-800 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Submit Feedback
        </button>

        {/* SKIP */}
        <button
          onClick={() => router.push("/Commuters")}
          className="w-full mt-3 text-gray-600 hover:text-gray-800 text-sm"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}