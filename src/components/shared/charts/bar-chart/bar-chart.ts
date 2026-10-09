/**
 * Vertical bars with data labels and an optional trend line. When one label doesn't fit,
 * all data labels drop rather than leaving single bars unlabeled.
 */
import { html, svg, nothing, type TemplateResult } from 'lit'
import { ref } from 'lit/directives/ref.js'
import { styleProps } from '../../../../core/style-props'
import { axisColumn, axisScale, band, yPosition } from '../shared/scale'
import { formatNumber, formatDataLabel, dataLabelFits } from '../../../../core/format'
import { staggerStyle } from '../shared/stagger'
import { DEFAULT_SERIES_COLOR, chartColor } from '../shared/colors'
import { renderChartFrame, type SvgSlot } from '../shared/axes'
import { renderTooltip } from '../shared/tooltip'
import { chartArea, type ChartOptions, type TooltipContent } from '../shared/controller'
import { markSelection } from '../shared/mark-select'
import { plotKeys, renderPlotStatus } from '../shared/plot-keys'
import type { ChartSpec } from '../shared/types'

/** Tints of one color, for a subdivision of a single variable. */
export const TINTS = [
  'var(--color-chart-tint-1)',
  'var(--color-chart-tint-2)',
  'var(--color-chart-tint-3)',
  'var(--color-chart-tint-4)',
  'var(--color-chart-tint-5)',
]

type BarSpec = Extract<ChartSpec, { kind: 'bar' }>

export function renderBarChart(spec: BarSpec, options: ChartOptions): TemplateResult {
  const { controller, description } = options
  const { labels, values, axisTitle, trend, dataLabels = true, small = false, links } = spec
  const color = chartColor(spec.color) ?? DEFAULT_SERIES_COLOR
  const id = controller.id
  const selection = markSelection(options, links ?? [])

  controller.measure({
    width: true,
    height: options.height ?? (small ? '--chart-h-small' : '--chart-h-main'),
    // In the modal the token is the body's inner height; the legend and axis title come off it.
    fit: Boolean(options.expanded) && !options.mobile,
  })

  const actualValues = values.filter((value): value is number => value != null)
  const { max, ticks } = axisScale(Math.max(...actualValues, 1))
  const axis = axisColumn(ticks, controller.width, { fontFamily: controller.fontFamily })
  const area = chartArea(options, { left: axis.width })
  const baseline = area.height - area.bottom
  // Labels only if each fits its band with 4 px to spare.
  const { width: barWidth, bandWidth } = band(0, labels.length, area)
  const showLabels =
    dataLabels &&
    values.every(
      (value) => value == null || dataLabelFits(formatDataLabel(value, barWidth), bandWidth - 4),
    )

  const contentAt = (i: number): TooltipContent => ({
    title: labels[i],
    rows: [
      {
        label: axisTitle ?? 'Waarde',
        value: values[i] == null ? 'geen gegevens' : formatNumber(values[i]!),
        color,
      },
    ],
  })
  const keys = plotKeys(controller, labels.length, (i) => ({
    x: band(i, labels.length, area).center,
    y: values[i] == null ? area.top : yPosition(values[i]!, max, area),
    content: contentAt(i),
  }))

  const marks: SvgSlot = [
    values.map((value, i) => {
      const slot = band(i, labels.length, area)
      // A missing value is no bar of height 0: its slot is hatched over the plot's height (rule 15).
      if (value == null) {
        return svg`<rect class="lintje-chart__missing" x=${slot.x} y=${area.top} width=${slot.width}
                         height=${Math.max(0, baseline - area.top)} fill="url(#hatch-${id})"
                         @mousemove=${(event: MouseEvent) => controller.showTooltip(event, contentAt(i))}
                         @mouseleave=${() => controller.hideTooltip()} />`
      }
      const y = yPosition(value, max, area)
      const mark = selection.of(links?.[i], labels[i], `${labels[i]}: ${formatNumber(value)}`)
      return svg`
        <g class="lintje-chart__bar-group ${controller.hoverIndex === i ? 'is-hovered' : ''}"
           ${styleProps(staggerStyle(i, labels.length))}
           @mousemove=${(event: MouseEvent) => controller.showTooltip(event, contentAt(i))}
           @mouseleave=${() => controller.hideTooltip()}>
          <rect class="lintje-chart__bar lintje-chart__mark ${mark.state}"
                x=${slot.x} y=${y} width=${slot.width} height=${Math.max(0, baseline - y)} fill=${color}
                data-mark-id=${mark.markId} role=${mark.role} tabindex=${mark.tabIndex}
                aria-pressed=${mark.pressed} aria-label=${mark.label}
                @click=${mark.click} @keydown=${mark.keydown} />
          ${
            showLabels
              ? svg`<text x=${slot.center} y=${y - 5} text-anchor="middle" class="lintje-chart__data-label">
                    ${formatDataLabel(value, slot.width)}
                  </text>`
              : nothing
          }
        </g>
      `
    }),
    trend
      ? svg`<polyline
          fill="none" stroke="var(--color-chart-emphasis)" stroke-width="1.5" stroke-dasharray="5 4"
          points=${trend
            .map((value, i) =>
              value == null
                ? null
                : `${band(i, labels.length, area).center},${yPosition(value, max, area)}`,
            )
            .filter(Boolean)
            .join(' ')} />`
      : nothing,
  ]

  return html`
    <div class="lintje-chart-wrap ${small ? 'lintje-chart--small' : ''}"
         ${ref(controller.attach)} ?data-in-view=${controller.inView} data-tooltip-anchor
         @keydown=${(event: KeyboardEvent) => controller.dismiss(event) || selection.escape(event)}>
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
