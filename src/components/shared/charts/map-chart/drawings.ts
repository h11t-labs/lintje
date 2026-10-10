/**
 * A map as a stack of drawings: its `plots`, or its own variant and values as a stack of one. The
 * svg map, the basemap and the tile's CSV read the same list, so a figure always speaks the unit
 * and the series names of its own layer.
 */
import type { MapSeriesKey, MapSpec, MapValue, MapVariant } from '../shared/types'

export type DrawingVariant = Exclude<MapVariant, 'plots'>

export interface MapDrawing {
  variant: DrawingVariant
  values: MapValue[]
  /** The layer's place in the stack, from the bottom; what keys a series switched off. */
  index: number
  /** The layer's name in the legend and the CSV: its `label`, or the word for its variant. */
  name: string
  unit: string
  /** The largest figure, at least 1: what the classes, widths and sizes scale to. */
  max: number
  /** The smallest figure a mark carries, for the legend's range; `max` without any. */
  min: number
  destination?: { lon: number; lat: number; label: string }
  seriesLabels?: Partial<Record<MapSeriesKey, string>>
}

const NAMES: Record<DrawingVariant, string> = {
  polygons: 'Vlakken',
  points: 'Punten',
  flows: 'Stromen',
  choropleth: 'Gebieden',
  'scope-picker': 'Punten',
}

const maxOf = (values: MapValue[]): number =>
  Math.max(1, ...values.map((value) => value.value ?? 0))

const minOf = (values: MapValue[]): number => {
  const figures = values.filter((value) => value.value != null).map((value) => value.value!)
  return figures.length ? Math.min(...figures) : maxOf(values)
}

/** The drawings in the order they draw, bottom first; `unit` is the map's own. */
export function mapDrawings(data: MapSpec, unit: string): MapDrawing[] {
  if (data.variant !== 'plots') {
    const values = data.values ?? []
    return [
      {
        variant: data.variant,
        values,
        index: 0,
        name: NAMES[data.variant],
        unit,
        max: maxOf(values),
        min: minOf(values),
        destination: data.destination,
        seriesLabels: data.seriesLabels,
      },
    ]
  }
  return (data.plots ?? []).map((plot, index) => {
    const values = plot.values ?? []
    return {
      variant: plot.variant,
      values,
      index,
      name: plot.label ?? NAMES[plot.variant],
      unit: plot.unit ?? unit,
      max: maxOf(values),
      min: minOf(values),
      destination: plot.destination ?? data.destination,
      seriesLabels: plot.seriesLabels
        ? { ...data.seriesLabels, ...plot.seriesLabels }
        : data.seriesLabels,
    }
  })
}

/** A figure and its unit, without a dangling space when the unit is empty. */
export function withUnit(figure: string, unit: string): string {
  return unit ? `${figure} ${unit}` : figure
}
