/**
 * Radar chart: the profile of one to three variables over five to eight axes that share one
 * scale, from 0 in the centre to `max` on the outer ring, with a grey comparison and a norm.
 * Dashed is the norm only: a dashed comparison over it would read as a second norm.
 * Overlapping areas mix into a colour no variable has, so of more layers only the one the
 * reader points at in the legend fills. Below 768 px each axis becomes a row of bars (rule 9).
 */
import { html, svg, nothing, type TemplateResult } from 'lit'
import { ref } from 'lit/directives/ref.js'
import { styleProps } from '../../../../core/style-props'
import { formatNumber, textWidth } from '../../../../core/format'
import { chartColor, lineCasing } from '../shared/colors'
import { markPath, SERIES_KEYS, isSeriesKey, type SeriesKey } from '../shared/series-shapes'
import {
  drawingRole,
  renderLegend,
  THRESHOLD_KEY,
  type LegendItem,
  type SvgSlot,
} from '../shared/axes'
import { renderTooltip } from '../shared/tooltip'
import type {
  ChartController,
  ChartOptions,
  TooltipContent,
  TooltipRow,
} from '../shared/controller'
import { plotKeys, renderPlotStatus } from '../shared/plot-keys'
import { staggerStyle } from '../shared/stagger'
import type { ChartSpec } from '../shared/types'

type RadarSpec = Extract<ChartSpec, { kind: 'radar' }>

/** How far a spoke runs past the outer ring, so its name sits at the end of its own axis. */
const EXTEND = 16
const LABEL_GAP = 6
const NAME_LINE = 18
const VALUE_LINE = 16
const VERTEX = 3
const HOVER_VERTEX = 4
/** The scale's numbers stand this far beside the top spoke. */
const SCALE_GAP = 8
const MIN_RADIUS = 40
/** A tile's radar is as tall as this share of its width, within the chart token and this cap. */
const ASPECT = 0.7
const MAX_HEIGHT = 420
/** The phone's rows: a bar per variable, the comparison thinner under them. */
const ROW_GAP = 12
const BAR_GAP = 2

interface Layer {
  label: string
  values: (number | null)[]
  comparison: boolean
  color: string
  /** The shape on its vertices (rule 13); a comparison is told apart by its dashes. */
  symbol?: SeriesKey
}

interface Point {
  x: number
  y: number
}

/**
 * Each layer's colour and shape. A variable that names no colour takes the next data colour no
 * other variable names, so two never share a shape; a comparison is grey.
 */
function layersOf(spec: RadarSpec): Layer[] {
  const named = new Set(spec.series.map((row) => row.color).filter(isSeriesKey))
  const free = SERIES_KEYS.filter((key) => !named.has(key))
  let next = 0
  return spec.series.map((row) => {
    const values = spec.axes.map((_, i) => row.values[i] ?? null)
    if (row.comparison) {
      return { label: row.label, values, comparison: true, color: 'var(--color-chart-secondary)' }
    }
    const symbol = isSeriesKey(row.color) ? row.color : free[next++ % free.length]
    return {
      label: row.label,
      values,
      comparison: false,
      color: chartColor(row.color ?? symbol)!,
      symbol,
    }
  })
}

/**
 * The runs of known values around the circle, as axis indices. Without a gap the one run closes
 * on itself; a gap breaks the line there, as nothing is known to bridge it (rule 15).
 */
export function radarRuns(values: (number | null)[]): { closed: boolean; runs: number[][] } {
  const count = values.length
  const gap = values.findIndex((value) => value == null)
  if (gap === -1) return { closed: true, runs: [values.map((_, i) => i)] }
  const runs: number[][] = []
  let run: number[] = []
  for (let step = 1; step <= count; step++) {
    const i = (gap + step) % count
    if (values[i] == null) {
      if (run.length) runs.push(run)
      run = []
    } else run.push(i)
  }
  if (run.length) runs.push(run)
  return { closed: false, runs }
}

/** The rings: every `step` up to `max`, and `max` itself as the outer one. */
export function radarTicks(max: number, step = max / 5): number[] {
  const ticks: number[] = []
  for (let i = 1; i * step < max - step * 1e-6; i++) ticks.push(Math.round(i * step * 1e6) / 1e6)
  return [...ticks, max]
}

