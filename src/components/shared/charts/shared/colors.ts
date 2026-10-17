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
