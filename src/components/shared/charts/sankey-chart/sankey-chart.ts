/**
 * Sankey: how one count divides over two to four steps of a process. A step is a column of
 * nodes, a flow a band as wide as its count between nodes of two consecutive steps. What flows
 * is one variable, so nodes and bands take one colour, and bands may cross: one colour over
 * itself darkens and mixes into no colour another variable has. A node is a part of the whole,
 * a flow a part of its source. Below 768 px every transition becomes a bar per source (rule 9).
 */
import { html, svg, nothing, type TemplateResult } from 'lit'
import { ref } from 'lit/directives/ref.js'
import { styleProps } from '../../../../core/style-props'
import { formatNumber, formatPercent, textWidth } from '../../../../core/format'
import { isDataColor } from '../../../../tokens/colors'
import { chartColor, DEFAULT_SERIES_COLOR, labelInk } from '../shared/colors'
import { LADDER_PARTS } from '../shared/fold'
import {
  drawingRole,
  focusRingStyle,
  renderFocusRing,
  renderLegend,
  type LegendItem,
  type SvgSlot,
} from '../shared/axes'
import { renderTooltip } from '../shared/tooltip'
import type { ChartOptions, TooltipContent, TooltipRow } from '../shared/controller'
import { markSelection, type MarkAttributes, type MarkSelection } from '../shared/mark-select'
import { plotKeys, renderPlotStatus, type PlotPoint } from '../shared/plot-keys'
import { staggerStyle } from '../shared/stagger'
import { tintSteps, tintsFor } from '../shared/tints'
import type { ChartSpec } from '../shared/types'

type SankeySpec = Extract<ChartSpec, { kind: 'sankey' }>

const NODE_WIDTH = 12
const NODE_GAP = 14
/** After a middle step the bands run straight this far, so its labels lie on one even tint. */
const STRIP = 96
/** A band needs at least this much run to bend from its source to its target. */
const MIN_CURVE = 32
const LABEL_GAP = 6
/** A node's label: its name in `--text-small` and its count in `--text-axis`, each a line high. */
const NAME_LINE = 21
const VALUE_LINE = 15
const LABEL_ROOM = NAME_LINE + VALUE_LINE
/** The step names above the columns. */
const STEP_ROW = 24
/** A band of 1 px at its tint cannot be seen. */
const MIN_BAND = 2
const STUB_WIDTH = 28
/** A node's target reaches this far past it on either side; a thin band's is this tall. */
const NODE_REACH = 4
const MIN_HIT = 8

/* --- The model: what each node and flow counts, without any geometry ------------------ */

export interface SankeyNodeModel {
  id: string
  label: string
  href?: string
  /** The host's own count, which goes before the sum of its flows. */
  value?: number
  step: number
  /** Its place in its step, top first. */
  index: number
  /** The count it is drawn as: 0 when nothing of it is known. */
  size: number
  /** No value and no known flow: it shows only its name and "geen gegevens". */
  unknown: boolean
  /** Its count is a lower bound: a flow into it is missing, or one out of it with no value. */
  atLeast: boolean
  /** The flows into it, in the order of their sources. */
  inflow: SankeyFlowModel[]
  /** The flows out of it, in the order of their targets. */
  outflow: SankeyFlowModel[]
  /** What no known flow out of it takes while one is missing: one hatched stub for them all. */
  stub: number
  /** What ends here: neither a known flow nor the stub takes it. */
  rest: number
}

export interface SankeyFlowModel {
  id: string
  from: SankeyNodeModel
  to: SankeyNodeModel
  /** null = no data, never 0 (rule 15). */
  value: number | null
  href?: string
}

export interface SankeyModel {
  steps: { label: string; nodes: SankeyNodeModel[] }[]
  /** The flows between consecutive steps, in the host's order; any other is left out. */
  flows: SankeyFlowModel[]
  /** The whole: what the first step counts. */
  total: number
  /** What the host sent that the chart can only catch, for one warning in the console. */
  problems: string[]
}

const knownSum = (flows: SankeyFlowModel[]) =>
  flows.reduce((sum, flow) => sum + (flow.value ?? 0), 0)

