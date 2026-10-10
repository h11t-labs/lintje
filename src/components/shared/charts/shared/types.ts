/** The chart data contract, field for field as `src/types.ts` carries it. */
import type { DataColor } from '../../../../tokens/colors'

/**
 * A chart color: a variable's name (the one list in `tokens/colors.ts`) maps to its token,
 * `other`, `remainder` and `emphasis` to their roles, and anything else passes through as CSS.
 */
export type ChartColor = DataColor | 'other' | 'remainder' | 'emphasis' | (string & {})

/**
 * What makes a mark clickable: the host's identity for it and the URL the host minted. A bare
 * number takes them from the chart's `links` array. Without a `href` the mark is not clickable.
 */
export interface ChartLink {
  id: string
  href?: string
}

export interface LineSeriesData {
  label: string
  /** null = no data, never 0 (rule 15). */
  values: (number | null)[]
  color?: ChartColor
  comparison?: boolean
  area?: boolean
}

export interface BarSeriesData {
  label: string
  values: number[]
  color?: ChartColor
  /** One entry per value: the drilldown of that bar or segment, or null. */
  links?: (ChartLink | null)[]
}

export type ChartSpec =
  | {
      kind: 'line'
      labels: string[]
      series: LineSeriesData[]
      axisTitle?: string
      unit?: string
      /** Index of the last complete point; after it the data is incomplete. */
      asOfIndex?: number
      asOfLabel?: string
      pendingHours?: number
      fixedMax?: number
      small?: boolean
    }
  | {
      kind: 'bar'
      labels: string[]
      values: (number | null)[]
      color?: ChartColor
      axisTitle?: string
      /** Trend line over the bars. */
      trend?: (number | null)[]
      dataLabels?: boolean
      small?: boolean
      /** One entry per value: the drilldown of that bar, or null. */
      links?: (ChartLink | null)[]
    }
  | {
      kind: 'horizontal-bar'
      rows: { label: string; value: number; id?: string; href?: string }[]
      threshold?: number
      thresholdLabel?: string
      unit?: string
      color?: ChartColor
      aboveThresholdColor?: ChartColor
    }
  | { kind: 'target-progress'; rows: { label: string; value: number }[]; target?: number }
  | {
      kind: 'grouped-bar'
      labels: string[]
      series: BarSeriesData[]
      axisTitle?: string
      small?: boolean
    }
  | {
      kind: 'stacked-bar'
      labels: string[]
      series: BarSeriesData[]
      axisTitle?: string
      normalized?: boolean
      totalOnTop?: boolean
      small?: boolean
    }
  | {
      kind: 'pie'
      segments: {
        label: string
        value: number
        color?: ChartColor
        remainder?: boolean
        id?: string
        href?: string
      }[]
      /** The variable the pie divides: its parts take this colour's tints. Default sky blue. */
      color?: ChartColor
      donut?: boolean
      centerValue?: string
      centerLabel?: string
      legendTable?: boolean
      /** Header of the legend table's first column: what the segments are. */
      labelHeader?: string
      size?: number
    }
  | {
      kind: 'dual-axis'
      labels: string[]
      left: { label: string; values: (number | null)[]; color?: ChartColor; unit?: string }
      right: { label: string; values: (number | null)[]; color?: ChartColor; unit?: string }
      threshold?: number
      thresholdLabel?: string
      pendingHours?: number
      small?: boolean
    }
  | {
      kind: 'heatmap'
      columnLabels: string[]
      rowLabels: string[]
      /** null = no measurement, never 0 (rule 15); the cell stays empty. */
      values: (number | null)[][]
      unit?: string
      compact?: boolean
      /** The four ascending bounds between the classes; without them they move with the data. */
      bounds?: number[]
      /** One entry per cell, row for row: that cell's drilldown, or null. */
      links?: (ChartLink | null)[][]
      /**
       * The compact representation below 768 px (rule 9): its own labels, values and `links`.
       * Without it a grid wider than tall is drawn on its side there.
       */
      mobile?: {
        columnLabels: string[]
        rowLabels: string[]
        values: (number | null)[][]
        links?: (ChartLink | null)[][]
      }
    }
  | {
      kind: 'histogram'
      /**
       * The classes in ascending order, each starting where the one before ends. `to: null` is
       * an open last class ("30+"); `count: null` is no data, never 0 (rule 15).
       */
      bins: { from: number; to: number | null; count: number | null }[]
      /** What the classes count, in the legend and the tooltip. Default "Aantal". */
      label?: string
      color?: ChartColor
      /** Above the y-axis, e.g. "aanvragen per twee dagen". */
      axisTitle?: string
      /** Under the x labels, right-aligned, e.g. "doorlooptijd in dagen". */
      xTitle?: string
      /** The unit of the x-axis, e.g. "dagen": in the tooltip and beside the lines. */
      unit?: string
      /** A solid emphasis line at this x value. */
      median?: number
      /** The text beside the median line; default "mediaan" with its value and unit. */
      medianLabel?: string
      /** A dashed emphasis line at this x value. */
      threshold?: number
      /** The text beside the threshold line; default "norm" with its value and unit. */
      thresholdLabel?: string
      small?: boolean
    }

export type ChartKind = ChartSpec['kind']

/**
 * What a map draws. `polygons` are areas that carry their own outline (`MapValue.polygon`);
 * `plots` stacks several drawings, from `MapSpec.plots`.
 */
