"use client";

import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { useAuth } from "@/lib/authContext";

// Mirrors the list formerly enforced by src/middleware.ts. Middleware does not
// run in a static export (Capacitor build), so protection is enforced here on
// the client using the same auth state the app already validates against Convex.
const PROTECTED_ROUTES = [
  "/admin",
  "/operator",
  "/Commuters",
  "/map",
  "/payment",
  "/feedback",
];

function isProtected(pathname: string): boolean {
  return PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

export function RouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const protectedRoute = isProtected(pathname);

  useEffect(() => {
    if (protectedRoute && !isLoading && !user) {
      const loginUrl = `/login?redirect=${encodeURIComponent(pathname)}`;
      router.replace(loginUrl);
    }
  }, [protectedRoute, isLoading, user, pathname, router]);

  // Avoid flashing protected content before auth resolves / redirect fires.
  if (protectedRoute && (isLoading || !user)) {
    return null;
  }

  return <>{children}</>;
}
