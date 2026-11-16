"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { FaArrowLeft, FaFacebookF, FaGoogle } from "react-icons/fa6";
import { AppLoader } from "@/components/AppLoader";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/authContext";
import { homeForRole } from "@/lib/roles";
import { RouteStage, useRouteTransition } from "@/lib/routeTransition";

const ROLE_ROUTES: { prefix: string; role: string }[] = [
  { prefix: "/admin", role: "admin" },
  { prefix: "/operator", role: "operator" },
  { prefix: "/map", role: "commuter" },
  { prefix: "/profile", role: "commuter" },
  { prefix: "/payment", role: "commuter" },
  { prefix: "/feedback", role: "commuter" },
];

function isAllowedForRole(path: string, role: string): boolean {
  const route = ROLE_ROUTES.find(
    (candidate) =>
      path === candidate.prefix || path.startsWith(`${candidate.prefix}/`)
  );
  return route?.role === role;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, user } = useAuth();
  const { showToast } = useToast();
  // fixoct50: the back button pops this page off and the landing page slides
  // back in underneath.
  const { go, leaving } = useRouteTransition(["/"]);

  // The route the visitor was trying to reach before being sent here. It is
  // only honoured when the signed-in role is allowed to use it.
  const redirectTo = searchParams.get("redirect");

  // Redirect already-authenticated users away from the login page
  useEffect(() => {
    if (!user) {
      return;
    }
    if (redirectTo && isAllowedForRole(redirectTo, user.role)) {
      router.replace(redirectTo);
      return;
    }
    router.replace(homeForRole(user.role));
  }, [user, redirectTo, router]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const result = await login(email, password);

    setIsLoading(false);

    if (!result.success) {
      setError(result.error || "Login failed");
    }
    // Navigation is handled reactively by the useEffect above once `user` is set
  };

  return (
    <RouteStage leaving={leaving}>
      <div className="relative flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
        {/* A dedicated way back to the landing page, clear of the notch. */}
        <button
          aria-label="Back to the HATUD home page"
          className="group absolute top-[calc(env(safe-area-inset-top,0px)+1rem)] left-4 z-10 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)]/90 py-2 pr-4 pl-3 font-semibold text-[var(--foreground)] text-sm shadow-lg shadow-slate-950/10 backdrop-blur transition-[transform,background-color] duration-200 hover:bg-[var(--surface-strong)] active:scale-95 motion-reduce:transition-none"
          onClick={() => go("/", "back")}
          type="button"
        >
          <FaArrowLeft
            aria-hidden="true"
            className="text-sky-500 transition-transform duration-200 group-hover:-translate-x-0.5 motion-reduce:transition-none"
          />
          Back
        </button>
        <div className="w-full max-w-md">
          <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)]/90 p-8 shadow-slate-950/50 shadow-xl backdrop-blur">
            <div className="mb-8 text-center">
              <h1 className="font-bold text-4xl text-[var(--foreground)] tracking-tight">
                HATUD
              </h1>
              <p className="mt-2 text-[var(--text-muted)] text-sm">
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
                  className="mb-2 block font-medium text-[var(--foreground)] text-sm"
                  htmlFor="email"
                >
                  Email
                </label>
                <input
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)]/50 px-4 py-3 text-[var(--foreground)] transition-colors placeholder:text-[var(--text-muted)] focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
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
                  className="mb-2 block font-medium text-[var(--foreground)] text-sm"
                  htmlFor="password"
                >
                  Password
                </label>
                <input
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)]/50 px-4 py-3 text-[var(--foreground)] transition-colors placeholder:text-[var(--text-muted)] focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
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
                {isLoading ? (
                  <AppLoader label="Signing in" variant="inline" />
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            <div className="my-6 flex items-center">
              <div className="h-px flex-grow bg-[var(--surface-muted)]" />
              <span className="px-4 text-[var(--text-muted)] text-sm">
                Or continue with
              </span>
              <div className="h-px flex-grow bg-[var(--surface-muted)]" />
            </div>

            <div className="flex justify-center gap-4">
              <button
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] transition-all hover:scale-105 hover:bg-[var(--surface-muted)]"
                onClick={() => showToast("Social login coming soon.", "info")}
                type="button"
              >
                <FaGoogle className="text-red-400 text-xl" />
              </button>
              <button
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] transition-all hover:scale-105 hover:bg-[var(--surface-muted)]"
                onClick={() => showToast("Social login coming soon.", "info")}
                type="button"
              >
                <FaFacebookF className="text-blue-400 text-xl" />
              </button>
            </div>

            <p className="mt-6 text-center text-[var(--text-muted)] text-sm">
              Don&apos;t have an account?{" "}
              <Link
                className="font-medium text-sky-400 transition-colors hover:text-sky-300"
                href="/signup"
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </RouteStage>
  );
}
