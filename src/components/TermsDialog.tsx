"use client";

import {
  type UIEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { FaCheckCircle, FaTimes } from "react-icons/fa";
import { trapFocus } from "@/lib/focusTrap";
import { isScrolledToEnd } from "@/lib/scroll";
import { TERMS, TERMS_EFFECTIVE_DATE, TERMS_VERSION } from "@/lib/terms";

interface TermsDialogProps {
  isOpen: boolean;
  /** Called when the terms have been read and accepted. */
  onAccept: () => void;
  onClose: () => void;
  /**
   * Read-only: the document is shown, but there is nothing to tick and
   * nothing to accept. Used for reading the terms after signing up.
   */
  readOnly?: boolean;
}

/**
 * The Terms and Conditions.
 *
 * The dialog is a card over the page, not a page of its own, and it is built
 * from the project's own theme tokens so it looks like the rest of the app in
 * both light and dark mode.
 *
 * The tick box only becomes available once the document has been scrolled to
 * the end. A document that is shorter than the box has nothing to scroll, so
 * it opens straight away — otherwise the tick box could never be reached and
 * signing up would be impossible.
 */
export function TermsDialog({
  isOpen,
  onAccept,
  onClose,
  readOnly = false,
}: TermsDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const [isAccepted, setIsAccepted] = useState(false);

  const titleId = useId();
  const descriptionId = useId();

  /**
   * Whether the document has been read to the end.
   *
   * Checked on every scroll, and again whenever the box is laid out or
   * resized, so a document that fits — or a phone that rotates — never leaves
   * the tick box locked.
   */
  const checkReachedEnd = useCallback(() => {
    const element = bodyRef.current;
    if (!element) {
      return;
    }
    if (
      isScrolledToEnd({
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        scrollTop: element.scrollTop,
      })
    ) {
      setHasReachedEnd(true);
    }
  }, []);

  // Reopening starts the document again: it has to be read again.
  useEffect(() => {
    if (isOpen) {
      setHasReachedEnd(false);
      setIsAccepted(false);
      bodyRef.current?.scrollTo({ top: 0 });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      trapFocus(event, panelRef.current);
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  // Return focus to whatever opened the dialog once it closes.
  useEffect(() => {
    if (!isOpen) {
      restoreFocusRef.current?.focus();
    }
  }, [isOpen]);

  // The gate is measured, not waited for.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const element = bodyRef.current;
    if (!element) {
      return;
    }

    checkReachedEnd();
    const observer = new ResizeObserver(checkReachedEnd);
    observer.observe(element);
    return () => observer.disconnect();
  }, [checkReachedEnd, isOpen]);

  const handleScroll = (event: UIEvent<HTMLElement>) => {
    const element = event.currentTarget;
    if (
      isScrolledToEnd({
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        scrollTop: element.scrollTop,
      })
    ) {
      setHasReachedEnd(true);
    }
  };

  if (!isOpen) {
    return null;
  }

  const canAgree = readOnly || (hasReachedEnd && isAccepted);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        aria-label="Close the terms and conditions"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
        ref={panelRef}
        role="dialog"
      >
        {/* The header and the footer stay put; only the document scrolls. */}
        <div className="flex items-start justify-between gap-4 border-[var(--border)] border-b px-6 py-5">
          <div className="min-w-0">
            <h2
              className="font-semibold text-[var(--foreground)] text-xl"
              id={titleId}
            >
              {TERMS.title}
            </h2>
            <p
              className="mt-1 text-[var(--text-muted)] text-xs"
              id={descriptionId}
            >
              Version {TERMS_VERSION} · effective {TERMS_EFFECTIVE_DATE}
            </p>
          </div>
          <button
            aria-label="Close the terms and conditions"
            className="shrink-0 rounded-full p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-strong)] hover:text-[var(--foreground)]"
            onClick={onClose}
            ref={closeRef}
            type="button"
          >
            <FaTimes />
          </button>
        </div>

        {/* The document. It is a focusable region, so it can be scrolled with
            the keyboard as well as with a finger. */}
        <section
          aria-label="Terms and Conditions"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5 text-[var(--foreground)] text-sm leading-relaxed"
          onScroll={handleScroll}
          ref={bodyRef}
          tabIndex={0}
        >
          <p className="font-medium">{TERMS.introduction}</p>

          {TERMS.sections.map((section, index) => (
            <section className="mt-5" key={section.heading}>
              <h3 className="font-semibold text-[var(--foreground)]">
                {index + 1}. {section.heading}
              </h3>
              {section.paragraphs.map((paragraph) => (
                <p className="mt-2 text-[var(--text-muted)]" key={paragraph}>
                  {paragraph}
                </p>
              ))}
              {section.bullets ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--text-muted)]">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}

          <section className="mt-6 border-[var(--border)] border-t pt-5">
            <h3 className="font-semibold text-[var(--foreground)]">
              Agreement
            </h3>
            <p className="mt-2 text-[var(--text-muted)]">{TERMS.agreement}</p>
          </section>
        </section>

        {readOnly ? (
          <div className="border-[var(--border)] border-t px-6 py-4">
            <button
              className="min-h-11 w-full rounded-full bg-[var(--surface-strong)] px-5 py-2.5 font-semibold text-[var(--foreground)] text-sm transition hover:bg-[var(--surface-muted)]"
              onClick={onClose}
              type="button"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="border-[var(--border)] border-t px-6 py-4">
            <label
              className={`flex items-start gap-3 text-sm ${
                hasReachedEnd
                  ? "cursor-pointer text-[var(--foreground)]"
                  : "cursor-not-allowed text-[var(--text-muted)]"
              }`}
            >
              <input
                checked={isAccepted}
                className="mt-0.5 h-5 w-5 shrink-0 accent-sky-500"
                disabled={!hasReachedEnd}
                onChange={(event) => setIsAccepted(event.target.checked)}
                type="checkbox"
              />
              <span>{TERMS.checklist}</span>
            </label>

            {hasReachedEnd ? null : (
              <p className="mt-2 text-[var(--text-muted)] text-xs">
                Scroll to the end of the terms to continue.
              </p>
            )}

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                className="min-h-11 rounded-full bg-[var(--surface-strong)] px-5 py-2.5 font-semibold text-[var(--foreground)] text-sm transition hover:bg-[var(--surface-muted)]"
                onClick={onClose}
                type="button"
              >
                Not now
              </button>
              <button
                className="min-h-11 rounded-full bg-sky-500 px-5 py-2.5 font-semibold text-sm text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canAgree}
                onClick={onAccept}
                type="button"
              >
                {isAccepted ? <FaCheckCircle className="mr-2" /> : null}I agree
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
