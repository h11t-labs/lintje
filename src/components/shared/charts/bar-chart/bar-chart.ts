/**
 * Vertical bars with data labels, an optional trend line and a forecast. When one label doesn't
 * fit, all data labels drop rather than leaving single bars unlabeled. A forecast bar is open,
 * never the full colour of a measured one.
 */
import { html, svg, nothing, type TemplateResult } from 'lit'
import { ref } from 'lit/directives/ref.js'
import { styleProps } from '../../../../core/style-props'
import { DEFAULT_PLOT_AREA, axisColumn, axisScale, band, yPosition } from '../shared/scale'
import { formatNumber, formatDataLabel, dataLabelFits } from '../../../../core/format'
import { staggerStyle } from '../shared/stagger'
import { DEFAULT_SERIES_COLOR, chartColor, lineCasing } from '../shared/colors'
import { renderAsOfMarker, renderChartFrame, renderLegend, type SvgSlot } from '../shared/axes'
import { renderTooltip } from '../shared/tooltip'
import { chartArea, type ChartOptions, type TooltipContent } from '../shared/controller'
import { markSelection } from '../shared/mark-select'
import { nearestHit, type MarkBox } from '../shared/nearest-mark'
import { plotKeys, renderPlotStatus } from '../shared/plot-keys'
import { LONE_POINT_RADIUS, knownRuns } from '../shared/runs'
import {
  FORECAST_LABEL,
  FORECAST_ROOM,
  INTERVAL_LABEL,
  boundsAt,
  forecastStart,
  hasInterval,
  intervalRow,
  intervalValues,
} from '../shared/forecast'
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

/** The width of the caps on a forecast bar's margin. */
const INTERVAL_CAP = 8

