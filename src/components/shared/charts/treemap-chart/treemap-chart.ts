/**
 * Treemap: the parts of one whole on one moment, each an area in proportion to its value, the
 * largest top left, with their sub-parts inside them. The parts take the tints of one variable;
 * a sub-part shares its part's tint and is told apart by a line, never by a colour of its own.
 * Parts under 1 % of the whole fold into one grey "Overig" that is not clickable. With two levels
 * the part is the click target. Below 768 px the whole becomes one strip over a row per part
 * (rule 9).
 */
import { html, svg, nothing, type TemplateResult } from 'lit'
import { keyed } from 'lit/directives/keyed.js'
import { ref } from 'lit/directives/ref.js'
import { styleProps } from '../../../../core/style-props'
import { formatNumber, formatPercent, textWidth } from '../../../../core/format'
import { renderIcon } from '../../../../icons/render'
import { isDataColor } from '../../../../tokens/colors'
import { chartColor, DEFAULT_SERIES_COLOR, insideLabelClass, labelInk } from '../shared/colors'
import { drawingRole, focusRingStyle, renderFocusRing, renderLegend } from '../shared/axes'
import type { LegendItem, SvgSlot } from '../shared/axes'
import { renderTooltip } from '../shared/tooltip'
import type { ChartOptions, TooltipContent, TooltipRow } from '../shared/controller'
import { markSelection, type MarkAttributes } from '../shared/mark-select'
import { plotKeys, renderPlotStatus, type PlotPoint } from '../shared/plot-keys'
import { staggerStyle } from '../shared/stagger'
import { tintSteps, tintsFor } from '../shared/tints'
import type { ChartSpec } from '../shared/types'
import { squarify, type TreemapRect } from './squarify'
import { fitLabel, LABEL_PAD, LINE_HEIGHT, type LabelLine } from './treemap-labels'
import { isMissing, treemapModel, type TreemapGroup, type TreemapModel } from './treemap-parts'

export { squarify } from './squarify'
export { fitLabel } from './treemap-labels'
export { treemapModel, treemapRows } from './treemap-parts'

type TreemapSpec = Extract<ChartSpec, { kind: 'treemap' }>

/** The phone's strip of the whole. */
const STRIP_HEIGHT = 28
const STRIP_GAP = 2
/** Between a part's name and the label of the sub-part under it. */
const HEADER_GAP = 4

/** One area as drawn: where it is, what it says and which part it belongs to. */
interface Cell {
  group: number
  rect: TreemapRect
  color: string
  label: string
  value: number
  other: boolean
  /** Positioned lines of its label; empty for none. */
  lines: { text: string; x: number; y: number; line: LabelLine }[]
  content: TooltipContent
}

interface Context {
  spec: TreemapSpec
  model: TreemapModel
  options: ChartOptions
  colors: string[]
  inks: (string | null)[]
  marks: MarkAttributes[]
  format: (value: number) => string
  withUnit: (value: number) => string
  share: (value: number, of?: number) => string
  legend: LegendItem[]
  totalLine: string
}

