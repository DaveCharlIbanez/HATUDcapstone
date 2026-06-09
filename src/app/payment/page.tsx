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
    { id: "cash",   name: "Cash",              icon: <FaMoneyBill />,  description: "Pay with cash to driver" },
    { id: "card",   name: "Credit/Debit Card", icon: <FaCreditCard />, description: "Pay with card" },
    { id: "wallet", name: "Digital Wallet",    icon: <FaWallet />,     description: "Pay with wallet balance" },
    { id: "promo",  name: "Promo Code",        icon: <FaGift />,       description: "Use promo code" },
  ];

  const rideDetails = { distance: "5.2 km", duration: "15 min", fare: 75, discount: 10, total: 65 };

  const handlePayment = () => {
    alert("Payment successful!");
    router.push("/feedback");
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100">
      <div className="mx-auto max-w-md space-y-4">

        {/* RIDE SUMMARY */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h1 className="mb-4 font-bold text-xl text-white">Payment</h1>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-400">
              <span>Distance</span><span>{rideDetails.distance}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Duration</span><span>{rideDetails.duration}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Fare</span><span>₱{rideDetails.fare}</span>
            </div>
            <div className="flex justify-between text-emerald-400">
              <span>Discount</span><span>-₱{rideDetails.discount}</span>
            </div>
            <div className="flex justify-between border-slate-700 border-t pt-3 font-bold text-lg text-white">
              <span>Total</span><span>₱{rideDetails.total}</span>
            </div>
          </div>
        </div>

        {/* PAYMENT METHODS */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-4 font-semibold text-lg text-white">Payment Method</h2>
          <div className="space-y-3">
            {paymentMethods.map((method) => (
              <button
                className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
                  selectedMethod === method.id
                    ? "border-sky-500 bg-sky-500/10"
                    : "border-slate-700 bg-slate-800/50 hover:bg-slate-800"
                }`}
                key={method.id}
                onClick={() => setSelectedMethod(method.id as PaymentMethod)}
              >
                <div className="flex items-center gap-3">
                  <div className={`text-xl ${selectedMethod === method.id ? "text-sky-400" : "text-slate-400"}`}>
                    {method.icon}
                  </div>
                  <div>
                    <div className="font-medium text-slate-100">{method.name}</div>
                    <div className="text-slate-500 text-sm">{method.description}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* CARD DETAILS */}
        {selectedMethod === "card" && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h3 className="mb-4 font-semibold text-lg text-white">Card Details</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block font-medium text-slate-300 text-sm">Card Number</label>
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="1234 5678 9012 3456"
                  type="text"
                  value={cardNumber}
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block font-medium text-slate-300 text-sm">Expiry</label>
                  <input
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    onChange={(e) => setExpiry(e.target.value)}
                    placeholder="MM/YY"
                    type="text"
                    value={expiry}
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block font-medium text-slate-300 text-sm">CVV</label>
                  <input
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
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
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-100">Wallet Balance</div>
                <div className="text-slate-400 text-sm">Available: ₱500.00</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg text-sky-400">₱{rideDetails.total}</div>
                <div className="text-emerald-400 text-sm">Sufficient balance</div>
              </div>
            </div>
          </div>
        )}

        {/* PROMO CODE */}
        {selectedMethod === "promo" && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h3 className="mb-4 font-semibold text-lg text-white">Promo Code</h3>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="Enter promo code"
                type="text"
                value={promoCode}
              />
              <button
                className="rounded-xl bg-sky-500 px-4 py-2.5 font-semibold text-sm text-white transition hover:bg-sky-400"
                onClick={handleApplyPromo}
                type="button"
              >
                Apply
              </button>
            </div>
            <p className="mt-3 text-slate-400 text-sm">
              {promoApplied ? "✓ SAVE10 applied (-₱10)" : "Enter a code then press Apply."}
            </p>
          </div>
        )}

        {/* PAY BUTTON */}
        <button
          className="w-full rounded-2xl bg-sky-500 py-4 font-semibold text-lg text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400"
          onClick={handlePayment}
        >
          Pay ₱{promoApplied ? rideDetails.total - rideDetails.discount : rideDetails.total}
        </button>

        <button
          className="w-full py-2 text-slate-500 text-sm transition hover:text-slate-300"
          onClick={() => router.back()}
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
