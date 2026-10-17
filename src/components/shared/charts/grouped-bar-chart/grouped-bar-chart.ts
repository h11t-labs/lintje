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
import { layerMotion, layerWeights } from '../shared/layer-motion'
import { markSelection } from '../shared/mark-select'
import { plotKeys, renderPlotStatus } from '../shared/plot-keys'
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

  const series = spec.series.map((row, j) => ({
    ...row,
    color:
      chartColor(row.color) ?? (j === 0 ? DEFAULT_SERIES_COLOR : 'var(--color-chart-secondary)'),
    hidden: controller.hiddenSeries.includes(row.label),
  }))
  const visible = series.filter((row) => !row.hidden)
  const selection = markSelection(
    options,
    visible.flatMap((row) => row.links ?? []),
  )
  // Every series sets the scale, so switching one off moves nothing up or down.
  const { max, ticks } = axisScale(Math.max(...series.flatMap((row) => row.values), 1))
  const axis = axisColumn(ticks, controller.width, { fontFamily: controller.fontFamily })
  const area = chartArea(options, { left: axis.width })
  const baseline = area.height - area.bottom
  const slotWidth = band(0, labels.length, area).width / Math.max(1, visible.length)
  // A bar switched off narrows out and its neighbours close up; its nodes stay, so switched back
  // on it widens in place rather than drawing in again.
  const weights = layerWeights(
    controller,
    series.map((row) => row.label).join('\u0000'),
    series.map((row) => (row.hidden ? 0 : 1)),
  )
  const motion = layerMotion(controller)
  const unit =
    band(0, labels.length, area).width /
    Math.max(
      1,
      weights.reduce((a, b) => a + b, 0),
    )
  const offsets = weights.map((_, j) => weights.slice(0, j).reduce((a, b) => a + b, 0) * unit)
  // Labels only if each fits its slot; adjacent slots are 2 px apart.
  const showLabels = visible.every((row) =>
    row.values.every((value) => dataLabelFits(formatDataLabel(value, slotWidth), slotWidth - 2)),
  )

  const legend: LegendItem[] = series.map((row) => ({
    label: row.label,
    color: row.color,
    shape: 'square',
    hidden: row.hidden,
    fixed: series.length < 2,
  }))

  const contentAt = (i: number): TooltipContent => ({
    title: labels[i],
    rows: visible.map((row) => ({
      label: row.label,
      value: formatNumber(row.values[i]),
      color: row.color,
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
        ${series.map((row, j) => {
          const value = row.values[i]
          const y = yPosition(value, max, area)
          const x = group.x + offsets[j]
          const width = Math.max(0, weights[j] * unit - 2)
          // A bar switched off is no mark: not to the pointer, the keyboard or the reader.
          const mark = row.hidden
            ? undefined
            : selection.of(
                row.links?.[i],
                `${label} · ${row.label}`,
                `${label}, ${row.label}: ${formatNumber(value)}`,
              )
          return svg`
            <g>
              <rect class="lintje-chart__bar lintje-chart__mark ${mark?.state ?? ''}"
                    x=${x} y=${y} width=${width}
                    height=${Math.max(0, baseline - y)} fill=${row.color}
                    data-mark-id=${mark?.markId ?? nothing} role=${mark?.role ?? nothing}
                    tabindex=${mark?.tabIndex ?? nothing} aria-pressed=${mark?.pressed ?? nothing}
                    aria-label=${mark?.label ?? nothing} aria-hidden=${mark ? nothing : 'true'}
                    @click=${mark?.click ?? nothing} @auxclick=${mark?.click ?? nothing} @keydown=${mark?.keydown ?? nothing} />
              <!-- Every label keeps its node and fades, so one that fits after a switch does not
                   draw in again. -->
              <g class="lintje-chart__series ${!row.hidden && showLabels ? '' : 'is-off'}">
                <text x=${x + width / 2} y=${y - 4} text-anchor="middle"
                      class="lintje-chart__data-label">${formatDataLabel(value, slotWidth)}</text>
              </g>
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
      ${renderLegend({ items: legend, onToggle: (key) => controller.toggleSeries(key) })}
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
        svg`<g ${ref(motion.attach)}>${marks}</g>`,
      )}
      ${renderTooltip(controller)}
      ${renderPlotStatus(controller)}
    </div>
  `
}