export function renderTreemapChart(spec: TreemapSpec, options: ChartOptions): TemplateResult {
  const model = treemapModel(spec)
  const { groups, total, decimals } = model
  const ranked = groups.filter((group) => !group.other).length
  const tints = tintsFor(ranked, spec.color)
  const steps = tintSteps(ranked)
  // `tintsFor` takes the default ladder for a colour that is not a variable; so does the ink.
  const named = isDataColor(spec.color) ? spec.color : undefined
  const colors = groups.map((group) =>
    group.other ? 'var(--color-chart-other)' : tints[Math.min(group.rank, tints.length - 1)],
  )
  // A grey area never carries a label; a step where neither ink reaches 4.5:1 neither.
  const inks = groups.map((group) => {
    if (group.other || spec.dataLabels === false) return null
    const ink = labelInk(named, steps[Math.min(group.rank, steps.length - 1)])
    return ink ? insideLabelClass(ink) : null
  })
  const links = groups.map((group) =>
    group.href && !group.other ? { id: group.id, href: group.href } : null,
  )
  const selection = markSelection(options, links)
  const format = (value: number) => formatNumber(value, decimals)
  const withUnit = (value: number) => `${format(value)}${spec.unit ? ` ${spec.unit}` : ''}`
  const share = (value: number, of = total) => formatPercent(of > 0 ? (value / of) * 100 : 0, 1)
  const marks = groups.map((group, i) =>
    selection.of(
      links[i],
      group.label,
      `${group.label}: ${withUnit(group.value)} · ${share(group.value)}`,
    ),
  )

  const legend: LegendItem[] = [
    ...(model.folded
      ? [
          {
            label: 'Overig: posten onder 1 % samen',
            color: 'var(--color-chart-other)',
            shape: 'square' as const,
            fixed: true,
          },
        ]
      : []),
    ...(model.missing.length
      ? [
          {
            label: `Geen gegevens: ${model.missing.join(', ')}`,
            shape: 'hatch' as const,
            fixed: true,
          },
        ]
      : []),
  ]
  const totalLine = `totaal ${withUnit(total)}${
    model.missing.length ? `, zonder ${model.missing.join(', ')}` : ''
  }`

  const context: Context = {
    spec,
    model,
    options,
    colors,
    inks,
    marks,
    format,
    withUnit,
    share,
    legend,
    totalLine,
  }
  const { controller } = options
  return html`
    <div class="lintje-chart-wrap lintje-treemap ${spec.small ? 'lintje-chart--small' : ''}"
         ${ref(controller.attach)} ?data-in-view=${controller.inView} data-tooltip-anchor
         @keydown=${(event: KeyboardEvent) => controller.dismiss(event) || selection.escape(event)}>
      ${legend.length ? renderLegend({ items: legend }) : nothing}
      <p class="lintje-treemap__total">${totalLine}</p>
      ${options.mobile ? drawRows(context) : drawMap(context, selection.interactive)}
      ${renderTooltip(controller)}
      ${renderPlotStatus(controller)}
    </div>
  `
}

/** The tooltip of an area: its part above it, its value, its shares; "Overig" lists its parts. */
function tooltipOf(
  context: Context,
  group: TreemapGroup,
  area: {
    label: string
    value: number
    other: boolean
    folded: { label: string; value: number }[]
  },
  color: string,
  nested: boolean,
): TooltipContent {
  const { spec, withUnit, share } = context
  const kicker = nested ? group.label : undefined
  if (area.other) {
    return {
      kicker,
      title: area.label,
      rows: [
        ...area.folded.map((part) => ({ label: part.label, value: withUnit(part.value) })),
        { label: 'Samen', value: withUnit(area.value), color, divider: true },
      ],
    }
  }
  const rows: TooltipRow[] = [
    { label: spec.label ?? 'Waarde', value: withUnit(area.value), color },
    ...(nested
      ? [{ label: `Aandeel in ${group.label}`, value: share(area.value, group.value) }]
      : []),
    { label: 'Aandeel in het totaal', value: share(area.value) },
  ]
  if (nested && group.missing.length) {
    rows.push({
      label: `${group.label}, zonder ${group.missing.join(', ')}`,
      value: withUnit(group.value),
      divider: true,
    })
  }
  return { kicker, title: area.label, rows }
}

/** The lines of a label placed from the top left of a box, and the height they take. */
function place(lines: LabelLine[], x: number, y: number): Cell['lines'] {
  let top = y
  return lines.map((line) => {
    const placed = { text: line.text, x, y: top + line.size, line }
    top += LINE_HEIGHT[line.size]
    return placed
  })
}

const linesHeight = (lines: LabelLine[]) =>
  lines.reduce((sum, line) => sum + LINE_HEIGHT[line.size], 0)

