/** Stacked bars, sequential and normalized to 100 %: tints of one color, darkest at the bottom. */
import { html, svg, nothing, type TemplateResult } from 'lit'
import { ref } from 'lit/directives/ref.js'
import { styleProps } from '../../../../core/style-props'
import { axisColumn, axisScale, band, yPosition } from '../shared/scale'
import {
  formatNumber,
  formatPercent,
  formatDataLabel,
  dataLabelFits,
} from '../../../../core/format'
import { staggerStyle } from '../shared/stagger'
import { chartColor } from '../shared/colors'
import { renderChartFrame, renderLegend, type LegendItem, type SvgSlot } from '../shared/axes'
import { renderTooltip } from '../shared/tooltip'
import { chartArea, type ChartOptions, type TooltipContent } from '../shared/controller'
import { markSelection } from '../shared/mark-select'
import { plotKeys, renderPlotStatus } from '../shared/plot-keys'
import { tintsFor } from '../shared/tints'
import type { ChartSpec } from '../shared/types'

type StackedBarSpec = Extract<ChartSpec, { kind: 'stacked-bar' }>

/** The data colours white text reaches 4.5:1 on; a label on any other fill is ink. */
const DARK_FILLS = new Set([
  'sky-blue',
  'red',
  'green',
  'violet',
  'dark-green',
  'purple',
  'ruby-red',
  'dark-brown',
  'brown',
  'dark-blue',
  'moss-green',
])

