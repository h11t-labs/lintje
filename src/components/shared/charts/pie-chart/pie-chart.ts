/**
 * Pie and donut: at most five parts, largest first and darkest first, whatever order the host
 * sends. The parts take the tints of one variable (the spec's `color`, or the default) spread
 * over the ladder with their number. "Overig" and a `remainder` segment (the open part of an
 * occupancy donut) are not parts: they draw last, gray and light gray, unless the data colours
 * them; a segment's own `color` always wins. More than five parts fold into four and one gray
 * "Overig" that is not clickable: a merged slice has no single place to drill into. The legend
 * is a table, in the drawn order.
 */
import { html, svg, nothing, type TemplateResult } from 'lit'
import { ref } from 'lit/directives/ref.js'
import { styleProps } from '../../../../core/style-props'
import { formatNumber, formatPercent } from '../../../../core/format'
import { chartColor } from '../shared/colors'
import { renderTooltip } from '../shared/tooltip'
import type { ChartOptions } from '../shared/controller'
import { markSelection } from '../shared/mark-select'
import { drawingRole, focusRingStyle, renderFocusRing } from '../shared/axes'
import { tintsFor } from '../shared/tints'
import type { ChartSpec } from '../shared/types'

/** More parts than this fold into "Overig"; the ladder holds five. */
const MAX_PARTS = 5

type PieSpec = Extract<ChartSpec, { kind: 'pie' }>
type PieSegment = PieSpec['segments'][number]

const isOther = (segment: PieSegment): boolean => {
  const label = segment.label.toLowerCase()
  return label.startsWith('overig') || label === 'rest'
}

/** A segment that takes a tint: neither "Overig" nor a remainder. */
const isPart = (segment: PieSegment): boolean => !segment.remainder && !isOther(segment)

/** The segments in drawn order: the parts by size, then "Overig", then the remainders. */
function prepare(segments: PieSegment[]): PieSegment[] {
  const parts = segments.filter(isPart).sort((a, b) => b.value - a.value)
  const other = segments.filter((segment) => !segment.remainder && isOther(segment))
  const remainders = segments.filter((segment) => segment.remainder)
  if (parts.length > MAX_PARTS) {
    const sum = parts.splice(MAX_PARTS - 1).reduce((total, segment) => total + segment.value, 0)
    // Into the host's own "Overig" if it sent one, so the gray slice is drawn once; the merged
    // slice keeps no link.
    if (other.length > 0) {
      const [first] = other
      other[0] = { label: first.label, value: first.value + sum, color: first.color }
    } else {
      other.push({ label: 'Overig', value: sum })
    }
  }
  return [...parts, ...other, ...remainders]
}

