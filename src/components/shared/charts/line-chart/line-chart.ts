/**
 * Line and area chart with comparison, hatching, as-of time, events and a forecast. Missing data
 * is never drawn as 0 (rule 15): `null` points are skipped and the missing part is hatched or cut
 * off; a forecast is never drawn as measured (dotted, with an open hover point).
 */
import { html, svg, nothing, type TemplateResult } from 'lit'
import { ref } from 'lit/directives/ref.js'
import {
  DEFAULT_PLOT_AREA,
  axisColumn,
  axisScale,
  plotWidth,
  xPosition,
  yPosition,
} from '../shared/scale'
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
import { styleProps } from '../../../../core/style-props'
import { chartArea, type ChartOptions, type TooltipContent } from '../shared/controller'
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
import type { ChartForecast, ChartSpec } from '../shared/types'

type LineSpec = Extract<ChartSpec, { kind: 'line' }>

/** An event's numbered square; the list and the tooltip draw it at this size too. */
const EVENT_CHIP = 18
/** Between two rows of squares, two squares in a row, and the top edge and the first row. */
const EVENT_ROW_GAP = 4
/** Between the lowest row of squares and the plot. */
const EVENT_GAP = 8

/**
 * The row of each square, in order: the first row where it touches no square before it. A
 * second event at one category, or a neighbour on a narrow drawing, goes a row down.
 */
function eventRows(centres: number[]): number[] {
  const rows: number[][] = []
  return centres.map((x) => {
    let row = rows.findIndex((taken) =>
      taken.every((other) => Math.abs(other - x) >= EVENT_CHIP + EVENT_ROW_GAP),
    )
    if (row === -1) row = rows.push([]) - 1
    rows[row].push(x)
    return row
  })
}

/**
 * The stretches of a margin from the last measured point on, each as its upper edge left to
 * right and its lower edge back: it opens from width zero, and a point without both bounds
 * breaks it (rule 15). Clamped to the plot, so a negative bound stops on the zero line.
 */
function bandPolygons(
  values: (number | null)[],
  forecast: ChartForecast,
  from: number,
  point: (value: number, index: number) => { x: number; y: number },
  max: number,
): string[] {
  const clamp = (value: number) => Math.min(max, Math.max(0, value))
  const bounds = values.map((value, i) => {
    if (i < from - 1) return null
    if (i === from - 1) return value == null ? null : { low: value, high: value }
    const { low, high } = boundsAt(forecast, i)
    return low == null || high == null ? null : { low, high }
  })
  const stretches: { low: number; high: number; i: number }[][] = []
  let stretch: { low: number; high: number; i: number }[] = []
  bounds.forEach((bound, i) => {
    if (bound) {
      stretch.push({ ...bound, i })
    } else if (stretch.length) {
      stretches.push(stretch)
      stretch = []
    }
  })
  if (stretch.length) stretches.push(stretch)
  return stretches
    .filter((run) => run.length > 1)
    .map((run) => {
      const upper = run.map((b) => point(clamp(b.high), b.i))
      const lower = run.map((b) => point(clamp(b.low), b.i)).reverse()
      return [...upper, ...lower].map((p) => `${p.x},${p.y}`).join(' ')
    })
}

