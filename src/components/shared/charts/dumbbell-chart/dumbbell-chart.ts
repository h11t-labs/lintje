/**
 * Dumbbell chart: one measure per row at two moments, the earlier a grey ring and the later a
 * dot in the variable's colour, joined by a neutral line; the signed difference stands in a
 * column of its own. A dumbbell carries a position, not a length, so the host may shorten the
 * axis; a value outside it stands on the edge with an off-axis mark. Below 768 px the name
 * stands on a line of its own above its row (rule 9).
 */
import { html, svg, nothing, type TemplateResult } from 'lit'
import { ref } from 'lit/directives/ref.js'
import { styleProps } from '../../../../core/style-props'
import { formatNumber, textWidth, truncateToWidth } from '../../../../core/format'
import { axisScale, rowLabelColumn } from '../shared/scale'
import { staggerStyle } from '../shared/stagger'
import { chartColor, DEFAULT_SERIES_COLOR, lineCasing } from '../shared/colors'
import { renderTooltip } from '../shared/tooltip'
import type { ChartOptions, TooltipContent, TooltipRow } from '../shared/controller'
import { markSelection } from '../shared/mark-select'
import {
  drawingRole,
  renderLegend,
  THRESHOLD_KEY,
  type KeyMark,
  type LegendItem,
  type SvgSlot,
} from '../shared/axes'
import { plotKeys, renderPlotStatus, tooltipSentence, type PlotPoint } from '../shared/plot-keys'
import type { ChartSpec, DumbbellRow } from '../shared/types'

type DumbbellSpec = Extract<ChartSpec, { kind: 'dumbbell' }>

/** The legend keys of the two moments: never the host's labels, which may name anything. */
export const FROM_KEY = 'moment:from'
export const TO_KEY = 'moment:to'

const ROW = 28
const PHONE_ROW = 44
/** Above the first row: the head of the difference column and the norm's label. */
const HEAD = 24
/** Under the last row: the scale. */
const FOOT = 24
/** Free at both ends of the axis: the ring with its edge, 2 px air and the off-axis mark. */
const EDGE = 14
const RING = 6
const DOT = 4
const MARK_GAP = 2
const MARK_DEPTH = 5
const MARK_HALF = 3
const FOCUS = 10
/** Between the end of the axis room and the difference column. */
const COLUMN_GAP = 8
const NO_DATA = 'geen gegevens'
const OFF_AXIS = 'buiten de as'

/** The chart's height: a row each, the head above and the scale under them. */
export function dumbbellHeight(count: number, mobile = false): number {
  return HEAD + count * (mobile ? PHONE_ROW : ROW) + FOOT
}

const fractionDigits = (value: number) =>
  Number.isInteger(value) ? 0 : (String(value).split('.')[1]?.length ?? 0)

/** As many decimals as the most precise value of the rows. */
export function dumbbellDecimals(rows: DumbbellRow[]): number {
  return Math.max(
    0,
    ...rows
      .flatMap((row) => [row.from, row.to])
      .filter((value): value is number => value != null)
      .map(fractionDigits),
  )
}

/** `to` minus `from`, rounded to `decimals`, from the real values; `null` when an end is missing. */
export function dumbbellDifference(
  row: Pick<DumbbellRow, 'from' | 'to'>,
  decimals: number,
): number | null {
  if (row.from == null || row.to == null) return null
  // `|| 0` turns a rounded -0 into 0, which reads "0,0" and not "-0,0".
  return Number((row.to - row.from).toFixed(decimals)) || 0
}

/**
 * The axis: the host's `min` and `max`, each without it the default, which runs from 0 to a
 * round value above the data and the norm. Ticks are the round steps inside it.
 */