export function sankeyModel(spec: Pick<SankeySpec, 'steps' | 'flows'>): SankeyModel {
  const byId = new Map<string, SankeyNodeModel>()
  const steps = spec.steps.map((step, s) => ({
    label: step.label,
    nodes: step.nodes.map((node, index) => {
      const model: SankeyNodeModel = {
        id: node.id,
        label: node.label,
        href: node.href,
        value: node.value,
        step: s,
        index,
        size: 0,
        unknown: false,
        atLeast: false,
        inflow: [],
        outflow: [],
        stub: 0,
        rest: 0,
      }
      if (!byId.has(node.id)) byId.set(node.id, model)
      return model
    }),
  }))

  const flows = spec.flows.flatMap((flow): SankeyFlowModel[] => {
    const from = byId.get(flow.from)
    const to = byId.get(flow.to)
    if (!from || !to || to.step !== from.step + 1) return []
    return [
      { id: flow.id ?? `${flow.from}→${flow.to}`, from, to, value: flow.value, href: flow.href },
    ]
  })
  for (const flow of flows) {
    flow.from.outflow.push(flow)
    flow.to.inflow.push(flow)
  }

  const problems: string[] = []
  const last = steps.length - 1
  for (const step of steps) {
    for (const node of step.nodes) {
      node.outflow.sort((a, b) => a.to.index - b.to.index)
      node.inflow.sort((a, b) => a.from.index - b.from.index)
      const knownIn = knownSum(node.inflow)
      const knownOut = knownSum(node.outflow)
      const missingOut = node.outflow.some((flow) => flow.value == null)
      const anyKnown = [...node.inflow, ...node.outflow].some((flow) => flow.value != null)
      if (node.value != null) {
        if (node.value < knownOut) {
          node.size = knownOut
          problems.push(`node "${node.id}" has a value below the known flows out of it`)
        } else {
          node.size = node.value
          if (missingOut) node.stub = node.value - knownOut
        }
      } else {
        node.size = Math.max(knownIn, knownOut)
        node.unknown = !anyKnown
        node.atLeast = !node.unknown && node.inflow.some((flow) => flow.value == null)
        if (missingOut && node.inflow.length === 0) {
          // Without a value nothing says how much the missing flow took: no stub, no guess.
          node.atLeast = !node.unknown
          problems.push(`node "${node.id}" has a missing flow out of it and no value`)
        } else if (missingOut) {
          node.stub = Math.max(0, knownIn - knownOut)
        }
      }
      node.rest = node.step < last ? Math.max(0, node.size - knownOut - node.stub) : 0
    }
  }
  const total = (steps[0]?.nodes ?? []).reduce((sum, node) => sum + node.size, 0)
  return { steps, flows, total, problems }
}

/** The height the drawing needs: the busiest step's labels and gaps, and the step names. */
export function sankeyHeight(spec: Pick<SankeySpec, 'steps'>): number {
  const busiest = Math.max(1, ...spec.steps.map((step) => step.nodes.length))
  return STEP_ROW + busiest * LABEL_ROOM + (busiest - 1) * NODE_GAP
}

/** One place the keyboard reads: a node, a flow, or the stub of a node's missing flows. */
export type SankeyStop =
  | { kind: 'node'; node: SankeyNodeModel }
  | { kind: 'flow'; flow: SankeyFlowModel }
  | { kind: 'stub'; node: SankeyNodeModel }

/**
 * The reading order: step by step, top to bottom, each node and then its flows out in the order
 * of their targets, the stub once where its first missing flow stands. A flow of 0 draws no
 * band and is read in the tooltips of its nodes.
 */
export function sankeyStops(model: SankeyModel): SankeyStop[] {
  const stops: SankeyStop[] = []
  for (const step of model.steps) {
    for (const node of step.nodes) {
      stops.push({ kind: 'node', node })
      let stubbed = false
      for (const flow of node.outflow) {
        if (flow.value == null) {
          if (node.stub > 0 && !stubbed) stops.push({ kind: 'stub', node })
          stubbed = true
        } else if (flow.value > 0) stops.push({ kind: 'flow', flow })
      }
    }
  }
  return stops
}

/* --- The geometry ------------------------------------------------------------------------ */

export interface SankeyBand {
  /** Top of the band at its source and at its target; `thickness` is at least 2 px. */
  a: number
  b: number
  thickness: number
  x0: number
  /** Where the straight run after a middle step ends and the bend begins. */
  xs: number
  x1: number
}

export interface SankeyLayout {
  width: number
  height: number
  /** px per count, one for every step. */
  scale: number
  columns: number[]
  /** The straight run after a middle step; 96 px unless the columns stand closer. */
  strip: number
  /** The counts beside the names: all of them, or none when one does not fit. */
  values: boolean
  node: Map<SankeyNodeModel, { x: number; y: number; h: number; slot: number; slotTop: number }>
  band: Map<SankeyFlowModel, SankeyBand>
  stub: Map<SankeyNodeModel, { x: number; y: number; h: number }>
}

export interface LayoutInput {
  width: number
  height: number
  /** A label's width: the name in 14 px, the count line in 12 px. */
  nameWidth: (node: SankeyNodeModel) => number
  valueWidth: (node: SankeyNodeModel) => number
}

