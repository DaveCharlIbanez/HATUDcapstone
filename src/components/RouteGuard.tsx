"use client";

import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { FaSpinner } from "react-icons/fa";
import { useAuth } from "@/lib/authContext";

/**
 * The single client-side access gate.
 *
 * Middleware does not run in a static export (the Capacitor build), so route
 * protection lives here. Each route declares the role it needs; anything not
 * listed is open. Previously every page also carried its own `router.push`
 * role effect, which meant three separate fences had to agree.
 */
const ROUTE_ROLES: {
  prefix: string;
  role?: "admin" | "operator" | "commuter";
}[] = [
  { prefix: "/admin", role: "admin" },
  { prefix: "/operator", role: "operator" },
  { prefix: "/map", role: "commuter" },
  { prefix: "/profile", role: "commuter" },
  { prefix: "/payment", role: "commuter" },
  { prefix: "/feedback", role: "commuter" },
];

/** Where each role belongs. Operators live on the map, which is the single
 * operator dashboard. */
const ROLE_HOME: Record<string, string> = {
  admin: "/admin",
  operator: "/operator/map",
  commuter: "/map",
};

function matchRoute(pathname: string) {
  return ROUTE_ROLES.find(
    (route) =>
      pathname === route.prefix || pathname.startsWith(`${route.prefix}/`)
  );
}

export function RouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const route = matchRoute(pathname);
  const requiredRole = route?.role;

  useEffect(() => {
    if (isLoading || !route) {
      return;
    }
    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    if (requiredRole && user.role !== requiredRole) {
      router.replace(ROLE_HOME[user.role] ?? "/map");
    }
  }, [isLoading, route, requiredRole, user, pathname, router]);

  // Avoid flashing protected content before auth resolves / redirect fires.
  if (route && (isLoading || !user)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <FaSpinner className="animate-spin text-2xl text-sky-400" />
      </div>
    );
  }

  return <>{children}</>;
}
