/** Progress against a target. The axis runs to 110 so a bar visibly crosses the line. */
import { html, svg, type TemplateResult } from 'lit'
import { ref } from 'lit/directives/ref.js'
import { styleProps } from '../../../../core/style-props'
import { formatPercent } from '../../../../core/format'
import { rowLabelColumn } from '../shared/scale'
import { staggerStyle } from '../shared/stagger'
import { renderTooltip } from '../shared/tooltip'
import { rowsHeight } from '../horizontal-bar-chart/horizontal-bar-chart'
import type { ChartOptions, TooltipContent } from '../shared/controller'
import { plotKeys, renderPlotStatus } from '../shared/plot-keys'
import type { ChartSpec } from '../shared/types'

type TargetProgressSpec = Extract<ChartSpec, { kind: 'target-progress' }>

export function renderTargetProgressChart(
  spec: TargetProgressSpec,
  options: ChartOptions,
): TemplateResult {
  const { controller, description } = options
  const { rows, target = 100 } = spec
  const id = controller.id

  const rowHeight = 26
  const barHeight = 16
  const height = rowsHeight(rows.length)
  controller.measure({ width: true, height })
  const width = controller.width
  const column = rowLabelColumn(
    rows.map((row) => row.label),
    width,
    { fontFamily: controller.fontFamily },
  )
  const { labelEnd, barStart } = column
  const axisMax = 110
  const scale = (value: number) => (Math.max(40, width - barStart - 70) * value) / axisMax
  const targetX = barStart + scale(target)
  const colorOf = (value: number) =>
    value >= target ? 'var(--color-chart-green)' : 'var(--color-attention)'
  const contentAt = (i: number): TooltipContent => ({
    title: rows[i].label,
    rows: [
      { label: 'Voortgang', value: formatPercent(rows[i].value), color: colorOf(rows[i].value) },
      { label: 'Doel', value: formatPercent(target), color: 'var(--color-chart-emphasis)' },
    ],
  })
  const keys = plotKeys(controller, rows.length, (i) => ({
    x: barStart + scale(rows[i].value),
    y: i * rowHeight + 4,
    content: contentAt(i),
  }))

  return html`
    <figure class="lintje-chart lintje-chart--rows" ${ref(controller.attach)} ?data-in-view=${controller.inView}
            data-tooltip-anchor @keydown=${(event: KeyboardEvent) => controller.dismiss(event)}>
      <svg viewBox="0 0 ${width} ${height}" class="lintje-chart__svg" role="img"
           aria-labelledby="${id}-desc" width=${width} height=${height} ${styleProps({ height: `${height}px` })}
           tabindex="0" @keydown=${keys.keydown} @focus=${keys.focus} @blur=${keys.blur}>
        <desc id="${id}-desc">${description}</desc>
        ${rows.map((row, i) => {
          const y = i * rowHeight + 4
          const barWidth = scale(row.value)
          const color = colorOf(row.value)
          // No room right of the bar: the label goes inside, in the text its fill carries —
          // white on the green, ink on the attention orange (white is 3.2:1 there).
          const labelOutside = barStart + barWidth + 46 > width
          const inside =
            row.value >= target
              ? 'lintje-chart__data-label--inside'
              : 'lintje-chart__data-label--inside-light'
          return svg`
            <g class="lintje-chart__bar-row ${controller.hoverIndex === i ? 'is-hovered' : ''}"
               @mousemove=${(event: MouseEvent) => controller.showTooltip(event, contentAt(i))}
               @mouseleave=${() => controller.hideTooltip()}>
              <rect x=${0} y=${y - 5} width=${width} height=${rowHeight} fill="transparent" />
              <text x=${labelEnd} y=${y + barHeight - 3} text-anchor="end" class="lintje-chart__axis-label">${column.fit(row.label)}</text>
              <rect class="lintje-chart__bar lintje-chart__bar--horizontal" ${styleProps(staggerStyle(i, rows.length))}
                    x=${barStart} y=${y} width=${Math.max(0, barWidth)} height=${barHeight} fill=${color} />
              <text x=${labelOutside ? barStart + barWidth - 6 : barStart + barWidth + 6} y=${y + barHeight - 3}
                    text-anchor=${labelOutside ? 'end' : 'start'}
                    class="lintje-chart__data-label ${labelOutside ? inside : ''}" font-weight="700">${formatPercent(row.value)}</text>
            </g>
          `
        })}
        <line x1=${targetX} x2=${targetX} y1=${0} y2=${rows.length * rowHeight + 2}
              stroke="var(--color-chart-emphasis)" stroke-width="1" stroke-dasharray="3 3" />
        <text x=${targetX + 6} y=${rows.length * rowHeight + 16} class="lintje-chart__axis-label">norm ${target}</text>
      </svg>
      ${renderTooltip(controller)}
      ${renderPlotStatus(controller)}
    </figure>
  `
}