/** Places the nodes, the bands and the stubs: one scale over all steps, within `height`. */
export function sankeyLayout(model: SankeyModel, input: LayoutInput): SankeyLayout {
  const { width, height, nameWidth, valueWidth } = input
  const { steps } = model
  const n = steps.length

  const room = (s: number, values: boolean) =>
    Math.max(
      0,
      ...(steps[s]?.nodes ?? []).map((node) =>
        Math.max(nameWidth(node), values ? valueWidth(node) : 0),
      ),
    )
  const place = (values: boolean) => {
    const first = room(0, values) + LABEL_GAP
    const last = width - (n > 1 ? room(n - 1, values) + LABEL_GAP : 0) - NODE_WIDTH
    const gap = n > 1 ? (last - first) / (n - 1) : 0
    return { columns: steps.map((_, s) => first + gap * s), run: gap - NODE_WIDTH }
  }
  const middle = steps.slice(1, -1).flatMap((step) => step.nodes)
  const wide = place(true)
  const values =
    wide.run >= (n > 2 ? STRIP : 0) + MIN_CURVE &&
    middle.every((node) => valueWidth(node) <= STRIP - LABEL_GAP - 2)
  let { columns, run } = values ? wide : place(false)
  if (n > 1 && run < MIN_CURVE) {
    // Too narrow even for the names: the columns keep room to bend and the names run over.
    const span = (n - 1) * (NODE_WIDTH + MIN_CURVE) + NODE_WIDTH
    const first = Math.max(0, Math.min(columns[0], width - span))
    columns = steps.map((_, s) => first + s * (NODE_WIDTH + MIN_CURVE))
    run = MIN_CURVE
  }
  const strip = n > 2 ? Math.max(0, Math.min(STRIP, run - MIN_CURVE)) : 0

  // One scale: the largest at which every step's slots and gaps fit the plot. A slot is the
  // node, or its label where the node is smaller; that keeps the fit monotone, so it bisects.
  const plot = height - STEP_ROW
  const slots = (k: number, nodes: SankeyNodeModel[]) =>
    nodes.reduce((sum, node) => sum + Math.max(node.size * k, LABEL_ROOM), 0) +
    NODE_GAP * Math.max(0, nodes.length - 1)
  const fits = (k: number) => steps.every((step) => slots(k, step.nodes) <= plot + 1e-6)
  const largest = Math.max(0, ...steps.flatMap((step) => step.nodes.map((node) => node.size)))
  let scale = 0
  if (largest > 0) {
    let lo = 0
    let hi = plot / largest
    if (fits(hi)) lo = hi
    else {
      for (let i = 0; i < 48; i++) {
        const mid = (lo + hi) / 2
        if (fits(mid)) lo = mid
        else hi = mid
      }
    }
    scale = lo
  }

  const node = new Map<
    SankeyNodeModel,
    { x: number; y: number; h: number; slot: number; slotTop: number }
  >()
  steps.forEach((step, s) => {
    // A shorter step stands in the middle.
    let top = STEP_ROW + Math.max(0, (plot - slots(scale, step.nodes)) / 2)
    for (const item of step.nodes) {
      const h = item.size * scale
      const slot = Math.max(h, LABEL_ROOM)
      node.set(item, { x: columns[s], y: top + (slot - h) / 2, h, slot, slotTop: top })
      top += slot + NODE_GAP
    }
  })

  const outAt = new Map<SankeyFlowModel, number>()
  const inAt = new Map<SankeyFlowModel, number>()
  const stub = new Map<SankeyNodeModel, { x: number; y: number; h: number }>()
  for (const item of node.keys()) {
    const box = node.get(item)!
    let y = box.y
    for (const flow of item.outflow) {
      if (flow.value != null) {
        outAt.set(flow, y)
        y += flow.value * scale
      } else if (item.stub > 0 && !stub.has(item)) {
        const h = item.stub * scale
        stub.set(item, { x: box.x + NODE_WIDTH, y, h: Math.max(MIN_BAND, h) })
        y += h
      }
    }
    y = box.y
    for (const flow of item.inflow) {
      if (flow.value == null) continue
      inAt.set(flow, y)
      y += flow.value * scale
    }
  }

  const band = new Map<SankeyFlowModel, SankeyBand>()
  for (const flow of model.flows) {
    if (flow.value == null || flow.value <= 0) continue
    const real = flow.value * scale
    const thickness = Math.max(MIN_BAND, real)
    // A thin band widens around the middle of its real place, so the node keeps its sum.
    const shift = (real - thickness) / 2
    const x0 = node.get(flow.from)!.x + NODE_WIDTH
    band.set(flow, {
      a: outAt.get(flow)! + shift,
      b: inAt.get(flow)! + shift,
      thickness,
      x0,
      xs: x0 + (flow.from.step > 0 ? strip : 0),
      x1: node.get(flow.to)!.x,
    })
  }

  return { width, height, scale, columns, strip, values, node, band, stub }
}

/** The band's outline: straight from its source, then a cubic bend with its handles halfway. */
export function bandPath({ a, b, thickness: t, x0, xs, x1 }: SankeyBand): string {
  const xm = (xs + x1) / 2
  return [
    `M${x0},${a}`,
    `H${xs}`,
    `C${xm},${a} ${xm},${b} ${x1},${b}`,
    `V${b + t}`,
    `C${xm},${b + t} ${xm},${a + t} ${xs},${a + t}`,
    `H${x0}`,
    'Z',
  ].join(' ')
}

