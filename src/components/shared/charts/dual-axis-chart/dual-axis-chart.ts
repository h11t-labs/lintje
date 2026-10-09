/**
 * Two y-axes, each in the color of its series. Yellow text on white is too light, so axis
 * text takes dark-yellow-80 % (#B07A00).
 */
import { html, svg, nothing, type TemplateResult } from 'lit'
import { ref } from 'lit/directives/ref.js'
import { styleProps } from '../../../../core/style-props'
import { AXIS_GAP, axisColumn, axisScale, band, yPosition } from '../shared/scale'
import { formatNumber } from '../../../../core/format'
import { staggerStyle } from '../shared/stagger'
import { DEFAULT_SERIES_COLOR, chartColor, lineCasing } from '../shared/colors'
import { drawingRole, renderLegend, type LegendItem } from '../shared/axes'
import { renderTooltip } from '../shared/tooltip'
import { chartArea, type ChartOptions, type TooltipContent } from '../shared/controller'
import { plotKeys, renderPlotStatus } from '../shared/plot-keys'
import type { ChartSpec } from '../shared/types'

type DualAxisSpec = Extract<ChartSpec, { kind: 'dual-axis' }>

export function renderDualAxisChart(spec: DualAxisSpec, options: ChartOptions): TemplateResult {
  const { controller, description } = options
  const { labels, threshold, thresholdLabel, small = false, pendingHours = 0 } = spec
  const left = { ...spec.left, color: chartColor(spec.left.color) }
  const right = { ...spec.right, color: chartColor(spec.right.color) }
  const id = controller.id

  controller.measure({
    width: true,
    height: options.height ?? (small ? '--chart-h-small' : '--chart-h-main'),
    // In the modal the token is the body's inner height; the legend and axis title come off it.
    fit: Boolean(options.expanded) && !options.mobile,
  })

  const leftColor = left.color ?? DEFAULT_SERIES_COLOR
  const rightColor = right.color ?? 'var(--color-chart-dark-yellow)'
  const rightTextColor = 'var(--color-chart-dark-yellow-text)'

  const l = axisScale(Math.max(...left.values.filter((value): value is number => value != null), 1))
  const r = axisScale(
    Math.max(...right.values.filter((value): value is number => value != null), threshold ?? 0, 1),
  )
  const leftAxis = axisColumn(l.ticks, controller.width, { fontFamily: controller.fontFamily })
  const rightAxis = axisColumn(r.ticks, controller.width, { fontFamily: controller.fontFamily })
  const area = chartArea(options, { left: leftAxis.width, right: rightAxis.width })
  const baseline = area.height - area.bottom

  const legend: LegendItem[] = [
    { label: `${left.label} (linkeras)`, color: leftColor, shape: 'square' },
    { label: `${right.label} (rechteras)`, color: rightColor, shape: 'line' },
    ...(threshold != null
      ? [
          {
            label: thresholdLabel ?? `Norm ${threshold}`,
            color: 'var(--color-chart-emphasis)',
            shape: 'dashed' as const,
          },
        ]
      : []),
  ]

  const step = Math.max(1, Math.ceil(labels.length / 8))
  const hoverIndex = controller.hoverIndex
  const rightCasing = lineCasing(rightColor)
  // A missing value breaks the line (rule 15): one polyline per run of known values.
  const rightRuns: string[][] = [[]]
  right.values.forEach((value, i) => {
    if (value == null) {
      if (rightRuns[rightRuns.length - 1].length) rightRuns.push([])
      return
    }
    rightRuns[rightRuns.length - 1].push(
      `${band(i, labels.length, area).center},${yPosition(value, r.max, area)}`,
    )
  })

  const withUnit = (value: number | null, unit?: string) =>
    value == null ? 'geen gegevens' : `${formatNumber(value)}${unit ? ` ${unit}` : ''}`
  const contentAt = (i: number): TooltipContent => ({
    title: labels[i],
    rows: [
      { label: left.label, value: withUnit(left.values[i], left.unit), color: leftColor },
      { label: right.label, value: withUnit(right.values[i], right.unit), color: rightColor },
    ],
  })
  const keys = plotKeys(controller, labels.length, (i) => ({
    x: band(i, labels.length, area).center,
    y: Math.min(
      left.values[i] == null ? baseline : yPosition(left.values[i]!, l.max, area),
      right.values[i] == null ? baseline : yPosition(right.values[i]!, r.max, area),
    ),
    content: contentAt(i),
  }))

  return html`
    <div class="lintje-chart-wrap ${small ? 'lintje-chart--small' : ''}"
         ${ref(controller.attach)} ?data-in-view=${controller.inView} data-tooltip-anchor
         @keydown=${(event: KeyboardEvent) => controller.dismiss(event)}>
      ${renderLegend({ items: legend })}
      <figure class="lintje-chart">
        <svg viewBox="0 0 ${area.width} ${area.height}" class="lintje-chart__svg" role=${drawingRole(false)}
             aria-labelledby="${id}-desc" width=${area.width} height=${area.height}
             tabindex="0" @keydown=${keys.keydown} @focus=${keys.focus} @blur=${keys.blur}>
          <desc id="${id}-desc">${description}</desc>
          <defs>
            <pattern id="hatch-${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-chart-hatch)" stroke-width="2" />
            </pattern>
          </defs>
          <!-- Incomplete hours at the end: hatched, never drawn as zero. -->
          ${
            pendingHours > 0
              ? (() => {
                  const first = band(labels.length - pendingHours, labels.length, area)
                  return svg`<rect x=${first.x - (first.bandWidth - first.width) / 2} y=${area.top}
                             width=${area.width - area.right - first.x + (first.bandWidth - first.width) / 2}
                             height=${baseline - area.top} fill="url(#hatch-${id})" />`
                })()
              : nothing
          }

          ${l.ticks.map((tick) => {
            const y = yPosition(tick, l.max, area)
            const isZero = tick === 0
            return svg`
              <g>
                <line x1=${area.left} x2=${area.width - area.right} y1=${y} y2=${y}
                      stroke=${isZero ? 'var(--color-chart-zero)' : 'var(--color-chart-grid)'}
                      stroke-width=${isZero ? 1.5 : 1} />
                <text x=${area.left - AXIS_GAP} y=${y + 4} text-anchor="end" class="lintje-chart__axis-label" fill=${leftColor}>
                  ${leftAxis.format(tick)}
                </text>
              </g>
            `
          })}
          ${r.ticks.map(
            (tick) => svg`
            <text x=${area.width - area.right + AXIS_GAP} y=${yPosition(tick, r.max, area) + 4}
                  class="lintje-chart__axis-label" fill=${rightTextColor}>${rightAxis.format(tick)}</text>
          `,
          )}

          <!-- 2 px axis lines in the color of their series -->
          <line x1=${area.left} x2=${area.left} y1=${area.top} y2=${baseline} stroke=${leftColor} stroke-width="2" />
          <line x1=${area.width - area.right} x2=${area.width - area.right} y1=${area.top} y2=${baseline}
                stroke=${rightColor} stroke-width="2" />

          <!-- Bars grow in one after another; the hit areas below sit on top, so hover comes
               from hoverIndex rather than :hover. -->
          ${left.values.map((value, i) => {
            const slot = band(i, labels.length, area)
            // An empty slot is hatched, not a bar of height 0 (rule 15).
            if (value == null) {
              return svg`<rect class="lintje-chart__missing" x=${slot.x} y=${area.top} width=${slot.width}
                               height=${Math.max(0, baseline - area.top)} fill="url(#hatch-${id})" />`
            }
            const y = yPosition(value, l.max, area)
            return svg`
              <g class="lintje-chart__bar-group ${hoverIndex === i ? 'is-hovered' : ''}"
                 ${styleProps(staggerStyle(i, labels.length))}>
                <rect class="lintje-chart__bar" x=${slot.x} y=${y} width=${slot.width}
                      height=${Math.max(0, baseline - y)} fill=${leftColor} />
              </g>
            `
          })}

          ${
            threshold != null
              ? svg`<line x1=${area.left} x2=${area.width - area.right}
                        y1=${yPosition(threshold, r.max, area)} y2=${yPosition(threshold, r.max, area)}
                        stroke="var(--color-chart-emphasis)" stroke-width="1" stroke-dasharray="4 3" />`
              : nothing
          }

          <g class="lintje-chart__reveal">
            ${rightRuns
              .filter((run) => run.length > 0)
              .map((run) => {
                const points = run.join(' ')
                const [cx, cy] = run[0].split(',')
                return svg`
                  ${
                    rightCasing && run.length > 1
                      ? svg`<polyline class="lintje-chart__line lintje-chart__line--casing"
                                    stroke=${rightCasing} points=${points} />`
                      : nothing
                  }
                  ${
                    run.length === 1
                      ? svg`<circle cx=${cx} cy=${cy} r="2.5" fill=${rightColor} />`
                      : svg`<polyline class="lintje-chart__line" stroke=${rightColor} points=${points} />`
                  }
                `
              })}
          </g>

          ${labels
            .filter((_, i) => i % step === 0)
            .map(
              (label, j) => svg`
            <text x=${band(j * step, labels.length, area).center} y=${area.height - 8}
                  text-anchor="middle" class="lintje-chart__axis-label">${label}</text>
          `,
            )}

          <!-- Hover point on the right-axis line; no point for a missing value. -->
          ${
            hoverIndex != null && right.values[hoverIndex] != null
              ? svg`<circle class="lintje-chart__hover-point" r="4" fill=${rightColor}
                          cx=${band(hoverIndex, labels.length, area).center}
                          cy=${yPosition(right.values[hoverIndex]!, r.max, area)} />`
              : nothing
          }
          ${labels.map((_, i) => {
            const slot = band(i, labels.length, area)
            return svg`
              <rect x=${slot.x} y=${area.top} width=${slot.bandWidth} height=${baseline - area.top}
                    fill="transparent"
                    @mousemove=${(event: MouseEvent) => controller.hoverAt(i, event, contentAt(i))}
                    @mouseleave=${() => controller.hoverAt(null)} />
            `
          })}
        </svg>
      </figure>
      ${renderTooltip(controller)}
      ${renderPlotStatus(controller)}
    </div>
  `
}
