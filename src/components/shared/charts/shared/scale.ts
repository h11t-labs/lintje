/** Scale helpers for the hand-made SVG charts. Pure geometry. */

import {
  formatCompactNumber,
  formatNumber,
  textWidth,
  truncateToWidth,
} from '../../../../core/format'

export interface PlotArea {
  width: number
  height: number
  left: number
  right: number
  top: number
  bottom: number
}

/** The margins a chart starts from; `left` is the fallback when there is no measured axis column. */
export const DEFAULT_PLOT_AREA: PlotArea = {
  width: 900,
  height: 264,
  left: 52,
  right: 8,
  top: 16,
  bottom: 28,
}

export const AXIS_GAP = 8
export const AXIS_COLUMN_MAX = 96
export const AXIS_COLUMN_SHARE = 0.25
// Never narrower than this, so a centered first x label still shows.
const AXIS_COLUMN_MIN = 16

const ROW_LABEL_GAP = 10
export const ROW_LABEL_SHARE = 0.3
export const ROW_LABEL_MAX = 320

export interface RowLabelColumn {
  /** Where the labels end (`text-anchor="end"`). */
  labelEnd: number
  barStart: number
  /** A label as drawn: whole when it fits the column, otherwise shortened with an ellipsis. */
  fit: (label: string) => string
}

/**
 * The label column of a chart with a label per row: as wide as the widest label, capped at
 * `ROW_LABEL_SHARE` of the chart and `ROW_LABEL_MAX`.
 */
export function rowLabelColumn(
  labels: string[],
  chartWidth: number,
  { fontFamily = '' }: { fontFamily?: string } = {},
): RowLabelColumn {
  const cap = Math.min(ROW_LABEL_MAX, Math.round(chartWidth * ROW_LABEL_SHARE))
  const widest = Math.ceil(Math.max(0, ...labels.map((label) => textWidth(label, fontFamily))))
  const labelEnd = Math.min(cap, widest)
  return {
    labelEnd,
    barStart: labelEnd + ROW_LABEL_GAP,
    fit: (label) => truncateToWidth(label, labelEnd, fontFamily),
  }
}

export interface AxisColumn {
  width: number
  /** How the ticks are written: in full, or compact when full does not fit the caps. */
  format: (tick: number) => string
}

/**
 * The column an axis takes: its widest tick label (measured) plus the gap, capped by
 * `AXIS_COLUMN_MAX` and `AXIS_COLUMN_SHARE`; past the caps the ticks go compact ("1,2 mln").
 */
export function axisColumn(
  ticks: number[],
  chartWidth: number,
  { minimum = AXIS_COLUMN_MIN, fontFamily = '' }: { minimum?: number; fontFamily?: string } = {},
): AxisColumn {
  const cap = Math.min(AXIS_COLUMN_MAX, Math.round(chartWidth * AXIS_COLUMN_SHARE))
  const needed = (format: (tick: number) => string) =>
    Math.ceil(Math.max(0, ...ticks.map((tick) => textWidth(format(tick), fontFamily))) + AXIS_GAP)
  let format = formatNumber
  let width = needed(format)
  if (width > cap) {
    format = formatCompactNumber
    width = needed(format)
  }
  return { width: Math.min(cap, Math.max(minimum, width)), format }
}

export function plotWidth(v: PlotArea): number {
  return v.width - v.left - v.right
}
function plotHeight(v: PlotArea): number {
  return v.height - v.top - v.bottom
}

export function axisScale(max: number, steps = 4): { max: number; ticks: number[] } {
  if (max <= 0) return { max: 1, ticks: [0, 1] }
  const raw = max / steps
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)))
  const normalized = raw / magnitude
  const step =
    (normalized <= 1
      ? 1
      : normalized <= 2
        ? 2
        : normalized <= 2.5
          ? 2.5
          : normalized <= 5
            ? 5
            : 10) * magnitude
  const top = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let t = 0; t <= top + 1e-9; t += step) ticks.push(Number(t.toFixed(6)))
  return { max: top, ticks }
}

export function yPosition(value: number, max: number, v: PlotArea): number {
  return v.top + plotHeight(v) * (1 - value / max)
}

export function xPosition(index: number, count: number, v: PlotArea): number {
  if (count <= 1) return v.left + plotWidth(v) / 2
  return v.left + (plotWidth(v) * index) / (count - 1)
}

export function band(index: number, count: number, v: PlotArea, margin = 0.22) {
  const b = plotWidth(v) / count
  const w = b * (1 - margin)
  return {
    x: v.left + b * index + (b - w) / 2,
    width: w,
    center: v.left + b * index + b / 2,
    bandWidth: b,
  }
}
