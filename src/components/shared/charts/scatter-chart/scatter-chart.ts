/**
 * Scatter plot: two value axes, a point per record. A series is a colour and the shape that
 * colour has on a map (rule 13); a point without both values is not drawn (rule 15).
 */
import { html, svg, nothing, type TemplateResult } from 'lit'
import { ref } from 'lit/directives/ref.js'
import { axisColumn, axisScale, plotWidth, yPosition } from '../shared/scale'
import { formatNumber, textWidth } from '../../../../core/format'
import { chartColor, lineCasing } from '../shared/colors'
import { markPath, SERIES_KEYS, isSeriesKey, type SeriesKey } from '../shared/series-shapes'
import { renderChartFrame, renderLegend, type LegendItem, type SvgSlot } from '../shared/axes'
import { renderTooltip } from '../shared/tooltip'
import { chartArea, type ChartOptions, type TooltipContent } from '../shared/controller'
import { markSelection } from '../shared/mark-select'
import { plotKeys, renderPlotStatus, tooltipSentence } from '../shared/plot-keys'
import type { ChartSpec, ScatterPoint } from '../shared/types'

type ScatterSpec = Extract<ChartSpec, { kind: 'scatter' }>

const RADIUS = 4.5
const HOVER_RADIUS = 5.5
// The x title takes one more row of axis text under the labels.
const BOTTOM = 44
const LABEL_GAP = 8

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

const withUnit = (value: number, unit?: string) => `${formatNumber(value)}${unit ? ` ${unit}` : ''}`

/**
 * Each series' colour and shape. A series that names no colour takes the next data colour that
 * no other series names, so two series never share a shape.
 */
function seriesStyles(spec: ScatterSpec): { color: string; symbol: SeriesKey }[] {
  const named = new Set(spec.series.map((row) => row.color).filter(isSeriesKey))
  const free = SERIES_KEYS.filter((key) => !named.has(key))
  let next = 0
  return spec.series.map((row) => {
    const symbol = isSeriesKey(row.color) ? row.color : free[next++ % free.length]
    return { color: chartColor(row.color ?? symbol)!, symbol }
  })
}