export function renderLineChart(spec: LineSpec, options: ChartOptions): TemplateResult {
  const { controller, description } = options
  const { labels, axisTitle, unit, fixedMax, small = false } = spec
  // A forecast continues a measured series; with only comparisons there is none.
  const from = spec.series.some((row) => !row.comparison)
    ? forecastStart(spec.forecastFrom, labels.length)
    : null
  const forecastLabel = spec.forecastLabel ?? FORECAST_LABEL
  // With a forecast the chart has one boundary: no as-of hatching, cut or second line.
  const asOfIndex = from == null ? spec.asOfIndex : undefined
  const asOfLabel = from == null ? spec.asOfLabel : undefined
  const pendingHours = from == null ? (spec.pendingHours ?? 0) : 0
  // One outside the labels draws nothing; the rest are numbered from left to right.
  const events = (spec.events ?? [])
    .filter(
      (event) => Number.isInteger(event.index) && event.index >= 0 && event.index < labels.length,
    )
    .sort((a, b) => a.index - b.index)
    .map((event, i) => ({ ...event, number: i + 1 }))
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
  const forecasts = (row: { comparison?: boolean }) => from != null && !row.comparison
  // Every series sets the scale, so switching one off moves nothing; a margin sets it too.
  const allValues = [
    ...series.flatMap((row) => row.values),
    ...series.flatMap((row) => (forecasts(row) ? intervalValues(row.forecast) : [])),
  ].filter((value): value is number => value != null)
  const { max, ticks } = axisScale(fixedMax ?? Math.max(...allValues, 1))
  // The first x label is centered on the plot's left edge; the column keeps room for half of it.
  const axis = axisColumn(ticks, controller.width, {
    font: controller.font,
    minimum: Math.ceil(textWidth(labels[0] ?? '', controller.font) / 2),
  })
  // The squares stay inside the drawing at its ends; x does not depend on the top.
  const across = chartArea(options, { left: axis.width })
  const centres = events.map((event) =>
    Math.min(
      across.width - EVENT_CHIP / 2,
      Math.max(EVENT_CHIP / 2, xPosition(event.index, labels.length, across)),
    ),
  )
  const rows = eventRows(centres)
  const rowCount = rows.length ? Math.max(...rows) + 1 : 0
  const eventsTop = rowCount
    ? rowCount * (EVENT_CHIP + EVENT_ROW_GAP) + EVENT_GAP
    : DEFAULT_PLOT_AREA.top
  const area = chartArea(options, {
    left: axis.width,
    top: eventsTop + (from != null ? FORECAST_ROOM : 0),
  })
  const chipTop = (i: number) => EVENT_ROW_GAP + rows[i] * (EVENT_CHIP + EVENT_ROW_GAP)

  const isEarly = pendingHours > 6
  const lastKnown = asOfIndex ?? labels.length - 1

  const colorOf = (row: { color?: string; comparison?: boolean }) =>
    row.comparison ? 'var(--color-chart-secondary)' : (row.color ?? DEFAULT_SERIES_COLOR)

  // Of more variables the one pointed at in the legend fills its margin; the others step back.
  const variables = series.filter((row) => !row.comparison)
  const shownVariables = visible.filter((row) => !row.comparison)
  const emphasis =
    from != null &&
    shownVariables.length > 1 &&
    shownVariables.some((row) => row.label === controller.emphasis)
      ? controller.emphasis
      : null
  const filled = (row: { label: string }) =>
    shownVariables.length === 1 ? shownVariables[0].label === row.label : row.label === emphasis

  // The forecast and its margin are keys, not switches: the series switches them with it.
  const keyColor = variables.length === 1 ? colorOf(variables[0]) : 'var(--color-text-muted)'
  const legend: LegendItem[] = [
    ...series.map((row) => ({
      label: row.label,
      color: colorOf(row),
      shape: row.comparison ? ('dashed' as const) : ('line' as const),
      symbol: row.symbol,
      hidden: controller.hiddenSeries.includes(row.label),
      fixed: series.length < 2,
    })),
    ...(from != null
      ? [{ label: forecastLabel, color: keyColor, shape: 'dotted' as const, fixed: true }]
      : []),
    ...(from != null && variables.some((row) => hasInterval(row.forecast, from, labels.length))
      ? [
          {
            label: spec.intervalLabel ?? INTERVAL_LABEL,
            color: keyColor,
            shape: 'band' as const,
            fixed: true,
          },
        ]
      : []),
  ]

  const step = Math.max(1, Math.ceil(labels.length / 8))
  const xLabels = labels
    .map((label, i) => ({ label, x: xPosition(i, labels.length, area), i }))
    .filter((label) => label.i % step === 0)

  const isForecast = (row: { comparison?: boolean }, i: number) => forecasts(row) && i >= from!

  function contentAt(i: number): TooltipContent {
    const here = events.filter((event) => event.index === i)
    return {
      title: labels[i],
      ...(from != null && i >= from ? { note: forecastLabel.toLowerCase() } : {}),
      rows: visible.flatMap((row) => [
        {
          label: row.label,
          value: row.values[i] == null ? 'geen gegevens' : formatNumber(row.values[i]!),
          color: colorOf(row),
          // With a forecast the swatch says how the point is drawn, as the legend does.
          ...(from != null
            ? {
                marker: row.comparison
                  ? ('dashed' as const)
                  : isForecast(row, i)
                    ? ('dotted' as const)
                    : ('line' as const),
              }
            : {}),
        },
        ...(isForecast(row, i) && row.forecast ? [intervalRow(row.forecast, i)] : []),
      ]),
      ...(here.length ? { events: here } : {}),
    }
  }
  const topAt = (i: number): number | null => {
    const known = visible
      .map((row) => row.values[i])
      .filter((value): value is number => value != null)
    return known.length ? Math.max(...known) : null
  }
  const keys = plotKeys(controller, labels.length, (i) => {
    const top = topAt(i)
    return {
      x: xPosition(i, labels.length, area),
      y: top == null ? area.top : yPosition(top, max, area),
      content: contentAt(i),
    }
  })
  const focusPoint = (i: number) => {
    const top = topAt(i)
    return top == null
      ? nothing
      : svg`<circle class="lintje-chart__focus-point" r="7.5"
                    cx=${xPosition(i, labels.length, area)} cy=${yPosition(top, max, area)} />`
  }

  // The forecast's part of the drawing, under the grid.
  const forecastGround = (x: number) =>
    svg`<rect class="lintje-chart__forecast-ground" x=${x} y=${area.top}
              width=${Math.max(0, area.width - area.right - x)}
              height=${Math.max(0, area.height - area.top - area.bottom)} />`

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

    // Under the area and the lines, and drawn at once like the axes: no reveal. The lines go
    // first, so a square a row down covers the line of the one above it.
    events.length
      ? svg`<g>
          ${events.map((event, i) => {
            const x = xPosition(event.index, labels.length, area)
            return svg`<line class="lintje-chart__event-line" x1=${x} x2=${x}
                             y1=${chipTop(i) + EVENT_CHIP} y2=${area.height - area.bottom} />`
          })}
          ${events.map(
            (event, i) => svg`
              <rect class="lintje-chart__event-chip" x=${centres[i] - EVENT_CHIP / 2} y=${chipTop(i)}
                    width=${EVENT_CHIP} height=${EVENT_CHIP} />
              <text class="lintje-chart__event-number" x=${centres[i]} y=${chipTop(i) + EVENT_CHIP / 2}
                    text-anchor="middle" dominant-baseline="central">${event.number}</text>
            `,
          )}
        </g>`
      : nothing,

    svg`<g class="lintje-chart__reveal">
      ${series.map((row) => {
        const color = colorOf(row)
        const casing = row.comparison ? undefined : lineCasing(color)
        const at = (value: number, i: number) => ({
          x: xPosition(i, labels.length, area),
          y: yPosition(value, max, area),
          i,
        })
        const ahead = forecasts(row)
        // At an early as-of time the line stops there; a forecast stops the measured line at
        // its last point and goes on dotted from it.
        const drawn = knownRuns(
          isEarly
            ? row.values.slice(0, lastKnown + 1)
            : ahead
              ? row.values.slice(0, from!)
              : row.values,
          at,
        )
        const dotted = ahead
          ? knownRuns(
              row.values.map((value, i) => (i < from! - 1 ? null : value)),
              at,
              // The last measured point alone is no forecast: the measured line ends there.
            ).filter((run) => run.length > 1 || run[0].i >= from!)
          : []
        const ends = [...drawn, ...dotted]
        if (ends.length === 0) return nothing
        const lastRun = ends[ends.length - 1]
        const last = lastRun[lastRun.length - 1]
        const floor = area.height - area.bottom
        const bands =
          ahead && row.forecast ? bandPolygons(row.values, row.forecast, from!, at, max) : []

        const off = !visible.includes(row)
        const muted = emphasis != null && row.label !== emphasis
        return svg`
          <g class="lintje-chart__series ${off ? 'is-off' : ''} ${muted ? 'is-muted' : ''}">
            ${bands.map(
              (points) => svg`<polygon class="lintje-chart__band ${filled(row) ? 'is-filled' : ''}"
                                       fill=${color} points=${points} />`,
            )}
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
                    ? svg`<circle cx=${run[0].x} cy=${run[0].y} r=${LONE_POINT_RADIUS} fill=${color} />`
                    : svg`<polyline
                        class="lintje-chart__line"
                        points=${d}
                        stroke=${color}
                        stroke-dasharray=${row.comparison ? '5 4' : nothing}
                        opacity=${row.comparison ? 0.9 : 1} />`
                }
              `
            })}
            ${dotted.map((run) => {
              const d = run.map((point) => `${point.x},${point.y}`).join(' ')
              return run.length === 1
                ? svg`<circle cx=${run[0].x} cy=${run[0].y} r=${LONE_POINT_RADIUS} fill=${color} />`
                : svg`
                  ${
                    casing
                      ? svg`<polyline class="lintje-chart__line lintje-chart__line--casing lintje-chart__line--forecast"
                                      points=${d} stroke=${casing} />`
                      : nothing
                  }
                  <polyline class="lintje-chart__line lintje-chart__line--forecast" points=${d} stroke=${color} />
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

    from != null
      ? renderAsOfMarker({
          mode: 'forecast',
          area,
          x: xPosition(from - 1, labels.length, area),
          label: forecastLabel,
          font: controller.font,
        })
      : nothing,

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

    // A missing value gets no hover point (rule 15); a forecast's is open (rule 13).
    controller.hoverIndex != null
      ? visible.map((row) => {
          const index = controller.hoverIndex!
          const value = row.values[index]
          if (value == null || (isEarly && index > lastKnown)) return nothing
          const open = isForecast(row, index)
          const cx = xPosition(index, labels.length, area)
          const cy = yPosition(value, max, area)
          // A light colour keeps the dark edge its line has, over the ring in the surface; a
          // forecast's open point is a ring in its own colour.
          const casing = open ? undefined : lineCasing(colorOf(row))
          return svg`<circle class="lintje-chart__hover-point ${open ? 'lintje-chart__hover-point--forecast' : ''}"
                             r="4" fill=${open ? nothing : colorOf(row)} color=${open ? colorOf(row) : nothing}
                             cx=${cx} cy=${cy} />
            ${casing ? svg`<circle class="lintje-chart__hover-casing" r="4" stroke=${casing} cx=${cx} cy=${cy} />` : nothing}`
        })
      : nothing,

    // The point the keyboard stands on: the top one, where its tooltip stands.
    controller.hoverIndex != null && controller.status
      ? focusPoint(controller.hoverIndex)
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
         ${styleProps({ '--lintje-event-size': `${EVENT_CHIP}px` })}
         ${ref(controller.attach)} ?data-in-view=${controller.inView} data-tooltip-anchor
         @keydown=${(event: KeyboardEvent) => controller.dismiss(event)}>
      ${renderLegend({
        items: legend,
        onToggle: (key) => controller.toggleSeries(key),
        onEmphasis:
          from != null && variables.length > 1 ? (label) => controller.emphasise(label) : undefined,
      })}
      ${renderChartFrame(
        {
          font: controller.font,
          id,
          ticks,
          max,
          area,
          formatTick: axis.format,
          axisTitle: axisTitle ?? unit,
          xLabels,
          underlay:
            from != null ? forecastGround(xPosition(from - 1, labels.length, area)) : nothing,
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
                  <span class="lintje-event-chip"><span class="lintje-event-chip__number">${event.number}</span></span>
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
