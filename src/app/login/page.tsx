"use client"

import Link from "next/link"
import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { FaGoogle, FaFacebookF } from "react-icons/fa6"

export default function LoginPage() {
  const [phone, setPhone] = useState("")
  const [otp, setOtp] = useState("")
  const [step, setStep] = useState<"phone" | "otp">("phone")
  const router = useRouter()

  const handleSendOtp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    alert(`OTP sent to ${phone}: 123456`)
    setStep("otp")
  }

  const handleVerifyOtp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (otp === "123456") { 
      router.push("/Commuters")
    } else {
      alert("Invalid OTP")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-300 to-blue-100 p-4">
      <form
        onSubmit={step === "phone" ? handleSendOtp : handleVerifyOtp}
        className="bg-white p-6 rounded-lg shadow-lg w-full max-w-sm"
      >
        <h2 className="text-2xl text-gray-700 font-bold mb-6 text-center">HATUD</h2>

        {step === "phone" ? (
          <>
            <div className="mb-4 text-black-600">
              <label htmlFor="phone" className="block text-gray-600 mb-2">Phone Number</label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter your phone"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black-600"
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
              Verify & Login
            </button>
            <button
              type="button"
              onClick={() => setStep("phone")}
              className="w-full mt-2 text-blue-500 hover:underline"
            >
              Change Phone Number
            </button>
          </>
        )}

        <div className="flex items-center my-6">
          <div className="flex-grow h-px bg-gray-300"></div>
          <span className="px-4 text-gray-500 text-sm">Or</span>
          <div className="flex-grow h-px bg-gray-300"></div>
        </div>

        <div className="flex justify-center gap-6">
          <button className="w-10 h-10 flex items-center justify-center rounded-full bg-white shadow hover:scale-110 transition">
            <FaGoogle className="text-red-500" />
          </button>
          <button className="w-10 h-10 flex items-center justify-center rounded-full bg-white shadow hover:scale-110 transition">
            <FaFacebookF className="text-blue-600" />
          </button>
        </div>

        <p className="text-center text-sm text-gray-600 mt-4">
          Don't have an account?{" "}
          <Link href="/signup" className="text-blue-500 hover:underline">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  )
}