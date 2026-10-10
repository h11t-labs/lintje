/**
 * Line and area chart with comparison, hatching, as-of time and events. Missing data is never
 * drawn as 0 (rule 15): `null` points are skipped and the missing part is hatched or cut off.
 */
import { html, svg, nothing, type TemplateResult } from 'lit'
import { ref } from 'lit/directives/ref.js'
import { axisColumn, axisScale, plotWidth, xPosition, yPosition } from '../shared/scale'
import { formatNumber, textWidth } from '../../../../core/format'
import { DEFAULT_SERIES_COLOR, chartColor, lineCasing } from '../shared/colors'
import { markPath, SERIES_KEYS, isSeriesKey, type SeriesKey } from '../shared/series-shapes'
import {
  renderChartFrame,
  renderLegend,
  renderAsOfMarker,
  type LegendItem,
  type SvgSlot,
} from '../shared/axes'
import { renderTooltip } from '../shared/tooltip'
import { chartArea, type ChartOptions, type TooltipContent } from '../shared/controller'
import { plotKeys, renderPlotStatus } from '../shared/plot-keys'
import type { ChartSpec } from '../shared/types'

type LineSpec = Extract<ChartSpec, { kind: 'line' }>

/** An event's numbered square, 2 px below the top; the plot moves down to make room for it. */
const EVENT_CHIP = 18
const EVENT_GAP = 8
const EVENT_TOP = 2 + EVENT_CHIP + EVENT_GAP

