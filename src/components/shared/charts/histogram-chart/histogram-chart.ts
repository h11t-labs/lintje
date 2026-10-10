/**
 * A histogram: counts in classes that touch, on an x-axis that runs on, so the labels stand on
 * the class bounds. A median is a solid emphasis line, a threshold a dashed one.
 */
import { html, svg, nothing, type TemplateResult } from 'lit'
import { ref } from 'lit/directives/ref.js'
import { styleProps } from '../../../../core/style-props'
import { axisColumn, axisScale, yPosition, type PlotArea } from '../shared/scale'
import { formatNumber, formatPercent, textWidth } from '../../../../core/format'
import { staggerStyle } from '../shared/stagger'
import { DEFAULT_SERIES_COLOR, chartColor } from '../shared/colors'
import {
  renderChartFrame,
  renderLegend,
  thinLabels,
  type LegendItem,
  type SvgSlot,
} from '../shared/axes'
import { renderTooltip } from '../shared/tooltip'
import { chartArea, type ChartOptions, type TooltipContent } from '../shared/controller'
import { plotKeys, renderPlotStatus } from '../shared/plot-keys'
import type { ChartSpec } from '../shared/types'

type HistogramSpec = Extract<ChartSpec, { kind: 'histogram' }>

/** The room under the x labels for the x title. */
const X_TITLE_HEIGHT = 16
/** A bound every few classes reads as a scale; one under every class as a list. */
const MIN_LABEL_SPACING = 56
const LINE_LABEL_GAP = 8
/** A second line label that would touch the first drops one line. */
const LINE_LABEL_ROW = 18

/** A bound as written: whole numbers whole, anything else with one decimal. */
function bound(value: number): string {
  return formatNumber(value, Number.isInteger(value) ? 0 : 1)
}

export interface LineLabel {
  x: number
  text: string
  /** Bold, as the median's label is: it runs about a tenth wider. */
  bold?: boolean
}

/**
 * Where the labels of the median and the threshold stand: right of their line, or left of it
 * where they would leave the drawing, and the right one a line lower when the two would touch.
 */
export function placeLineLabels(
  labels: LineLabel[],
  area: PlotArea,
  fontFamily = '',
): { x: number; y: number; anchor: 'start' | 'end' }[] {
  // The svg overflows, so a label may run into the right margin, as the last x label does.
  const end = area.width
  const boxes = labels.map((label) => {
    const width = textWidth(label.text, fontFamily) * (label.bold ? 1.1 : 1)
    const right = label.x + 6 + width <= end
    return {
      x: right ? label.x + 6 : label.x - 6,
      anchor: right ? ('start' as const) : ('end' as const),
      left: right ? label.x + 6 : label.x - 6 - width,
      right: right ? label.x + 6 + width : label.x - 6,
    }
  })
  const rightmost = boxes.length === 2 ? (labels[1].x >= labels[0].x ? 1 : 0) : -1
  const touch =
    boxes.length === 2 &&
    boxes[0].left < boxes[1].right + LINE_LABEL_GAP &&
    boxes[1].left < boxes[0].right + LINE_LABEL_GAP
  return boxes.map((box, i) => ({
    x: box.x,
    y: area.top + 12 + (touch && i === rightmost ? LINE_LABEL_ROW : 0),
    anchor: box.anchor,
  }))
}

