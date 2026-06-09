"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useAuth } from "@/lib/authContext";

export default function SignupPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "commuter" as "commuter" | "operator",
    licenseNumber: "",
    plateNumber: "",
    model: "",
    color: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { signup } = useAuth();

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (!/[A-Z]/.test(formData.password)) {
      setError("Password must contain at least one uppercase letter");
      return;
    }
    if (!/[0-9]/.test(formData.password)) {
      setError("Password must contain at least one number");
      return;
    }

    if (
      formData.role === "operator" &&
      !(
        formData.licenseNumber &&
        formData.plateNumber &&
        formData.model &&
        formData.color
      )
    ) {
      setError("Please fill in all vehicle details");
      return;
    }

    setIsLoading(true);

    const result = await signup({
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      password: formData.password,
      role: formData.role,
      licenseNumber:
        formData.role === "operator" ? formData.licenseNumber : undefined,
      vehicleInfo:
        formData.role === "operator"
          ? {
              plateNumber: formData.plateNumber,
              model: formData.model,
              color: formData.color,
            }
          : undefined,
    });

    setIsLoading(false);

    if (result.success) {
      router.push("/login?registered=true");
    } else {
      setError(result.error || "Signup failed");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto">
        <div className="rounded-[2rem] border border-slate-800 bg-slate-900/90 p-8 shadow-slate-950/50 shadow-xl backdrop-blur">
          <div className="mb-8 text-center">
            <h1 className="font-bold text-3xl text-slate-50">HATUD</h1>
            <p className="mt-2 text-slate-400 text-sm">Create your account</p>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label
                className="mb-2 block font-medium text-slate-300 text-sm"
                htmlFor="role"
              >
                I am a
              </label>
              <select
                className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-slate-100 transition-colors focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                id="role"
                name="role"
                onChange={handleChange}
                value={formData.role}
              >
                <option value="commuter">Commuter</option>
                <option value="operator">Operator (Driver)</option>
              </select>
            </div>

            <div>
              <label
                className="mb-2 block font-medium text-slate-300 text-sm"
                htmlFor="name"
              >
                Full Name
              </label>
              <input
                className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-slate-100 transition-colors placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                id="name"
                name="name"
                onChange={handleChange}
                placeholder="Enter your full name"
                required
                type="text"
                value={formData.name}
              />
            </div>

            <div>
              <label
                className="mb-2 block font-medium text-slate-300 text-sm"
                htmlFor="email"
              >
                Email
              </label>
              <input
                className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-slate-100 transition-colors placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                id="email"
                name="email"
                onChange={handleChange}
                placeholder="Enter your email"
                required
                type="email"
                value={formData.email}
              />
            </div>

            <div>
              <label
                className="mb-2 block font-medium text-slate-300 text-sm"
                htmlFor="phone"
              >
                Phone Number
              </label>
              <input
                className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-slate-100 transition-colors placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                id="phone"
                name="phone"
                onChange={handleChange}
                placeholder="+63 9XX XXX XXXX"
                required
                type="tel"
                value={formData.phone}
              />
            </div>

            <div>
              <label
                className="mb-2 block font-medium text-slate-300 text-sm"
                htmlFor="password"
              >
                Password
              </label>
              <input
                className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-slate-100 transition-colors placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                id="password"
                name="password"
                onChange={handleChange}
                placeholder="Create a password"
                required
                type="password"
                value={formData.password}
              />
            </div>

            <div>
              <label
                className="mb-2 block font-medium text-slate-300 text-sm"
                htmlFor="confirmPassword"
              >
                Confirm Password
              </label>
              <input
                className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-slate-100 transition-colors placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                id="confirmPassword"
                name="confirmPassword"
                onChange={handleChange}
                placeholder="Confirm your password"
                required
                type="password"
                value={formData.confirmPassword}
              />
            </div>

            {formData.role === "operator" && (
              <div className="mt-4 border-slate-700 border-t pt-4">
                <h3 className="mb-4 font-semibold text-slate-300">
                  Vehicle Information
                </h3>

                <div className="space-y-4">
                  <div>
                    <label
                      className="mb-2 block font-medium text-slate-300 text-sm"
                      htmlFor="licenseNumber"
                    >
                      License Number
                    </label>
                    <input
                      className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-slate-100 transition-colors placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                      id="licenseNumber"
                      name="licenseNumber"
                      onChange={handleChange}
                      placeholder="DR-XXXX-XXXX"
                      required={formData.role === "operator"}
                      type="text"
                      value={formData.licenseNumber}
                    />
                  </div>

                  <div>
                    <label
                      className="mb-2 block font-medium text-slate-300 text-sm"
                      htmlFor="plateNumber"
                    >
                      Plate Number
                    </label>
                    <input
                      className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-slate-100 transition-colors placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                      id="plateNumber"
                      name="plateNumber"
                      onChange={handleChange}
                      placeholder="ABC 123"
                      required={formData.role === "operator"}
                      type="text"
                      value={formData.plateNumber}
                    />
                  </div>

                  <div>
                    <label
                      className="mb-2 block font-medium text-slate-300 text-sm"
                      htmlFor="model"
                    >
                      Vehicle Model
                    </label>
                    <input
                      className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-slate-100 transition-colors placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                      id="model"
                      name="model"
                      onChange={handleChange}
                      placeholder="Toyota Hilux"
                      required={formData.role === "operator"}
                      type="text"
                      value={formData.model}
                    />
                  </div>

                  <div>
                    <label
                      className="mb-2 block font-medium text-slate-300 text-sm"
                      htmlFor="color"
                    >
                      Vehicle Color
                    </label>
                    <input
                      className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-slate-100 transition-colors placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                      id="color"
                      name="color"
                      onChange={handleChange}
                      placeholder="White"
                      required={formData.role === "operator"}
                      type="text"
                      value={formData.color}
                    />
                  </div>
                </div>
              </div>
            )}

            <button
              className="mt-6 w-full rounded-xl bg-sky-500 py-3 font-semibold text-white shadow-lg shadow-sky-500/20 transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isLoading}
              type="submit"
            >
              {isLoading ? "Creating Account..." : "Create Account"}
            </button>

            <p className="mt-4 text-center text-slate-400 text-sm">
              Already have an account?{" "}
              <Link
                className="font-medium text-sky-400 transition-colors hover:text-sky-300"
                href="/login"
              >
                Log in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