/** Every area of the drawing in the keyboard's order: part after part, large to small. */
function cellsOf(context: Context, width: number, height: number, fontFamily: string): Cell[] {
  const { model, colors, inks, format, share } = context
  const measure = (text: string, size: number, bold: boolean) =>
    (textWidth(text, fontFamily, bold ? 700 : 400) * size) / 12
  const boxes = squarify(
    model.groups.map((group) => group.value),
    { x: 0, y: 0, width, height },
  )
  return model.groups.flatMap((group, g) => {
    const box = boxes[g]
    const color = colors[g]
    const labelled = inks[g] != null
    if (!group.areas.length) {
      const lines =
        labelled && !group.other
          ? fitLabel(
              { name: group.label, amount: format(group.value), share: share(group.value) },
              box,
              measure,
            )
          : []
      return [
        {
          group: g,
          rect: box,
          color,
          label: group.label,
          value: group.value,
          other: group.other,
          lines: place(lines, box.x + LABEL_PAD, box.y + LABEL_PAD),
          content: tooltipOf(context, group, group, color, false),
        },
      ]
    }
    const rects = squarify(
      group.areas.map((area) => area.value),
      box,
    )
    return group.areas.map((area, a) => {
      const rect = rects[a]
      let lines: Cell['lines'] = []
      if (labelled && !area.other) {
        // The part's name and total stand over the label of its largest sub-part, top left.
        const header =
          a === 0
            ? fitLabel(
                { name: group.label, amount: format(group.value), share: share(group.value) },
                rect,
                measure,
              )
            : []
        const used = header.length ? linesHeight(header) + HEADER_GAP : 0
        const own = fitLabel(
          { name: area.label, amount: format(area.value) },
          { width: rect.width, height: rect.height - used },
          measure,
        )
        lines = [
          ...place(header, rect.x + LABEL_PAD, rect.y + LABEL_PAD),
          ...place(own, rect.x + LABEL_PAD, rect.y + LABEL_PAD + used),
        ]
      }
      return {
        group: g,
        rect,
        color: area.other ? 'var(--color-chart-other)' : color,
        label: area.label,
        value: area.value,
        other: area.other,
        lines,
        content: tooltipOf(
          context,
          group,
          area,
          area.other ? 'var(--color-chart-other)' : color,
          true,
        ),
      }
    })
  })
}

/** The label of a cell: white or ink as its step says, the text colour once dimmed. */
function renderLabel(cell: Cell, ink: string | null, muted: boolean): SvgSlot {
  if (!ink || !cell.lines.length) return nothing
  return cell.lines.map(
    ({ text, x, y, line }) => svg`<text x=${x} y=${y}
      class="lintje-chart__data-label lintje-treemap__label lintje-treemap__label--${line.size} ${
        line.bold ? 'lintje-treemap__label--bold' : ''
      } ${muted ? 'lintje-treemap__label--muted' : ink}">${text}</text>`,
  )
}

