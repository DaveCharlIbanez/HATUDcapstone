"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

export default function HeaderClient() {
  const pathname = usePathname();

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

  return (
    <header className="sticky top-0 z-50 border-[var(--border)] border-b bg-[var(--surface-strong)]/80 shadow-sm backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <Link
          className="font-semibold text-[var(--foreground)] text-lg"
          href="/"
        >
          Hatud
        </Link>
        <nav className="flex flex-wrap items-center gap-3 text-[var(--text-muted)] text-sm">
          <Link
            className="rounded-full px-4 py-2 hover:bg-[var(--surface-muted)]"
            href="/"
          >
            Home
          </Link>
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
              href="/operator"
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