export function renderPieChart(spec: PieSpec, options: ChartOptions): TemplateResult {
  const { controller, description } = options
  const {
    donut = false,
    centerValue,
    centerLabel,
    legendTable = true,
    labelHeader = 'Categorie',
  } = spec
  const id = controller.id
  const segments = prepare(spec.segments).map((segment) => ({
    ...segment,
    color: chartColor(segment.color),
  }))
  // Without an id of its own the label is the slice's identity.
  const links = segments.map((segment) =>
    segment.href ? { id: segment.id ?? segment.label, href: segment.href } : null,
  )
  const selection = markSelection(options, links)
  // A legend row follows its slice, so swatch and slice dim together.
  const rowState = (i: number): string => {
    const state = selection.of(links[i], segments[i].label, segments[i].label).state
    return state.includes('is-selected')
      ? 'is-selected'
      : state.includes('is-muted')
        ? 'is-muted'
        : ''
  }

  // In the tile the pie has its own size (200, or the spec's). In the modal it grows with
  // the body (the modal's height token, within 240–560); width is watched so the token is
  // read again once the modal has laid out.
  const expanded = Boolean(options.expanded)
  controller.measure(expanded ? { width: true, height: '--chart-h-main' } : {})
  const size = expanded ? Math.max(240, Math.min(560, controller.height - 24)) : (spec.size ?? 200)

  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  const radius = size / 2
  const innerRadius = donut ? radius * 0.62 : 0
  // A part takes the tint of its rank; a colour of its own replaces that tint and does not
  // hand it on. Slice and legend row read the same array.
  const tints = tintsFor(segments.filter(isPart).length, spec.color)
  let rank = -1
  const colors = segments.map((segment) => {
    if (isPart(segment)) rank += 1
    return (
      segment.color ??
      (segment.remainder
        ? 'var(--color-chart-remainder)'
        : isOther(segment)
          ? 'var(--color-chart-other)'
          : tints[Math.min(rank, tints.length - 1)])
    )
  })

  let angle = -90
  const arcs = segments.map((segment, i) => {
    const part = segment.value / total
    const start = angle
    const end = angle + part * 360
    angle = end
    const largeArc = part > 0.5 ? 1 : 0
    const point = (degrees: number, r: number) => [
      radius + r * Math.cos((degrees * Math.PI) / 180),
      radius + r * Math.sin((degrees * Math.PI) / 180),
    ]
    const [x1, y1] = point(start, radius)
    const [x2, y2] = point(end, radius)
    const d = donut
      ? (() => {
          const [ix1, iy1] = point(end, innerRadius)
          const [ix2, iy2] = point(start, innerRadius)
          return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix2} ${iy2} Z`
        })()
      : `M ${radius} ${radius} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`
    return { segment, i, d, color: colors[i] }
  })
  const hover = controller.hoverSegment
  const lifted = hover != null ? arcs[hover] : undefined

  const setHover = (index: number | null) => {
    controller.hoverSegment = index
    controller.requestUpdate()
  }

  return html`
    <div class="lintje-pie-chart ${expanded ? 'lintje-pie-chart--expanded' : ''}" ${ref(controller.attach)}
         ?data-in-view=${controller.inView} data-tooltip-anchor
         @keydown=${(event: KeyboardEvent) => controller.dismiss(event) || selection.escape(event)}>
      <svg viewBox="0 0 ${size} ${size}" width=${size} height=${size} role=${drawingRole(selection.interactive)}
           class="lintje-pie-chart__svg" aria-labelledby="${id}-desc" ${styleProps(focusRingStyle(id))}>
        <desc id="${id}-desc">${description}</desc>
        <defs>${renderFocusRing(id)}</defs>
        ${arcs.map(({ segment, i, d, color }) => {
          const mark = selection.of(
            links[i],
            segment.label,
            `${segment.label}: ${formatNumber(segment.value)} · ${formatPercent((segment.value / total) * 100)}`,
          )
          return svg`
          <path d=${d} fill=${color}
                class="lintje-pie-chart__segment lintje-chart__mark lintje-chart__segment ${hover === i ? 'is-hovered' : ''} ${mark.state}"
                ${styleProps({ 'transform-origin': `${radius}px ${radius}px` })}
                data-mark-id=${mark.markId} role=${mark.role} tabindex=${mark.tabIndex}
                aria-pressed=${mark.pressed} aria-label=${mark.label}
                @click=${mark.click} @keydown=${mark.keydown}
                @mousemove=${(event: MouseEvent) => {
                  setHover(i)
                  controller.showTooltip(event, {
                    title: segment.label,
                    rows: [
                      {
                        label: 'Aantal',
                        value: `${formatNumber(segment.value)} · ${formatPercent((segment.value / total) * 100)}`,
                        color,
                      },
                    ],
                  })
                }}
                @mouseleave=${() => {
                  controller.hoverSegment = null
                  controller.hideTooltip()
                  controller.requestUpdate()
                }} />
        `
        })}
        <!-- The hovered segment once more on top, lifted with a light shadow: in place, the
             next segment would cover that shadow on one side (user test 13 Sep). -->
        ${
          lifted
            ? svg`<path d=${lifted.d} fill=${lifted.color} class="lintje-pie-chart__lift lintje-chart__segment"
                      ${styleProps({ 'transform-origin': `${radius}px ${radius}px` })} aria-hidden="true" />`
            : nothing
        }
        ${
          donut && centerValue
            ? svg`
          <text x=${radius} y=${radius + 2} text-anchor="middle" class="lintje-pie-chart__center">${centerValue}</text>
          ${
            centerLabel
              ? svg`<text x=${radius} y=${radius + 20} text-anchor="middle" class="lintje-chart__axis-label">${centerLabel}</text>`
              : nothing
          }
        `
            : nothing
        }
      </svg>

      ${
        legendTable
          ? html`
        <table class="lintje-pie-chart__table">
          <caption class="visually-hidden">Legenda: ${description}</caption>
          <thead>
            <tr>
              <th scope="col" class="lintje-pie-chart__column-label">${labelHeader}</th>
              <th scope="col" class="lintje-pie-chart__column-label lintje-pie-chart__column-label--numeric">aantal</th>
              <th scope="col" class="lintje-pie-chart__column-label lintje-pie-chart__column-label--numeric">%</th>
            </tr>
          </thead>
          <tbody>
            ${segments.map(
              (segment, i) => html`
              <tr class="lintje-pie-chart__row ${hover === i ? 'is-hovered' : ''} ${rowState(i)}"
                  @mouseenter=${() => setHover(i)} @mouseleave=${() => setHover(null)}>
                <th scope="row" class="lintje-pie-chart__label">
                  <span class="lintje-pie-chart__marker" ${styleProps({ background: colors[i] })}></span>${segment.label}
                </th>
                <td class="lintje-pie-chart__value">${formatNumber(segment.value)}</td>
                <td class="lintje-pie-chart__value">${formatPercent((segment.value / total) * 100)}</td>
              </tr>
            `,
            )}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" class="lintje-pie-chart__total-label">Totaal</th>
              <td class="lintje-pie-chart__total">${formatNumber(total)}</td>
              <td class="lintje-pie-chart__total"></td>
            </tr>
          </tfoot>
        </table>
      `
          : nothing
      }
      ${renderTooltip(controller)}
    </div>
  `
}
