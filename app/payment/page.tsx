"use client";

import { useState } from "react";
import { FaCreditCard, FaMoneyBill, FaWallet, FaGift } from "react-icons/fa";
import { useRouter } from "next/navigation";

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
    { id: "cash", name: "Cash", icon: <FaMoneyBill />, description: "Pay with cash to driver" },
    { id: "card", name: "Credit/Debit Card", icon: <FaCreditCard />, description: "Pay with card" },
    { id: "wallet", name: "Digital Wallet", icon: <FaWallet />, description: "Pay with wallet balance" },
    { id: "promo", name: "Promo Code", icon: <FaGift />, description: "Use promo code" },
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
      <div className="max-w-md mx-auto">

        {/* HEADER */}
        <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
          <h1 className="text-xl font-semibold mb-2">Payment</h1>
          <div className="text-sm text-gray-600">
            <div className="flex justify-between mb-1">
              <span>Distance:</span>
              <span>{rideDetails.distance}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span>Duration:</span>
              <span>{rideDetails.duration}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span>Fare:</span>
              <span>₱{rideDetails.fare}</span>
            </div>
            <div className="flex justify-between mb-1 text-green-600">
              <span>Discount:</span>
              <span>-₱{rideDetails.discount}</span>
            </div>
            <div className="flex justify-between font-semibold text-lg border-t pt-2">
              <span>Total:</span>
              <span>₱{rideDetails.total}</span>
            </div>
          </div>
        </div>

        {/* PAYMENT METHODS */}
        <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-3">Payment Method</h2>

          <div className="space-y-3">
            {paymentMethods.map((method) => (
              <button
                key={method.id}
                onClick={() => setSelectedMethod(method.id as PaymentMethod)}
                className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                  selectedMethod === method.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="text-xl text-gray-600">{method.icon}</div>
                  <div>
                    <div className="font-medium">{method.name}</div>
                    <div className="text-sm text-gray-500">{method.description}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* CARD DETAILS */}
        {selectedMethod === "card" && (
          <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
            <h3 className="text-lg font-semibold mb-3">Card Details</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Card Number</label>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="1234 5678 9012 3456"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">Expiry Date</label>
                  <input
                    type="text"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    placeholder="MM/YY"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">CVV</label>
                  <input
                    type="text"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value)}
                    placeholder="123"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* WALLET BALANCE */}
        {selectedMethod === "wallet" && (
          <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium">Wallet Balance</div>
                <div className="text-sm text-gray-500">Available: ₱500.00</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">₱{rideDetails.total}</div>
                <div className="text-sm text-green-600">Sufficient balance</div>
              </div>
            </div>
          </div>
        )}

        {/* PROMO CODE */}
        {selectedMethod === "promo" && (
          <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
            <h3 className="text-lg font-semibold mb-3">Promo Code</h3>

            <div className="flex gap-2">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="Enter promo code"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
              type="button"
              onClick={handleApplyPromo}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
                Apply
            </button>
            </div>

            <div className="mt-3 text-sm text-gray-600">
              {promoApplied ? `Applied: SAVE10 (-₱10)` : "Enter a code then press Apply."}
            </div>
          </div>
        )}

        {/* PAY BUTTON */}
        <button
          onClick={handlePayment}
          className="w-full bg-black text-white py-4 rounded-lg font-semibold text-lg hover:bg-gray-800 transition-colors"
        >
          Pay ₱{rideDetails.total}
        </button>

        {/* BACK BUTTON */}
        <button
          onClick={() => router.back()}
          className="w-full mt-3 text-gray-600 hover:text-gray-800"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}