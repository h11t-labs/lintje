/**
 * How a series draws: its colour and its shape. A data colour by name brings its own shape
 * (rule 13, one shape per colour); a style in `seriesStyles` may set either apart — a neutral
 * colour for series that differ by shape alone — and a key that is neither is the default colour
 * and a circle, as a point without a series.
 */
import { seriesColor } from '../shared/colors'
import { isSeriesKey, seriesShape, type SeriesShape } from '../shared/series-shapes'
import type { MapDrawing } from './drawings'

/** `neutral`: the comparison grey of the grammar, never a data colour. */
export const NEUTRAL_SERIES_COLOR = 'var(--color-chart-secondary)'

export interface ResolvedSeriesStyle {
  /** A CSS colour, or nothing for the default. */
  color: string | undefined
  shape: SeriesShape
}

export function seriesStyle(
  drawing: Pick<MapDrawing, 'seriesStyles'>,
  series: string | undefined,
): ResolvedSeriesStyle {
  const style = series ? drawing.seriesStyles?.[series] : undefined
  const color =
    style?.color === 'neutral'
      ? NEUTRAL_SERIES_COLOR
      : style?.color
        ? seriesColor(style.color)
        : seriesColor(series)
  const shape = style?.shape ?? (isSeriesKey(series) ? seriesShape(series) : 'circle')
  return { color, shape }
}
