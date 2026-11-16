"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import { homeForRole } from "@/lib/roles";
import { AppMenuButton } from "./AppShell";
import { ThemeToggle } from "./ThemeToggle";

export default function HeaderClient() {
  const pathname = usePathname();
  const { user } = useAuth();

  // Full-screen map pages that have their own in-page floating header.
  const fullScreenMapRoutes = new Set(["/operator", "/operator/map", "/map"]);

  const hideGlobalHeader =
    pathname === "/" ||
    pathname?.startsWith("/login") ||
    pathname?.startsWith("/signup") ||
    (pathname != null && fullScreenMapRoutes.has(pathname));

  // Show header on document-style pages only (profiles, admin, payment, feedback)
  if (hideGlobalHeader) {
    return null;
  }

  const isAdmin = pathname?.startsWith("/admin");
  const isOperator = pathname?.startsWith("/operator");
  const isCommuter = pathname === "/map" || pathname === "/profile";

  // The wordmark is the way back into the app, so it goes to the signed-in
  // user's own dashboard rather than to the landing page.
  const brandHref = user ? homeForRole(user.role) : "/";

  return (
    <header className="sticky top-0 z-50 border-[var(--border)] border-b bg-[var(--surface-strong)]/80 shadow-sm backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
        <AppMenuButton />
        <Link
          className="font-bold text-2xl text-[var(--foreground)] tracking-tight"
          href={brandHref}
        >
          Hatud
        </Link>
        <nav className="flex flex-wrap items-center gap-3 text-[var(--text-muted)] text-sm">
          {isAdmin && (
            <Link
              className="rounded-full px-4 py-2 hover:bg-[var(--surface-muted)]"
              href="/admin"
            >
              Admin
            </Link>
          )}
          {isOperator && (
            <Link
              className="rounded-full px-4 py-2 hover:bg-[var(--surface-muted)]"
              href="/operator/map"
            >
              Operator
            </Link>
          )}
          {isCommuter && (
            <Link
              className="rounded-full px-4 py-2 hover:bg-[var(--surface-muted)]"
              href="/map"
            >
              Commuter
            </Link>
          )}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
