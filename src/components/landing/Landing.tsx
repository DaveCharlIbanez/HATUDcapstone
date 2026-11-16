"use client";

import Link from "next/link";
import { type MouseEvent, useState } from "react";
import { FaMapMarkerAlt, FaRoute, FaWallet } from "react-icons/fa";
import { RouteStage, useRouteTransition } from "@/lib/routeTransition";
import { HatudLogo } from "../HatudLogo";
import { TechStack } from "./TechStack";

const FEATURES = [
  {
    icon: <FaMapMarkerAlt />,
    line: "Pick a landmark or search any address.",
    title: "Pickup & drop-off",
  },
  {
    icon: <FaRoute />,
    line: "Follow your driver along the road in real time.",
    title: "Live tracking",
  },
  {
    icon: <FaWallet />,
    line: "Cash or online — choose before you book.",
    title: "Pay your way",
  },
];

/** Items before the tech grid: the tagline, then one per feature card. */
const TECH_START_INDEX = FEATURES.length + 2;

/**
 * The landing page: HATUD, raised in the middle of the screen.
 *
 * Tapping the wordmark lifts it into the header and eases the story of the
 * app in below it — what it does, and what it is built with. Tapping it again
 * puts it back.
 *
 * Nothing is mounted on reveal and nothing reflows: the content is always
 * there, hidden, and the wordmark only moves by `transform`. Every animation
 * is `transform` and `opacity`, so it stays smooth on low-end phones, and
 * with reduced motion only the fade is kept. See `.landing` in `globals.css`.
 */
export function Landing() {
  const [revealed, setRevealed] = useState(false);
  // fixoct50: Sign In and Sign Up push the next page in with motion.
  const { go, leaving } = useRouteTransition(["/login", "/signup"]);

  /** A plain click slides; a new-tab or modified click is left alone. */
  const pushTo = (href: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.button !== 0
    ) {
      return;
    }
    event.preventDefault();
    go(href, "forward");
  };

  return (
    <RouteStage leaving={leaving}>
      <div
        className="landing relative h-[100dvh] overflow-hidden bg-[var(--background)] text-[var(--foreground)]"
        data-state={revealed ? "revealed" : "idle"}
      >
        <div aria-hidden="true" className="landing-aurora">
          <span className="landing-blob landing-blob-a" />
          <span className="landing-blob landing-blob-b" />
          <span className="landing-blob landing-blob-c" />
        </div>

        <button
          aria-controls="landing-about"
          aria-expanded={revealed}
          aria-label={revealed ? "Hide about HATUD" : "About HATUD"}
          className="landing-wordmark"
          onClick={() => setRevealed((value) => !value)}
          type="button"
        >
          <span className="landing-wordmark-float">
            {/* The logo, in place of the gradient "HATUD" text. The button's
              label already names it, so the image itself is decorative. */}
            <HatudLogo className="landing-logo" decorative priority />
            <span aria-hidden="true" className="landing-wordmark-shadow" />
          </span>
        </button>

        <p aria-hidden={revealed} className="landing-hint">
          Tap to explore
        </p>

        <section
          aria-hidden={!revealed}
          aria-label="About HATUD"
          className="landing-about"
          id="landing-about"
          inert={!revealed}
        >
          <div className="mx-auto max-w-3xl space-y-5 px-4 pb-8 sm:px-6">
            <p
              className="landing-reveal text-center text-[var(--text-muted)] text-sm uppercase tracking-[0.3em]"
              style={{ "--i": 0 } as React.CSSProperties}
            >
              Ride booking for Antique
            </p>
            <h1
              className="landing-reveal text-balance text-center font-semibold text-2xl tracking-tight sm:text-3xl"
              style={{ "--i": 1 } as React.CSSProperties}
            >
              Book a ride across San Jose and Sibalom, follow your driver to
              your door, and pay your way.
            </h1>

            <ul className="grid gap-2.5 sm:grid-cols-3">
              {FEATURES.map((feature, index) => (
                <li
                  className="landing-reveal flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-3 backdrop-blur sm:block sm:p-4"
                  key={feature.title}
                  style={{ "--i": index + 2 } as React.CSSProperties}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-500 sm:mb-2">
                    {feature.icon}
                  </span>
                  <span className="block min-w-0">
                    <span className="block font-semibold text-sm">
                      {feature.title}
                    </span>
                    <span className="mt-0.5 block text-[var(--text-muted)] text-xs">
                      {feature.line}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <h2
              className="landing-reveal pt-2 text-center font-semibold text-[var(--text-muted)] text-xs uppercase tracking-[0.3em]"
              style={{ "--i": TECH_START_INDEX - 1 } as React.CSSProperties}
            >
              Built with
            </h2>
            <TechStack startIndex={TECH_START_INDEX} />
          </div>
        </section>

        <div className="landing-actions">
          <Link
            className="flex-1 rounded-full bg-[var(--btn-primary)] px-6 py-3 text-center font-semibold text-sm text-white shadow-lg shadow-sky-500/20 transition hover:bg-[var(--btn-primary-hover)]"
            href="/login"
            onClick={pushTo("/login")}
          >
            Sign In
          </Link>
          <Link
            className="flex-1 rounded-full border border-[var(--border)] bg-[var(--surface)]/80 px-6 py-3 text-center font-semibold text-sm backdrop-blur transition hover:bg-[var(--surface-muted)]"
            href="/signup"
            onClick={pushTo("/signup")}
          >
            Sign Up
          </Link>
        </div>
      </div>
    </RouteStage>
  );
}
