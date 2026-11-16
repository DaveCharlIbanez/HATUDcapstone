"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/lib/authContext";
import { AppDrawer } from "./AppDrawer";
import { AppLoader } from "./AppLoader";

interface AppShellValue {
  close: () => void;
  /** Opens a screen, with the loading beat in between. */
  navigate: (href: string) => void;
  open: () => void;
}

const AppShellContext = createContext<AppShellValue | null>(null);

/**
 * The drawer, for the screen that needs to open it.
 */
export function useAppShell(): AppShellValue {
  const value = useContext(AppShellContext);
  if (!value) {
    throw new Error("useAppShell must be used inside the app shell");
  }
  return value;
}

/** The routes that belong to a visitor rather than to the app. */
const PUBLIC_ROUTES = ["/", "/login", "/signup"];

/**
 * How long the loading beat lasts before the screen changes.
 *
 * Long enough to read as a transition rather than a flicker, and short enough
 * that the app still feels quick.
 */
const NAVIGATION_BEAT_MS = 420;

/**
 * The frame the whole app sits in.
 *
 * The drawer is the app's one navigation model: it opens over whatever screen
 * the user is on, and it is not rendered at all for a visitor who has not
 * signed in. The public pages keep their own layout.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  /** Where the loading beat is taking us, if it is taking us anywhere. */
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname?.startsWith(`${route}/`)
  );

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const navigate = useCallback(
    (href: string) => {
      setIsOpen(false);
      setNavigatingTo(href);
      window.setTimeout(() => {
        router.push(href);
      }, NAVIGATION_BEAT_MS);
    },
    [router]
  );

  // The beat ends when the screen has actually changed.
  useEffect(() => {
    if (navigatingTo && pathname === navigatingTo) {
      setNavigatingTo(null);
    }
  }, [navigatingTo, pathname]);

  // A navigation that never lands must not leave the loader on the screen.
  useEffect(() => {
    if (!navigatingTo) {
      return;
    }
    const timer = window.setTimeout(() => setNavigatingTo(null), 4000);
    return () => window.clearTimeout(timer);
  }, [navigatingTo]);

  // Escape closes it, the way a drawer is expected to behave.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close, isOpen]);

  const value = useMemo(
    () => ({ close, navigate, open }),
    [close, navigate, open]
  );
  const showsDrawer = Boolean(user) && !isLoading && !isPublic;

  return (
    <AppShellContext.Provider value={value}>
      {children}
      {showsDrawer ? (
        <AppDrawer isOpen={isOpen} onClose={close} pathname={pathname} />
      ) : null}
      {navigatingTo ? (
        <div className="fixed inset-0 z-[80] bg-[var(--background)]">
          <AppLoader label="Loading" variant="full" />
        </div>
      ) : null}
    </AppShellContext.Provider>
  );
}

/**
 * The button that opens the drawer.
 *
 * It is the same button on every screen, so it is the same component with the
 * same size and the same behaviour. Where it sits is the caller's business —
 * inside the header on the document screens, floating on the maps, which carry
 * their own chrome.
 */
export function AppMenuButton({
  className = "",
  label = "Open the menu",
}: {
  className?: string;
  label?: string;
}) {
  const { open } = useAppShell();

  return (
    <button
      aria-label={label}
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)]/95 text-[var(--foreground)] shadow-lg backdrop-blur transition-colors hover:bg-[var(--surface-strong)] ${className}`}
      onClick={open}
      type="button"
    >
      <span aria-hidden="true" className="flex flex-col gap-[5px]">
        <span className="block h-[2px] w-5 rounded-full bg-current" />
        <span className="block h-[2px] w-5 rounded-full bg-current" />
        <span className="block h-[2px] w-5 rounded-full bg-current" />
      </span>
    </button>
  );
}