function centreLine({ a, b, thickness: t, x0, xs, x1 }: SankeyBand): string {
  const xm = (xs + x1) / 2
  return `M${x0},${a + t / 2} H${xs} C${xm},${a + t / 2} ${xm},${b + t / 2} ${x1},${b + t / 2}`
}

/* --- The render --------------------------------------------------------------------------- */

/** Specs warned about, so a render on every pointer move warns once. */
const warned = new WeakSet<object>()

interface Related {
  flows: Set<SankeyFlowModel>
  nodes: Set<SankeyNodeModel>
  stubs: Set<SankeyNodeModel>
}

/** What stays at full strength while a stop is pointed at or chosen; the rest steps back. */
function relatedTo(stop: SankeyStop): Related {
  if (stop.kind === 'flow') {
    return {
      flows: new Set([stop.flow]),
      nodes: new Set([stop.flow.from, stop.flow.to]),
      stubs: new Set(),
    }
  }
  const { node } = stop
  if (stop.kind === 'stub') {
    const missing = node.outflow.filter((flow) => flow.value == null)
    return {
      flows: new Set(),
      nodes: new Set([node, ...missing.map((flow) => flow.to)]),
      stubs: new Set([node]),
    }
  }
  const through = [...node.inflow, ...node.outflow]
  return {
    flows: new Set(through),
    nodes: new Set([node, ...through.map((flow) => flow.from), ...through.map((flow) => flow.to)]),
    stubs: new Set([node]),
  }
}

export function renderSankeyChart(spec: SankeySpec, options: ChartOptions): TemplateResult {
  const model = sankeyModel(spec)
  if (model.problems.length && !warned.has(spec)) {
    warned.add(spec)
    console.warn(`lintje-chart (sankey): ${model.problems.join('; ')}`)
  }

  const name = spec.label ?? 'Aantal'
  const color = chartColor(spec.color) ?? DEFAULT_SERIES_COLOR
  const showShare = spec.share !== false
  const withUnit = (value: number) => `${formatNumber(value)}${spec.unit ? ` ${spec.unit}` : ''}`
  const pct = (part: number, whole: number) => formatPercent(whole > 0 ? (part / whole) * 100 : 0)
  const count = (node: SankeyNodeModel) =>
    node.unknown ? 'geen gegevens' : `${node.atLeast ? '≥ ' : ''}${formatNumber(node.size)}`
  const countWithUnit = (node: SankeyNodeModel) =>
    node.unknown ? 'geen gegevens' : `${node.atLeast ? '≥ ' : ''}${withUnit(node.size)}`
  // A lower bound or an unknown has no share: a share of a guess is a guess.
  const nodeShare = (node: SankeyNodeModel) =>
    node.unknown || node.atLeast || model.total <= 0 ? null : pct(node.size, model.total)

  const links = [
    ...model.steps.flatMap((step) =>
      step.nodes.map((node) => (node.href ? { id: node.id, href: node.href } : null)),
    ),
    ...model.flows.map((flow) => (flow.href ? { id: flow.id, href: flow.href } : null)),
  ]
  const selection = markSelection(options, links)

  return options.mobile
    ? renderRows(spec, options, model, selection, { count, pct })
    : renderDrawing(spec, options, model, selection, {
        name,
        color,
        showShare,
        withUnit,
        pct,
        count,
        countWithUnit,
        nodeShare,
        small: spec.small ?? false,
      })
}

interface DrawingText {
  name: string
  color: string
  showShare: boolean
  withUnit: (value: number) => string
  pct: (part: number, whole: number) => string
  count: (node: SankeyNodeModel) => string
  countWithUnit: (node: SankeyNodeModel) => string
  nodeShare: (node: SankeyNodeModel) => string | null
  small: boolean
}

/** The attributes of a stop's mark: a button with a `href`, inert without one. */
function markOf(
  selection: MarkSelection,
  link: { id: string; href?: string },
  label: string,
  sentence: string,
): MarkAttributes {
  return selection.of(link.href ? { id: link.id, href: link.href } : null, label, sentence)
}