function drawMap(context: Context, interactive: boolean): TemplateResult {
  const { spec, model, options, inks, marks } = context
  const { controller, description } = options
  const id = controller.id
  controller.measure({
    width: true,
    height: options.height ?? (spec.small ? '--chart-h-small' : '--chart-h-main'),
    // In the modal the token is the body's inner height; the legend and total line come off it.
    fit: Boolean(options.expanded),
  })
  const width = controller.width
  const height = controller.height
  const cells = cellsOf(context, width, height, controller.fontFamily)
  const boxes = squarify(
    model.groups.map((group) => group.value),
    { x: 0, y: 0, width, height },
  )
  const muted = (g: number) => marks[g].state.includes('is-muted')

  const at = (i: number): PlotPoint => {
    const { rect, content } = cells[i]
    const left = rect.x + rect.width / 2 < width / 2
    return {
      x: left ? rect.x + rect.width : rect.x,
      y: rect.y + rect.height / 2,
      content,
      side: left ? undefined : 'left',
    }
  }
  const keys = plotKeys(controller, cells.length, at)
  const keydown = (event: KeyboardEvent) => {
    // Enter or space on the drawing chooses the part of the area the keys stand on.
    const index = controller.hoverIndex
    if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) {
      const cell = index == null ? undefined : cells[index]
      const choose = cell ? marks[cell.group].keydown : undefined
      if (typeof choose === 'function') choose(event)
      return
    }
    keys.keydown(event)
  }
  const hover = (event: MouseEvent, i: number) => {
    if (controller.hoverIndex === i && controller.tooltip) return
    const drawing = (event.currentTarget as SVGElement).ownerSVGElement
    if (!drawing) return
    const point = at(i)
    const anchor = drawing.closest('[data-tooltip-anchor]')
    const box = drawing.getBoundingClientRect()
    const origin = anchor?.getBoundingClientRect() ?? box
    controller.hoverIndex = i
    controller.showTooltipAt(
      box.left - origin.left + point.x,
      box.top - origin.top + point.y,
      point.content,
      point.side,
    )
  }
  const leave = () => {
    if (controller.hoverIndex == null) return
    controller.hoverAt(null)
  }

  const active = controller.hoverIndex != null ? cells[controller.hoverIndex] : undefined
  const area = (cell: Cell, extra = '') =>
    svg`<rect class="lintje-treemap__area lintje-chart__segment ${extra}" x=${cell.rect.x} y=${cell.rect.y}
              width=${cell.rect.width} height=${cell.rect.height} fill=${cell.color} />`
  const copy = (cell: Cell, className: string) => svg`
    <g class="${className} ${muted(cell.group) ? 'is-muted' : ''}" aria-hidden="true">
      <rect class="lintje-treemap__ground" x=${cell.rect.x} y=${cell.rect.y}
            width=${cell.rect.width} height=${cell.rect.height} />
      ${area(cell)}${renderLabel(cell, inks[cell.group], muted(cell.group))}
    </g>`
  const chosen = model.groups.findIndex((_, g) => marks[g].state.includes('is-selected'))
  // A new data set draws in again; a hover keeps the nodes.
  const dataset = JSON.stringify(spec.parts)

  return html`
    <figure class="lintje-chart">
      <svg viewBox="0 0 ${width} ${height}" width=${width} height=${height}
           class="lintje-chart__svg lintje-treemap__svg" ${styleProps({ height: `${height}px`, ...focusRingStyle(id) })}
           role=${drawingRole(interactive)} aria-labelledby="${id}-desc" tabindex="0"
           @keydown=${keydown} @focus=${keys.focus} @blur=${keys.blur} @mouseleave=${leave}>
        <desc id="${id}-desc">${description}</desc>
        <defs>${renderFocusRing(id)}</defs>
        ${keyed(
          dataset,
          svg`${model.groups.map((group, g) => {
            const mark = marks[g]
            const own = cells.filter((cell) => cell.group === g)
            return svg`
            <g class="lintje-treemap__group ${mark.state}" data-part-id=${group.id}
               ${styleProps(staggerStyle(g, model.groups.length))}
               role=${mark.role} aria-pressed=${mark.pressed} aria-label=${mark.label} @click=${mark.click}>
              ${own.map(
                (
                  cell,
                ) => svg`<rect class="lintje-treemap__area lintje-chart__segment" x=${cell.rect.x} y=${cell.rect.y}
                    width=${cell.rect.width} height=${cell.rect.height} fill=${cell.color}
                    @mousemove=${(event: MouseEvent) => hover(event, cells.indexOf(cell))} />`,
              )}
            </g>`
          })}
          <!-- The labels apart from the parts: a part's name as a button is its own sentence. -->
          <g class="lintje-treemap__labels" aria-hidden="true">
            ${cells.map((cell) => renderLabel(cell, inks[cell.group], muted(cell.group)))}
          </g>`,
        )}
        <!-- The line between parts, on their border, over the areas on both sides of it. -->
        <g class="lintje-treemap__edges" aria-hidden="true">
          ${boxes.map(
            (box) =>
              svg`<rect class="lintje-treemap__edge" x=${box.x} y=${box.y} width=${box.width} height=${box.height} />`,
          )}
        </g>
        ${
          chosen >= 0
            ? svg`<rect class="lintje-chart__mark is-selected lintje-treemap__outline" aria-hidden="true"
                    x=${boxes[chosen].x + 3} y=${boxes[chosen].y + 3}
                    width=${Math.max(0, boxes[chosen].width - 6)} height=${Math.max(0, boxes[chosen].height - 6)} />`
            : nothing
        }
        ${active ? copy(active, 'lintje-treemap__lift') : nothing}
        ${active ? copy(active, 'lintje-treemap__focus') : nothing}
      </svg>
    </figure>
  `
}

/**
 * Below 768 px: the whole as one strip, then a row per part with its bar, opened to its sub-parts.
 * The unit stands once, in the total line, so a long name keeps its room.
 */