const fractionDigits = (value: number) =>
  Number.isInteger(value) ? 0 : (String(value).split('.')[1]?.length ?? 0)

/** Which layers fill: one alone does; of more, the emphasised one (`emphasis`), all or none. */
export function radarFills(
  spec: Pick<RadarSpec, 'area'>,
  shown: { label: string; comparison: boolean; complete: boolean }[],
  emphasis: string | null,
): Set<string> {
  const mode = spec.area ?? 'emphasis'
  const variables = shown.filter((layer) => !layer.comparison)
  return new Set(
    variables
      .filter(
        (layer) =>
          layer.complete &&
          mode !== 'never' &&
          (mode === 'always' || variables.length === 1 || layer.label === emphasis),
      )
      .map((layer) => layer.label),
  )
}

export function renderRadarChart(spec: RadarSpec, options: ChartOptions): TemplateResult {
  const { controller, description, mobile = false } = options
  const { axes, unit, threshold, small = false } = spec
  const count = axes.length
  const layers = layersOf(spec)
  const hidden = (layer: Layer) => controller.hiddenSeries.includes(layer.label)
  const normOff = controller.hiddenSeries.includes(THRESHOLD_KEY)
  // A lone layer is a switch only while the norm would stay.
  const lone = layers.length < 2 && threshold == null
  const shown = layers.filter((layer) => !hidden(layer))
  const variables = layers.filter((layer) => !layer.comparison)
  const shownVariables = shown.filter((layer) => !layer.comparison)

  const decimals = Math.min(
    2,
    Math.max(
      0,
      ...layers
        .flatMap((layer) => layer.values.filter((v): v is number => v != null))
        .map(fractionDigits),
      ...(threshold != null ? [fractionDigits(threshold)] : []),
    ),
  )
  const format = (value: number) => formatNumber(value, decimals)
  const withUnit = (value: number) => `${format(value)}${unit ? ` ${unit}` : ''}`
  const signed = (value: number) => {
    const rounded = Math.round(value * 10 ** decimals) / 10 ** decimals
    return rounded === 0 ? format(0) : `${rounded > 0 ? '+' : '−'}${format(Math.abs(rounded))}`
  }

  // Of more variables the emphasis is the one pointed at in the legend; it lies on top.
  const emphasis =
    shownVariables.length > 1 && shownVariables.some((layer) => layer.label === controller.emphasis)
      ? controller.emphasis
      : null
  const fills = radarFills(
    spec,
    shown.map((layer) => ({ ...layer, complete: layer.values.every((value) => value != null) })),
    emphasis,
  )
  // What the legend switches never moves the drawing: the gaps, the room for the values and
  // the phone's rows are those of every layer, shown or not.
  const missing = axes.map((_, i) => layers.some((layer) => layer.values[i] == null))
  // Data labels are all or nothing: with more variables two values do not fit by one name.
  const reserve = spec.dataLabels !== false && variables.length === 1
  const labelled = reserve && !hidden(variables[0])

  const legend: LegendItem[] = [
    ...layers.map((layer) =>
      layer.comparison
        ? {
            label: layer.label,
            color: layer.color,
            shape: 'line' as const,
            hidden: hidden(layer),
            fixed: lone,
          }
        : {
            label: layer.label,
            color: layer.color,
            shape: 'line' as const,
            symbol: layer.symbol,
            hidden: hidden(layer),
            fixed: lone,
          },
    ),
    ...(threshold != null
      ? [
          {
            key: THRESHOLD_KEY,
            label: spec.thresholdLabel ?? `Norm ${withUnit(threshold)}`,
            color: 'var(--color-chart-emphasis)',
            shape: 'dashed' as const,
            hidden: normOff,
          },
        ]
      : []),
    ...(missing.some(Boolean)
      ? [{ label: 'Geen gegevens', shape: 'hatch' as const, fixed: true }]
      : []),
  ]

  function contentAt(i: number): TooltipContent {
    const rows: TooltipRow[] = shown.map((layer) => {
      const value = layer.values[i]
      return {
        label: layer.label,
        value: value == null ? 'geen gegevens' : withUnit(value),
        color: layer.color,
        symbol: layer.symbol,
        marker: layer.comparison ? ('line' as const) : undefined,
      }
    })
    if (threshold != null && !normOff) {
      rows.push({
        label: spec.thresholdLabel ?? 'Norm',
        value: withUnit(threshold),
        color: 'var(--color-chart-emphasis)',
        marker: 'dashed',
      })
    }
    // One variable against its comparison and the norm, with the sign of the difference.
    const [only] = shownVariables
    const value = shownVariables.length === 1 ? only.values[i] : null
    if (value != null) {
      const comparison = shown.find((layer) => layer.comparison)
      const before = comparison?.values[i]
      if (comparison && before != null) {
        rows.push({
          label: `t.o.v. ${comparison.label}`,
          value: signed(value - before),
          divider: true,
        })
      }
      if (threshold != null && !normOff) {
        rows.push({
          label: 't.o.v. norm',
          value: signed(value - threshold),
          divider: !(comparison && before != null),
        })
      }
    }
    return { title: axes[i], rows }
  }

  const draw = mobile ? drawRows : drawRadar
  const { width, height, body, at } = draw({
    spec,
    controller,
    options,
    layers,
    shown,
    fills,
    emphasis,
    missing,
    reserve,
    labelled,
    hidden,
    normOff,
    format,
    contentAt,
  })
  const keys = plotKeys(controller, count, (i) => ({ ...at(i), content: contentAt(i) }))

  return html`
    <div class="lintje-chart-wrap ${small ? 'lintje-chart--small' : ''}"
         ${ref(controller.attach)} ?data-in-view=${controller.inView} data-tooltip-anchor
         @keydown=${(event: KeyboardEvent) => controller.dismiss(event)}>
      ${renderLegend({
        items: legend,
        onToggle: (label) => controller.toggleSeries(label),
        onEmphasis: variables.length > 1 ? (label) => controller.emphasise(label) : undefined,
      })}
      <figure class="lintje-chart">
        <svg viewBox="0 0 ${width} ${height}" width=${width} height=${height}
             class="lintje-chart__svg lintje-radar ${mobile ? 'lintje-radar--rows' : ''}"
             ${styleProps({ height: `${height}px` })}
             role=${drawingRole(false)} aria-labelledby="${controller.id}-desc" tabindex="0"
             @keydown=${keys.keydown} @focus=${keys.focus} @blur=${keys.blur}>
          <desc id="${controller.id}-desc">${description}</desc>
          <defs>
            <pattern id="hatch-${controller.id}" width="6" height="6" patternUnits="userSpaceOnUse"
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

interface DrawInput {
  spec: RadarSpec
  controller: ChartController
  options: ChartOptions
  layers: Layer[]
  shown: Layer[]
  fills: Set<string>
  emphasis: string | null
  missing: boolean[]
  /** One variable with data labels: the room for its values, taken whether it shows or not. */
  reserve: boolean
  labelled: boolean
  hidden: (layer: Layer) => boolean
  /** The norm switched off in the legend: it fades, as a layer does. */
  normOff: boolean
  format: (value: number) => string
  contentAt: (i: number) => TooltipContent
}

interface Drawing {
  width: number
  height: number
  body: SvgSlot
  /** Where the keyboard's tooltip stands for an axis. */
  at: (i: number) => Point
}

/** The radar itself: rings, spokes, the scale on the top spoke, the layers and the norm. */
function drawRadar({
  spec,
  controller,
  options,
  layers,
  shown,
  fills,
  emphasis,
  missing,
  reserve,
  labelled,
  hidden,
  normOff,
  format,
  contentAt,
}: DrawInput): Drawing {
  const { axes, max, threshold, small = false } = spec
  const count = axes.length
  const token = small ? '--chart-h-small' : '--chart-h-main'
  controller.measure({
    width: true,
    height: options.height ?? token,
    fit: Boolean(options.expanded),
  })
  const width = controller.width
  // Measured, not stretched: a wide tile gives the radar room to be round, within a cap.
  const height =
    options.height ??
    (options.expanded || small
      ? controller.height
      : Math.max(controller.height, Math.min(MAX_HEIGHT, Math.round(width * ASPECT))))

  const angle = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / count
  const font = controller.font
  const nameWidth = (name: string) => (textWidth(name, font) * 14) / 12
  const side = Math.max(
    0,
    ...axes.map((name, i) =>
      Math.abs(Math.cos(angle(i))) < 0.1 ? 0 : nameWidth(name) + LABEL_GAP + 2,
    ),
  )
  const vertical = LABEL_GAP + NAME_LINE + (reserve ? VALUE_LINE : 0)
  const radius = Math.max(
    MIN_RADIUS,
    Math.min(width / 2 - side - EXTEND, height / 2 - vertical - EXTEND),
  )
  const cx = width / 2
  const cy = height / 2
  const polar = (i: number, r: number): Point => ({
    x: cx + r * Math.cos(angle(i)),
    y: cy + r * Math.sin(angle(i)),
  })
  const scale = (value: number) => (Math.max(0, Math.min(value, max)) / max) * radius
  const points = (list: Point[]) => list.map((p) => `${p.x},${p.y}`).join(' ')
  const ring = (value: number) => points(axes.map((_, i) => polar(i, scale(value))))

  const ticks = radarTicks(max, spec.step)
  const tickDecimals = Math.max(0, ...ticks.map(fractionDigits))
  const active = controller.hoverIndex

  // The outer vertex on an axis carries the keyboard's tooltip; without a value, the middle.
  const at = (i: number): Point => {
    const known = shown.map((layer) => layer.values[i]).filter((v): v is number => v != null)
    return polar(i, known.length ? scale(Math.max(...known)) : radius / 2)
  }

  // The comparison under the variables. Every layer keeps its node, a hidden one unseen, so a
  // switch in the legend lets nothing grow in again.
  const order = [
    ...layers.filter((layer) => layer.comparison),
    ...layers.filter((layer) => !layer.comparison),
  ]
  const muted = (layer: Layer) => emphasis != null && layer.label !== emphasis
  const origin = styleProps({ 'transform-origin': `${cx}px ${cy}px` })

  const labels = axes.map((name, i) => {
    const cos = Math.cos(angle(i))
    const sin = Math.sin(angle(i))
    const end = polar(i, radius + EXTEND + LABEL_GAP)
    const upright = Math.abs(cos) < 0.1
    const anchor = upright ? 'middle' : cos > 0 ? 'start' : 'end'
    let nameY: number
    if (upright && sin < 0) nameY = end.y - 4 - (reserve ? VALUE_LINE : 0)
    else if (upright) nameY = end.y + 12
    else nameY = reserve ? end.y - 2 : end.y + 5
    const value = reserve ? layers.find((layer) => !layer.comparison)?.values[i] : undefined
    // A value stays when its layer goes, unseen, so it does not fade in a second time.
    return svg`
      <text x=${end.x} y=${nameY} text-anchor=${anchor} class="lintje-radar__name">${name}</text>
      ${
        reserve
          ? svg`<g class="lintje-chart__series ${labelled ? '' : 'is-off'}">
              <text x=${end.x} y=${nameY + VALUE_LINE} text-anchor=${anchor}
                    class="lintje-chart__data-label lintje-radar__value ${value == null ? 'lintje-radar__no-value' : ''}">
                ${value == null ? 'geen gegevens' : format(value)}</text>
            </g>`
          : nothing
      }
    `
  })

  const layer = (item: Layer, part: 'area' | 'line' | 'lift') => {
    // The fade sits on a wrapper, so the emphasis keeps its own quicker step back.
    const off = `lintje-chart__series ${hidden(item) ? 'is-off' : ''}`
    const vertices = item.values.map((value, i) => (value == null ? null : polar(i, scale(value))))
    // Every complete layer keeps its area, filled or not: one that appeared on emphasis would
    // grow in a second time.
    if (part === 'area') {
      if (item.comparison || vertices.some((p) => p == null)) return nothing
      return svg`<g class=${off}><g class="lintje-radar__layer" ${origin}>
        <polygon class="lintje-radar__area ${fills.has(item.label) ? 'is-filled' : ''}"
                 points=${points(vertices as Point[])} fill=${item.color} />
      </g></g>`
    }
    const { closed, runs } = radarRuns(item.values)
    const casing = item.comparison ? undefined : lineCasing(item.color)
    const lines = runs.map((run) => {
      const list = run.map((i) => vertices[i]!)
      const d = points(closed ? [...list, list[0]] : list)
      if (list.length === 1) {
        return item.comparison
          ? svg`<circle cx=${list[0].x} cy=${list[0].y} r="2.5" fill=${item.color} />`
          : nothing
      }
      return svg`
        ${casing ? svg`<polyline class="lintje-chart__line lintje-chart__line--casing" points=${d} stroke=${casing} />` : nothing}
        <polyline class="lintje-chart__line" points=${d} stroke=${item.color} />
      `
    })
    const marks = item.symbol
      ? vertices.map((p) =>
          p
            ? svg`<path d=${markPath(item.symbol, VERTEX, p.x, p.y)} fill=${item.color}
                        stroke=${casing ?? nothing} stroke-width=${casing ? 1 : nothing} />`
            : nothing,
        )
      : nothing
    // The emphasised layer once more on top, as a lifted pie slice is: in place it would stay
    // under the layers drawn after it.
    if (part === 'lift')
      return svg`<g class="lintje-radar__lift" aria-hidden="true">${lines}${marks}</g>`
    return svg`<g class=${off}><g class="lintje-radar__layer ${muted(item) ? 'is-muted' : ''}" ${origin}>
      ${lines}${marks}
    </g></g>`
  }

  const sector = (i: number) => {
    const reach = radius + EXTEND
    const half = Math.PI / count
    const point = (a: number) => `${cx + reach * Math.cos(a)},${cy + reach * Math.sin(a)}`
    return `${cx},${cy} ${point(angle(i) - half)} ${point(angle(i))} ${point(angle(i) + half)}`
  }

  const body: SvgSlot = [
    ticks.map((tick) => svg`<polygon class="lintje-radar__ring" points=${ring(tick)} />`),
    missing.map((gap, i) => {
      if (!gap) return nothing
      const a = angle(i)
      const dx = -Math.sin(a) * 5
      const dy = Math.cos(a) * 5
      const end = polar(i, radius)
      return svg`<polygon class="lintje-radar__gap" fill="url(#hatch-${controller.id})"
                          points=${`${cx + dx},${cy + dy} ${end.x + dx},${end.y + dy} ${end.x - dx},${end.y - dy} ${cx - dx},${cy - dy}`} />`
    }),
    axes.map((_, i) => {
      const end = polar(i, radius + EXTEND)
      return svg`<line class="lintje-radar__spoke ${active === i ? 'is-active' : ''}"
                       x1=${cx} y1=${cy} x2=${end.x} y2=${end.y} />`
    }),
    // One axis carries the scale: every axis shares it. Above the grid, under the data.
    ticks.map((tick) => {
      const p = polar(0, scale(tick))
      return svg`<text x=${p.x + SCALE_GAP / 2} y=${p.y + 4}
                       class="lintje-chart__axis-label lintje-chart__axis-label--halo">${formatNumber(tick, tickDecimals)}</text>`
    }),
    threshold != null
      ? svg`<g class="lintje-chart__series ${normOff ? 'is-off' : ''}">
          <polygon class="lintje-chart__reference lintje-radar__norm" points=${ring(threshold)} />
        </g>`
      : nothing,
    order.map((item) => layer(item, 'area')),
    order.map((item) => layer(item, 'line')),
    emphasis != null
      ? layer(
          layers.find((item) => item.label === emphasis)!,
          'lift',
        )
      : nothing,
    labels,
    active != null
      ? shown.map((item) => {
          const value = item.values[active]
          if (value == null) return nothing
          const p = polar(active, scale(value))
          const casing = item.comparison ? undefined : lineCasing(item.color)
          const d = markPath(item.symbol, HOVER_VERTEX, p.x, p.y)
          return svg`
            <path class="lintje-chart__hover-point" d=${d} fill=${item.color} />
            ${casing ? svg`<path class="lintje-chart__hover-casing" d=${d} stroke=${casing} />` : nothing}
          `
        })
      : nothing,
    svg`<g @mouseleave=${() => controller.hoverAt(null)}>
      ${axes.map(
        (_, i) => svg`<polygon class="lintje-chart__hit" points=${sector(i)}
                               @mousemove=${(event: MouseEvent) => controller.hoverAt(i, event, contentAt(i))} />`,
      )}
    </g>`,
  ]

  return { width, height, body, at }
}

/** Below 768 px: a row per axis, a bar per variable and the comparison under them (rule 9). */
function drawRows({
  spec,
  controller,
  layers,
  shown,
  reserve,
  labelled,
  hidden,
  normOff,
  format,
  contentAt,
}: DrawInput): Drawing {
  const { axes, max, threshold } = spec
  controller.measure({ width: true })
  const width = controller.width
  const plot = width - 1
  const variables = layers.filter((layer) => !layer.comparison)
  // The variables in legend order, then the comparison, thinner; a hidden one keeps its place.
  const bars = [
    ...variables.map((layer) => ({ layer, size: variables.length === 1 ? 8 : 6 })),
    ...layers.filter((layer) => layer.comparison).map((layer) => ({ layer, size: 4 })),
  ]
  const barsHeight =
    bars.reduce((sum, bar) => sum + bar.size, 0) + BAR_GAP * Math.max(0, bars.length - 1)
  const rowHeight = NAME_LINE + 4 + barsHeight + ROW_GAP
  const scaleTop = axes.length * rowHeight
  const height = scaleTop + 16
  const x = (value: number) => 0.5 + (Math.max(0, Math.min(value, max)) / max) * plot
  const font = controller.font
  const variable = layers.find((layer) => !layer.comparison)
  const pointed = shown.find((layer) => !layer.comparison)
  const active = controller.hoverIndex

  const at = (i: number): Point => {
    const value = pointed?.values[i]
    return { x: value != null ? x(value) : width / 2, y: i * rowHeight + NAME_LINE + 4 }
  }

  const rows = axes.map((name, i) => {
    const top = i * rowHeight
    const barTop = top + NAME_LINE + 4
    const value = reserve ? variable?.values[i] : undefined
    const text = reserve ? (value == null ? 'geen gegevens' : format(value)) : ''
    const below = reserve && value != null && threshold != null && value < threshold
    const off = `lintje-chart__series ${labelled ? '' : 'is-off'}`
    let offset = barTop
    return svg`
      <g class="lintje-radar__row ${active === i ? 'is-active' : ''}">
        <text x="0" y=${top + 14} class="lintje-radar__name">${name}</text>
        ${
          reserve
            ? svg`<g class=${off}><text x=${width} y=${top + 14} text-anchor="end"
                       class="lintje-chart__data-label lintje-radar__value ${value == null ? 'lintje-radar__no-value' : ''}">${text}</text></g>`
            : nothing
        }
        ${
          below
            ? svg`<g class=${off}><text x=${width - textWidth(text, font, 700) - 6} y=${top + 14} text-anchor="end"
                       class="lintje-chart__axis-label lintje-radar__value">onder norm</text></g>`
            : nothing
        }
        ${bars.map(({ layer, size }) => {
          const y = offset
          offset += size + BAR_GAP
          const v = layer.values[i]
          const gone = hidden(layer) ? 'is-off' : ''
          return v == null
            ? svg`<rect class="lintje-radar__bar lintje-chart__series ${gone}" x="0.5" y=${y} width=${plot} height=${size}
                       fill="url(#hatch-${controller.id})" />`
            : svg`<rect class="lintje-chart__bar lintje-chart__bar--horizontal lintje-radar__bar lintje-chart__series ${gone}" x="0.5" y=${y}
                       width=${Math.max(0, x(v) - 0.5)} height=${size} fill=${layer.color}
                       ${styleProps(staggerStyle(i, axes.length))} />`
        })}
        <line class="lintje-radar__zero" x1="0.5" x2="0.5" y1=${barTop - 2} y2=${barTop + barsHeight + 2} />
        ${
          threshold != null
            ? svg`<g class="lintje-chart__series ${normOff ? 'is-off' : ''}">
                <line class="lintje-chart__reference lintje-radar__norm" x1=${x(threshold)} x2=${x(threshold)}
                      y1=${barTop - 3} y2=${barTop + barsHeight + 3} />
              </g>`
            : nothing
        }
        <rect class="lintje-chart__hit" x="0" y=${top} width=${width} height=${rowHeight}
              @mousemove=${(event: MouseEvent) => controller.hoverAt(i, event, contentAt(i))} />
      </g>
    `
  })

  const ticks = [0, ...radarTicks(max, spec.step)]
  const tickDecimals = Math.max(0, ...ticks.map(fractionDigits))
  const scale = ticks.map(
    (tick, i) => svg`<text x=${x(tick)} y=${scaleTop + 12}
                           text-anchor=${i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'}
                           class="lintje-chart__axis-label">${formatNumber(tick, tickDecimals)}</text>`,
  )

  const body: SvgSlot = svg`<g @mouseleave=${() => controller.hoverAt(null)}>${rows}</g>${scale}`
  return { width, height, body, at }
}
