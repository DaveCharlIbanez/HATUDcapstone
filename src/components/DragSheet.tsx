"use client";

import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export interface SnapPoint {
  /** Stable id, surfaced through `onSnapChange`. */
  id: string;
  /** Visible height of the sheet, as a fraction of its own content height. */
  ratio: number;
}

interface Detent {
  height: number;
  id: string;
}

interface DragSheetProps {
  /** Classes for the scrolling body, below the grab handle. */
  bodyClassName?: string;
  /** Height of the app chrome below the sheet, in pixels. */
  bottomInset?: number;
  children: ReactNode;
  /** Classes for the sheet surface itself. */
  className?: string;
  /** Detent selected on mount. Defaults to the middle one. */
  defaultSnapId?: string;
  /** Turns dragging off without changing the layout. */
  disabled?: boolean;
  /** Label of the pill that brings a dismissed sheet back. */
  dismissLabel?: string;
  /** Pinned below the scrolling body and never scrolled out of view. */
  footer?: ReactNode;
  /** Accessible name of the grab handle. */
  handleLabel?: string;
  /** Called when the sheet is pushed past its smallest detent. */
  onDismiss?: () => void;
  /** Called when the sheet settles onto a different detent. */
  onSnapChange?: (snapId: string) => void;
  /** Detents, ordered ascending by ratio. */
  snaps: SnapPoint[];
  /** Height of viewport left uncovered at the top, in pixels. */
  topInset?: number;
  /**
   * `sheet` is a draggable bottom sheet. `panel` is the same content laid out
   * as a static sidebar, with no handle and no fixed height.
   */
  variant?: "panel" | "sheet";
}

interface DragState {
  currentSnapId: string;
  delta: number;
  lastTime: number;
  lastY: number;
  pointerId: number;
  rawHeight: number;
  startHeight: number;
  startTime: number;
  startY: number;
}

/** Above this speed a flick moves the sheet exactly one detent. */
const FLICK_VELOCITY = 0.4;
/** Past this travel the sheet moves in the direction of the drag. */
const SNAP_DISTANCE = 48;
/** How far below the smallest detent the sheet has to be pushed to dismiss. */
const DISMISS_TOLERANCE = 24;
/** Height of the grab handle, which is always on screen. */
const HANDLE_HEIGHT = 44;

function nearestDetentIndex(detents: Detent[], height: number): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const [index, detent] of detents.entries()) {
    const distance = Math.abs(detent.height - height);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return bestIndex;
}

/**
 * The detent the sheet has been dragged into.
 *
 * Dragging up from `half` far enough to cross `full` lands on `full`; a drag
 * that stops halfway lands on the detent it stopped inside of.
 */
function detentCrossed(
  detents: Detent[],
  fromIndex: number,
  height: number,
  direction: 1 | -1
): number {
  if (direction === 1) {
    for (let index = fromIndex + 1; index < detents.length; index += 1) {
      if ((detents[index]?.height ?? 0) >= height) {
        return index;
      }
    }
    return detents.length - 1;
  }

  for (let index = fromIndex - 1; index >= 0; index -= 1) {
    if ((detents[index]?.height ?? 0) <= height) {
      return index;
    }
  }
  return 0;
}

/**
 * A bottom sheet the user can drag.
 *
 * The sheet owns its height: it measures its own content, turns the `snaps`
 * it is given into pixel detents, and settles onto one of them when the drag
 * ends. The height is written straight to the DOM during a drag so a swipe
 * never re-renders the subtree it is carrying.
 */
