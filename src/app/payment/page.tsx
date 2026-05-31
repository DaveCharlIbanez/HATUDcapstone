"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FaCreditCard, FaGift, FaMoneyBill, FaWallet } from "react-icons/fa";

type PaymentMethod = "cash" | "card" | "wallet" | "promo";

export default function PaymentPage() {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("cash");
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const router = useRouter();

  const handleApplyPromo = () => {
    if (!promoCode.trim()) {
      alert("Please enter a promo code first.");
      return;
    }
    setPromoApplied(true);
    alert(`Promo code ${promoCode.toUpperCase()} applied!`);
  };

  const paymentMethods = [
    {
      id: "cash",
      name: "Cash",
      icon: <FaMoneyBill />,
      description: "Pay with cash to driver",
    },
    {
      id: "card",
      name: "Credit/Debit Card",
      icon: <FaCreditCard />,
      description: "Pay with card",
    },
    {
      id: "wallet",
      name: "Digital Wallet",
      icon: <FaWallet />,
      description: "Pay with wallet balance",
    },
    {
      id: "promo",
      name: "Promo Code",
      icon: <FaGift />,
      description: "Use promo code",
    },
  ];

  const rideDetails = {
    distance: "5.2 km",
    duration: "15 min",
    fare: 75,
    discount: 10,
    total: 65,
  };

  const handlePayment = () => {
    // Mock payment processing
    alert("Payment successful!");
    router.push("/feedback");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-md">
        {/* HEADER */}
        <div className="mb-4 rounded-lg bg-white p-4 shadow-sm">
          <h1 className="mb-2 font-semibold text-xl">Payment</h1>
          <div className="text-gray-600 text-sm">
            <div className="mb-1 flex justify-between">
              <span>Distance:</span>
              <span>{rideDetails.distance}</span>
            </div>
            <div className="mb-1 flex justify-between">
              <span>Duration:</span>
              <span>{rideDetails.duration}</span>
            </div>
            <div className="mb-1 flex justify-between">
              <span>Fare:</span>
              <span>₱{rideDetails.fare}</span>
            </div>
            <div className="mb-1 flex justify-between text-green-600">
              <span>Discount:</span>
              <span>-₱{rideDetails.discount}</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold text-lg">
              <span>Total:</span>
              <span>₱{rideDetails.total}</span>
            </div>
          </div>
        </div>

        {/* PAYMENT METHODS */}
        <div className="mb-4 rounded-lg bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold text-lg">Payment Method</h2>

          <div className="space-y-3">
            {paymentMethods.map((method) => (
              <button
                className={`w-full rounded-lg border-2 p-3 text-left transition-all ${
                  selectedMethod === method.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 bg-white"
                }`}
                key={method.id}
                onClick={() => setSelectedMethod(method.id as PaymentMethod)}
              >
                <div className="flex items-center gap-3">
                  <div className="text-gray-600 text-xl">{method.icon}</div>
                  <div>
                    <div className="font-medium">{method.name}</div>
                    <div className="text-gray-500 text-sm">
                      {method.description}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* CARD DETAILS */}
        {selectedMethod === "card" && (
          <div className="mb-4 rounded-lg bg-white p-4 shadow-sm">
            <h3 className="mb-3 font-semibold text-lg">Card Details</h3>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block font-medium text-sm">
                  Card Number
                </label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="1234 5678 9012 3456"
                  type="text"
                  value={cardNumber}
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block font-medium text-sm">
                    Expiry Date
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onChange={(e) => setExpiry(e.target.value)}
                    placeholder="MM/YY"
                    type="text"
                    value={expiry}
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block font-medium text-sm">CVV</label>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onChange={(e) => setCvv(e.target.value)}
                    placeholder="123"
                    type="text"
                    value={cvv}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* WALLET BALANCE */}
        {selectedMethod === "wallet" && (
          <div className="mb-4 rounded-lg bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Wallet Balance</div>
                <div className="text-gray-500 text-sm">Available: ₱500.00</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg">₱{rideDetails.total}</div>
                <div className="text-green-600 text-sm">Sufficient balance</div>
              </div>
            </div>
          </div>
        )}

        {/* PROMO CODE */}
        {selectedMethod === "promo" && (
          <div className="mb-4 rounded-lg bg-white p-4 shadow-sm">
            <h3 className="mb-3 font-semibold text-lg">Promo Code</h3>

            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="Enter promo code"
                type="text"
                value={promoCode}
              />
              <button
                className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
                onClick={handleApplyPromo}
                type="button"
              >
                Apply
              </button>
            </div>

            <div className="mt-3 text-gray-600 text-sm">
              {promoApplied
                ? "Applied: SAVE10 (-₱10)"
                : "Enter a code then press Apply."}
            </div>
          </div>
        )}

        {/* PAY BUTTON */}
        <button
          className="w-full rounded-lg bg-black py-4 font-semibold text-lg text-white transition-colors hover:bg-gray-800"
          onClick={handlePayment}
        >
          Pay ₱{rideDetails.total}
        </button>

        {/* BACK BUTTON */}
        <button
          className="mt-3 w-full text-gray-600 hover:text-gray-800"
          onClick={() => router.back()}
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
