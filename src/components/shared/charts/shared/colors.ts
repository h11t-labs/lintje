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

export function chartColor(color: ChartColor | undefined): string | undefined {
  if (color == null) return undefined
  return TOKENS[color] ?? color
}

/**
 * The light colours that reach 3:1 as a line or a mark only by a dark edge. In dark each token is
 * the colour itself and the edge melts away.
 */
const EDGES = new Map<string, string>(
  (['dark-yellow', 'mint-green', 'orange', 'pink', 'yellow', 'light-blue'] as const).map(
    (color): [string, string] => [TOKENS[color], `var(--color-chart-${color}-edge)`],
  ),
)

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

/** The text a label on a dimmed fill takes: the text colour, ink, or none. */
export type DimmedInk = 'text' | 'ink' | null

const T = 'text'

/**
 * Which text reaches 4.5:1 on each step of each ladder once it is dimmed (`fill-opacity: .45` over
 * the surface), in light and dark and in both house styles alike, as no component draws by mode
 * or style: the text colour (near-black in light, white in dark), the near-black ink of a light
 * fill, or neither (`null`), where the dimmed area carries no label and its tooltip names it. `colour-scheme.test.ts` checks
 * every cell.
 */
export const DIMMED_INK: Readonly<
  Record<DataColor, readonly [DimmedInk, DimmedInk, DimmedInk, DimmedInk, DimmedInk]>
> = {
  'sky-blue': [T, T, T, T, T],
  'dark-yellow': [T, T, null, null, null],
  red: [T, T, T, T, T],
  green: [T, T, T, T, T],
  'mint-green': [T, T, null, null, null],
  violet: [T, T, T, T, T],
  orange: [T, T, T, T, null],
  pink: [T, T, T, null, null],
  'dark-green': [T, T, T, T, T],
  purple: [T, T, T, T, T],
  'ruby-red': [T, T, T, T, T],
  yellow: [null, null, null, null, null],
  'dark-brown': [T, T, T, T, T],
  brown: [T, T, T, T, T],
  'dark-blue': [T, T, T, T, T],
  'light-blue': [T, T, null, null, null],
  'moss-green': [T, T, T, T, T],
}

/** The ink of a label on step `step` of `color`'s ladder once dimmed; as `labelInk`, by default. */
export function dimmedLabelInk(color: string | undefined, step = 1): DimmedInk {
  if (color != null && !isDataColor(color)) return T
  const ink = DIMMED_INK[color ?? 'sky-blue'][step - 1]
  return ink === undefined ? T : ink
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