function drawRows(context: Context): TemplateResult {
  const { spec, model, options, colors, marks, format, share } = context
  const { controller, description } = options
  const id = controller.id
  controller.measure({ width: true })
  const width = controller.width
  const variable = chartColor(spec.color) ?? DEFAULT_SERIES_COLOR
  const largest = Math.max(0, ...model.groups.map((group) => group.value))
  const length = (value: number) => `${largest > 0 ? (value / largest) * 100 : 0}%`

  // The strip: a piece per part in its tint, 2 px of surface between them.
  const room = Math.max(0, width - STRIP_GAP * Math.max(0, model.groups.length - 1))
  let x = 0
  const pieces = model.groups.map((group, g) => {
    const w = model.total > 0 ? (group.value / model.total) * room : 0
    const piece = svg`<rect class="lintje-treemap__piece" x=${x} y="0" width=${w} height=${STRIP_HEIGHT}
                            fill=${colors[g]} ${styleProps(staggerStyle(g, model.groups.length))} />`
    x += w + STRIP_GAP
    return piece
  })

  const bar = (value: number, color: string, thin = false) => html`
    <span class="lintje-treemap__track ${thin ? 'lintje-treemap__track--sub' : ''}" aria-hidden="true">
      <span class="lintje-treemap__bar" ${styleProps({ width: length(value), background: color })}></span>
    </span>`

  const rows = model.groups.map((group, g) => {
    const mark = marks[g]
    const open = controller.openParts.includes(group.id)
    const subsId = `${id}-parts-${g}`
    const nested = group.areas.length > 0
    const color = group.other ? 'var(--color-chart-other)' : variable
    const body = html`
      <span class="lintje-treemap__swatch" ${styleProps({ background: colors[g] })} aria-hidden="true"></span>
      <span class="lintje-treemap__name">${group.label}${
        group.other
          ? html`<span class="lintje-treemap__count"> · ${group.folded.length} posten</span>`
          : nothing
      }</span>
      <span class="lintje-treemap__amount">${format(group.value)}</span>
      <span class="lintje-treemap__share">${share(group.value)}</span>
      ${bar(group.value, color)}`
    return html`
      <li class="lintje-treemap__row ${group.other ? 'lintje-treemap__row--other' : ''} ${mark.state}">
        ${
          nested
            ? html`<button type="button" class="lintje-treemap__toggle" aria-expanded=${open ? 'true' : 'false'}
                    aria-controls=${subsId} aria-label="Onderdelen van ${group.label}"
                    @click=${() => controller.toggleOpen(group.id)}>
                ${renderIcon(open ? 'functioneel-delta-omlaag' : 'functioneel-delta-rechts', { size: 16 })}
              </button>`
            : model.nested
              ? html`<span class="lintje-treemap__toggle-space" aria-hidden="true"></span>`
              : nothing
        }
        ${
          mark.clickable
            ? html`<button type="button" class="lintje-treemap__part lintje-treemap__part--button" aria-pressed=${mark.pressed}
                    @click=${mark.click}>${body}</button>`
            : html`<div class="lintje-treemap__part">${body}</div>`
        }
        ${
          nested && open
            ? html`<ul class="lintje-treemap__subs" id=${subsId}>
                ${group.areas.map(
                  (
                    area,
                  ) => html`<li class="lintje-treemap__sub ${area.other ? 'lintje-treemap__sub--other' : ''}">
                    <span class="lintje-treemap__name">${area.label}${
                      area.other
                        ? html`<span class="lintje-treemap__count"> · ${area.folded.length} posten</span>`
                        : nothing
                    }</span>
                    <span class="lintje-treemap__amount">${format(area.value)}</span>
                    <span class="lintje-treemap__share">${share(area.value, group.value)}</span>
                    ${bar(area.value, area.other ? 'var(--color-chart-other)' : variable, true)}
                  </li>`,
                )}
                ${group.missing.map(
                  (label) => html`<li class="lintje-treemap__sub">
                    <span class="lintje-treemap__name">${label}</span>
                    <span class="lintje-treemap__amount lintje-treemap__amount--none">geen gegevens</span>
                  </li>`,
                )}
              </ul>`
            : nothing
        }
      </li>`
  })
  // A part without data has no piece and no bar: a bar would draw a measure nobody took.
  const missing = spec.parts.filter(isMissing).map(
    (part) => html`
      <li class="lintje-treemap__row lintje-treemap__row--missing">
        ${model.nested ? html`<span class="lintje-treemap__toggle-space" aria-hidden="true"></span>` : nothing}
        <div class="lintje-treemap__part">
          <span class="lintje-treemap__swatch lintje-treemap__swatch--hatch" aria-hidden="true"></span>
          <span class="lintje-treemap__name">${part.label}</span>
          <span class="lintje-treemap__amount lintje-treemap__amount--none">geen gegevens</span>
        </div>
      </li>`,
  )

  return html`
    <svg viewBox="0 0 ${width} ${STRIP_HEIGHT}" width=${width} height=${STRIP_HEIGHT}
         class="lintje-chart__svg lintje-treemap__strip" ${styleProps({ height: `${STRIP_HEIGHT}px` })}
         role="img" aria-labelledby="${id}-desc">
      <desc id="${id}-desc">${description}</desc>
      ${keyed(JSON.stringify(spec.parts), svg`${pieces}`)}
    </svg>
    <ul class="lintje-treemap__rows ${model.nested ? '' : 'lintje-treemap__rows--flat'}">${rows}${missing}</ul>
  `
}
