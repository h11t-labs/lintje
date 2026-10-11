/**
 * Scatter plot: two value axes, a point per record. A series is a colour and the shape that
 * colour has on a map (rule 13); a point without both values is not drawn (rule 15).
 */
import { html, svg, nothing, type TemplateResult } from 'lit'
import { ref } from 'lit/directives/ref.js'
import { repeat } from 'lit/directives/repeat.js'
import { styleProps } from '../../../../core/style-props'
import { staggerStyle } from '../shared/stagger'
import { axisColumn, axisScale, plotWidth, yPosition, type PlotArea } from '../shared/scale'
import { lengthPx } from '../../../../core/length'
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

interface DataLabel {
  label: string
  x: number
  y: number
  anchor: 'start' | 'end'
}

interface Box {
  left: number
  right: number
  top: number
  bottom: number
}

const overlaps = (a: Box, b: Box) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

/**
 * The named points' labels, above-left of their point or above-right where the left has no
 * room. A label must stay in the drawing, clear of the other labels and of every other point;
 * when one cannot, none shows (all or nothing).
 */
export function placeDataLabels(
  points: { label: string; x: number; y: number }[],
  names: string[],
  area: PlotArea,
  fontFamily: string,
): DataLabel[] {
  const reach = RADIUS + 1
  const placed: (DataLabel & Box)[] = []
  for (const [i, point] of points.entries()) {
    if (!names.includes(point.label)) continue
    const width = textWidth(point.label, fontFamily, 700)
    const baseline = point.y - 9
    const top = baseline - 12
    const bottom = baseline + 3
    const sides = [
      { anchor: 'end' as const, x: point.x - LABEL_GAP, left: point.x - LABEL_GAP - width },
      { anchor: 'start' as const, x: point.x + LABEL_GAP, left: point.x + LABEL_GAP },
    ]
    const fit = sides
      .map((side) => ({ ...side, right: side.left + width, top, bottom }))
      .find(
        (box) =>
          box.left >= area.left &&
          box.right <= area.width - area.right &&
          box.top >= 0 &&
          placed.every((other) => !overlaps(box, other)) &&
          points.every(
            (other, j) =>
              j === i ||
              !overlaps(box, {
                left: other.x - reach,
                right: other.x + reach,
                top: other.y - reach,
                bottom: other.y + reach,
              }),
          ),
      )
    if (!fit) return []
    placed.push({ ...fit, label: point.label, y: baseline })
  }
  return placed.map(({ label, x, y, anchor }) => ({ label, x, y, anchor }))
}

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
  const hidden = (row: { label: string }) => controller.hiddenSeries.includes(row.label)

  // Every point with both values, in the order of x: each keeps its node and its place in the
  // draw-in whatever the legend hides, so a switch does not grow it again.
  const drawable = series
    .flatMap((row, s) =>
      row.points
        .map((point, p) => ({ point, row, key: `${s}:${p}` }))
        .filter(
          (entry): entry is typeof entry & { point: ScatterPoint & { x: number; y: number } } =>
            entry.point.x != null && entry.point.y != null,
        ),
    )
    .sort((a, b) => a.point.x - b.point.x || a.point.y - b.point.y)
  // The shown ones drive the scales, the pointer and the arrow keys.
  const points = drawable.filter(({ row }) => !hidden(row))
  const indexOf = new Map(points.map((entry, i) => [entry.key, i]))

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
      hidden: hidden(row),
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
  const place = (point: { x: number; y: number }) => ({
    x: xPosition(point.x),
    y: yPosition(point.y, y.max, area),
  })
  const at = (i: number) => place(points[i].point)
  const keys = plotKeys(controller, points.length, (i) => ({ ...at(i), content: contentAt(i) }))

  // The point carries its href, the way a table row does. Without an id its series and label
  // are its identity, so a name in two series is two points.
  const links = points.map(({ point, row }) =>
    point.href ? { id: point.id ?? `${row.label} · ${point.label}`, href: point.href } : null,
  )
  const selection = markSelection(options, links)
  const marks = points.map(({ point }, i) =>
    selection.of(links[i], point.label, tooltipSentence(contentAt(i))),
  )

  const dataLabels = placeDataLabels(
    points.map((entry, i) => ({ label: entry.point.label, ...at(i) })),
    spec.dataLabels ?? [],
    area,
    controller.fontFamily,
  )

  const thresholdY = threshold != null ? yPosition(threshold, y.max, area) : 0
  const hovered = controller.hoverIndex != null ? points[controller.hoverIndex] : undefined

  /*
   * One listener for the whole drawing: the drawn mark under the pointer is that point, and
   * elsewhere the nearest point within half of --h-target is, so a small point is a full
   * target without a neighbour's target covering it.
   */
  const pick = (event: MouseEvent): number | null => {
    const drawn = (event.target as Element).closest?.('[data-point]')
    if (drawn) return Number(drawn.getAttribute('data-point'))
    const group = event.currentTarget as SVGGElement
    const box = group.ownerSVGElement?.getBoundingClientRect()
    const scale = box && box.width > 0 ? area.width / box.width : 1
    const px = (event.clientX - (box?.left ?? 0)) * scale
    const py = (event.clientY - (box?.top ?? 0)) * scale
    const reach = lengthPx(group, '--h-target', 48) / 2
    let nearest: number | null = null
    let distance = reach
    points.forEach((_, i) => {
      const { x: cx, y: cy } = at(i)
      const d = Math.hypot(cx - px, cy - py)
      if (d <= distance) {
        nearest = i
        distance = d
      }
    })
    return nearest
  }
  const pointer = (event: MouseEvent) => {
    const i = pick(event)
    if (i != null) controller.hoverAt(i, event, contentAt(i))
    else if (controller.hoverIndex != null || controller.tooltip) controller.hoverAt(null)
  }
  const click = (event: MouseEvent) => {
    const i = pick(event)
    const mark = i != null ? marks[i] : null
    if (mark?.clickable && mark.click !== nothing) mark.click()
  }
  const pointing = hovered != null && marks[controller.hoverIndex!]?.clickable

  const drawing: SvgSlot = [
    // The norm comes in with its label once the points are drawn.
    threshold != null
      ? svg`
        <g class="lintje-chart__reference">
          <line x1=${area.left} x2=${area.width - area.right} y1=${thresholdY} y2=${thresholdY}
                stroke="var(--color-chart-emphasis)" stroke-width="1" stroke-dasharray="3 3" />
          <text x=${area.left + 6} y=${thresholdY - 6}
                class="lintje-chart__axis-label lintje-chart__axis-label--halo">
            ${thresholdLabel ?? `norm ${withUnit(threshold, unit)}`}
          </text>
        </g>
      `
      : nothing,

    svg`<g @mousemove=${pointer} @mouseleave=${() => controller.hoverAt(null)} @click=${click}>
      <rect class="lintje-chart__hit ${pointing ? 'is-clickable' : ''}"
            x="0" y="0" width=${area.width} height=${area.height} />
      <g>
        ${repeat(
          drawable,
          (entry) => entry.key,
          ({ point, row, key }, rank) => {
            const { x: cx, y: cy } = place(point)
            const casing = lineCasing(row.color)
            const i = indexOf.get(key)
            const mark = i != null ? marks[i] : undefined
            // The 1 px edge in the surface keeps overlapping points apart; dark yellow takes its
            // text colour there, as its line does. A hidden series' point stays, unseen.
            return svg`
              <path class="lintje-chart__point lintje-chart__mark ${casing ? '' : 'lintje-chart__segment'} ${mark?.state ?? 'is-hidden'}"
                    ${styleProps(staggerStyle(rank, drawable.length))}
                    d=${markPath(row.symbol, RADIUS, cx, cy)} fill=${row.color}
                    stroke=${casing ?? nothing} stroke-width=${casing ? 1 : nothing}
                    data-point=${i ?? nothing}
                    data-mark-id=${mark?.markId ?? nothing} role=${mark?.role ?? nothing}
                    tabindex=${mark?.tabIndex ?? nothing}
                    aria-pressed=${mark?.pressed ?? nothing} aria-label=${mark?.label ?? nothing}
                    @keydown=${mark?.keydown ?? nothing} />
            `
          },
        )}
      </g>

      ${dataLabels.map(
        (label) => svg`
          <text x=${label.x} y=${label.y} text-anchor=${label.anchor}
                class="lintje-chart__data-label lintje-chart__data-label--halo">${label.label}</text>
        `,
      )}

      <!-- The point under the pointer or the keyboard, raised with a ring in the surface. -->
      ${
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
          : nothing
      }
    </g>`,
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
        drawing,
      )}
      ${renderTooltip(controller)}
      ${renderPlotStatus(controller)}
    </div>
  `
}
