/**
 * Keeps the keyboard inside a dialog.
 *
 * Tab has to cycle between the controls of the panel and never escape to the
 * page behind it.
 */

/** Everything a person can reach with the keyboard. */
const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export function trapFocus(
  event: KeyboardEvent,
  panel: HTMLElement | null
): void {
  if (event.key !== "Tab") {
    return;
  }

  const focusable = [
    ...(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []),
  ];
  if (focusable.length === 0) {
    return;
  }

  const first = focusable.at(0);
  const last = focusable.at(-1);
  if (!(first && last)) {
    return;
  }

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