export function renderStackedBarChart(spec: StackedBarSpec, options: ChartOptions): TemplateResult {
  const { controller, description } = options
  const { labels, axisTitle, normalized = false, totalOnTop = true, small = false } = spec
  const id = controller.id

  controller.measure({
    width: true,
    height: options.height ?? (small ? '--chart-h-small' : '--chart-h-main'),
    // In the modal the token is the body's inner height; the legend and axis title come off it.
    fit: Boolean(options.expanded) && !options.mobile,
  })

  const series = spec.series.map((row) => ({ ...row, color: chartColor(row.color) }))
  const selection = markSelection(
    options,
    series.flatMap((row) => row.links ?? []),
  )
  const totals = labels.map((_, i) => series.reduce((sum, row) => sum + row.values[i], 0))
  const { max, ticks } = normalized
    ? { max: 100, ticks: [0, 25, 50, 75, 100] }
    : axisScale(Math.max(...totals, 1))
  const axis = axisColumn(ticks, controller.width, { fontFamily: controller.fontFamily })
  const area = chartArea(options, { left: axis.width })
  const baseline = area.height - area.bottom
  const { width: barWidth, bandWidth } = band(0, labels.length, area)
  // Totals only if each one fits its band with 4 px to spare.
  const showTotals =
    totalOnTop &&
    !normalized &&
    totals.every((total) => dataLabelFits(formatDataLabel(total, bandWidth), bandWidth - 4))

  // The ladder spreads with the number of series, as the pie spreads its parts. The stacking
  // order carries meaning, so the series are neither sorted nor folded: past five they keep
  // the lightest tint.
  const tints = tintsFor(series.length)
  const colorFor = (row: { color?: string }, i: number) =>
    row.color ?? tints[Math.min(i, tints.length - 1)]

  // Without a colour of its own a series is a rung of the ladder: only the darkest carries white.
  const insideLabel = (j: number) => {
    const named = spec.series[j].color
    const dark = named == null ? j === 0 : DARK_FILLS.has(named)
    return dark ? 'lintje-chart__data-label--inside' : 'lintje-chart__data-label--inside-light'
  }

  const contentAt = (i: number): TooltipContent => ({
    title: labels[i],
    rows: series.map((row, j) => ({
      label: row.label,
      value: normalized
        ? formatPercent((row.values[i] / totals[i]) * 100)
        : formatNumber(row.values[i]),
      color: colorFor(row, j),
    })),
  })
  const keys = plotKeys(controller, labels.length, (i) => ({
    x: band(i, labels.length, area).center,
    y: yPosition(normalized ? max : totals[i], max, area),
    content: contentAt(i),
  }))

  const legend: LegendItem[] = series.map((row, i) => ({
    label: row.label,
    color: colorFor(row, i),
    shape: 'square',
  }))

  const marks: SvgSlot = labels.map((label, i) => {
    const group = band(i, labels.length, area)
    let cumulative = 0
    const segments = series.map((row, j) => {
      const raw = row.values[i]
      const value = normalized ? (raw / totals[i]) * 100 : raw
      const y0 = yPosition(cumulative, max, area)
      cumulative += value
      const y1 = yPosition(cumulative, max, area)
      return { row, j, value, y1, height: Math.max(0, y0 - y1) }
    })
    return svg`
      <g class="lintje-chart__bar-group ${controller.hoverIndex === i ? 'is-hovered' : ''}"
         ${styleProps(staggerStyle(i, labels.length))}
         @mousemove=${(event: MouseEvent) => controller.showTooltip(event, contentAt(i))}
         @mouseleave=${() => controller.hideTooltip()}>
        <!-- The hit area under the whole column, so the tooltip also follows the empty
             space above the stack. It lies *under* the segments: on top it swallowed
             every click on a segment that drills. -->
        <rect x=${group.x} y=${area.top} width=${group.width} height=${baseline - area.top} fill="transparent" />
        <!-- The segments in one group, so the column lifts on hover as a whole. -->
        <g class="lintje-chart__bar">
          ${segments.map((segment) => {
            const mark = selection.of(
              segment.row.links?.[i],
              `${label} · ${segment.row.label}`,
              `${label}, ${segment.row.label}: ${formatNumber(segment.row.values[i])}`,
            )
            return svg`
            <rect class="lintje-chart__mark lintje-chart__segment ${mark.state}"
                  x=${group.x} y=${segment.y1} width=${group.width} height=${segment.height}
                  fill=${colorFor(segment.row, segment.j)}
                  data-mark-id=${mark.markId} role=${mark.role} tabindex=${mark.tabIndex}
                  aria-pressed=${mark.pressed} aria-label=${mark.label}
                  @click=${mark.click} @keydown=${mark.keydown} />
          `
          })}
        </g>
        <!-- Percentages inside the segments when they are >= 16 px tall and fit the width. -->
        ${
          normalized
            ? segments.map((segment) =>
                segment.height >= 16 && dataLabelFits(formatPercent(segment.value), barWidth - 4)
                  ? svg`<text x=${group.center} y=${segment.y1 + segment.height / 2 + 4} text-anchor="middle"
                        class="lintje-chart__data-label ${insideLabel(segment.j)}">${formatPercent(segment.value)}</text>`
                  : nothing,
              )
            : nothing
        }
        ${
          showTotals
            ? svg`<text x=${group.center} y=${yPosition(totals[i], max, area) - 5} text-anchor="middle"
                      class="lintje-chart__data-label" font-weight="700">${formatDataLabel(totals[i], group.bandWidth)}</text>`
            : nothing
        }
      </g>
    `
  })

  return html`
    <div class="lintje-chart-wrap ${small ? 'lintje-chart--small' : ''}"
         ${ref(controller.attach)} ?data-in-view=${controller.inView} data-tooltip-anchor
         @keydown=${(event: KeyboardEvent) => controller.dismiss(event) || selection.escape(event)}>
      ${renderLegend({ items: legend })}
      ${renderChartFrame(
        {
          fontFamily: controller.fontFamily,
          id,
          ticks,
          max,
          area,
          axisTitle,
          description,
          formatTick: axis.format,
          xLabels: labels.map((label, i) => ({ label, x: band(i, labels.length, area).center })),
          interactive: selection.interactive,
          keys,
        },
        marks,
      )}
      ${renderTooltip(controller)}
      ${renderPlotStatus(controller)}
    </div>
  `
}
