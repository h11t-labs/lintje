/** Number formatting for the charts (Dutch locale). */

export function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString('nl-NL', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** In full if it fits, otherwise abbreviated (121k). */
export function formatCompactNumber(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${formatNumber(n / 1_000_000, 1)} mln`
  if (Math.abs(n) >= 10_000) return `${Math.round(n / 1000)}k`
  return formatNumber(n)
}

/** Full if it fits in `available` px, otherwise abbreviated. */
export function formatDataLabel(n: number, available: number): string {
  const full = formatNumber(n)
  return dataLabelFits(full, available) ? full : formatCompactNumber(n)
}

/** The estimated width of one character of the 12 px axis and data label font. */
const CHARACTER_WIDTH = 6.5

/** Whether a data label fits in `available` px: ~6.5 px per character at 12 px. */
export function dataLabelFits(text: string, available: number): boolean {
  return text.length * CHARACTER_WIDTH <= available
}

/** The axis label font when no element is at hand to read `--font-ui` from. */
const FALLBACK_FONT_FAMILY = "'RijksSans', 'Source Sans 3', sans-serif"
let measuringContext: CanvasRenderingContext2D | null | undefined

/** `text` shortened with an ellipsis until it fits `maxWidth` px in the axis label font. */
export function truncateToWidth(text: string, maxWidth: number, fontFamily = ''): string {
  if (textWidth(text, fontFamily) <= maxWidth) return text
  let end = text.length
  while (end > 1) {
    end -= 1
    const shorter = `${text.slice(0, end).trimEnd()}…`
    if (textWidth(shorter, fontFamily) <= maxWidth) return shorter
  }
  return '…'
}

/** Width in px of `text` in the 12 px axis label font; ~6.5 px per character without a canvas. */
export function textWidth(text: string, fontFamily = ''): number {
  if (measuringContext === undefined) {
    measuringContext =
      typeof document === 'undefined'
        ? null
        : (document.createElement('canvas').getContext('2d') ?? null)
  }
  if (!measuringContext) return text.length * CHARACTER_WIDTH
  measuringContext.font = `400 12px ${fontFamily.trim() || FALLBACK_FONT_FAMILY}`
  return measuringContext.measureText(text).width
}

export function formatPercent(n: number, decimals = 0): string {
  return `${formatNumber(n, decimals)}%`
}
