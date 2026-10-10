/**
 * Stacked areas: the parts of one variable in its tints, the first at the bottom and darkest. A
 * missing value in any part breaks the whole stack there and the period is hatched (rule 15).
 */
import { html, svg, nothing, type TemplateResult } from 'lit'
import { ref } from 'lit/directives/ref.js'
import { axisColumn, axisScale, plotWidth, xPosition, yPosition } from '../shared/scale'
import { formatNumber, textWidth } from '../../../../core/format'
import { renderChartFrame, renderLegend, type LegendItem, type SvgSlot } from '../shared/axes'
import { renderTooltip } from '../shared/tooltip'
import { chartArea, type ChartOptions, type TooltipContent } from '../shared/controller'
import { plotKeys, renderPlotStatus } from '../shared/plot-keys'
import { tintsFor } from '../shared/tints'
import type { ChartSpec } from '../shared/types'

type StackedAreaSpec = Extract<ChartSpec, { kind: 'stacked-area' }>

const NO_DATA = 'geen gegevens'

export function renderStackedAreaChart(
  spec: StackedAreaSpec,
  options: ChartOptions,
): TemplateResult {
  const { controller, description } = options
  const { labels, axisTitle, unit, small = false } = spec
  const id = controller.id
  const count = labels.length

  controller.measure({
    width: true,
    height: options.height ?? (small ? '--chart-h-small' : '--chart-h-main'),
    // In the modal the token is the body's inner height; the legend and axis title come off it.
    fit: Boolean(options.expanded) && !options.mobile,
  })

  // The colours belong to the parts, not to what is shown: switching one off moves no colour.
  // Past five parts the order still carries meaning, so they keep the lightest tint.
  const tints = tintsFor(spec.series.length, spec.color)
  const series = spec.series.map((row, j) => ({
    ...row,
    color: tints[Math.min(j, tints.length - 1)],
  }))
  const visible = series.filter((row) => !controller.hiddenSeries.includes(row.label))

  // A point is drawn only when every part shown is known there; the stack breaks otherwise.
  const known = labels.map(
    (_, i) => visible.length > 0 && visible.every((row) => row.values[i] != null),
  )
  // tops[j][i]: the top of the j-th visible part at point i.
  const tops: number[][] = []
  visible.forEach((row, j) => {
    tops.push(labels.map((_, i) => (known[i] ? (tops[j - 1]?.[i] ?? 0) + row.values[i]! : 0)))
  })
  const totals = labels.map((_, i) => (known[i] ? (tops[tops.length - 1]?.[i] ?? 0) : null))

  const { max, ticks } = axisScale(
    Math.max(...totals.filter((total): total is number => total != null), 1),
  )
  // The first x label is centered on the plot's left edge; the column keeps room for half of it.
  const axis = axisColumn(ticks, controller.width, {
    fontFamily: controller.fontFamily,
    minimum: Math.ceil(textWidth(labels[0] ?? '', controller.fontFamily) / 2),
  })
  const area = chartArea(options, { left: axis.width })
  const floor = area.height - area.bottom
  const x = (i: number) => xPosition(i, count, area)

  // Runs of drawn points, and the gaps between them.
  const runs: number[][] = []
  const gaps: number[][] = []
  if (visible.length > 0) {
    labels.forEach((_, i) => {
      const into = known[i] ? runs : gaps
      const last = into[into.length - 1]
      if (last && last[last.length - 1] === i - 1) last.push(i)
      else into.push([i])
    })
  }

  const legend: LegendItem[] = series.map((row) => ({
    label: row.label,
    color: row.color,
    shape: 'square',
    hidden: controller.hiddenSeries.includes(row.label),
  }))

  const step = Math.max(1, Math.ceil(count / 8))
  const xLabels = labels
    .map((label, i) => ({ label, x: x(i), i }))
    .filter((label) => label.i % step === 0)

  // Read top to bottom, as drawn, then the total of the drawn stack; with a part switched off it
  // says so, since the table's total counts every part.
  const totalLabel = visible.length < series.length ? 'Totaal getoond' : 'Totaal'
  function contentAt(i: number): TooltipContent {
    return {
      title: labels[i],
      rows: [
        ...[...visible].reverse().map((row) => ({
          label: row.label,
          value: row.values[i] == null ? NO_DATA : formatNumber(row.values[i]!),
          color: row.color,
        })),
        ...(visible.length > 0
          ? [
              {
                label: totalLabel,
                value: totals[i] == null ? NO_DATA : formatNumber(totals[i]!),
                divider: true,
              },
            ]
          : []),
      ],
    }
  }
  const keys = plotKeys(controller, count, (i) => ({
    x: x(i),
    y: totals[i] == null ? area.top : yPosition(totals[i]!, max, area),
    content: contentAt(i),
  }))

  const line = (j: number, run: number[]) =>
    run.map((i) => `${x(i)},${yPosition(tops[j][i], max, area)}`)

  const marks: SvgSlot = [
    // From the last known point before a gap to the first after it; an end of the plot bounds it.
    gaps.map((gap) => {
      const from = x(Math.max(0, gap[0] - 1))
      const to = x(Math.min(count - 1, gap[gap.length - 1] + 1))
      const width = to - from
      const fits = textWidth(NO_DATA, controller.fontFamily) + 8 <= width
      return svg`
        <rect x=${from} y=${area.top} width=${Math.max(0, width)} height=${floor - area.top}
              fill="url(#hatch-${id})" />
        ${
          fits
            ? svg`<text x=${from + width / 2} y=${(area.top + floor) / 2 + 4} text-anchor="middle"
                      class="lintje-chart__as-of-note lintje-chart__data-label--halo">${NO_DATA}</text>`
            : nothing
        }
      `
    }),

    svg`<g class="lintje-chart__reveal">
      ${runs.map((run) =>
        run.length === 1
          ? // A lone point between two gaps has no area: each part's top is a point.
            visible.map(
              (row, j) =>
                svg`<circle cx=${x(run[0])} cy=${yPosition(tops[j][run[0]], max, area)} r="2.5" fill=${row.color} />`,
            )
          : svg`
            ${visible.map((row, j) => {
              const lower =
                j === 0
                  ? [`${x(run[run.length - 1])},${floor}`, `${x(run[0])},${floor}`]
                  : line(j - 1, run).reverse()
              return svg`<polygon fill=${row.color} points=${[...line(j, run), ...lower].join(' ')} />`
            })}
            ${visible
              .slice(0, -1)
              .map(
                (_, j) =>
                  svg`<polyline class="lintje-chart__segment" fill="none" points=${line(j, run).join(' ')} />`,
              )}
          `,
      )}
    </g>`,

    controller.hoverIndex != null && known[controller.hoverIndex]
      ? visible.map(
          (row, j) =>
            svg`<circle class="lintje-chart__hover-point" r="4" fill=${row.color}
                        cx=${x(controller.hoverIndex!)}
                        cy=${yPosition(tops[j][controller.hoverIndex!], max, area)} />`,
        )
      : nothing,

    labels.map((_, i) => {
      const bandWidth = plotWidth(area) / Math.max(1, count - 1)
      return svg`
        <rect x=${x(i) - bandWidth / 2} y=${area.top} width=${bandWidth}
              height=${floor - area.top}
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
          description,
          keys,
        },
        marks,
      )}
      ${renderTooltip(controller)}
      ${renderPlotStatus(controller)}
    </div>
  `
}
