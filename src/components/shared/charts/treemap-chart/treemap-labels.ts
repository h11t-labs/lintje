/**
 * What an area of a treemap says of itself: as much as fits, in a fixed order of fallbacks, and
 * nothing where not even four letters of its name do. The full name and amount are always in the
 * tooltip and the table.
 */

export interface LabelLine {
  text: string
  size: 14 | 12
  bold: boolean
}

/** The width of a text in px at a size and weight. */
export type Measure = (text: string, size: number, bold: boolean) => number

export interface LabelText {
  name: string
  /** The amount, formatted. */
  amount: string
  /** The share of the whole, formatted; a part shows it, a sub-part does not. */
  share?: string
}

/** From the area's edge to its text. */
export const LABEL_PAD = 8
/** The height of a line of text, per size. */
export const LINE_HEIGHT = { 14: 18, 12: 16 } as const
const MAX_LINES = 3
const MIN_LETTERS = 4
const ELLIPSIS = '…'

/** The name over at most three lines of this width, word by word; null if it does not fit. */
function wrap(name: string, width: number, size: 14 | 12, bold: boolean, measure: Measure) {
  const lines: string[] = []
  for (const word of name.split(/\s+/).filter(Boolean)) {
    const last = lines.at(-1)
    if (last != null && measure(`${last} ${word}`, size, bold) <= width) {
      lines[lines.length - 1] = `${last} ${word}`
    } else if (measure(word, size, bold) <= width) {
      lines.push(word)
    } else {
      return null
    }
  }
  return lines.length > 0 && lines.length <= MAX_LINES
    ? lines.map((text) => ({ text, size, bold }))
    : null
}

/** The name cut to one line with an ellipsis, keeping at least four letters; null if not. */
function truncate(name: string, width: number, bold: boolean, measure: Measure) {
  if (measure(name, 12, bold) <= width) return { text: name, size: 12 as const, bold }
  for (let end = name.length - 1; end >= MIN_LETTERS; end--) {
    const text = `${name.slice(0, end).trimEnd()}${ELLIPSIS}`
    if (measure(text, 12, bold) <= width) return { text, size: 12 as const, bold }
  }
  return null
}

const height = (lines: LabelLine[], scale: number): number =>
  lines.reduce((sum, line) => sum + LINE_HEIGHT[line.size] * scale, 0)

/**
 * The label of an area of `width` by `height`: for a part (`share` given) its name in 14 px bold
 * with amount and share under it, then the same in 12 px, then without the share, then the name
 * alone; for a sub-part its name in 12 px and the amount in bold, then the name alone. Last, the
 * name cut short with the amount if that fits. Empty where four letters do not fit. `scale` is
 * how much larger than designed the reader's text is drawn: the lines are as much taller.
 */
export function fitLabel(
  label: LabelText,
  box: { width: number; height: number },
  measure: Measure,
  scale = 1,
): LabelLine[] {
  const width = box.width - 2 * LABEL_PAD
  const room = box.height - 2 * LABEL_PAD
  const fits = (lines: LabelLine[] | null): lines is LabelLine[] =>
    lines != null &&
    height(lines, scale) <= room &&
    lines.every((line) => measure(line.text, line.size, line.bold) <= width)
  const part = label.share != null
  const amount: LabelLine = { text: label.amount, size: 12, bold: !part }
  const full: LabelLine = { text: `${label.amount} · ${label.share}`, size: 12, bold: false }
  const named = (size: 14 | 12) => wrap(label.name, width, size, part, measure)
  const candidates: (LabelLine[] | null)[] = part
    ? [withLine(named(14), full), withLine(named(12), full), withLine(named(12), amount), named(12)]
    : [withLine(named(12), amount), named(12)]
  for (const lines of candidates) if (fits(lines)) return lines
  const cut = truncate(label.name, width, part, measure)
  if (!cut) return []
  if (fits([cut, amount])) return [cut, amount]
  return fits([cut]) ? [cut] : []
}

function withLine(lines: LabelLine[] | null, line: LabelLine): LabelLine[] | null {
  return lines ? [...lines, line] : null
}