export function renderBarChart(spec: BarSpec, options: ChartOptions): TemplateResult {
  const { controller, description } = options
  const { labels, values, axisTitle, trend, dataLabels = true, small = false, links } = spec
  const color = chartColor(spec.color) ?? DEFAULT_SERIES_COLOR
  const from = forecastStart(spec.forecastFrom, labels.length)
  const forecastLabel = spec.forecastLabel ?? FORECAST_LABEL
  const name = axisTitle ?? 'Waarde'
  // The edge of an open bar and its margin: a light colour's dark edge, so it reaches 3:1.
  const edge = lineCasing(color) ?? color
  const isForecast = (i: number) => from != null && i >= from
  const id = controller.id
  const selection = markSelection(options, links ?? [])

  controller.measure({
    width: true,
    height: options.height ?? (small ? '--chart-h-small' : '--chart-h-main'),
    // In the modal the token is the body's inner height; the legend and axis title come off it.
    fit: Boolean(options.expanded) && !options.mobile,
  })

  const actualValues = [...values, ...(from != null ? intervalValues(spec.forecast) : [])].filter(
    (value): value is number => value != null,
  )
  const { max, ticks } = axisScale(Math.max(...actualValues, 1))
  const axis = axisColumn(ticks, controller.width, { fontFamily: controller.fontFamily })
  const area = chartArea(options, {
    left: axis.width,
    ...(from != null ? { top: DEFAULT_PLOT_AREA.top + FORECAST_ROOM } : {}),
  })
  // The margin of a forecast bar, clamped to the plot; none without both bounds.
  const intervalAt = (i: number) => {
    if (!isForecast(i) || values[i] == null) return null
    const { low, high } = boundsAt(spec.forecast, i)
    if (low == null || high == null) return null
    const clamp = (value: number) => yPosition(Math.min(max, Math.max(0, value)), max, area)
    return { top: clamp(high), bottom: clamp(low) }
  }
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
    ...(isForecast(i) ? { note: forecastLabel.toLowerCase() } : {}),
    rows: [
      {
        label: name,
        value: values[i] == null ? 'geen gegevens' : formatNumber(values[i]!),
        color,
        ...(isForecast(i) ? { marker: 'open' as const } : {}),
      },
      ...(isForecast(i) && spec.forecast ? [intervalRow(spec.forecast, i)] : []),
    ],
  })
  const keys = plotKeys(controller, labels.length, (i) => ({
    x: band(i, labels.length, area).center,
    y:
      values[i] == null
        ? area.top
        : Math.min(yPosition(values[i]!, max, area), intervalAt(i)?.top ?? Infinity),
    content: contentAt(i),
  }))
  // Between the band of the last measured bar and that of the first forecast one.
  const boundary = from != null ? band(from, labels.length, area) : null
  const boundaryX = boundary ? boundary.center - boundary.bandWidth / 2 : 0

  // A missing value breaks the trend, as it breaks a line (rule 15).
  const trendRuns = knownRuns(trend ?? [], (value, i) => ({
    x: band(i, labels.length, area).center,
    y: yPosition(value, max, area),
  }))

  const boxes: MarkBox[] = []
  const marks: SvgSlot = [
    values.map((value, i) => {
      const slot = band(i, labels.length, area)
      // A missing value is no bar of height 0: its slot is hatched over the plot's height (rule 15).
      if (value == null) {
        return svg`<rect class="lintje-chart__missing" x=${slot.x} y=${area.top} width=${slot.width}
                         height=${Math.max(0, baseline - area.top)} fill="url(#hatch-${id})"
                         @mousemove=${(event: MouseEvent) => keys.point(event, i)}
                         @mouseleave=${keys.leave} />`
      }
      const y = yPosition(value, max, area)
      const ahead = isForecast(i)
      const interval = intervalAt(i)
      const mark = selection.of(
        links?.[i],
        labels[i],
        `${labels[i]}${ahead ? ` ${forecastLabel.toLowerCase()}` : ''}: ${formatNumber(value)}`,
      )
      // An open bar keeps its edge inside its band.
      const inset = ahead ? 0.75 : 0
      boxes.push({ x: slot.x, y, width: slot.width, height: Math.max(0, baseline - y), mark })
      return svg`
        <g class="lintje-chart__bar-group ${controller.hoverIndex === i ? 'is-hovered' : ''}"
           ${styleProps(staggerStyle(i, labels.length))}
           @mousemove=${(event: MouseEvent) => keys.point(event, i)}
           @mouseleave=${keys.leave}>
          <rect class="lintje-chart__bar lintje-chart__mark ${ahead ? 'lintje-chart__bar--forecast' : ''} ${mark.state}"
                x=${slot.x + inset} y=${y + inset} width=${Math.max(0, slot.width - 2 * inset)}
                height=${Math.max(0, baseline - y - inset)} fill=${color}
                stroke=${ahead ? edge : nothing}
                data-mark-id=${mark.markId} role=${mark.role} tabindex=${mark.tabIndex}
                aria-pressed=${mark.pressed} aria-label=${mark.label}
                @click=${mark.click} @auxclick=${mark.click} @keydown=${mark.keydown} />
          ${
            interval
              ? svg`<path class="lintje-chart__interval" stroke=${edge}
                          d=${`M${slot.center},${interval.top}V${interval.bottom}M${slot.center - INTERVAL_CAP / 2},${interval.top}h${INTERVAL_CAP}M${slot.center - INTERVAL_CAP / 2},${interval.bottom}h${INTERVAL_CAP}`} />`
              : nothing
          }
          ${
            showLabels
              ? svg`<text x=${slot.center} y=${Math.min(y, interval?.top ?? y) - 5} text-anchor="middle"
                          class="lintje-chart__data-label">
                    ${formatDataLabel(value, slot.width)}
                  </text>`
              : nothing
          }
        </g>
      `
    }),
    trendRuns.length
      ? svg`<g class="lintje-chart__trend">
          ${trendRuns.map((run) =>
            run.length === 1
              ? svg`<circle cx=${run[0].x} cy=${run[0].y} r=${LONE_POINT_RADIUS}
                            fill="var(--color-chart-emphasis)" />`
              : svg`<polyline fill="none" stroke="var(--color-chart-emphasis)" stroke-width="1.5"
                              stroke-dasharray="5 4"
                              points=${run.map((point) => `${point.x},${point.y}`).join(' ')} />`,
          )}
        </g>`
      : nothing,
    from != null
      ? renderAsOfMarker({
          mode: 'forecast',
          area,
          x: boundaryX,
          label: forecastLabel,
          fontFamily: controller.fontFamily,
        })
      : nothing,
  ]

  return html`
    <div class="lintje-chart-wrap ${small ? 'lintje-chart--small' : ''}"
         ${ref(controller.attach)} ?data-in-view=${controller.inView} data-tooltip-anchor
         @keydown=${(event: KeyboardEvent) => controller.dismiss(event) || selection.escape(event)}>
      ${
        // One series stands alone and is no switch; the forecast and its margin are keys.
        from != null
          ? renderLegend({
              items: [
                { label: name, color, shape: 'square', fixed: true },
                { label: forecastLabel, color, shape: 'open', fixed: true },
                ...(hasInterval(spec.forecast, from, labels.length)
                  ? [
                      {
                        label: spec.intervalLabel ?? INTERVAL_LABEL,
                        color,
                        shape: 'interval' as const,
                        fixed: true,
                      },
                    ]
                  : []),
              ],
            })
          : nothing
      }
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
          underlay: boundary
            ? svg`<rect class="lintje-chart__forecast-ground" x=${boundaryX} y=${area.top}
                        width=${Math.max(0, area.width - area.right - boundaryX)}
                        height=${Math.max(0, baseline - area.top)} />`
            : nothing,
          interactive: selection.interactive,
          keys,
        },
        nearestHit(area, boxes, marks),
      )}
      ${renderTooltip(controller)}
      ${renderPlotStatus(controller)}
    </div>
  `
}
