/**
 * Horizontal bars with a threshold. The threshold is black and dashed,
 * never a second data color; a row above it takes variable c's color, so the
 * exceedance is carried by more than the bar length alone.
 */
import { html, svg, nothing, type TemplateResult } from 'lit'
import { ref } from 'lit/directives/ref.js'
import { styleProps } from '../../../../core/style-props'
import { formatNumber } from '../../../../core/format'
import { rowLabelColumn } from '../shared/scale'
import { staggerStyle } from '../shared/stagger'
import { chartColor } from '../shared/colors'
import { renderTooltip } from '../shared/tooltip'
import type { ChartOptions, TooltipContent } from '../shared/controller'
import { markSelection } from '../shared/mark-select'
import { drawingRole, focusRingStyle, renderFocusRing } from '../shared/axes'
import { plotKeys, renderPlotStatus } from '../shared/plot-keys'
import type { ChartSpec } from '../shared/types'

type HorizontalBarSpec = Extract<ChartSpec, { kind: 'horizontal-bar' }>

/** Horizontal bars draw 26 px per row plus the axis line. */
export function rowsHeight(count: number): number {
  return count * 26 + 24
}

export function renderHorizontalBarChart(
  spec: HorizontalBarSpec,
  options: ChartOptions,
): TemplateResult {
  const { controller, description } = options
  const { rows, threshold, thresholdLabel, unit } = spec
  const color = chartColor(spec.color) ?? 'var(--color-chart-dark-yellow)'
  const aboveThresholdColor = chartColor(spec.aboveThresholdColor) ?? 'var(--color-chart-red)'
  const id = controller.id
  // The row itself carries the href, the way a table row does; without an id of
  // its own the label is the identity.
  const links = rows.map((row) => (row.href ? { id: row.id ?? row.label, href: row.href } : null))
  const selection = markSelection(options, links)

  const rowHeight = 26
  const barHeight = 16
  const height = rowsHeight(rows.length)
  // Measured width: this way 12 px axis text stays 12 px, even in a narrow tile.
  controller.measure({ width: true, height })
  const width = controller.width
  // The label column follows the widest label, within its caps.
  const column = rowLabelColumn(
    rows.map((row) => row.label),
    width,
    { fontFamily: controller.fontFamily },
  )
  const { labelEnd, barStart } = column
  const max = Math.max(...rows.map((row) => row.value), threshold ?? 0) * 1.15
  const scale = (value: number) => (Math.max(40, width - barStart - 60) * value) / max
  const withUnit = (value: number) => `${formatNumber(value)}${unit ? ` ${unit}` : ''}`
  const contentAt = (i: number): TooltipContent => {
    const row = rows[i]
    const above = threshold != null && row.value > threshold
    return {
      title: row.label,
      rows: [
        { label: 'Waarde', value: withUnit(row.value), color: above ? aboveThresholdColor : color },
        ...(threshold != null
          ? [{ label: 'Norm', value: withUnit(threshold), color: 'var(--color-chart-emphasis)' }]
          : []),
      ],
    }
  }
  const keys = plotKeys(controller, rows.length, (i) => ({
    x: barStart + scale(rows[i].value),
    y: i * rowHeight + 4,
    content: contentAt(i),
  }))

  return html`
    <figure class="lintje-chart lintje-chart--rows" ${ref(controller.attach)} ?data-in-view=${controller.inView}
            data-tooltip-anchor
            @keydown=${(event: KeyboardEvent) => controller.dismiss(event) || selection.escape(event)}>
      <svg viewBox="0 0 ${width} ${height}" class="lintje-chart__svg" role=${drawingRole(selection.interactive)}
           aria-labelledby="${id}-desc" width=${width} height=${height}
           ${styleProps({ height: `${height}px`, ...focusRingStyle(id) })}
           tabindex="0" @keydown=${keys.keydown} @focus=${keys.focus} @blur=${keys.blur}>
        <desc id="${id}-desc">${description}</desc>
        <defs>${renderFocusRing(id)}</defs>
        ${
          threshold != null
            ? svg`
          <line x1=${barStart + scale(threshold)} x2=${barStart + scale(threshold)} y1=${4} y2=${rows.length * rowHeight + 2}
                stroke="var(--color-chart-emphasis)" stroke-width="1" stroke-dasharray="3 3" />
          <text x=${barStart + scale(threshold) + 6} y=${rows.length * rowHeight + 16} class="lintje-chart__axis-label">
            ${thresholdLabel ?? `norm ${formatNumber(threshold)}`}
          </text>
        `
            : nothing
        }
        ${rows.map((row, i) => {
          const y = i * rowHeight + 4
          const aboveThreshold = threshold != null && row.value > threshold
          const barWidth = scale(row.value)
          const mark = selection.of(
            links[i],
            row.label,
            `${row.label}: ${formatNumber(row.value)}${unit ? ` ${unit}` : ''}`,
          )
          return svg`
            <g class="lintje-chart__bar-row ${controller.hoverIndex === i ? 'is-hovered' : ''}"
               @mousemove=${(event: MouseEvent) => controller.showTooltip(event, contentAt(i))}
               @mouseleave=${() => controller.hideTooltip()}>
              <!-- Hit area across the whole row, so the tooltip doesn't flicker between bars. -->
              <rect x=${0} y=${y - 5} width=${width} height=${rowHeight} fill="transparent" />
              <text x=${labelEnd} y=${y + barHeight - 3} text-anchor="end" class="lintje-chart__axis-label">${column.fit(row.label)}</text>
              <rect class="lintje-chart__bar lintje-chart__bar--horizontal lintje-chart__mark ${mark.state}"
                    ${styleProps(staggerStyle(i, rows.length))}
                    x=${barStart} y=${y} width=${Math.max(0, barWidth)} height=${barHeight}
                    fill=${aboveThreshold ? aboveThresholdColor : color}
                    data-mark-id=${mark.markId} role=${mark.role} tabindex=${mark.tabIndex}
                    aria-pressed=${mark.pressed} aria-label=${mark.label}
                    @click=${mark.click} @keydown=${mark.keydown} />
              <text x=${barStart + barWidth + 6} y=${y + barHeight - 3} font-weight="700"
                    class="lintje-chart__data-label ${threshold != null ? 'lintje-chart__data-label--halo' : ''}">
                ${formatNumber(row.value)}${unit ? ` ${unit}` : ''}
              </text>
            </g>
          `
        })}
      </svg>
      ${renderTooltip(controller)}
      ${renderPlotStatus(controller)}
    </figure>
  `
}
