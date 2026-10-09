/**
 * A length token in px, e.g. `lengthPx(this, '--h-topbar', 56)`. Read where the element stands,
 * so a breakpoint's override applies; `rem` resolves against the root font size. Anything that is
 * not px, rem or a bare number gives the fallback.
 */
export function lengthPx(element: Element, token: string, fallback: number): number {
  const raw = getComputedStyle(element).getPropertyValue(token).trim()
  const value = parseFloat(raw)
  if (!Number.isFinite(value)) return fallback
  if (raw.endsWith('rem')) return value * rootFontSize()
  return value
}

function rootFontSize(): number {
  const size = parseFloat(getComputedStyle(document.documentElement).fontSize)
  return Number.isFinite(size) && size > 0 ? size : 16
}