export function renderHistogramChart(spec: HistogramSpec, options: ChartOptions): TemplateResult {
  const { controller, description } = options
  const { bins, axisTitle, xTitle, unit, median, threshold, small = false } = spec
  const label = spec.label ?? 'Aantal'
  const color = chartColor(spec.color) ?? DEFAULT_SERIES_COLOR
  const id = controller.id
  const withUnit = (value: string) => (unit ? `${value} ${unit}` : value)

  controller.measure({
    width: true,
    height: options.height ?? (small ? '--chart-h-small' : '--chart-h-main'),
    // In the modal the token is the body's inner height; the legend and axis title come off it.
    fit: Boolean(options.expanded) && !options.mobile,
  })

  const counts = bins.map((bin) => bin.count).filter((count): count is number => count != null)
  const total = counts.reduce((sum, count) => sum + count, 0)
  const { max, ticks } = axisScale(Math.max(...counts, 1))
  const axis = axisColumn(ticks, controller.width, { fontFamily: controller.fontFamily })
  const defaults = chartArea(options)
  const area = chartArea(options, {
    left: axis.width,
    bottom: defaults.bottom + (xTitle ? X_TITLE_HEIGHT : 0),
  })
  const baseline = area.height - area.bottom
  const plotRight = area.width - area.right

  // An open last class is as wide as the one before it.
  const first = bins[0]?.from ?? 0
  const last = bins[bins.length - 1]
  const openWidth = bins.length > 1 ? bins[bins.length - 1].from - bins[bins.length - 2].from : 1
  const upper = last ? (last.to ?? last.from + openWidth) : 1
  const xOf = (value: number) =>
    area.left +
    ((value - first) / Math.max(upper - first, Number.EPSILON)) * (plotRight - area.left)
  const slots = bins.map((bin) => {
    const x = xOf(bin.from)
    const width = xOf(bin.to ?? upper) - x
    return { x, width, center: x + width / 2 }
  })

  const binTitle = (i: number) => {
    const { from, to } = bins[i]
    return to == null
      ? withUnit(`${bound(from)} of meer`)
      : withUnit(`${bound(from)} tot ${bound(to)}`)
  }
  const contentAt = (i: number): TooltipContent => {
    const count = bins[i].count
    return {
      title: binTitle(i),
      rows: [
        { label, value: count == null ? 'geen gegevens' : formatNumber(count), color },
        ...(count != null && total > 0
          ? [{ label: 'Aandeel', value: formatPercent((count / total) * 100, 1), color }]
          : []),
      ],
    }
  }
  const keys = plotKeys(controller, bins.length, (i) => ({
    x: slots[i].center,
    y: bins[i].count == null ? area.top : yPosition(bins[i].count!, max, area),
    content: contentAt(i),
  }))

  // The labels stand on the bounds, thinned to what fits; an open class is named under its
  // middle, and the bound it starts on stays unlabelled.
  const open = last?.to == null && bins.length > 0
  const bounds = [
    ...bins.slice(0, open ? -1 : undefined).map((bin) => bin.from),
    ...(open ? [] : last ? [last.to!] : []),
  ].map((value) => ({ label: bound(value), x: xOf(value) }))
  const openLabel = open
    ? { label: `${bound(last.from)}+`, x: slots[slots.length - 1].center }
    : null
  const pitch =
    bounds.length > 1 ? (bounds[bounds.length - 1].x - bounds[0].x) / (bounds.length - 1) : 1
  const stride = Math.max(1, Math.ceil(MIN_LABEL_SPACING / pitch))
  let shown = thinLabels(
    bounds.filter((_, i) => i % stride === 0),
    controller.fontFamily,
  )
  if (openLabel && shown.length) {
    const before = shown[shown.length - 1]
    const room = openLabel.x - before.x
    const needed =
      (textWidth(before.label, controller.fontFamily) +
        textWidth(openLabel.label, controller.fontFamily)) /
        2 +
      LINE_LABEL_GAP
    if (room < needed) shown = shown.slice(0, -1)
  }

  const lines = [
    ...(median != null
      ? [
          {
            x: xOf(median),
            text: spec.medianLabel ?? withUnit(`mediaan ${bound(median)}`),
            bold: true,
            dashed: false,
          },
        ]
      : []),
    ...(threshold != null
      ? [
          {
            x: xOf(threshold),
            text: spec.thresholdLabel ?? withUnit(`norm ${bound(threshold)}`),
            bold: false,
            dashed: true,
          },
        ]
      : []),
  ]
  const lineLabels = placeLineLabels(lines, area, controller.fontFamily)

  const capitalised = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
  const legend: LegendItem[] = [
    { label, color, shape: 'square' },
    ...(median != null
      ? [{ label: 'Mediaan', color: 'var(--color-chart-emphasis)', shape: 'line' as const }]
      : []),
    ...(threshold != null
      ? [
          {
            label: capitalised(spec.thresholdLabel ?? 'Norm'),
            color: 'var(--color-chart-emphasis)',
            shape: 'dashed' as const,
          },
        ]
      : []),
  ]

  const bar = (i: number): SvgSlot => {
    const slot = slots[i]
    const count = bins[i].count
    // A missing count is no bar of height 0: its class is hatched over the plot's height (rule 15).
    if (count == null) {
      return svg`<rect class="lintje-chart__missing" x=${slot.x} y=${area.top} width=${slot.width}
                       height=${Math.max(0, baseline - area.top)} fill="url(#hatch-${id})" />`
    }
    const y = yPosition(count, max, area)
    return svg`
      <g class="lintje-chart__bar-group ${controller.hoverIndex === i ? 'is-hovered' : ''}"
         ${styleProps(staggerStyle(i, bins.length))}>
        <rect class="lintje-chart__bar lintje-chart__segment" x=${slot.x} y=${y} width=${slot.width}
              height=${Math.max(0, baseline - y)} fill=${color} />
      </g>
    `
  }
  // The classes touch, and a later sibling paints over an earlier one: the lifted class comes
  // last, so its neighbours do not cover it. Unkeyed, the nodes stay and only their attributes move.
  const hovered = controller.hoverIndex
  const order = bins.map((_, i) => i).filter((i) => i !== hovered)
  if (hovered != null && hovered < bins.length) order.push(hovered)

  const marks: SvgSlot = [
    order.map(bar),
    shown.map(
      (tick) => svg`
        <line x1=${tick.x} x2=${tick.x} y1=${baseline} y2=${baseline + 4}
              stroke="var(--color-chart-zero)" stroke-width="1" />
        <text x=${tick.x} y=${baseline + 20} text-anchor="middle" class="lintje-chart__axis-label">${tick.label}</text>
      `,
    ),
    openLabel
      ? svg`<text x=${openLabel.x} y=${baseline + 20} text-anchor="middle" class="lintje-chart__axis-label">${openLabel.label}</text>`
      : nothing,
    xTitle
      ? svg`<text x=${plotRight} y=${area.height - 4} text-anchor="end" class="lintje-chart__x-title">${xTitle}</text>`
      : nothing,
    lines.map((line, i) => {
      const place = lineLabels[i]
      return svg`
        <line x1=${line.x} x2=${line.x} y1=${area.top} y2=${baseline}
              stroke="var(--color-chart-emphasis)" stroke-width=${line.dashed ? 1 : 1.5}
              stroke-dasharray=${line.dashed ? '3 3' : nothing} />
        <text x=${place.x} y=${place.y} text-anchor=${place.anchor}
              class=${
                line.bold
                  ? 'lintje-chart__data-label lintje-chart__data-label--halo'
                  : 'lintje-chart__axis-label lintje-chart__axis-label--halo'
              }>${line.text}</text>
      `
    }),
    // The hit areas lie on top, so hover comes from hoverIndex rather than :hover.
    slots.map(
      (slot, i) => svg`
        <rect x=${slot.x} y=${area.top} width=${slot.width} height=${Math.max(0, baseline - area.top)}
              fill="transparent"
              @mousemove=${(event: MouseEvent) => controller.hoverAt(i, event, contentAt(i))}
              @mouseleave=${() => controller.hoverAt(null)} />
      `,
    ),
  ]

  return html`
    <div class="lintje-chart-wrap ${small ? 'lintje-chart--small' : ''}"
         ${ref(controller.attach)} ?data-in-view=${controller.inView} data-tooltip-anchor
         @keydown=${(event: KeyboardEvent) => controller.dismiss(event)}>
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
          keys,
        },
        marks,
      )}
      ${renderTooltip(controller)}
      ${renderPlotStatus(controller)}
    </div>
  `
}
