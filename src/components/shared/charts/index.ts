/**
 * The charts as lit-html templates: `renderChart(spec, options)` draws any `ChartSpec`,
 * `renderMap` a map. See README.md for the contract.
 */
export { renderChart } from './shared/render-chart'
export { renderLineChart } from './line-chart/line-chart'
export { renderBarChart, TINTS } from './bar-chart/bar-chart'
export { renderHorizontalBarChart, rowsHeight } from './horizontal-bar-chart/horizontal-bar-chart'
export { renderTargetProgressChart } from './target-progress-chart/target-progress-chart'
export { renderGroupedBarChart } from './grouped-bar-chart/grouped-bar-chart'
export { renderStackedBarChart } from './stacked-bar-chart/stacked-bar-chart'
export { renderPieChart } from './pie-chart/pie-chart'
export { renderDualAxisChart } from './dual-axis-chart/dual-axis-chart'
export { renderHeatmap, heatmapBounds, heatmapClasses } from './heatmap-chart/heatmap-chart'
export type { HeatmapClass } from './heatmap-chart/heatmap-chart'
export { renderMap } from './map-chart/map-chart'
export type { MapOptions } from './map-chart/map-chart'

export { renderChartFrame, renderLegend, renderAsOfMarker } from './shared/axes'
export type { ChartFrameOptions, LegendItem, SvgSlot } from './shared/axes'
export { renderTooltip } from './shared/tooltip'
export {
  renderChartSkeleton,
  renderChartEmpty,
  renderChartError,
  liveAnnouncement,
} from './shared/chart-states'
export type { ChartSkeletonKind } from './shared/chart-states'

export { ChartController, chartArea } from './shared/controller'
export type {
  ChartOptions,
  MeasureSpec,
  TooltipContent,
  TooltipRow,
  TooltipState,
} from './shared/controller'
export { markSelection } from './shared/mark-select'
export type { ChartSelection, MarkAttributes, MarkSelection } from './shared/mark-select'
export { chartColor } from './shared/colors'
export { tintsFor } from './shared/tints'
export { DATA_COLORS, chartToken, isDataColor } from '../../../tokens/colors'
export type { DataColor } from '../../../tokens/colors'
export * from './shared/scale'
export * from '../../../core/format'
export { staggerStyle, gridStaggerStyle } from './shared/stagger'
export type { StyleInfo } from './shared/stagger'
export { chartStyles, chartFrameStyles, pieChartStyles, heatmapStyles } from './shared/chart-styles'
export { mapStyles, mapChartStyles } from './map-chart/map-styles'
export type {
  ChartSpec,
  ChartKind,
  ChartColor,
  ChartLink,
  LineSeriesData,
  BarSeriesData,
  MapSpec,
  MapValue,
  MapVariant,
  MapPlotData,
  MapPlotVariant,
} from './shared/types'
