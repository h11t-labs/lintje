/** Grouped bars: several variables side by side per category; the second is the comparison. */
import { html, svg, nothing, type TemplateResult } from 'lit'
import { ref } from 'lit/directives/ref.js'
import { styleProps } from '../../../../core/style-props'
import { axisColumn, axisScale, band, yPosition } from '../shared/scale'
import { formatNumber, formatDataLabel, dataLabelFits } from '../../../../core/format'
import { staggerStyle } from '../shared/stagger'
import { DEFAULT_SERIES_COLOR, chartColor } from '../shared/colors'
import { renderChartFrame, renderLegend, type LegendItem, type SvgSlot } from '../shared/axes'
import { renderTooltip } from '../shared/tooltip'
import { chartArea, type ChartOptions, type TooltipContent } from '../shared/controller'
import { markSelection } from '../shared/mark-select'
import { plotKeys, renderPlotStatus } from '../shared/plot-keys'
import { TINTS } from '../bar-chart/bar-chart'
import type { ChartSpec } from '../shared/types'

type GroupedBarSpec = Extract<ChartSpec, { kind: 'grouped-bar' }>

export function renderGroupedBarChart(spec: GroupedBarSpec, options: ChartOptions): TemplateResult {
  const { controller, description } = options
  const { labels, axisTitle, small = false } = spec
  const id = controller.id

  controller.measure({
    width: true,
    height: options.height ?? (small ? '--chart-h-small' : '--chart-h-main'),
    // In the modal the token is the body's inner height; the legend and axis title come off it.
    fit: Boolean(options.expanded) && !options.mobile,
  })

  const series = spec.series.map((row) => ({ ...row, color: chartColor(row.color) }))
  const visible = series.filter((row) => !controller.hiddenSeries.includes(row.label))
  const selection = markSelection(
    options,
    visible.flatMap((row) => row.links ?? []),
  )
  const { max, ticks } = axisScale(Math.max(...visible.flatMap((row) => row.values), 1))
  const axis = axisColumn(ticks, controller.width, { fontFamily: controller.fontFamily })
  const area = chartArea(options, { left: axis.width })
  const baseline = area.height - area.bottom
  const slotWidth = band(0, labels.length, area).width / Math.max(1, visible.length)
  // Labels only if each fits its slot; adjacent slots are 2 px apart.
  const showLabels = visible.every((row) =>
    row.values.every((value) => dataLabelFits(formatDataLabel(value, slotWidth), slotWidth - 2)),
  )

  const legend: LegendItem[] = series.map((row, i) => ({
    label: row.label,
    color: row.color ?? (i === 0 ? DEFAULT_SERIES_COLOR : 'var(--color-chart-secondary)'),
    shape: 'square',
    hidden: controller.hiddenSeries.includes(row.label),
  }))
  const colorOf = (row: (typeof series)[number], slot: number) =>
    legend[series.indexOf(row)]?.color ?? TINTS[slot]

  const contentAt = (i: number): TooltipContent => ({
    title: labels[i],
    rows: visible.map((row, slot) => ({
      label: row.label,
      value: formatNumber(row.values[i]),
      color: colorOf(row, slot),
    })),
  })
  const keys = plotKeys(controller, labels.length, (i) => ({
    x: band(i, labels.length, area).center,
    y: yPosition(Math.max(0, ...visible.map((row) => row.values[i])), max, area),
    content: contentAt(i),
  }))

  const marks: SvgSlot = labels.map((label, i) => {
    const group = band(i, labels.length, area)
    return svg`
      <g class="lintje-chart__bar-group ${controller.hoverIndex === i ? 'is-hovered' : ''}"
         ${styleProps(staggerStyle(i, labels.length))}
         @mousemove=${(event: MouseEvent) => controller.showTooltip(event, contentAt(i))}
         @mouseleave=${() => controller.hideTooltip()}>
        ${visible.map((row, slot) => {
          const value = row.values[i]
          const y = yPosition(value, max, area)
          const color = colorOf(row, slot)
          const mark = selection.of(
            row.links?.[i],
            `${label} · ${row.label}`,
            `${label}, ${row.label}: ${formatNumber(value)}`,
          )
          return svg`
            <g>
              <rect class="lintje-chart__bar lintje-chart__mark ${mark.state}"
                    x=${group.x + slot * slotWidth} y=${y} width=${slotWidth - 2}
                    height=${Math.max(0, baseline - y)} fill=${color}
                    data-mark-id=${mark.markId} role=${mark.role} tabindex=${mark.tabIndex}
                    aria-pressed=${mark.pressed} aria-label=${mark.label}
                    @click=${mark.click} @keydown=${mark.keydown} />
              ${
                showLabels
                  ? svg`<text x=${group.x + slot * slotWidth + (slotWidth - 2) / 2} y=${y - 4}
                            text-anchor="middle" class="lintje-chart__data-label">${formatDataLabel(value, slotWidth)}</text>`
                  : nothing
              }
            </g>
          `
        })}
      </g>
    `
  })

  return html`
    <div class="lintje-chart-wrap ${small ? 'lintje-chart--small' : ''}"
         ${ref(controller.attach)} ?data-in-view=${controller.inView} data-tooltip-anchor
         @keydown=${(event: KeyboardEvent) => controller.dismiss(event) || selection.escape(event)}>
      ${renderLegend({ items: legend, onToggle: (label) => controller.toggleSeries(label) })}
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
