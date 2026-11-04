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

/** The type a label is measured in: its family, and what the reader's own settings make of it. */
export interface TextFont {
  family: string
  /** How large a 12 px label is drawn, over 12: more with a larger default font. */
  scale?: number
  /** The reader's letter and word spacing, in em. */
  letterSpacing?: number
  wordSpacing?: number
}

/** `text` shortened with an ellipsis until it fits `maxWidth` px in the axis label font. */
export function truncateToWidth(
  text: string,
  maxWidth: number,
  font: TextFont | string = '',
): string {
  if (textWidth(text, font) <= maxWidth) return text
  let end = text.length
  while (end > 1) {
    end -= 1
    const shorter = `${text.slice(0, end).trimEnd()}…`
    if (textWidth(shorter, font) <= maxWidth) return shorter
  }
  return '…'
}

/** `text` in lines of at most `maxWidth` px, word by word; a word longer than a line breaks. */
export function wrapToWidth(
  text: string,
  maxWidth: number,
  font: TextFont | string = '',
  weight = 400,
  size = 12,
): string[] {
  const fits = (line: string) => textWidth(line, font, weight, size) <= maxWidth
  const lines: string[] = []
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = lines.at(-1)
    if (last != null && fits(`${last} ${word}`)) {
      lines[lines.length - 1] = `${last} ${word}`
      continue
    }
    let rest = word
    while (!fits(rest) && rest.length > 1) {
      let end = rest.length - 1
      while (end > 1 && !fits(rest.slice(0, end))) end -= 1
      lines.push(rest.slice(0, end))
      rest = rest.slice(end)
    }
    lines.push(rest)
  }
  return lines
}

/**
 * Width in px of `text` in the 12 px chart font, at `weight` (400 for an axis label, 700 for a
 * data label), or at another `size`; ~6.5 px per character at 12 px without a canvas. With the
 * reader's settings in `font`, as wide as the browser draws it.
 */
export function textWidth(
  text: string,
  font: TextFont | string = '',
  weight = 400,
  size = 12,
): number {
  const {
    family,
    scale = 1,
    letterSpacing = 0,
    wordSpacing = 0,
  } = typeof font === 'string' ? ({ family: font } as TextFont) : font
  const px = size * scale
  // CSS puts letter spacing after every character and word spacing on every space.
  const spacing =
    px * (letterSpacing * [...text].length + wordSpacing * (text.split(' ').length - 1))
  if (measuringContext === undefined) {
    measuringContext =
      typeof document === 'undefined'
        ? null
        : (document.createElement('canvas').getContext('2d') ?? null)
  }
  if (!measuringContext) return (text.length * CHARACTER_WIDTH * px) / 12 + spacing
  measuringContext.font = `${weight} ${px}px ${family.trim() || FALLBACK_FONT_FAMILY}`
  return measuringContext.measureText(text).width + spacing
}

export function formatPercent(n: number, decimals = 0): string {
  return `${formatNumber(n, decimals)}%`
}