export function renderScatterChart(spec: ScatterSpec, options: ChartOptions): TemplateResult {
  const { controller, description } = options
  const { axisTitle, unit, xTitle, xUnit, threshold, thresholdLabel, small = false } = spec
  const id = controller.id

  controller.measure({
    width: true,
    height: options.height ?? (small ? '--chart-h-small' : '--chart-h-main'),
    fit: Boolean(options.expanded) && !options.mobile,
  })

  const styles = seriesStyles(spec)
  const series = spec.series.map((row, i) => ({ ...row, ...styles[i] }))
  const visible = series.filter((row) => !controller.hiddenSeries.includes(row.label))

  // One list in the order of x drives the marks, the pointer and the arrow keys.
  const points = visible
    .flatMap((row) =>
      row.points
        .filter(
          (point): point is ScatterPoint & { x: number; y: number } =>
            point.x != null && point.y != null,
        )
        .map((point) => ({ point, row })),
    )
    .sort((a, b) => a.point.x - b.point.x || a.point.y - b.point.y)

  const x = axisScale(Math.max(...points.map(({ point }) => point.x), 1), options.mobile ? 3 : 6)
  const y = axisScale(Math.max(...points.map(({ point }) => point.y), threshold ?? 0, 1))
  const axis = axisColumn(y.ticks, controller.width, { fontFamily: controller.fontFamily })
  const area = chartArea(options, { left: axis.width, bottom: BOTTOM })
  const xPosition = (value: number) => area.left + (plotWidth(area) * value) / x.max

  const xLabels = x.ticks.map((tick, i) => ({
    label: formatNumber(tick),
    x: xPosition(tick),
    anchor: i === x.ticks.length - 1 ? ('end' as const) : ('middle' as const),
  }))

  const legend: LegendItem[] = [
    ...series.map((row) => ({
      label: row.label,
      color: row.color,
      shape: 'point' as const,
      symbol: row.symbol,
      hidden: controller.hiddenSeries.includes(row.label),
    })),
    ...(threshold != null
      ? [
          {
            label: thresholdLabel ?? 'Norm',
            color: 'var(--color-chart-emphasis)',
            shape: 'dashed' as const,
            fixed: true,
          },
        ]
      : []),
  ]

  function contentAt(i: number): TooltipContent {
    const { point, row } = points[i]
    return {
      title: point.label,
      rows: [
        { label: row.label, value: '', color: row.color, symbol: row.symbol },
        { label: capitalise(xTitle), value: withUnit(point.x, xUnit) },
        { label: capitalise(axisTitle), value: withUnit(point.y, unit) },
      ],
    }
  }
  const at = (i: number) => ({
    x: xPosition(points[i].point.x),
    y: yPosition(points[i].point.y, y.max, area),
  })
  const keys = plotKeys(controller, points.length, (i) => ({ ...at(i), content: contentAt(i) }))

  // The point carries its href, the way a table row does; without an id the label is its identity.
  const links = points.map(({ point }) =>
    point.href ? { id: point.id ?? point.label, href: point.href } : null,
  )
  const selection = markSelection(options, links)

  // The named points' labels stand above-left of the point, or above-right where the left has no
  // room; when one fits neither, none shows (all or nothing).
  const named = points
    .map((entry, i) => ({ ...entry, ...at(i) }))
    .filter(({ point }) => spec.dataLabels?.includes(point.label))
    .map((entry) => {
      const width = textWidth(entry.point.label, controller.fontFamily)
      const left = entry.x - LABEL_GAP - width >= area.left
      const right = entry.x + LABEL_GAP + width <= area.width - area.right
      return { ...entry, fits: (left || right) && entry.y - 21 >= 0, side: left ? 'left' : 'right' }
    })
  const dataLabels = named.every((label) => label.fits) ? named : []

  const thresholdY = threshold != null ? yPosition(threshold, y.max, area) : 0
  const hovered = controller.hoverIndex != null ? points[controller.hoverIndex] : undefined

  const marks: SvgSlot = [
    threshold != null
      ? svg`
        <line x1=${area.left} x2=${area.width - area.right} y1=${thresholdY} y2=${thresholdY}
              stroke="var(--color-chart-emphasis)" stroke-width="1" stroke-dasharray="3 3" />
        <text x=${area.left + 6} y=${thresholdY - 6}
              class="lintje-chart__axis-label lintje-chart__data-label--halo">
          ${thresholdLabel ?? `norm ${withUnit(threshold, unit)}`}
        </text>
      `
      : nothing,

    svg`<g class="lintje-chart__reveal">
      ${points.map(({ point, row }, i) => {
        const { x: cx, y: cy } = at(i)
        const casing = lineCasing(row.color)
        const mark = selection.of(links[i], point.label, tooltipSentence(contentAt(i)))
        // The 1 px edge in the surface keeps overlapping points apart; dark yellow takes its
        // text colour there, as its line does.
        return svg`
          <!-- The click sits on the group, so the transparent target of --h-target takes it
               too; where neighbours overlap, the later point's target wins. -->
          <g @mousemove=${(event: MouseEvent) => controller.hoverAt(i, event, contentAt(i))}
             @mouseleave=${() => controller.hoverAt(null)}
             @click=${mark.click}>
            <circle class="lintje-chart__hit ${mark.clickable ? 'is-clickable' : ''}" cx=${cx} cy=${cy} />
            <path class="lintje-chart__mark ${casing ? '' : 'lintje-chart__segment'} ${mark.state}"
                  d=${markPath(row.symbol, RADIUS, cx, cy)} fill=${row.color}
                  stroke=${casing ?? nothing} stroke-width=${casing ? 1 : nothing}
                  data-mark-id=${mark.markId} role=${mark.role} tabindex=${mark.tabIndex}
                  aria-pressed=${mark.pressed} aria-label=${mark.label}
                  @keydown=${mark.keydown} />
          </g>
        `
      })}
    </g>`,

    dataLabels.map(
      (label) => svg`
        <text x=${label.side === 'left' ? label.x - LABEL_GAP : label.x + LABEL_GAP} y=${label.y - 9}
              text-anchor=${label.side === 'left' ? 'end' : 'start'}
              class="lintje-chart__data-label lintje-chart__data-label--halo">${label.point.label}</text>
      `,
    ),

    // The point under the pointer or the keyboard, raised with a ring in the surface.
    hovered
      ? (() => {
          const { x: cx, y: cy } = at(controller.hoverIndex!)
          const casing = lineCasing(hovered.row.color)
          const d = markPath(hovered.row.symbol, HOVER_RADIUS, cx, cy)
          return svg`
            <path class="lintje-chart__hover-point" d=${d} fill=${hovered.row.color} />
            ${casing ? svg`<path class="lintje-chart__hover-casing" d=${d} stroke=${casing} />` : nothing}
          `
        })()
      : nothing,
  ]

  return html`
    <div class="lintje-chart-wrap ${small ? 'lintje-chart--small' : ''}"
         ${ref(controller.attach)} ?data-in-view=${controller.inView} data-tooltip-anchor
         @keydown=${(event: KeyboardEvent) => controller.dismiss(event) || selection.escape(event)}>
      ${renderLegend({ items: legend, onToggle: (label) => controller.toggleSeries(label) })}
      ${renderChartFrame(
        {
          fontFamily: controller.fontFamily,
          id,
          ticks: y.ticks,
          max: y.max,
          area,
          formatTick: axis.format,
          axisTitle,
          xLabels,
          xTitle,
          description,
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