export function renderLineChart(spec: LineSpec, options: ChartOptions): TemplateResult {
  const { controller, description } = options
  const {
    labels,
    axisTitle,
    unit,
    asOfIndex,
    asOfLabel,
    pendingHours = 0,
    fixedMax,
    small = false,
  } = spec
  // Numbered in the host's order; one outside the labels draws nothing.
  const events = (spec.events ?? [])
    .map((event, i) => ({ ...event, number: i + 1 }))
    .filter(
      (event) => Number.isInteger(event.index) && event.index >= 0 && event.index < labels.length,
    )
  const id = controller.id

  controller.measure({
    width: true,
    height: options.height ?? (small ? '--chart-h-small' : '--chart-h-main'),
    // In the modal the token is the body's inner height; the legend and axis title come off it.
    fit: Boolean(options.expanded) && !options.mobile,
  })

  // Two or more lines in colour carry a shape at their end as well, the one their colour has
  // on a map (rule 13); a comparison is told apart by its dashes already.
  const shaped = spec.series.filter((row) => !row.comparison).length > 1
  let unnamed = 0
  const series = spec.series.map((row) => ({
    ...row,
    color: chartColor(row.color),
    symbol:
      shaped && !row.comparison
        ? isSeriesKey(row.color)
          ? row.color
          : SERIES_KEYS[unnamed++ % SERIES_KEYS.length]
        : (undefined as SeriesKey | undefined),
  }))
  const visible = series.filter((row) => !controller.hiddenSeries.includes(row.label))
  const allValues = visible
    .flatMap((row) => row.values)
    .filter((value): value is number => value != null)
  const { max, ticks } = axisScale(fixedMax ?? Math.max(...allValues, 1))
  // The first x label is centered on the plot's left edge; the column keeps room for half of it.
  const axis = axisColumn(ticks, controller.width, {
    fontFamily: controller.fontFamily,
    minimum: Math.ceil(textWidth(labels[0] ?? '', controller.fontFamily) / 2),
  })
  const area = chartArea(options, {
    left: axis.width,
    ...(events.length ? { top: EVENT_TOP } : {}),
  })

  const isEarly = pendingHours > 6
  const lastKnown = asOfIndex ?? labels.length - 1

  const colorOf = (row: { color?: string; comparison?: boolean }) =>
    row.comparison ? 'var(--color-chart-secondary)' : (row.color ?? DEFAULT_SERIES_COLOR)

  const legend: LegendItem[] = series.map((row) => ({
    label: row.label,
    color: colorOf(row),
    shape: row.comparison ? 'dashed' : 'line',
    symbol: row.symbol,
    hidden: controller.hiddenSeries.includes(row.label),
  }))

  const step = Math.max(1, Math.ceil(labels.length / 8))
  const xLabels = labels
    .map((label, i) => ({ label, x: xPosition(i, labels.length, area), i }))
    .filter((label) => label.i % step === 0)

  function contentAt(i: number): TooltipContent {
    const here = events.filter((event) => event.index === i)
    return {
      title: labels[i],
      rows: visible.map((row) => ({
        label: row.label,
        value: row.values[i] == null ? 'geen gegevens' : formatNumber(row.values[i]!),
        color: colorOf(row),
      })),
      ...(here.length ? { events: here } : {}),
    }
  }
  const keys = plotKeys(controller, labels.length, (i) => {
    const known = visible
      .map((row) => row.values[i])
      .filter((value): value is number => value != null)
    return {
      x: xPosition(i, labels.length, area),
      y: known.length ? yPosition(Math.max(...known), max, area) : area.top,
      content: contentAt(i),
    }
  })

  const marks: SvgSlot = [
    pendingHours > 0
      ? (() => {
          const x = xPosition(lastKnown, labels.length, area)
          const width = isEarly
            ? plotWidth(area) / (labels.length - 1)
            : area.width - area.right - x
          return svg`<rect x=${x} y=${area.top} width=${Math.max(0, width)}
                           height=${area.height - area.top - area.bottom}
                           fill="url(#hatch-${id})" />`
        })()
      : nothing,

    // Under the area and the lines, and drawn at once like the axes: no reveal.
    events.length
      ? svg`<g>${events.map((event) => {
          const x = xPosition(event.index, labels.length, area)
          const top = area.top - EVENT_GAP - EVENT_CHIP
          return svg`
            <line class="lintje-chart__event-line" x1=${x} x2=${x}
                  y1=${area.top - EVENT_GAP} y2=${area.height - area.bottom} />
            <rect class="lintje-chart__event-chip" x=${x - EVENT_CHIP / 2} y=${top}
                  width=${EVENT_CHIP} height=${EVENT_CHIP} />
            <text class="lintje-chart__event-number" x=${x} y=${top + 13.5}
                  text-anchor="middle">${event.number}</text>
          `
        })}</g>`
      : nothing,

    svg`<g class="lintje-chart__reveal">
      ${visible.map((row) => {
        const color = colorOf(row)
        const casing = row.comparison ? undefined : lineCasing(color)
        // A missing value breaks the line: no segment bridges it as if it were known (rule 15).
        const runs: { x: number; y: number }[][] = [[]]
        row.values.forEach((value, i) => {
          if (value == null || (isEarly && i > lastKnown)) {
            if (runs[runs.length - 1].length) runs.push([])
            return
          }
          runs[runs.length - 1].push({
            x: xPosition(i, labels.length, area),
            y: yPosition(value, max, area),
          })
        })
        const drawn = runs.filter((run) => run.length > 0)
        if (drawn.length === 0) return nothing
        const lastRun = drawn[drawn.length - 1]
        const last = lastRun[lastRun.length - 1]
        const floor = area.height - area.bottom

        return svg`
          <g>
            ${drawn.map((run) => {
              const d = run.map((point) => `${point.x},${point.y}`).join(' ')
              return svg`
                ${
                  row.area && !row.comparison
                    ? svg`<polygon fill=${color} fill-opacity=".14"
                                 points=${`${run[0].x},${floor} ${d} ${run[run.length - 1].x},${floor}`} />`
                    : nothing
                }
                ${
                  casing && run.length > 1
                    ? svg`<polyline class="lintje-chart__line lintje-chart__line--casing" points=${d} stroke=${casing} />`
                    : nothing
                }
                ${
                  run.length === 1
                    ? svg`<circle cx=${run[0].x} cy=${run[0].y} r="2.5" fill=${color} />`
                    : svg`<polyline
                        class="lintje-chart__line"
                        points=${d}
                        stroke=${color}
                        stroke-dasharray=${row.comparison ? '5 4' : nothing}
                        opacity=${row.comparison ? 0.9 : 1} />`
                }
              `
            })}
            <!-- The line's own shape at its end; a 4 px point there at an early as-of time. -->
            ${
              row.symbol
                ? svg`<path class="lintje-chart__line-end" d=${markPath(row.symbol, 4.5, last.x, last.y)} fill=${color} />`
                : isEarly && !row.comparison
                  ? svg`<circle cx=${last.x} cy=${last.y} r="4" fill=${color} />`
                  : nothing
            }
          </g>
        `
      })}
    </g>`,

    isEarly && asOfLabel
      ? renderAsOfMarker({
          area,
          index: lastKnown,
          count: labels.length,
          label: `peilmoment ${asOfLabel}`,
          pendingHours,
          lastValue: (() => {
            const first = visible.find((row) => !row.comparison)
            const value = first?.values[lastKnown]
            return value != null ? `${formatNumber(value)}${unit ? ` ${unit}` : ''}` : undefined
          })(),
        })
      : nothing,

    // A missing value gets no hover point (rule 15).
    controller.hoverIndex != null
      ? visible.map((row) => {
          const index = controller.hoverIndex!
          const value = row.values[index]
          if (value == null || (isEarly && index > lastKnown)) return nothing
          return svg`<circle class="lintje-chart__hover-point" r="4" fill=${colorOf(row)}
                             cx=${xPosition(index, labels.length, area)}
                             cy=${yPosition(value, max, area)} />`
        })
      : nothing,

    labels.map((_, i) => {
      const x = xPosition(i, labels.length, area)
      const bandWidth = plotWidth(area) / Math.max(1, labels.length - 1)
      return svg`
        <rect x=${x - bandWidth / 2} y=${area.top} width=${bandWidth}
              height=${area.height - area.top - area.bottom}
              fill="transparent"
              @mousemove=${(event: MouseEvent) => controller.hoverAt(i, event, contentAt(i))}
              @mouseleave=${() => controller.hoverAt(null)} />
      `
    }),
  ]

  return html`
    <div class="lintje-chart-wrap ${small ? 'lintje-chart--small' : ''}"
         ${ref(controller.attach)} ?data-in-view=${controller.inView} data-tooltip-anchor
         @keydown=${(event: KeyboardEvent) => controller.dismiss(event)}>
      ${renderLegend({ items: legend, onToggle: (label) => controller.toggleSeries(label) })}
      ${renderChartFrame(
        {
          fontFamily: controller.fontFamily,
          id,
          ticks,
          max,
          area,
          formatTick: axis.format,
          axisTitle: axisTitle ?? unit,
          xLabels,
          // The drawing names its events too; the list below says them again.
          description: events.length
            ? `${description} ${events
                .map(
                  (event) => `Gebeurtenis ${event.number}, ${labels[event.index]}: ${event.label}.`,
                )
                .join(' ')}`
            : description,
          keys,
        },
        marks,
      )}
      ${
        events.length
          ? html`<ol class="lintje-chart-events" aria-label="Gebeurtenissen">
              ${events.map(
                (event) => html`<li class="lintje-chart-events__item">
                  <span class="lintje-event-number">${event.number}</span>
                  <span><span class="lintje-chart-events__category">${labels[event.index]}</span> ·
                    ${event.label}</span>
                </li>`,
              )}
            </ol>`
          : nothing
      }
      ${renderTooltip(controller)}
      ${renderPlotStatus(controller)}
    </div>
  `
}