function renderDrawing(
  spec: SankeySpec,
  options: ChartOptions,
  model: SankeyModel,
  selection: MarkSelection,
  text: DrawingText,
): TemplateResult {
  const { controller, description } = options
  const { name, color, showShare, withUnit, pct, count, countWithUnit, nodeShare } = text
  const id = controller.id
  const token = text.small ? '--chart-h-small' : '--chart-h-main'
  controller.measure({
    width: true,
    height: options.height ?? token,
    fit: Boolean(options.expanded),
  })
  const width = controller.width
  const height = options.height ?? Math.max(controller.height, sankeyHeight(spec))
  const fontFamily = controller.fontFamily

  const valueLine = (node: SankeyNodeModel) => {
    const share = showShare ? nodeShare(node) : null
    return { count: count(node), share: share == null ? '' : ` · ${share}` }
  }
  const layout = sankeyLayout(model, {
    width,
    height,
    nameWidth: (node) => (textWidth(node.label, fontFamily) * 14) / 12,
    valueWidth: (node) => {
      const line = valueLine(node)
      return textWidth(line.count, fontFamily, 700) + textWidth(line.share, fontFamily)
    },
  })
  const stops = sankeyStops(model)
  const last = model.steps.length - 1

  /* Tooltips and sentences */

  const nodeContent = (node: SankeyNodeModel): TooltipContent => {
    const share = nodeShare(node)
    const rows: TooltipRow[] = [{ label: name, value: countWithUnit(node), color }]
    if (share != null) rows.push({ label: 'van het totaal', value: share })
    const through =
      node.step === last
        ? node.inflow.map((flow) => ({ label: `uit ${flow.from.label}`, value: flow.value }))
        : node.outflow.map((flow) => ({ label: `→ ${flow.to.label}`, value: flow.value }))
    through.forEach((row, i) =>
      rows.push({
        label: row.label,
        value: row.value == null ? 'geen gegevens' : withUnit(row.value),
        divider: i === 0,
      }),
    )
    if (node.rest > 0) {
      rows.push({ label: 'eindigt hier', value: withUnit(node.rest), divider: !through.length })
    }
    return { title: `${node.label} (${model.steps[node.step].label})`, rows }
  }
  const flowContent = (flow: SankeyFlowModel): TooltipContent => ({
    title: `${flow.from.label} → ${flow.to.label}`,
    rows: [
      { label: name, value: withUnit(flow.value ?? 0), color },
      { label: `van ${flow.from.label}`, value: pct(flow.value ?? 0, flow.from.size) },
      { label: 'van het totaal', value: pct(flow.value ?? 0, model.total) },
    ],
  })
  const stubLabel = (node: SankeyNodeModel) =>
    `${node.label} zonder ${model.steps[node.step + 1]?.label ?? ''}`.trim()
  const missingOf = (node: SankeyNodeModel) => node.outflow.filter((flow) => flow.value == null)
  const stubContent = (node: SankeyNodeModel): TooltipContent => ({
    title: 'Geen gegevens',
    rows: [
      { label: stubLabel(node), value: withUnit(node.stub) },
      ...missingOf(node).map((flow, i) => ({
        label: `→ ${flow.to.label}`,
        value: '',
        divider: i === 0,
      })),
    ],
  })

  const sentenceOf = (stop: SankeyStop): string => {
    if (stop.kind === 'flow') {
      const { flow } = stop
      return `${flow.from.label} → ${flow.to.label}: ${withUnit(flow.value ?? 0)} (${pct(flow.value ?? 0, flow.from.size)} van ${flow.from.label})`
    }
    const { node } = stop
    if (stop.kind === 'stub') {
      const missing = missingOf(node).map((flow) => flow.to.label)
      return `${stubLabel(node)}: ${withUnit(node.stub)}, geen gegevens over ${missing.join(' en ')}`
    }
    const share = nodeShare(node)
    return `${node.label} (${model.steps[node.step].label}): ${countWithUnit(node)}${share == null ? '' : ` (${share} van het totaal)`}`
  }
  const contentOf = (stop: SankeyStop): TooltipContent =>
    stop.kind === 'flow'
      ? flowContent(stop.flow)
      : stop.kind === 'stub'
        ? stubContent(stop.node)
        : nodeContent(stop.node)

  /** Beside the node on the side without its label; beside a band's middle, toward the centre. */
  const at = (i: number): PlotPoint => {
    const stop = stops[i]
    const content = contentOf(stop)
    const sentence = sentenceOf(stop)
    if (stop.kind === 'flow') {
      const band = layout.band.get(stop.flow)!
      const x = (band.xs + band.x1) / 2
      const y = (band.a + band.b) / 2 + band.thickness / 2
      return { x, y, content, sentence, side: x > width / 2 ? 'left' : undefined }
    }
    if (stop.kind === 'stub') {
      const box = layout.stub.get(stop.node)!
      return { x: box.x + STUB_WIDTH, y: box.y + box.h / 2, content, sentence }
    }
    const box = layout.node.get(stop.node)!
    const y = box.slotTop + box.slot / 2
    return stop.node.step === 0
      ? { x: box.x + NODE_WIDTH, y, content, sentence }
      : { x: box.x, y, content, sentence, side: 'left' }
  }
  const keys = plotKeys(controller, stops.length, at)

  // The pointer stands the tooltip where the keyboard would, beside the mark, not the pointer.
  const point = (event: MouseEvent, i: number) => {
    if (controller.hoverIndex === i && controller.tooltip && !controller.status) return
    const drawing = (event.currentTarget as Element).closest('svg')
    const anchor = drawing?.closest('[data-tooltip-anchor]')
    if (!drawing || !anchor) return
    const box = drawing.getBoundingClientRect()
    const origin = anchor.getBoundingClientRect()
    const place = at(i)
    controller.hoverIndex = i
    controller.status = ''
    controller.showTooltipAt(
      box.left - origin.left + place.x,
      box.top - origin.top + place.y,
      place.content,
      place.side,
    )
  }

  /* States */

  const stopIndex = new Map<unknown, number>()
  stops.forEach((stop, i) =>
    stopIndex.set(
      stop.kind === 'flow' ? stop.flow : stop.kind === 'stub' ? `stub:${stop.node.id}` : stop.node,
      i,
    ),
  )
  const chosen =
    selection.active == null
      ? undefined
      : stops.find((stop) =>
          stop.kind === 'flow'
            ? stop.flow.id === selection.active
            : stop.kind === 'node' && stop.node.id === selection.active,
        )
  const hovered = controller.hoverIndex != null ? stops[controller.hoverIndex] : undefined
  const focus = hovered ?? chosen
  const related = focus ? relatedTo(focus) : null
  const keyboard = Boolean(controller.status)
  const current = (i: number | undefined) =>
    keyboard && i != null && i === controller.hoverIndex ? 'is-current' : ''
  const dimmed = (on: boolean) => (related && !on ? 'is-dimmed' : '')
  const own = (mark: MarkAttributes) =>
    `${mark.clickable ? 'is-clickable' : ''} ${mark.pressed === 'true' ? 'is-selected' : ''}`

  /* Marks */

  const hatch = `url(#hatch-${id})`
  const transitions = model.steps.slice(0, -1).map((step, t) => {
    const flows = model.flows.filter((flow) => flow.from.step === t && layout.band.has(flow))
    const bands = flows.map((flow) => {
      const band = layout.band.get(flow)!
      const i = stopIndex.get(flow)
      const label = `${flow.from.label} → ${flow.to.label}`
      const mark = markOf(selection, flow, label, sentenceOf({ kind: 'flow', flow }))
      const active = related?.flows.has(flow) ?? false
      return svg`<g @mousemove=${(event: MouseEvent) => i != null && point(event, i)}>
        <path d=${bandPath(band)} fill=${color}
              class="lintje-chart__mark lintje-sankey__band ${own(mark)} ${active ? 'is-active' : ''} ${dimmed(active)} ${current(i)}"
              data-mark-id=${mark.markId} role=${mark.role} tabindex=${mark.tabIndex}
              aria-pressed=${mark.pressed} aria-label=${mark.label}
              @click=${mark.click} @keydown=${mark.keydown} />
        ${
          band.thickness < MIN_HIT
            ? svg`<path class="lintje-sankey__hit lintje-sankey__hit--line ${mark.clickable ? 'is-clickable' : ''}"
                        d=${centreLine(band)} @click=${mark.click} />`
            : nothing
        }
      </g>`
    })
    const stubs = step.nodes.map((node) => {
      const box = layout.stub.get(node)
      if (!box) return nothing
      const i = stopIndex.get(`stub:${node.id}`)
      return svg`<rect class="lintje-sankey__stub ${dimmed(related?.stubs.has(node) ?? false)} ${current(i)}"
                       x=${box.x} y=${box.y} width=${STUB_WIDTH} height=${box.h} fill=${hatch}
                       @mousemove=${(event: MouseEvent) => i != null && point(event, i)} />`
    })
    return svg`<g class="lintje-sankey__flows" ${styleProps(staggerStyle(t, Math.max(1, model.steps.length - 1)))}>
      ${bands}${stubs}
    </g>`
  })

  const nodes = model.steps.flatMap((step) =>
    step.nodes.map((node) => {
      const box = layout.node.get(node)!
      const i = stopIndex.get(node)
      const mark = markOf(selection, node, node.label, sentenceOf({ kind: 'node', node }))
      const hit = Math.max(box.h, MIN_HIT)
      return svg`<g @mousemove=${(event: MouseEvent) => i != null && point(event, i)}>
        <rect class="lintje-sankey__hit ${mark.clickable ? 'is-clickable' : ''}"
              x=${box.x - NODE_REACH} y=${box.y + box.h / 2 - hit / 2}
              width=${NODE_WIDTH + 2 * NODE_REACH} height=${hit} @click=${mark.click} />
        ${
          box.h > 0
            ? svg`<rect class="lintje-chart__mark lintje-sankey__node ${own(mark)} ${dimmed(related?.nodes.has(node) ?? false)} ${current(i)}"
                        x=${box.x} y=${box.y} width=${NODE_WIDTH} height=${box.h} fill=${color}
                        data-mark-id=${mark.markId} role=${mark.role} tabindex=${mark.tabIndex}
                        aria-pressed=${mark.pressed} aria-label=${mark.label}
                        @click=${mark.click} @keydown=${mark.keydown} />`
            : nothing
        }
      </g>`
    }),
  )

  const labels = model.steps.flatMap((step, s) =>
    step.nodes.map((node) => {
      const box = layout.node.get(node)!
      const first = s === 0
      const x = first ? box.x - LABEL_GAP : box.x + NODE_WIDTH + LABEL_GAP
      const anchor = first ? 'end' : 'start'
      const middle = box.slotTop + box.slot / 2
      const line = valueLine(node)
      // On the straight run after a middle step the share takes the text colour: on a light
      // band's tint the muted text does not reach 4.5:1, in dark not even at rest.
      const onBand = s > 0 && s < last
      return svg`<g class="lintje-sankey__label ${onBand ? 'is-on-band' : ''}">
        <text x=${x} y=${layout.values ? middle - 3 : middle + 5} text-anchor=${anchor}
              class="lintje-sankey__name">${node.label}</text>
        ${
          layout.values
            ? svg`<text x=${x} y=${middle + 14} text-anchor=${anchor}
                        class="lintje-chart__data-label lintje-sankey__value">${line.count}<tspan
                        class="lintje-sankey__share">${line.share}</tspan></text>`
            : nothing
        }
      </g>`
    }),
  )

  const stepNames = model.steps.map(
    (step, s) => svg`<text x=${s === 0 ? layout.columns[0] + NODE_WIDTH : layout.columns[s]} y="12"
                          text-anchor=${s === 0 ? 'end' : 'start'}
                          class="lintje-chart__axis-label">${step.label}</text>`,
  )

  const missing = model.flows.some((flow) => flow.value == null)
  const legend: LegendItem[] = [
    { label: name, color, shape: 'square', fixed: true },
    { label: 'Stroom: de breedte is het aantal', color, shape: 'flow', fixed: true },
    ...(missing ? [{ label: 'Geen gegevens', shape: 'hatch' as const, fixed: true }] : []),
  ]

  const body: SvgSlot = [
    stepNames,
    svg`<g @mouseleave=${() => controller.hoverAt(null)}>${transitions}${nodes}</g>`,
    labels,
  ]

  return html`
    <div class="lintje-chart-wrap ${text.small ? 'lintje-chart--small' : ''}"
         ${ref(controller.attach)} ?data-in-view=${controller.inView} data-tooltip-anchor
         @keydown=${(event: KeyboardEvent) => controller.dismiss(event) || selection.escape(event)}>
      ${renderLegend({ items: legend })}
      <figure class="lintje-chart">
        <svg viewBox="0 0 ${width} ${height}" width=${width} height=${height}
             class="lintje-chart__svg lintje-sankey"
             ${styleProps({ height: `${height}px`, ...focusRingStyle(id) })}
             role=${drawingRole(selection.interactive)} aria-labelledby="${id}-desc" tabindex="0"
             @keydown=${keys.keydown} @focus=${keys.focus} @blur=${keys.blur}>
          <desc id="${id}-desc">${description}</desc>
          <defs>
            <pattern id="hatch-${id}" width="6" height="6" patternUnits="userSpaceOnUse"
                     patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-chart-hatch)" stroke-width="2" />
            </pattern>
            ${renderFocusRing(id)}
          </defs>
          ${body}
        </svg>
      </figure>
      ${renderTooltip(controller)}
      ${renderPlotStatus(controller)}
    </div>
  `
}

