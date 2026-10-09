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

/** Whether the reader asked for less motion. */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
}
