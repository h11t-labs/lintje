/** Pixels from the end that still count as standing at it. */
export const AT_END = 8

/**
 * Whether a reader stands at the end after a scroll from `lastTop` to `top`, with `beyond` pixels
 * still below. Content that grows below moves no reader: only scrolling up leaves the end, and
 * only arriving at it returns there. A pixel of upward jitter is not a scroll of theirs.
 */
export function atEndAfterScroll(
  wasAtEnd: boolean,
  top: number,
  lastTop: number,
  beyond: number,
): boolean {
  if (beyond <= AT_END) return true
  if (top < lastTop - 1) return false
  return wasAtEnd
}
