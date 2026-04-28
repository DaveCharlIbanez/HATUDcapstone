'use client'

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"

export default function SignupPage() {
  const [phone, setPhone] = useState("")
  const [otp, setOtp] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [step, setStep] = useState<"details" | "otp">("details")
  const router = useRouter()

  const handleSendOtp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    // Mock OTP send - in real app, integrate with SMS service
    alert(`OTP sent to ${phone}: 123456`)
    setStep("otp")
  }

  const handleVerifyOtp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (otp === "123456") { // Mock verification
      // Mock user creation
      alert("Account created successfully!")
      router.push("/login")
    } else {
      alert("Invalid OTP")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-300 to-blue-100 p-4">
      <form
        onSubmit={step === "details" ? handleSendOtp : handleVerifyOtp}
        className="bg-white p-6 rounded-lg shadow-lg w-full max-w-sm"
      >
        <h2 className="text-2xl text-gray-700 font-bold mb-6 text-center">HATUD</h2>

        {step === "details" ? (
          <>
            <div className="mb-4">
              <label htmlFor="name" className="block text-gray-600 mb-2">Full Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="mb-4">
              <label htmlFor="email" className="block text-gray-600 mb-2">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="mb-4">
              <label htmlFor="phone" className="block text-gray-600 mb-2">Phone Number</label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+63 9XX XXX XXXX"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
              Send OTP
            </button>
          </>
        ) : (
          <>
            <div className="mb-4">
              <label htmlFor="otp" className="block text-gray-600 mb-2">Enter OTP</label>
              <input
                id="otp"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter 6-digit code"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
              Verify & Sign Up
            </button>
            <button
              type="button"
              onClick={() => setStep("details")}
              className="w-full mt-2 text-blue-500 hover:underline"
            >
              Change Details
            </button>
          </>
        )}

        <p className="text-center text-sm text-gray-600 mt-4">
          Already have an account?{" "}
          <a href="/login" className="text-blue-500 hover:underline">
            Log in
          </a>
        </p>
      </form>
    </div>
  )
}         