export type MapVariant = 'flows' | 'points' | 'choropleth' | 'polygons' | 'plots' | 'scope-picker'

/** A map point's data colour, by name: one of the data colours, each with its own shape. */
export type MapSeriesKey = DataColor

/** One row of a map: an area, a point or the origin of a flow. */
export interface MapValue {
  /** Key: ISO code for choropleth, place id for points and flows. */
  id: string
  label: string
  value: number | null
  /** Second measure for the selection panel, e.g. the number of files. */
  detail?: string
  lon?: number
  lat?: number
  /** A data colour by name, and with it that colour's shape (rule 13). No series, no legend. */
  series?: MapSeriesKey
  /**
   * The outline of an area that is not in the map's own geometry: a ring of `[lon, lat]` pairs,
   * the first point not repeated. Drawn by `polygons`; a ring of fewer than three points draws
   * nothing.
   */
  polygon?: [number, number][]
  /** A URL the host minted, carried into `lintje-mark-select`. */
  href?: string
}

/**
 * An area drawn on the map to choose what lies in it: a lasso, a ring of `[lon, lat]` pairs with
 * the first point not repeated, or a circle around a `[lon, lat]` centre.
 */
export type MapArea =
  | { kind: 'lasso'; ring: [number, number][] }
  | { kind: 'circle'; centre: [number, number]; radiusKm: number }

/** A tool that draws an area on the map. */
export type MapTool = 'lasso' | 'circle' | 'rect'

/**
 * The parts of a map a host switches on or off. Without a value each keeps its default: every
 * part on, except the drawing tools, which choose for a host that filters on an area. With two
 * or more tools on, one button opens a menu of them.
 */
export interface MapControls {
  /** The + and − buttons, a double click and a pinch. Default on. */
  zoom?: boolean
  /** Zooming on the wheel with Ctrl or ⌘ held. Default on. */
  wheel?: boolean
  /** Panning with the mouse. Default on; on a phone a finger always scrolls the page. */
  drag?: boolean
  /** The reset: the whole area in view and nothing chosen. Default on. */
  reset?: boolean
  /** Choosing with a drawn lasso; sends `lintje-area-select`. Default off. */
  lasso?: boolean
  /** Choosing with a drawn circle; sends `lintje-area-select`. Default off. */
  circle?: boolean
  /** Choosing with a drawn rectangle, sent as a lasso of four corners. Default off. */
  rect?: boolean
  /** A scale bar in km bottom right. Default on. */
  scale?: boolean
  /** The legend above the map: a line per layer with its key and its series. Default on. */
  legend?: boolean
}

/** The basemap the map draws on, a WMS service the host configures. */
export interface WmsBasemap {
  kind: 'wms'
  url: string
  /** Comma separated. */
  layers: string
  /** Default `image/png`. */
  format?: string
  /** Default `1.3.0`, so the request asks for `CRS=EPSG:3857`. */
  version?: string
  /** Default `false`: a basemap is the bottom layer and has nothing to show through. */
  transparent?: boolean
  /** Shown bottom right; the service's terms usually require it. Required. */
  attribution: string
}

/** What one layer of a stacked map draws: a map's variant, without the scope picker. */
export type MapPlotVariant = 'polygons' | 'points' | 'flows' | 'choropleth'

/**
 * One layer of a stacked map. The first layer draws at the bottom and the last on top, except a
 * choropleth, which colours the land itself and so always lies under the rest. The ids are
 * unique across the layers: the map keeps one selection.
 */
export interface MapPlotData {
  variant: MapPlotVariant
  values: MapValue[]
  /** The layer's name in the legend and the CSV; without it the word for its variant. */
  label?: string
  /** The unit of this layer's figures; without it the map's `unit`. */
  unit?: string
  /** For `flows`: where this layer's arcs go; without it the map's `destination`. */
  destination?: { lon: number; lat: number; label: string }
  /**
   * What each series in this layer means, over the map's own `seriesLabels`. A colour may serve
   * several layers; each layer's line in the legend names and switches its own.
   */
  seriesLabels?: Partial<Record<MapSeriesKey, string>>
}

/** The map's data, as `MapData` in `src/types.ts` carries it, without the tile fields. */
export interface MapSpec {
  variant: MapVariant
  geo?: 'world' | 'netherlands'
  /** The marks of a one-variant map; empty with `variant: 'plots'`. */
  values: MapValue[]
  /** With `variant: 'plots'`: the layers, bottom first. */
  plots?: MapPlotData[]
  destination?: { lon: number; lat: number; label: string }
  unit?: string
  description: string
  /** Map height in px; default 400, 280 below 768 px. */
  height?: number
  selectedId?: string | null
  layers?: { value: string; label: string }[]
  /** The `value` of the layer shown; a choice is kept until the host's next `data` changes it. */
  layer?: string
  /** What each series means, keyed by colour name; each used series gets a legend line. */
  seriesLabels?: Partial<Record<MapSeriesKey, string>>
  /** The label of the link in the selection panel; default "Zet als bereik". */
  selectLabel?: string
  /** The URL that undoes the selection, for a page that keeps it in the URL. */
  clearHref?: string
  /** Tiles under the map: Leaflet draws the basemap, the map draws its data over it. */
  basemap?: WmsBasemap
  /** Which parts of the map show and answer; each left out keeps its default. */
  controls?: MapControls
  /** The area the host keeps, from its URL: adopted when it changes, as `selectedId` is. */
  selectedArea?: MapArea | null
}
