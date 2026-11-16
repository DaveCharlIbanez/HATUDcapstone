/**
 * How far a scrollable region has been read.
 *
 * The terms cannot be ticked until they have been read to the end, and the
 * rule that decides "the end" is here, on its own, so it can be tested
 * without a browser.
 */

/**
 * How close to the end counts as the end.
 *
 * A touch of overscroll at the bottom — a trackpad that carries on, a finger
 * that drags past — must not leave someone locked out of the tick box.
 */
export const SCROLL_END_TOLERANCE_PX = 32;

export interface ScrollMetrics {
  /** The height of the visible part of the region. */
  clientHeight: number;
  /** The height of the whole content, visible part or not. */
  scrollHeight: number;
  /** How far the region has been scrolled from the top. */
  scrollTop: number;
}

/**
 * True when the region has been scrolled to the end — or when there was never
 * anything to scroll.
 *
 * The second case is the important one. A document shorter than the box it is
 * shown in cannot be scrolled, so a rule that only watched for a scroll event
 * would leave the tick box locked for good and make signup impossible.
 */
export function isScrolledToEnd({
  clientHeight,
  scrollHeight,
  scrollTop,
}: ScrollMetrics): boolean {
  if (scrollHeight <= clientHeight + 1) {
    return true;
  }

  return scrollTop + clientHeight >= scrollHeight - SCROLL_END_TOLERANCE_PX;
}
