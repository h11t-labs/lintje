/**
 * Chart colors as a host names them: a variable name becomes its token, anything else is
 * already a CSS color and passes through. No color stays no color.
 */
import { DATA_COLORS, chartToken } from '../../../../tokens/colors'
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

/** The colour of a map point's series; colour names only. */
export function seriesColor(series: string | undefined): string | undefined {
  if (series == null || !isSeriesKey(series)) return undefined
  return TOKENS[series]
}