export function dumbbellAxis(spec: Pick<DumbbellSpec, 'rows' | 'min' | 'max' | 'threshold'>): {
  min: number
  max: number
  ticks: number[]
} {
  const values = spec.rows
    .flatMap((row) => [row.from, row.to])
    .filter((value): value is number => value != null)
  const fallback = axisScale(Math.max(0, ...values, spec.threshold ?? 0))
  if (spec.min == null && spec.max == null) return { min: 0, ...fallback }
  const min = spec.min ?? 0
  const max = spec.max != null && spec.max > min ? spec.max : Math.max(fallback.max, min + 1)
  const scale = axisScale(max - min, 5)
  const step = scale.ticks[1] - scale.ticks[0]
  const ticks: number[] = []
  for (let tick = Math.ceil(min / step - 1e-9) * step; tick <= max + 1e-9; tick += step) {
    ticks.push(Number(tick.toFixed(6)))
  }
  return { min, max, ticks }
}

interface Point {
  value: number
  x: number
  /** -1 below `min`, 1 above `max`: drawn on the edge with an off-axis mark. */
  side: -1 | 0 | 1
}

/** The off-axis mark: a triangle pointing out, its base 2 px beyond the point's edge. */
function offAxisPath(point: Point, radius: number, y: number): string {
  const base = point.x + point.side * (radius + MARK_GAP)
  const apex = base + point.side * MARK_DEPTH
  return `M${base} ${y - MARK_HALF}L${apex} ${y}L${base} ${y + MARK_HALF}Z`
}

