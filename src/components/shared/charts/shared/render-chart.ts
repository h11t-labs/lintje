/**
 * `renderChart(spec, options)` draws any `ChartSpec` by its kind. It stands apart from the
 * barrel so the chart tile can import it without the map and Leaflet.
 */
import type { TemplateResult } from 'lit'
import type { ChartOptions } from './controller'
import type { ChartSpec } from './types'
import { renderLineChart } from '../line-chart/line-chart'
import { renderBarChart } from '../bar-chart/bar-chart'
import { renderHorizontalBarChart } from '../horizontal-bar-chart/horizontal-bar-chart'
import { renderTargetProgressChart } from '../target-progress-chart/target-progress-chart'
import { renderGroupedBarChart } from '../grouped-bar-chart/grouped-bar-chart'
import { renderStackedBarChart } from '../stacked-bar-chart/stacked-bar-chart'
import { renderPieChart } from '../pie-chart/pie-chart'
import { renderDualAxisChart } from '../dual-axis-chart/dual-axis-chart'
import { renderScatterChart } from '../scatter-chart/scatter-chart'
import { renderHeatmap } from '../heatmap-chart/heatmap-chart'
import { renderHistogramChart } from '../histogram-chart/histogram-chart'

export function renderChart(spec: ChartSpec, options: ChartOptions): TemplateResult {
  switch (spec.kind) {
    case 'line':
      return renderLineChart(spec, options)
    case 'bar':
      return renderBarChart(spec, options)
    case 'horizontal-bar':
      return renderHorizontalBarChart(spec, options)
    case 'target-progress':
      return renderTargetProgressChart(spec, options)
    case 'grouped-bar':
      return renderGroupedBarChart(spec, options)
    case 'stacked-bar':
      return renderStackedBarChart(spec, options)
    case 'pie':
      return renderPieChart(spec, options)
    case 'dual-axis':
      return renderDualAxisChart(spec, options)
    case 'scatter':
      return renderScatterChart(spec, options)
    case 'heatmap':
      return renderHeatmap(spec, options)
    case 'histogram':
      return renderHistogramChart(spec, options)
  }
}
