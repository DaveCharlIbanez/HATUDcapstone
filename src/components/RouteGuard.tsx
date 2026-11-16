"use client";

import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { AppLoader } from "@/components/AppLoader";
import { useAuth } from "@/lib/authContext";
import { ROLE_HOME } from "@/lib/roles";

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
  /** "any" means the route is for every signed-in role. */
  role?: "admin" | "any" | "operator" | "commuter";
}[] = [
  { prefix: "/admin", role: "admin" },
  { prefix: "/operator", role: "operator" },
  { prefix: "/map", role: "commuter" },
  { prefix: "/profile", role: "commuter" },
  { prefix: "/payment", role: "commuter" },
  { prefix: "/feedback", role: "commuter" },
  // The shell's own pages are for everybody who is signed in.
  { prefix: "/dashboard", role: "any" },
  { prefix: "/settings", role: "any" },
  { prefix: "/help", role: "any" },
];

/** Where each role belongs. Everyone lands on the dashboard, and the map is
 * one tap away in the drawer. */

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
    if (requiredRole && requiredRole !== "any" && user.role !== requiredRole) {
      router.replace(ROLE_HOME[user.role] ?? "/dashboard");
    }
  }, [isLoading, route, requiredRole, user, pathname, router]);

  // Avoid flashing protected content before auth resolves / redirect fires.
  if (route && (isLoading || !user)) {
    return <AppLoader variant="full" />;
  }

  return <>{children}</>;
}
