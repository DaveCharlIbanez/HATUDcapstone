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
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-lg shadow-sm dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="text-lg font-semibold text-slate-950 dark:text-slate-100">
          Hatud
        </Link>
        <nav className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <Link href="/" className="rounded-full px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800">
            Home
          </Link>
          {isAdmin && (
            <Link href="/admin" className="rounded-full px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800">
              Admin
            </Link>
          )}
          {isOperator && (
            <Link href="/operator" className="rounded-full px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800">
              Operator
            </Link>
          )}
          {isCommuter && (
            <Link href="/Commuters" className="rounded-full px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800">
              Commuter
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
