/**
 * The forecast of a line or bar chart: where it starts and how its margin reads. The chart
 * element's table reads the same start, so drawing and table agree on what is a forecast.
 */
import { formatNumber } from '../../../../core/format'
import type { TooltipRow } from './controller'
import type { ChartForecast } from './types'

export const FORECAST_LABEL = 'Raming'
export const INTERVAL_LABEL = 'Marge'

/** The room above the plot for "Gemeten" and the forecast's word, over the boundary. */
export const FORECAST_ROOM = 16

/** The first forecast index, or `null` when `forecastFrom` names no point after the first. */
export function forecastStart(from: number | undefined, count: number): number | null {
  return from != null && Number.isInteger(from) && from > 0 && from < count ? from : null
}

/** The bounds at a point; a missing one is `null`. */
export function boundsAt(
  forecast: ChartForecast | undefined,
  index: number,
): { low: number | null; high: number | null } {
  return { low: forecast?.low?.[index] ?? null, high: forecast?.high?.[index] ?? null }
}

/** Whether the margin shows anywhere: a forecast point with both bounds. */
export function hasInterval(
  forecast: ChartForecast | undefined,
  from: number,
  count: number,
): boolean {
  for (let i = from; i < count; i++) {
    const { low, high } = boundsAt(forecast, i)
    if (low != null && high != null) return true
  }
  return false
}

/**
 * The tooltip's line under a forecast value: low – high, the one bound there is, or no margin.
 */
export function intervalRow(forecast: ChartForecast, index: number): TooltipRow {
  const { low, high } = boundsAt(forecast, index)
  if (low != null && high != null) {
    return {
      label: 'laag – hoog',
      value: `${formatNumber(low)} – ${formatNumber(high)}`,
      note: true,
    }
  }
  if (low != null) return { label: 'ondergrens', value: formatNumber(low), note: true }
  if (high != null) return { label: 'bovengrens', value: formatNumber(high), note: true }
  return { label: 'laag – hoog', value: 'geen marge', note: true }
}

/** Every bound of the margin, for the scale. */
export function intervalValues(forecast: ChartForecast | undefined): number[] {
  return [...(forecast?.low ?? []), ...(forecast?.high ?? [])].filter(
    (value): value is number => value != null,
  )
}
