/**
 * Stacked areas: the parts of one variable in its tints, the first at the bottom and darkest. A
 * missing value breaks its part and every part above it; the parts below stay, and the rest of
 * the column is hatched (rule 15). A part switched off shrinks out and the parts above settle.
 */
import { html, svg, nothing, type TemplateResult } from 'lit'
import { ref } from 'lit/directives/ref.js'
import { axisColumn, axisScale, plotWidth, xPosition, yPosition } from '../shared/scale'
import { formatNumber, textWidth } from '../../../../core/format'
import { durationMs, easing, prefersReducedMotion } from '../../../../core/motion'
import { renderChartFrame, renderLegend, type LegendItem, type SvgSlot } from '../shared/axes'
import { renderTooltip } from '../shared/tooltip'
import {
  chartArea,
  type ChartController,
  type ChartOptions,
  type TooltipContent,
} from '../shared/controller'
import { plotKeys, renderPlotStatus } from '../shared/plot-keys'
import { tintsFor } from '../shared/tints'
import type { ChartSpec } from '../shared/types'

type StackedAreaSpec = Extract<ChartSpec, { kind: 'stacked-area' }>

const NO_DATA = 'geen gegevens'

/**
 * The weight each part is drawn with, 0 (off) to 1 (on), eased between the two over `--dur-layer`
 * after a legend switch. Points and `d` do not transition in every engine, so the edges are
 * worked out per frame.
 */
interface LayerMotion {
  key: string
  from: number[]
  to: number[]
  start: number
  duration: number
  ease: (t: number) => number
  frame?: number
  element?: Element
  attach: (element: Element | undefined) => void
}

const motions = new WeakMap<ChartController, LayerMotion>()

function progress(motion: LayerMotion, now: number): number {
  return motion.duration > 0 ? Math.min(1, (now - motion.start) / motion.duration) : 1
}

function weightsAt(motion: LayerMotion, now: number): number[] {
  const done = progress(motion, now)
  // The end is exact, not a float near it: a weight of 0 takes the part out.
  if (done >= 1) return motion.to
  const eased = motion.ease(done)
  return motion.to.map((to, j) => motion.from[j] + (to - motion.from[j]) * eased)
}

