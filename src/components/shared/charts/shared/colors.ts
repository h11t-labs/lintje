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
 * The edge under a line drawn in dark yellow: its own text colour, so the line reaches 3:1 on
 * the light surface where the yellow is 1.8:1. In dark that token is the yellow itself and the
 * edge melts into the line.
 */
export function lineCasing(color: string | undefined): string | undefined {
  return color === TOKENS['dark-yellow'] ? 'var(--color-chart-dark-yellow-text)' : undefined
}

/** The colour of a map point's series; colour names only. */
export function seriesColor(series: string | undefined): string | undefined {
  if (series == null || !isSeriesKey(series)) return undefined
  return TOKENS[series]
}
