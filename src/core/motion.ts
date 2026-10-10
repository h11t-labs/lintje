/** Motion an element runs itself rather than in CSS: durations read from tokens, reduced motion. */

/**
 * A duration token in milliseconds, read where the element stands so local overrides apply.
 * The unit is parsed: a minifier writes `900ms` as `.9s`, which `parseFloat` alone reads as 0.9 ms.
 */
export function durationMs(element: Element, token: string): number {
  const raw = getComputedStyle(element).getPropertyValue(token).trim()
  const value = parseFloat(raw)
  if (!Number.isFinite(value)) return 0
  return raw.endsWith('ms') ? value : raw.endsWith('s') ? value * 1000 : value
}

/**
 * A timing-function token as a function of progress, for motion drawn frame by frame: `linear`
 * or `cubic-bezier(…)`; anything else runs linear.
 */
export function easing(element: Element, token: string): (t: number) => number {
  const raw = getComputedStyle(element).getPropertyValue(token).trim()
  const points = /^cubic-bezier\(([^)]+)\)$/.exec(raw)?.[1].split(',').map(Number)
  if (!points || points.length !== 4 || points.some((n) => !Number.isFinite(n))) return (t) => t
  const [x1, y1, x2, y2] = points
  const bezier = (a: number, b: number, s: number) =>
    3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3
  return (t) => {
    if (t <= 0 || t >= 1) return Math.min(1, Math.max(0, t))
    // x rises with s while x1 and x2 lie in [0, 1], as CSS requires: halve towards t.
    let low = 0
    let high = 1
    for (let step = 0; step < 24; step++) {
      const mid = (low + high) / 2
      if (bezier(x1, x2, mid) < t) low = mid
      else high = mid
    }
    return bezier(y1, y2, (low + high) / 2)
  }
}

/** Whether the reader asked for less motion. */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
}
