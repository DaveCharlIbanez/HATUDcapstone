"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { FaFacebookF, FaGoogle } from "react-icons/fa6";
import { useAuth } from "@/lib/authContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { login, user } = useAuth();

  if (user) {
    router.push(
      `/${user.role === "admin" ? "admin" : user.role === "operator" ? "operator" : "Commuters"}`
    );
    return null;
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const result = await login(email, password);

    setIsLoading(false);

    if (result.success) {
      const role = user?.role || "commuter";
      router.push(
        `/${role === "admin" ? "admin" : role === "operator" ? "operator" : "Commuters"}`
      );
    } else {
      setError(result.error || "Login failed");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md">
        <div className="rounded-[2rem] border border-slate-800 bg-slate-900/90 p-8 shadow-slate-950/50 shadow-xl backdrop-blur">
          <div className="mb-8 text-center">
            <h1 className="font-bold text-3xl text-slate-50">HATUD</h1>
            <p className="mt-2 text-slate-400 text-sm">
              Sign in to your account
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
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
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                type="email"
                value={email}
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
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                type="password"
                value={password}
              />
            </div>

            <button
              className="w-full rounded-xl bg-sky-500 py-3 font-semibold text-white shadow-lg shadow-sky-500/20 transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isLoading}
              type="submit"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="my-6 flex items-center">
            <div className="h-px flex-grow bg-slate-700" />
            <span className="px-4 text-slate-500 text-sm">
              Or continue with
            </span>
            <div className="h-px flex-grow bg-slate-700" />
          </div>

          <div className="flex justify-center gap-4">
            <button
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 transition-all hover:scale-105 hover:bg-slate-700"
              type="button"
            >
              <FaGoogle className="text-red-400 text-xl" />
            </button>
            <button
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 transition-all hover:scale-105 hover:bg-slate-700"
              type="button"
            >
              <FaFacebookF className="text-blue-400 text-xl" />
            </button>
          </div>

          <p className="mt-6 text-center text-slate-400 text-sm">
            Don&apos;t have an account?{" "}
            <Link
              className="font-medium text-sky-400 transition-colors hover:text-sky-300"
              href="/signup"
            >
              Sign up
            </Link>
          </p>

          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-slate-500 text-xs">
            <p className="mb-2 font-semibold text-slate-400">Demo Accounts:</p>
            <p>Admin: admin@hatud.com / 123456789</p>
            <p>Commuter: commuter1@hatud.com / password123</p>
            <p>Operator: operator1@hatud.com / password123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
