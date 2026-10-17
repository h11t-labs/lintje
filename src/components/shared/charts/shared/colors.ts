/**
 * Chart colors as a host names them: a variable name becomes its token, anything else is
 * already a CSS color and passes through. No color stays no color.
 */
import { DATA_COLORS, chartToken, isDataColor, type DataColor } from '../../../../tokens/colors'
import { isSeriesKey } from './series-shapes'
import type { ChartColor } from './types'

/** What a figure draws when its data names no colour; the stylesheets name the same token. */
export const DEFAULT_SERIES_COLOR = 'var(--color-chart-default)'

const TOKENS: Record<string, string> = {
  ...Object.fromEntries(DATA_COLORS.map((color) => [color, chartToken(color)])),
  other: 'var(--color-chart-other)',
  remainder: 'var(--color-chart-remainder)',
  emphasis: 'var(--color-chart-emphasis)',
}

/** The data colours white text reaches 4.5:1 on; any other named fill but the rest takes ink. */
export const DARK_FILLS: ReadonlySet<string> = new Set([
  'sky-blue',
  'red',
  'green',
  'violet',
  'dark-green',
  'purple',
  'ruby-red',
  'dark-brown',
  'brown',
  'dark-blue',
  'moss-green',
])

/**
 * Whether text on rung `rung` (0 is the colour itself) of a variable's ladder is white: only on
 * the darkest rung of a dark colour; every lighter rung takes ink.
 */
export function whiteOnRung(color: ChartColor | undefined, rung: number): boolean {
  return rung === 0 && (color == null || DARK_FILLS.has(color))
}

export function chartColor(color: ChartColor | undefined): string | undefined {
  if (color == null) return undefined
  return TOKENS[color] ?? color
}

/**
 * The light colours that reach 3:1 as a line or a mark only by a dark edge. Dark yellow keeps
 * its text colour as its edge. In dark each token is the colour itself and the edge melts away.
 */
const EDGES = new Map<string, string>([
  [TOKENS['dark-yellow'], 'var(--color-chart-dark-yellow-text)'],
  ...(['mint-green', 'orange', 'pink', 'yellow', 'light-blue'] as const).map(
    (color): [string, string] => [TOKENS[color], `var(--color-chart-${color}-edge)`],
  ),
])

/** The edge under a line, a point or a legend shape in `color`, if that colour needs one. */
export function lineCasing(color: string | undefined): string | undefined {
  return color == null ? undefined : EDGES.get(color)
}

/** The text a label on a fill takes: white, ink, or none where neither reaches 4.5:1. */
export type LabelInk = 'white' | 'ink' | null

type Rungs = readonly [LabelInk, LabelInk, LabelInk, LabelInk, LabelInk]
const W = 'white'
const K = 'ink'

/**
 * Which text reaches 4.5:1 on each step of each data colour's ladder: step 1 is the colour, 2–5
 * its tints, as `tintSteps` spreads them. Where neither does (`null`), the fill carries no label;
 * its tooltip and table still name it. `colour-scheme.test.ts` checks every cell.
 */
export const LABEL_INK: Readonly<Record<DataColor, Rungs>> = {
  'sky-blue': [W, K, K, K, K],
  'dark-yellow': [K, K, K, K, K],
  red: [W, K, K, K, K],
  green: [W, K, K, K, K],
  'mint-green': [K, K, K, K, K],
  violet: [W, W, K, K, K],
  orange: [K, K, K, K, K],
  pink: [K, K, K, K, K],
  'dark-green': [W, null, K, K, K],
  purple: [W, W, null, K, K],
  'ruby-red': [W, null, K, K, K],
  yellow: [K, K, K, K, K],
  'dark-brown': [W, W, K, K, K],
  brown: [W, K, K, K, K],
  'dark-blue': [W, K, K, K, K],
  'light-blue': [K, K, K, K, K],
  'moss-green': [W, K, K, K, K],
}

/**
 * The ink of a label on step `step` of `color`'s ladder; without a colour, the default's. Any
 * other fill a host names (a role, a CSS colour) is light and takes ink.
 */
export function labelInk(color: string | undefined, step = 1): LabelInk {
  if (color != null && !isDataColor(color)) return K
  const ink = LABEL_INK[color ?? 'sky-blue'][step - 1]
  return ink === undefined ? K : ink
}

/** The class of a label drawn on a mark in that ink. */
export function insideLabelClass(ink: Exclude<LabelInk, null>): string {
  return ink === 'white'
    ? 'lintje-chart__data-label--inside'
    : 'lintje-chart__data-label--inside-light'
}

/** The colour of a map point's series; colour names only. */
export function seriesColor(series: string | undefined): string | undefined {
  if (series == null || !isSeriesKey(series)) return undefined
  return TOKENS[series]
}
