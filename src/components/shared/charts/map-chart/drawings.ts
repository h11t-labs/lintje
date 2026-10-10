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
  /** The layer's name in the legend and the CSV: its `label`, or the word for its variant. */
  name: string
  unit: string
  /** The largest figure, at least 1: what the classes, widths and sizes scale to. */
  max: number
  destination?: { lon: number; lat: number; label: string }
  seriesLabels?: Partial<Record<MapSeriesKey, string>>
}

const NAMES: Record<DrawingVariant, string> = {
  polygons: 'vlakken',
  points: 'punten',
  flows: 'stromen',
  choropleth: 'klassen',
  'scope-picker': 'punten',
}

const maxOf = (values: MapValue[]): number =>
  Math.max(1, ...values.map((value) => value.value ?? 0))

/** The drawings in the order they draw, bottom first; `unit` is the map's own. */
export function mapDrawings(data: MapSpec, unit: string): MapDrawing[] {
  if (data.variant !== 'plots') {
    const values = data.values ?? []
    return [
      {
        variant: data.variant,
        values,
        name: NAMES[data.variant],
        unit,
        max: maxOf(values),
        destination: data.destination,
        seriesLabels: data.seriesLabels,
      },
    ]
  }
  return (data.plots ?? []).map((plot) => {
    const values = plot.values ?? []
    return {
      variant: plot.variant,
      values,
      name: plot.label ?? NAMES[plot.variant],
      unit: plot.unit ?? unit,
      max: maxOf(values),
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