interface RowsText {
  pct: (part: number, whole: number) => string
  count: (node: SankeyNodeModel) => string
}

/**
 * Below 768 px: per transition, per source its name and count, one bar of the source divided
 * over its targets, and a row per target under it. The rows are the legend.
 */
function renderRows(
  spec: SankeySpec,
  options: ChartOptions,
  model: SankeyModel,
  selection: MarkSelection,
  text: RowsText,
): TemplateResult {
  const { controller, description } = options
  const { count, pct } = text
  controller.measure({ width: true })
  const width = controller.width
  const fontFamily = controller.fontFamily
  const named = isDataColor(spec.color) ? spec.color : undefined
  const id = controller.id

  const lower = (label: string) => label.charAt(0).toLowerCase() + label.slice(1)
  const sections = model.steps.slice(0, -1).map((step, t) => {
    const next = model.steps[t + 1]
    // The same target takes the same tint at every source. Past five the smallest fold into one
    // grey "Overig" piece, as a stack folds, so no two pieces share a tint.
    const kept =
      next.nodes.length > LADDER_PARTS
        ? new Set([...next.nodes].sort((a, b) => b.size - a.size).slice(0, LADDER_PARTS - 1))
        : new Set(next.nodes)
    const ladder = next.nodes.filter((node) => kept.has(node))
    const tints = tintsFor(ladder.length, named)
    const steps = tintSteps(ladder.length)
    const fillOf = (node: SankeyNodeModel) =>
      kept.has(node) ? tints[ladder.indexOf(node)] : 'var(--color-chart-other)'
    // The ink that reaches 4.5:1 on the piece's rung; none where neither does.
    const inkOf = (node: SankeyNodeModel) =>
      kept.has(node) ? labelInk(named, steps[ladder.indexOf(node)]) : labelInk('other')
    const sources = step.nodes.filter((node) => node.outflow.length > 0 || node.size > 0)
    return html`<section class="lintje-sankey__transition">
      <p class="lintje-sankey__heading">${step.label} → ${lower(next.label)}</p>
      ${sources.map((node) => {
        const pieces: { weight: number; fill: string; kind: string; share?: string }[] = []
        let stubbed = false
        let other = 0
        for (const flow of node.outflow) {
          if (flow.value == null) {
            if (!stubbed && node.stub > 0)
              pieces.push({ weight: node.stub, fill: '', kind: 'missing' })
            stubbed = true
          } else if (flow.value > 0 && !kept.has(flow.to)) {
            other += flow.value
          } else if (flow.value > 0) {
            const ink = inkOf(flow.to)
            pieces.push({
              weight: flow.value,
              fill: fillOf(flow.to),
              kind: ink ?? 'unlabelled',
              share: ink ? pct(flow.value, node.size) : undefined,
            })
          }
        }
        if (other > 0)
          pieces.push({
            weight: other,
            fill: 'var(--color-chart-other)',
            kind: 'ink',
            share: pct(other, node.size),
          })
        if (node.rest > 0)
          pieces.push({
            weight: node.rest,
            fill: '',
            kind: 'rest',
            share: pct(node.rest, node.size),
          })
        const room = Math.max(0, width - 2 * Math.max(0, pieces.length - 1))
        const all = pieces.reduce((sum, piece) => sum + piece.weight, 0) || 1
        const head = markOf(selection, node, node.label, `${node.label}: ${count(node)}`)
        return html`<div class="lintje-sankey__source">
          <p class="lintje-sankey__source-head ${head.state}" data-mark-id=${head.markId}
             role=${head.role} tabindex=${head.tabIndex} aria-pressed=${head.pressed}
             aria-label=${head.label} @click=${head.click} @keydown=${head.keydown}>
            <span>${node.label}</span><span>${count(node)}</span>
          </p>
          <div class="lintje-sankey__bar" aria-hidden="true">
            ${pieces.map((piece) => {
              const fits =
                piece.share != null &&
                textWidth(piece.share, fontFamily, 700) + 8 <= (room * piece.weight) / all
              return html`<span class="lintje-sankey__piece lintje-sankey__piece--${piece.kind}"
                  ${styleProps({ '--lintje-weight': String(piece.weight), background: piece.fill || undefined })}
                  >${fits ? piece.share : nothing}</span>`
            })}
          </div>
          <ul class="lintje-sankey__rows">
            ${node.outflow.map((flow) => {
              const link = flow.href ? flow : flow.to
              const sentence =
                flow.value == null
                  ? `${flow.to.label}: geen gegevens`
                  : `${flow.to.label}: ${formatNumber(flow.value)}, ${pct(flow.value, node.size)} van ${node.label}`
              const mark = markOf(selection, link, flow.to.label, sentence)
              return html`<li class="lintje-sankey__row">
                <span class="lintje-sankey__row-mark ${mark.state}" data-mark-id=${mark.markId}
                      role=${mark.role} tabindex=${mark.tabIndex} aria-pressed=${mark.pressed}
                      aria-label=${mark.label} @click=${mark.click} @keydown=${mark.keydown}>
                  <span class="lintje-sankey__swatch ${flow.value == null ? 'lintje-sankey__swatch--missing' : ''}"
                        ${styleProps({ background: flow.value == null ? undefined : fillOf(flow.to) })}></span>
                  <span class="lintje-sankey__row-name">${flow.to.label}</span>
                  ${
                    flow.value == null
                      ? html`<span class="lintje-sankey__row-share">geen gegevens</span>`
                      : html`<span class="lintje-sankey__row-count">${formatNumber(flow.value)}</span>
                          <span class="lintje-sankey__row-share">${pct(flow.value, node.size)}</span>`
                  }
                </span>
              </li>`
            })}
            ${
              node.rest > 0
                ? html`<li class="lintje-sankey__row">
                    <span class="lintje-sankey__row-mark">
                      <span class="lintje-sankey__swatch lintje-sankey__swatch--rest"></span>
                      <span class="lintje-sankey__row-name">eindigt hier</span>
                      <span class="lintje-sankey__row-count">${formatNumber(node.rest)}</span>
                      <span class="lintje-sankey__row-share">${pct(node.rest, node.size)}</span>
                    </span>
                  </li>`
                : nothing
            }
          </ul>
        </div>`
      })}
    </section>`
  })

  return html`
    <div class="lintje-chart-wrap" ${ref(controller.attach)} ?data-in-view=${controller.inView}
         data-tooltip-anchor @keydown=${(event: KeyboardEvent) => selection.escape(event)}>
      <figure class="lintje-chart lintje-sankey lintje-sankey--rows" aria-labelledby="${id}-desc">
        <figcaption id="${id}-desc" class="visually-hidden">${description}</figcaption>
        ${sections}
      </figure>
    </div>
  `
}