export function renderDumbbellChart(spec: DumbbellSpec, options: ChartOptions): TemplateResult {
  const { controller, description, mobile = false } = options
  const { rows, fromLabel, toLabel, threshold, unit } = spec
  const id = controller.id
  const color = chartColor(spec.color) ?? DEFAULT_SERIES_COLOR
  const casing = lineCasing(color)
  const fromOn = !controller.hiddenSeries.includes(FROM_KEY)
  const toOn = !controller.hiddenSeries.includes(TO_KEY)
  const normOn = threshold != null && !controller.hiddenSeries.includes(THRESHOLD_KEY)

  const decimals = dumbbellDecimals(rows)
  const normDecimals = Math.max(decimals, threshold != null ? fractionDigits(threshold) : 0)
  const format = (value: number) => formatNumber(value, decimals)
  const withUnit = (value: number) => `${format(value)}${unit ? ` ${unit}` : ''}`
  // Signed with U+2212, no unit; zero has no sign.
  const signed = (value: number, digits = decimals) =>
    value === 0
      ? formatNumber(0, digits)
      : `${value > 0 ? '+' : '−'}${formatNumber(Math.abs(value), digits)}`
  const toNorm = (value: number) => Number((value - threshold!).toFixed(normDecimals)) || 0
  const differences = rows.map((row) => dumbbellDifference(row, decimals))

  const height = dumbbellHeight(rows.length, mobile)
  controller.measure({ width: true, height })
  const width = controller.width
  const fontFamily = controller.fontFamily
  const row = mobile ? PHONE_ROW : ROW

  const { min, max, ticks } = dumbbellAxis(spec)
  const tickDecimals = Math.max(0, ...ticks.map(fractionDigits))
  const column = rowLabelColumn(
    rows.map((item) => item.label),
    width,
    { fontFamily },
  )
  // The difference column is as wide as its widest text, so the axis never moves with a toggle.
  const differenceWidth = Math.ceil(
    Math.max(
      textWidth('Verschil', fontFamily),
      textWidth(NO_DATA, fontFamily),
      ...differences.map((value) =>
        value == null ? 0 : textWidth(signed(value), fontFamily, 700),
      ),
    ),
  )
  const axisLeft = mobile ? EDGE : column.barStart + EDGE
  const axisRight = Math.max(axisLeft + 40, width - differenceWidth - COLUMN_GAP - EDGE)
  const x = (value: number) =>
    axisLeft + ((Math.min(max, Math.max(min, value)) - min) / (max - min)) * (axisRight - axisLeft)
  const pointOf = (value: number | null): Point | null =>
    value == null ? null : { value, x: x(value), side: value < min ? -1 : value > max ? 1 : 0 }
  const points = rows.map((item) => ({ from: pointOf(item.from), to: pointOf(item.to) }))
  const centreOf = (i: number) => HEAD + i * row + (mobile ? 31 : ROW / 2)
  const plotBottom = HEAD + rows.length * row

  const links = rows.map((item) =>
    item.href ? { id: item.id ?? item.label, href: item.href } : null,
  )
  const selection = markSelection(options, links)

  const missing = rows.some((item) => item.from == null || item.to == null)
  const outside = points.some(
    ({ from, to }) => (from != null && from.side !== 0) || (to != null && to.side !== 0),
  )
  const legend: LegendItem[] = [
    {
      key: FROM_KEY,
      label: fromLabel,
      shape: 'ring',
      color: 'var(--color-chart-secondary)',
      hidden: !fromOn,
    },
    { key: TO_KEY, label: toLabel, shape: 'dot', color, hidden: !toOn },
    ...(threshold != null
      ? [
          {
            key: THRESHOLD_KEY,
            label: spec.thresholdLabel ?? `Norm ${formatNumber(threshold, normDecimals)}`,
            color: 'var(--color-chart-emphasis)',
            shape: 'dashed' as const,
            hidden: !normOn,
          },
        ]
      : []),
    ...(missing ? [{ label: 'Geen gegevens', shape: 'hatch' as const, fixed: true }] : []),
    ...(outside
      ? [
          {
            label: 'Buiten de as',
            shape: 'off-axis' as const,
            color: 'var(--color-text-muted)',
            fixed: true,
          },
        ]
      : []),
  ]

  const moment = (
    label: string,
    value: number | null,
    point: Point | null,
    marker: KeyMark,
    tone: string,
  ): TooltipRow => ({
    label,
    value: value == null ? NO_DATA : withUnit(value),
    marker,
    color: tone,
    aside: point != null && point.side !== 0 ? OFF_AXIS : undefined,
  })
  const contentAt = (i: number): TooltipContent => {
    const item = rows[i]
    const lines: TooltipRow[] = []
    if (fromOn) {
      lines.push(
        moment(fromLabel, item.from, points[i].from, 'ring', 'var(--color-chart-secondary)'),
      )
    }
    if (toOn) lines.push(moment(toLabel, item.to, points[i].to, 'dot', color))
    const difference = fromOn && toOn ? differences[i] : null
    if (difference != null) {
      lines.push({ label: 'Verschil', value: signed(difference), divider: true })
    }
    if (normOn && toOn && item.to != null) {
      lines.push({
        label: 't.o.v. norm',
        value: signed(toNorm(item.to), normDecimals),
        divider: difference == null,
      })
    }
    return { title: item.label, rows: lines }
  }

  // The tooltip stands right of the row's right point, else left of its left one; on a phone
  // under the row, centred when it fits beside neither.
  const at = (i: number): PlotPoint => {
    const shown = [fromOn ? points[i].from : null, toOn ? points[i].to : null].filter(
      (point): point is Point => point != null,
    )
    const xs = shown.length ? shown.map((point) => point.x) : [axisLeft]
    const reach = mobile ? 0 : EDGE - 12
    return {
      x: Math.max(...xs) + reach,
      flip: Math.min(...xs) - reach,
      y: mobile ? HEAD + (i + 1) * row + 12 : centreOf(i),
      content: contentAt(i),
    }
  }
  const keys = plotKeys(controller, rows.length, at)
  const showRow = (event: MouseEvent, i: number) => {
    const drawing = (event.currentTarget as SVGElement).ownerSVGElement
    const anchor = drawing?.closest('[data-tooltip-anchor]')
    if (!drawing || !anchor) return
    const box = drawing.getBoundingClientRect()
    const left = box.left - anchor.getBoundingClientRect().left
    const point = at(i)
    controller.hoverIndex = i
    controller.showTooltipAt(
      left + point.x,
      box.top - anchor.getBoundingClientRect().top + point.y,
      point.content,
      left + point.flip!,
    )
  }

  const norm =
    threshold != null && threshold >= min && threshold <= max
      ? (() => {
          const nx = x(threshold)
          const label = spec.thresholdLabel ?? `norm ${formatNumber(threshold, normDecimals)}`
          // A label that would run into the difference column stands left of its line.
          const right = nx + 6 + textWidth(label, fontFamily) <= axisRight + EDGE
          return svg`<g class="lintje-chart__series ${normOn ? '' : 'is-off'}">
            <line class="lintje-chart__reference lintje-dumbbell__norm" x1=${nx} x2=${nx}
                  y1=${HEAD - 4} y2=${plotBottom} />
            <text x=${right ? nx + 6 : nx - 6} y=${HEAD - 9} text-anchor=${right ? 'start' : 'end'}
                  class="lintje-chart__axis-label lintje-chart__reference">${label}</text>
          </g>`
        })()
      : nothing

  const body: SvgSlot = [
    ticks.map(
      (tick) =>
        svg`<line class="lintje-dumbbell__grid" x1=${x(tick)} x2=${x(tick)} y1=${HEAD} y2=${plotBottom} />`,
    ),
    min <= 0 && max >= 0
      ? svg`<line class="lintje-dumbbell__zero" x1=${x(0)} x2=${x(0)} y1=${HEAD} y2=${plotBottom} />`
      : nothing,
    ticks.map(
      (tick) => svg`<text x=${x(tick)} y=${plotBottom + 16} text-anchor="middle"
                          class="lintje-chart__axis-label">${formatNumber(tick, tickDecimals)}</text>`,
    ),
    svg`<text x=${width} y=${HEAD - 9} text-anchor="end" class="lintje-chart__axis-label">Verschil</text>`,
    norm,
    svg`<g @mouseleave=${() => controller.hoverAt(null)}>${rows.map((item, i) => {
      const { from, to } = points[i]
      const top = HEAD + i * row
      const cy = centreOf(i)
      const difference = differences[i]
      // Both beyond one edge lie on each other, as an unchanged row does, under one mark.
      const together =
        fromOn && toOn && from != null && to != null && from.side !== 0 && from.side === to.side
      const mark = selection.of(links[i], item.label, tooltipSentence(contentAt(i)))
      const focus = toOn && to ? to : fromOn && from ? from : null
      return svg`
        <g class="lintje-dumbbell__row ${controller.hoverIndex === i ? 'is-hovered' : ''} ${mark.state}"
           data-mark-id=${mark.markId} role=${mark.role} tabindex=${mark.tabIndex}
           aria-pressed=${mark.pressed} aria-label=${mark.label}
           @click=${mark.click} @keydown=${mark.keydown}>
          ${
            from == null || to == null
              ? svg`<rect class="lintje-dumbbell__gap" x=${axisLeft} y=${cy - 5} width=${axisRight - axisLeft}
                          height="10" fill="url(#hatch-${id})" />`
              : nothing
          }
          ${
            mobile
              ? svg`<text x="0" y=${top + 14} class="lintje-dumbbell__name lintje-dumbbell__name--above">${truncateToWidth(item.label, (width * 12) / 14, fontFamily)}</text>`
              : svg`<text x=${column.labelEnd} y=${cy + 4} text-anchor="end"
                          class="lintje-chart__axis-label lintje-dumbbell__name">${column.fit(item.label)}</text>`
          }
          ${
            from != null && to != null && !together
              ? svg`<g class="lintje-chart__series ${fromOn && toOn ? '' : 'is-off'}">
                  <line class="lintje-dumbbell__link" x1=${from.x} x2=${to.x} y1=${cy} y2=${cy}
                        ${styleProps({
                          ...staggerStyle(i, rows.length),
                          '--lintje-dumbbell-from': `${from.x}px`,
                        })} />
                </g>`
              : nothing
          }
          ${
            from != null
              ? svg`<g class="lintje-chart__series ${fromOn ? '' : 'is-off'}">
                  <circle class="lintje-dumbbell__ring" cx=${from.x} cy=${cy} r=${RING} />
                  ${
                    from.side !== 0 && !together
                      ? svg`<path class="lintje-chart__off-axis" d=${offAxisPath(from, RING + 1, cy)}
                                  fill="var(--color-chart-secondary)" />`
                      : nothing
                  }
                </g>`
              : nothing
          }
          ${
            to != null
              ? svg`<g class="lintje-chart__series ${toOn ? '' : 'is-off'}">
                  <circle class="lintje-dumbbell__dot" cx=${to.x} cy=${cy} r=${DOT} fill=${color}
                          stroke=${casing ?? nothing} stroke-width=${casing ? 1 : nothing}
                          ${styleProps({
                            ...staggerStyle(i, rows.length),
                            '--lintje-dumbbell-shift': `${from != null ? from.x - to.x : 0}px`,
                          })} />
                  ${
                    to.side !== 0
                      ? svg`<path class="lintje-chart__off-axis" d=${offAxisPath(to, together ? RING + 1 : DOT, cy)}
                                  fill=${color} stroke=${casing ?? nothing} stroke-width=${casing ? 1 : nothing} />`
                      : nothing
                  }
                </g>`
              : nothing
          }
          ${
            // Without a drawn point the ring goes round the whole row, inside its edge.
            focus
              ? svg`<circle class="lintje-dumbbell__focus" cx=${focus.x} cy=${cy} r=${FOCUS} />`
              : svg`<rect class="lintje-dumbbell__focus" x="1.5" y=${top + 1.5}
                          width=${Math.max(0, width - 3)} height=${Math.max(0, row - 3)} />`
          }
          <g class="lintje-chart__series ${fromOn && toOn ? '' : 'is-off'}">
            <text x=${width} y=${cy + 4} text-anchor="end"
                  class="lintje-chart__data-label lintje-dumbbell__difference ${difference == null ? 'lintje-dumbbell__no-value' : ''}">${difference == null ? NO_DATA : signed(difference)}</text>
          </g>
          <!-- The whole row answers, so the tooltip does not flicker between ring and dot. -->
          <rect class="lintje-chart__hit" x="0" y=${top} width=${width} height=${row}
                @mouseenter=${(event: MouseEvent) => showRow(event, i)} />
        </g>
      `
    })}</g>`,
  ]

  return html`
    <div class="lintje-chart-wrap" ${ref(controller.attach)} ?data-in-view=${controller.inView}
         data-tooltip-anchor
         @keydown=${(event: KeyboardEvent) => controller.dismiss(event) || selection.escape(event)}>
      ${renderLegend({ items: legend, onToggle: (key) => controller.toggleSeries(key) })}
      <figure class="lintje-chart">
        <svg viewBox="0 0 ${width} ${height}" width=${width} height=${height}
             class="lintje-chart__svg lintje-dumbbell ${mobile ? 'lintje-dumbbell--rows' : ''}"
             ${styleProps({ height: `${height}px` })}
             role=${drawingRole(selection.interactive)} aria-labelledby="${id}-desc" tabindex="0"
             @keydown=${keys.keydown} @focus=${keys.focus} @blur=${keys.blur}>
          <desc id="${id}-desc">${description}</desc>
          <defs>
            <pattern id="hatch-${id}" width="6" height="6" patternUnits="userSpaceOnUse"
                     patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-chart-hatch)" stroke-width="2" />
            </pattern>
          </defs>
          ${body}
        </svg>
      </figure>
      ${renderTooltip(controller)}
      ${renderPlotStatus(controller)}
    </div>
  `
}
