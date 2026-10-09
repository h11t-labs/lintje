/**
 * The charts' CSS for a host that renders into a shadow root: `static styles = [...chartStyles]`.
 * The button reset, `visually-hidden` and the keyframes come from `tokens/base.css`.
 */
import { unsafeCSS, type CSSResult } from 'lit'
import { iconStyles } from '../../../../icons/render'
import chart from './chart.css?inline'
import pie from '../pie-chart/pie-chart.css?inline'
import heatmap from '../heatmap-chart/heatmap-chart.css?inline'

export const chartFrameStyles: CSSResult = unsafeCSS(chart)
export const pieChartStyles: CSSResult = unsafeCSS(pie)
export const heatmapStyles: CSSResult = unsafeCSS(heatmap)

/** Everything a chart needs, in one list; the map adds `mapStyles`. */
export const chartStyles: CSSResult[] = [
  chartFrameStyles,
  pieChartStyles,
  heatmapStyles,
  iconStyles,
]
