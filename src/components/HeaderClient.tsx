"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function HeaderClient() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isLogin = pathname?.startsWith("/login");
  const isSignup = pathname?.startsWith("/signup");

  // Show header on all pages except home, login, and signup
  if (isHome || isLogin || isSignup) {
    return null;
  }

  const isAdmin = pathname?.startsWith("/admin");
  const isOperator = pathname?.startsWith("/operator");
  const isCommuter = pathname?.startsWith("/Commuters");

  return (
    <header className="sticky top-0 z-50 border-slate-200/70 border-b bg-white/80 shadow-sm backdrop-blur-lg dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <Link
          className="font-semibold text-lg text-slate-950 dark:text-slate-100"
          href="/"
        >
          Hatud
        </Link>
        <nav className="flex flex-wrap items-center gap-3 text-slate-600 text-sm dark:text-slate-300">
          <Link
            className="rounded-full px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"
            href="/"
          >
            Home
          </Link>
          {isAdmin && (
            <Link
              className="rounded-full px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"
              href="/admin"
            >
              Admin
            </Link>
          )}
          {isOperator && (
            <Link
              className="rounded-full px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"
              href="/operator"
            >
              Operator
            </Link>
          )}
          {isCommuter && (
            <Link
              className="rounded-full px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"
              href="/Commuters"
            >
              Commuter
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