export function DragSheet({
  bodyClassName = "",
  bottomInset = 0,
  children,
  className = "",
  defaultSnapId,
  disabled = false,
  dismissLabel = "Show panel",
  footer,
  handleLabel = "Panel",
  onDismiss,
  onSnapChange,
  snaps,
  topInset = 0,
  variant = "sheet",
}: DragSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const footerObserverRef = useRef<ResizeObserver | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const hasMountedRef = useRef(false);

  const [bodyHeight, setBodyHeight] = useState(0);
  const [currentSnapId, setCurrentSnapId] = useState<string | null>(
    defaultSnapId ?? null
  );
  const [footerHeight, setFooterHeight] = useState(0);
  const [isDismissed, setIsDismissed] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(0);

  const isPanel = variant === "panel";

  useEffect(() => {
    const onResize = () => {
      setViewportHeight(window.innerHeight);
    };

    onResize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // The content is measured through a callback ref rather than an effect: the
  // sheet unmounts while it is dismissed, and a callback ref re-measures as
  // soon as it comes back.
  const setContentElement = useCallback((element: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;

    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setBodyHeight(entry.contentRect.height);
      }
    });

    observer.observe(element);
    setBodyHeight(element.getBoundingClientRect().height);
    observerRef.current = observer;
  }, []);

  const setFooterElement = useCallback((element: HTMLDivElement | null) => {
    footerObserverRef.current?.disconnect();
    footerObserverRef.current = null;

    if (!element) {
      setFooterHeight(0);
      return;
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setFooterHeight(entry.contentRect.height);
      }
    });

    observer.observe(element);
    setFooterHeight(element.getBoundingClientRect().height);
    footerObserverRef.current = observer;
  }, []);

  useEffect(
    () => () => {
      observerRef.current?.disconnect();
      footerObserverRef.current?.disconnect();
    },
    []
  );

  // The handle and the footer are chrome: they are always on screen, so the
  // sheet can never be smaller than the two of them together.
  const chromeHeight = footerHeight + HANDLE_HEIGHT;

  /**
   * The detents are relative to the sheet's own content, not to the viewport.
   *
   * A sheet whose content is short must still have somewhere to be dragged
   * to, and a sheet must never show more empty surface than it has to. So a
   * detent is a fraction of the content height, capped by the room the
   * viewport actually has.
   */
  const detents = useMemo<Detent[]>(() => {
    if (bodyHeight <= 0 || viewportHeight <= 0) {
      return [];
    }

    const available = Math.max(0, viewportHeight - topInset - bottomInset);
    const room = Math.max(0, available - chromeHeight);
    const ordered = [...snaps].sort((a, b) => a.ratio - b.ratio);
    const result: Detent[] = [];

    for (const snap of ordered) {
      const height = chromeHeight + Math.min(bodyHeight * snap.ratio, room);
      const previous = result.at(-1);

      // Two detents that resolve to the same height are the same detent.
      if (previous && height <= previous.height + 1) {
        continue;
      }

      result.push({ height, id: snap.id });
    }

    return result;
  }, [bodyHeight, bottomInset, chromeHeight, snaps, topInset, viewportHeight]);

  const activeSnapId = useMemo(() => {
    const known = detents.find((detent) => detent.id === currentSnapId);
    if (known) {
      return known.id;
    }
    return detents[Math.floor(detents.length / 2)]?.id ?? null;
  }, [currentSnapId, detents]);

  const canDrag = !(disabled || isPanel) && detents.length > 1;

  const applyHeight = useCallback((height: number) => {
    const element = sheetRef.current;
    if (element) {
      element.style.height = `${height}px`;
    }
  }, []);

  useLayoutEffect(() => {
    if (isPanel || dragRef.current) {
      return;
    }

    const detent = detents.find((entry) => entry.id === activeSnapId);
    const element = sheetRef.current;
    if (!(detent && element)) {
      return;
    }

    const current = Number.parseFloat(element.style.height);
    if (Math.abs(current - detent.height) <= 0.5) {
      return;
    }

    if (!hasMountedRef.current) {
      // The first height is written without a transition: the sheet appears at
      // its resting size instead of growing out of nothing.
      hasMountedRef.current = true;
      element.setAttribute("data-dragging", "true");
      element.style.height = `${detent.height}px`;
      requestAnimationFrame(() => {
        element.removeAttribute("data-dragging");
      });
      return;
    }

    element.style.height = `${detent.height}px`;
  }, [activeSnapId, detents, isPanel]);

  const settleOn = useCallback(
    (detent: Detent) => {
      setCurrentSnapId(detent.id);
      onSnapChange?.(detent.id);

      const element = sheetRef.current;
      if (element) {
        // The transition is switched off while the sheet is being dragged.
        // It is switched back on first, and the new height is written on the
        // next frame so the browser animates to it instead of jumping.
        element.removeAttribute("data-dragging");
        requestAnimationFrame(() => {
          element.style.height = `${detent.height}px`;
        });
      }
    },
    [onSnapChange]
  );

  const dismiss = useCallback(() => {
    // The sheet is unmounted while it is dismissed, so the next one starts
    // from scratch rather than animating out of a stale height.
    hasMountedRef.current = false;
    setIsDismissed(true);
    onDismiss?.();
  }, [onDismiss]);

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!(canDrag && sheetRef.current)) {
        return;
      }

      const detent = detents.find((entry) => entry.id === activeSnapId);
      if (!detent) {
        return;
      }

      event.preventDefault();
      event.currentTarget.focus();
      event.currentTarget.setPointerCapture(event.pointerId);
      sheetRef.current.setAttribute("data-dragging", "true");

      dragRef.current = {
        currentSnapId: detent.id,
        delta: 0,
        lastTime: performance.now(),
        lastY: event.clientY,
        pointerId: event.pointerId,
        rawHeight: detent.height,
        startHeight: detent.height,
        startTime: performance.now(),
        startY: event.clientY,
      };
    },
    [activeSnapId, canDrag, detents]
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!(drag && drag.pointerId === event.pointerId)) {
        return;
      }

      const tallest = detents.at(-1)?.height;
      if (tallest === undefined) {
        return;
      }

      // Positive delta means the finger moved up, so the sheet grows.
      const delta = drag.startY - event.clientY;
      const rawHeight = drag.startHeight + delta;
      const applied = Math.min(Math.max(rawHeight, 0), tallest);

      drag.delta = delta;
      drag.lastTime = performance.now();
      drag.lastY = event.clientY;
      drag.rawHeight = rawHeight;

      applyHeight(applied);
    },
    [applyHeight, detents]
  );

  const handlePointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!(drag && drag.pointerId === event.pointerId)) {
        return;
      }

      dragRef.current = null;
      sheetRef.current?.removeAttribute("data-dragging");

      const shortest = detents[0]?.height;
      if (shortest === undefined) {
        return;
      }

      // Pushed past the smallest detent: the sheet is dismissed.
      if (onDismiss && drag.rawHeight < shortest - DISMISS_TOLERANCE) {
        dismiss();
        return;
      }

      const fromIndex = Math.max(
        0,
        detents.findIndex((entry) => entry.id === drag.currentSnapId)
      );
      const travel = drag.startY - drag.lastY;
      const duration = Math.max(1, drag.lastTime - drag.startTime);
      const velocity = travel / duration;

      let targetIndex: number;

      if (velocity > FLICK_VELOCITY) {
        targetIndex = fromIndex + 1;
      } else if (velocity < -FLICK_VELOCITY) {
        targetIndex = fromIndex - 1;
      } else if (Math.abs(drag.delta) >= SNAP_DISTANCE) {
        targetIndex = detentCrossed(
          detents,
          fromIndex,
          drag.rawHeight,
          drag.delta > 0 ? 1 : -1
        );
      } else {
        targetIndex = nearestDetentIndex(detents, drag.rawHeight);
      }

      targetIndex = Math.min(Math.max(targetIndex, 0), detents.length - 1);
      const target = detents[targetIndex];
      if (target) {
        settleOn(target);
      }
    },
    [dismiss, detents, onDismiss, settleOn]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (detents.length === 0) {
        return;
      }

      const fromIndex = Math.max(
        0,
        detents.findIndex((entry) => entry.id === activeSnapId)
      );

      let targetIndex: number | null = null;

      if (event.key === "ArrowUp") {
        targetIndex = fromIndex + 1;
      } else if (event.key === "ArrowDown") {
        targetIndex = fromIndex - 1;
      } else if (event.key === "Home") {
        targetIndex = 0;
      } else if (event.key === "End") {
        targetIndex = detents.length - 1;
      } else if (event.key === "Escape" && onDismiss) {
        event.preventDefault();
        dismiss();
        return;
      }

      if (targetIndex === null) {
        return;
      }

      event.preventDefault();
      const clamped = Math.min(Math.max(targetIndex, 0), detents.length - 1);
      const target = detents[clamped];
      if (target) {
        settleOn(target);
      }
    },
    [activeSnapId, detents, dismiss, onDismiss, settleOn]
  );

  if (isDismissed) {
    return (
      <div className={`pointer-events-auto flex justify-center ${className}`}>
        <button
          className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)]/95 px-4 py-2.5 font-medium text-[var(--foreground)] text-sm shadow-xl backdrop-blur transition hover:bg-[var(--surface-muted)]"
          onClick={() => {
            setIsDismissed(false);
            setCurrentSnapId(defaultSnapId ?? activeSnapId);
          }}
          type="button"
        >
          <span className="h-1.5 w-6 rounded-full bg-[var(--surface-muted)]" />
          {dismissLabel}
        </button>
      </div>
    );
  }

  if (isPanel) {
    return (
      <div className={className}>
        <div className={bodyClassName}>{children}</div>
        {footer}
      </div>
    );
  }

  const tallest = detents.at(-1)?.height ?? 0;
  const activeHeight =
    detents.find((entry) => entry.id === activeSnapId)?.height ?? 0;
  const percent = tallest > 0 ? Math.round((activeHeight / tallest) * 100) : 0;

  return (
    <div
      className={`drag-sheet pointer-events-auto flex flex-col overflow-hidden border-2 border-[var(--border)] shadow-2xl backdrop-blur-xl ${className}`}
      ref={sheetRef}
    >
      {/* A window splitter: the handle is a separator that the user can drag
          to resize the sheet. `role="separator"` with a value is the ARIA
          pattern for that; there is no native element for it, and `<hr>` would
          be a plain thematic break rather than a resizable one. */}
      {/* biome-ignore lint/a11y/useSemanticElements: a resizable separator has no native element */}
      <div
        aria-label={handleLabel}
        aria-orientation="horizontal"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={percent}
        className="flex h-11 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
        onKeyDown={handleKeyDown}
        onLostPointerCapture={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        role="separator"
        tabIndex={canDrag ? 0 : -1}
      >
        <span className="drag-sheet-grip h-2 w-16 rounded-full bg-[var(--surface-muted)] transition-colors" />
      </div>

      <div
        className={`min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain ${bodyClassName}`}
      >
        <div ref={setContentElement}>{children}</div>
      </div>

      {footer && (
        <div
          className="shrink-0 border-[var(--border)] border-t px-4 pb-4"
          ref={setFooterElement}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
