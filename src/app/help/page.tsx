"use client";

import Link from "next/link";
import { useState } from "react";
import { FaChevronDown } from "react-icons/fa";
import { HELP } from "@/lib/help";

/**
 * One question, with its answer.
 *
 * The answer is collapsed until it is asked for, so the page reads as a list
 * rather than a wall.
 */
function FaqEntry({ answer, question }: { answer: string; question: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-[var(--border)] border-b last:border-b-0">
      <button
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 py-4 text-left"
        onClick={() => setIsOpen((previous) => !previous)}
        type="button"
      >
        <span className="font-medium text-[var(--foreground)]">{question}</span>
        <FaChevronDown
          className={`shrink-0 text-[var(--text-muted)] transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {isOpen ? (
        <p className="pb-4 text-[var(--text-muted)] text-sm">{answer}</p>
      ) : null}
    </div>
  );
}

/**
 * Help for the app.
 *
 * The content is written from what the app actually does — the fare, the two
 * legs of the route, the fifteen-minute request, the terms — so it cannot
 * drift away from the behaviour it describes.
 */
export default function HelpPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <h1 className="font-bold text-2xl text-[var(--foreground)]">Help</h1>
          <p className="mt-1 text-[var(--text-muted)] text-sm">
            How HATUD works, and answers to the things people ask.
          </p>
        </header>

        {HELP.sections.map((section) => (
          <section
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-5"
            key={section.heading}
          >
            <h2 className="font-semibold text-[var(--foreground)]">
              {section.heading}
            </h2>
            <div className="mt-3 space-y-5">
              {section.entries.map((entry) => (
                <div key={entry.heading}>
                  <h3 className="font-medium text-[var(--foreground)] text-sm">
                    {entry.heading}
                  </h3>
                  {entry.body.map((paragraph) => (
                    <p
                      className="mt-1.5 text-[var(--text-muted)] text-sm"
                      key={paragraph}
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </section>
        ))}

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-5">
          <h2 className="font-semibold text-[var(--foreground)]">
            Frequently asked questions
          </h2>
          <div className="mt-1">
            {HELP.faqs.map((faq) => (
              <FaqEntry
                answer={faq.answer}
                key={faq.question}
                question={faq.question}
              />
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-5">
          <h2 className="font-semibold text-[var(--foreground)]">
            Still stuck?
          </h2>
          <p className="mt-1 text-[var(--text-muted)] text-sm">
            The terms and conditions say who to contact, and they are always one
            tap away in Settings.
          </p>
          <Link
            className="mt-4 inline-block rounded-full bg-sky-500 px-5 py-2.5 font-semibold text-sm text-white transition-colors hover:bg-sky-400"
            href="/settings"
          >
            Open settings
          </Link>
        </section>
      </div>
    </div>
  );
}