/** The weights to draw now; a new switch starts from where a running one stands. */
function layerWeights(controller: ChartController, key: string, target: number[]): number[] {
  const now = performance.now()
  let motion = motions.get(controller)
  if (!motion || motion.key !== key) {
    const fresh: LayerMotion = {
      key,
      from: target,
      to: target,
      start: now,
      duration: 0,
      ease: (t) => t,
      element: motion?.element,
      attach: (element) => {
        fresh.element = element
      },
    }
    motions.set(controller, fresh)
    return target
  }
  if (motion.to.some((to, j) => to !== target[j])) {
    const element = motion.element
    const instant = !element || prefersReducedMotion()
    motion.from = instant ? target : weightsAt(motion, now)
    motion.to = target
    motion.start = now
    motion.duration = instant ? 0 : durationMs(element, '--dur-layer')
    motion.ease = element ? easing(element, '--ease-in-motion') : (t) => t
    if (motion.frame == null && motion.duration > 0) {
      const running = motion
      const tick = () => {
        running.frame = undefined
        const done = progress(running, performance.now()) >= 1
        controller.requestUpdate()
        if (!done) running.frame = requestAnimationFrame(tick)
      }
      running.frame = requestAnimationFrame(tick)
    }
  }
  return weightsAt(motion, now)
}

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
    hidden: controller.hiddenSeries.includes(row.label),
  }))
  const visible = series.filter((row) => !row.hidden)

  const key = series.map((row) => row.label).join('\u0000')
  const weights = layerWeights(
    controller,
    key,
    series.map((row) => (row.hidden ? 0 : 1)),
  )
  const moving = weights.some((weight, j) => weight !== (series[j].hidden ? 0 : 1))
  const motion = motions.get(controller)!

  // The stack per point: a part is drawn from the top of the one below, up to the first part
  // shown that is missing there; that part and every one above it break off.
  const drawn = series.map(() => labels.map(() => false))
  const bottoms = series.map(() => labels.map(() => 0))
  const tops = series.map(() => labels.map(() => 0))
  const broken = labels.map(() => false)
  labels.forEach((_, i) => {
    let level = 0
    series.forEach((row, j) => {
      if (weights[j] === 0) return
      const value = row.values[i]
      if (broken[i] || value == null) {
        broken[i] = true
        return
      }
      drawn[j][i] = true
      bottoms[j][i] = level
      level += value * weights[j]
      tops[j][i] = level
    })
  })
  const anyShown = weights.some((weight) => weight > 0)

  // The axis holds whatever the legend shows: it reaches the most any choice of parts can draw at
  // a point, its known values together, so the whole stays the frame.
  const reach = labels
    .map((_, i) =>
      series.map((row) => row.values[i]).filter((value): value is number => value != null),
    )
    .filter((known) => known.length > 0)
    .map((known) => known.reduce((sum, value) => sum + value, 0))
  const { max, ticks } = axisScale(Math.max(...reach, 1))
  // The first x label is centered on the plot's left edge; the column keeps room for half of it.
  const axis = axisColumn(ticks, controller.width, {
    fontFamily: controller.fontFamily,
    minimum: Math.ceil(textWidth(labels[0] ?? '', controller.fontFamily) / 2),
  })
  const area = chartArea(options, { left: axis.width })
  const floor = area.height - area.bottom
  const x = (i: number) => xPosition(i, count, area)
  const y = (value: number) => yPosition(value, max, area)

  const runsOf = (on: (i: number) => boolean): number[][] => {
    const runs: number[][] = []
    labels.forEach((_, i) => {
      if (!on(i)) return
      const last = runs[runs.length - 1]
      if (last && last[last.length - 1] === i - 1) last.push(i)
      else runs.push([i])
    })
    return runs
  }

  // The tooltip and the keys read the end state: the parts shown, and a total only where all of
  // them are known (rule 15).
  const finalTops = labels.map((_, i) => {
    let level = 0
    for (const row of visible) {
      const value = row.values[i]
      if (value == null) return { level, complete: false }
      level += value
    }
    return { level, complete: visible.length > 0 }
  })

  const legend: LegendItem[] = series.map((row) => ({
    label: row.label,
    color: row.color,
    shape: 'square',
    hidden: row.hidden,
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
                value: finalTops[i].complete ? formatNumber(finalTops[i].level) : NO_DATA,
                divider: true,
              },
            ]
          : []),
      ],
    }
  }
  const keys = plotKeys(controller, count, (i) => ({
    x: x(i),
    y: finalTops[i].level > 0 ? y(finalTops[i].level) : area.top,
    content: contentAt(i),
  }))

  // Above a segment the stack lacks a part: from the highest part drawn at both ends to the top.
  const segmentFloor = (k: number) => {
    let level: [number, number] = [0, 0]
    series.forEach((_, j) => {
      if (drawn[j][k] && drawn[j][k + 1]) level = [tops[j][k], tops[j][k + 1]]
    })
    return level
  }
  const gaps = anyShown ? runsOf((i) => broken[i]) : []
  const hatches = gaps.map((gap) => {
    const first = Math.max(0, gap[0] - 1)
    const last = Math.min(count - 1, gap[gap.length - 1] + 1)
    const segments = Array.from({ length: last - first }, (_, s) => first + s).map((k) => {
      const [left, right] = segmentFloor(k)
      return { k, left: y(left), right: y(right) }
    })
    const from = x(first)
    const width = x(last) - from
    const ceiling = Math.min(floor, ...segments.flatMap((s) => [s.left, s.right]))
    const fits = textWidth(NO_DATA, controller.fontFamily) + 8 <= width && ceiling - area.top >= 20
    return { segments, from, width, ceiling, fits }
  })

  const edge = (values: number[], run: number[]) => run.map((i) => `${x(i)},${y(values[i])}`)

  const marks: SvgSlot = [
    hatches.map(
      (hatch) => svg`
        ${hatch.segments.map(
          (s) => svg`<polygon fill="url(#hatch-${id})"
            points=${`${x(s.k)},${area.top} ${x(s.k + 1)},${area.top} ${x(s.k + 1)},${s.right} ${x(s.k)},${s.left}`} />`,
        )}
        ${
          hatch.fits
            ? svg`<text x=${hatch.from + hatch.width / 2} y=${(area.top + hatch.ceiling) / 2 + 4}
                      text-anchor="middle"
                      class="lintje-chart__as-of-note lintje-chart__data-label--halo">${NO_DATA}</text>`
            : nothing
        }
      `,
    ),

    // One group per part, also while it is off, so a switch keeps every node it can.
    svg`<g class="lintje-chart__reveal" ${ref(motion.attach)}>
      ${series.map((row, j) => {
        const runs = runsOf((i) => drawn[j][i])
        return svg`<g>
          ${runs.map((run) =>
            run.length === 1
              ? // A lone point between two gaps has no area: its top is a point.
                svg`<circle cx=${x(run[0])} cy=${y(tops[j][run[0]])} r="2.5" fill=${row.color} />`
              : svg`<polygon fill=${row.color}
                      points=${[...edge(tops[j], run), ...edge(bottoms[j], run).reverse()].join(' ')} />`,
          )}
        </g>`
      })}
      <!-- Between two parts a 1 px line in the surface: along each part's lower edge, not the floor. -->
      ${series.map((_, j) =>
        runsOf((i) => drawn[j][i] && bottoms[j][i] > 0)
          .filter((run) => run.length > 1)
          .map(
            (run) =>
              svg`<polyline class="lintje-chart__segment" fill="none" points=${edge(bottoms[j], run).join(' ')} />`,
          ),
      )}
    </g>`,

    // While the parts move the hover points wait for the end state.
    controller.hoverIndex != null && !moving
      ? series.map((row, j) =>
          drawn[j][controller.hoverIndex!]
            ? svg`<circle class="lintje-chart__hover-point" r="4" fill=${row.color}
                          cx=${x(controller.hoverIndex!)} cy=${y(tops[j][controller.hoverIndex!])} />`
            : nothing,
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
