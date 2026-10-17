/**
 * `<lintje-graph>` — an entity diagram in its tile: nodes and the relations between them, laid
 * out, folded and zoomed by the element itself.
 *
 * The host sends the graph; the element finds its centre, gathers more than five leaves of one
 * kind into a group, lays it out and draws it. `selected`, `collapsed` and `opened` are the
 * host's: a click shows at once and asks with an event, and the host confirms in the next `data`.
 * A node with `more` asks for its neighbours and shows a busy counter until the host sends them.
 * Above a hundred nodes the layout is worked out in a worker. The zoom, the kinds switched off in
 * the legend and the pointer are the element's own.
 *
 * Events: `lintje-node-select` `{ id, label }` (undone, `{ id: null, label: null }`),
 * `lintje-node-toggle` `{ id, open }`, `lintje-node-expand` `{ id }`.
 */
import {
  html,
  nothing,
  svg,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { repeat } from 'lit/directives/repeat.js'
import { ref } from 'lit/directives/ref.js'
import { define, type FrameSettings } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { styleProps } from '../../../core/style-props'
import { MediaController } from '../../../core/media'
import { lengthPx } from '../../../core/length'
import { durationMs, easing, prefersReducedMotion } from '../../../core/motion'
import { formatNumber, textWidth } from '../../../core/format'
import { renderIcon, iconStyles } from '../../../icons/render'
import { chartToken, DATA_COLORS } from '../../../tokens/colors'
import { spanStyles } from '../../shared/grid-item-element'
import { LintjeContentTileElement } from '../../shared/content-tile'
import { FrameResizeObserver } from '../../shared/frame-resize-observer'
import { place, stand, viewport, type Rect } from '../../shared/place'
import { avatarStyles, renderAvatar } from '../../shared/avatar'
import { renderStatusDot, statusDotStyles } from '../../feedback/status-dot/status-dot'
import { downloadCsv } from '../../shared/download'
import { renderChartSkeleton } from '../../shared/charts/shared/chart-states'
import { chartFrameStyles } from '../../shared/charts/shared/chart-styles'
import { renderLegend, type LegendItem } from '../../shared/charts/shared/axes'
import { HINT_MS, hintText, wheelDoublings, zoomsWith } from '../../shared/charts/shared/wheel'
import { TOOLTIP_DELAY } from '../../overlays/tooltip/tooltip'
import skeletonCss from '../../feedback/skeleton/skeleton.css?inline'
import tileHostCss from '../../shared/view-tile.css?inline'
import bubbleCss from '../../shared/tooltip-bubble.css?inline'
import graphCss from './graph.css?inline'
import { LayoutRunner } from './layout-runner'
import type { LayoutRequest, LayoutResult, Point } from './layout'
import {
  buildModel,
  relationLines,
  typeOf,
  type DrawnEdge,
  type DrawnNode,
  type GraphModel,
} from './model'
import { routeEdges, type RouteEdge, type Shape } from './routes'
import {
  boundsOf,
  centreOn,
  fit,
  fits,
  levelAt,
  overview,
  zoomAt,
  ZOOM,
  type Level,
  type View,
} from './view'
import '../../feedback/announcement/announcement'
import '../../feedback/spinner/spinner'
import '../../layout/tile/tile'
import '../../overlays/tooltip/tooltip'
import type { CellValue, GraphData, GraphLayout, GraphLines, GraphNodeType } from '../../../types'

/** The drawing's height in px, in the tile and on a phone. */
export const GRAPH_HEIGHT = { desktop: 480, mobile: 360 } as const

/**
 * A card's sizes in px at a 14 px text, the size its text has at zoom 1. It is 168 px wide, and
 * wider, up to 240, where its longest word would otherwise break.
 */
const CARD = {
  width: 168,
  wide: 240,
  padX: 12,
  padY: 8,
  icon: 20,
  gap: 8,
  line: 18,
  sub: 20,
  min: 40,
}
/** A mark's circle, and the gap before its name. */
const MARK = { radius: 14, gap: 6 }
/** The counter: its target, its sign, the space beside its number, its inset and gap in a card. */
const COUNTER = { size: 24, sign: 12, pad: 5, digit: 7, inset: 12, gap: 6 }
/** The thinnest and the thickest line, by the number a relation carries. */
const STROKE = { min: 1.5, max: 4 }
/** A pointer that moves less than this is a click, not a drag. */
const DRAG_FROM = 4
/** The overview map's frame. */
const OVERVIEW = { width: 180, height: 100 }

type Hover = { node: string } | { edge: string; at: Point } | null

/** What one drawing keeps, the tile's and the modal's apart: its size, zoom and pointer. */
class Surface {
  width = 640
  height: number = GRAPH_HEIGHT.desktop
  controls = 48
  /** The reader's zoom; `null` fits the drawing. */
  view: View | null = null
  hover: Hover = null
  /** What the tooltip speaks of, once its delay has run or at once on focus. */
  tip: Hover = null
  tipTimer: ReturnType<typeof setTimeout> | undefined
  /** The node the Tab key stops at in the drawing. */
  stop: string | null = null
  /** The node that holds the keyboard's focus. */
  focused: string | null = null
  drag: { x: number; y: number; view: View; moved: boolean; id: number } | null = null
  /** Two fingers on a touch screen, for the pinch. */
  touches = new Map<number, Point>()
  pinch: { distance: number; view: View } | null = null
  /** A pointer leaving a node waits a moment: it may only be crossing to the node's counter. */
  leaveTimer: ReturnType<typeof setTimeout> | undefined
  hint: string | null = null
  hintTimer: ReturnType<typeof setTimeout> | undefined
  area: HTMLElement | null = null
  observer: FrameResizeObserver | null = null

  constructor(readonly requestUpdate: () => void) {}

  readonly attach = (element: Element | undefined): void => {
    if (element === this.area) return
    this.observer?.disconnect()
    this.observer = null
    this.area = element instanceof HTMLElement ? element : null
    if (!this.area) return
    this.read()
    this.observer = new FrameResizeObserver(() => {
      if (this.read()) this.requestUpdate()
    })
    this.observer.observe(this.area)
  }

  /** Whether the area's size changed. */
  private read(): boolean {
    const box = this.area?.getBoundingClientRect()
    if (!box || !box.width) return false
    // The strip the zoom buttons take on the right, with their inset.
    this.controls = lengthPx(this.area!, '--lintje-graph-control', 40) + 8
    const width = Math.round(box.width)
    const height = Math.round(box.height)
    if (width === this.width && height === this.height) return false
    this.width = width
    this.height = height
    return true
  }

  detach(): void {
    this.observer?.disconnect()
    this.observer = null
    this.area = null
    clearTimeout(this.tipTimer)
    clearTimeout(this.leaveTimer)
    clearTimeout(this.hintTimer)
  }
}

/** A layout as the element keeps it: dagre's routes by the key of their edge. */
interface Placed {
  positions: Record<string, Point>
  routes: Map<string, Point[]> | null
  kind: GraphLayout
  key: string
}

interface Motion {
  from: Record<string, Point>
  start: number
  duration: number
}

/** The node or counter that has the focus, and the group it was, if one. */
interface FocusedPart {
  surface: Surface
  element: HTMLElement
  node: string
  group?: { parent: string; members: string[] }
}

/** A node's counter: how many, open or folded, its name, and whether the host is loading. */
interface Counter {
  count: number
  open: boolean
  label: string
  busy: boolean
}

/** A node that is leaving: drawn where it stood while it fades. */
interface Leaving {
  node: DrawnNode
  at: Point
  size: { width: number; height: number }
}

const round = (value: number): number => Math.round(value * 10) / 10

function plural(type: GraphNodeType): string {
  return (type.plural ?? type.label).toLowerCase()
}

export class LintjeGraph extends LintjeContentTileElement {
  static override styles = [
    spanStyles,
    shadowCss(tileHostCss),
    shadowCss(skeletonCss),
    chartFrameStyles,
    iconStyles,
    avatarStyles,
    statusDotStyles,
    shadowCss(bubbleCss),
    shadowCss(graphCss),
  ]

  static override properties: PropertyDeclarations = {
    data: { attribute: false },
  }

  declare data?: GraphData | null

  readonly #mobile = new MediaController(this)
  readonly #runner = new LayoutRunner()
  readonly #tile = new Surface(() => this.requestUpdate())
  #modal: Surface | null = null

  #model: GraphModel | null = null
  /** The centre, kept while the graph has it: opening a branch never moves it. */
  #centre: string | null = null
  /** The layout the graph's shape asked for when its centre was found. */
  #suggested: GraphLayout | null = null
  #selected: string | null = null
  #collapsed = new Set<string>()
  #opened = new Set<string>()
  /** Nodes whose `more` was asked for, until the host answers. */
  #loading = new Set<string>()
  #hiddenTypes = new Set<string>()
  /** A branch or group the reader opened or folded: the model is built again before the render. */
  #stale = false
  /** What the host sent last, so a value is adopted only when the host changes it. */
  #seen: { selected?: string | null; collapsed?: string; opened?: string } = {}

  /** Each node's box in the graph's own units, at a 14 px text. */
  #sizes = new Map<string, { width: number; height: number }>()
  #layout: Placed | null = null
  #layoutKey = ''
  #busy = false
  #motion: Motion | null = null
  #frame = 0
  #leaving = new Map<string, Leaving>()
  #fadeTimer: ReturnType<typeof setTimeout> | undefined
  /** The nodes and sizes of the last layout, for what leaves it. */
  #nodesSeen = new Map<string, DrawnNode>()
  #sizesSeen = new Map<string, { width: number; height: number }>()
  /** The node or counter that held the focus as the update began. */
  #focusBefore: FocusedPart | null = null
  /** Text size in px and the font, read where the element stands. */
  #font = { size: 14, family: '' }

  protected override get dataSettings(): FrameSettings | undefined {
    return this.data ?? undefined
  }

  override connectedCallback(): void {
    super.connectedCallback()
    window.addEventListener('scroll', this.#onScroll, { capture: true, passive: true })
  }

  /** The tooltip stands on the viewport, so it is placed again when the page scrolls. */
  readonly #onScroll = (): void => {
    if (this.surfaces().some((surface) => surface.tip)) this.placeTips()
  }

  override disconnectedCallback(): void {
    window.removeEventListener('scroll', this.#onScroll, { capture: true })
    this.#tile.detach()
    this.#modal?.detach()
    this.#runner.destroy()
    cancelAnimationFrame(this.#frame)
    this.#frame = 0
    clearTimeout(this.#fadeTimer)
    super.disconnectedCallback()
  }

  protected override expandChanged(open: boolean): void {
    if (open) this.#modal ??= new Surface(() => this.requestUpdate())
    else {
      this.#modal?.detach()
      this.#modal = null
    }
  }

  /* --- The model and its layout ------------------------------------------------- */

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    this.#focusBefore = this.focusedPart()
    const data = this.data
    if (!data || !(changed.has('data') || this.#stale)) return
    if (changed.has('data')) this.adopt(data)
    this.#stale = false
    this.rebuild()
  }

  /** Takes over what the host keeps, each only when the host changed it. */
  private adopt(data: GraphData): void {
    const selected = data.selected ?? null
    if (selected !== this.#seen.selected) {
      this.#seen.selected = selected
      this.#selected = selected
    }
    const collapsed = JSON.stringify(data.collapsed ?? [])
    if (collapsed !== this.#seen.collapsed) {
      this.#seen.collapsed = collapsed
      this.#collapsed = new Set(data.collapsed ?? [])
    }
    const opened = JSON.stringify(data.opened ?? [])
    if (opened !== this.#seen.opened) {
      this.#seen.opened = opened
      this.#opened = new Set(data.opened ?? [])
    }
    // An asked-for node is answered once its `more` is gone.
    for (const id of this.#loading) {
      if (!data.nodes.some((node) => node.id === id && node.more)) this.#loading.delete(id)
    }
  }

  private get layoutKind(): GraphLayout {
    return this.data?.layout ?? this.#suggested ?? 'force'
  }

  private get lines(): GraphLines {
    return this.data?.lines ?? (this.layoutKind === 'radial' ? 'curved' : 'straight')
  }

  /** The model again, and its layout when what it lays out changed. */
  private rebuild(): void {
    const data = this.data
    if (!data) return
    const model = buildModel(data, {
      opened: this.#opened,
      collapsed: this.#collapsed,
      centre: this.#centre,
    })
    this.#model = model
    // The layout the shape asks for stays with its centre: a graph that grows keeps its picture.
    if (!this.#suggested || model.centre !== this.#centre) this.#suggested = model.layout
    this.#centre = model.centre
    this.readFont()
    this.#sizes = new Map(model.nodes.map((node) => [node.id, this.cardSize(node, model)]))
    const kind = this.layoutKind
    const request: LayoutRequest = {
      kind,
      nodes: model.nodes.map((node) => ({ id: node.id, ...this.#sizes.get(node.id)! })),
      edges: model.edges.map((edge) => ({ from: edge.from, to: edge.to })),
      centre: model.centre,
    }
    const key = JSON.stringify(request)
    if (key === this.#layoutKey) return
    this.#layoutKey = key
    // Force keeps what stood where it stood; a new node comes beside its neighbour.
    if (kind === 'force' && this.#layout?.kind === 'force') request.previous = this.positionsNow()
    const edgeKeys = model.edges.map((edge) => edge.key)
    const placed = (result: LayoutResult): Placed => ({
      positions: result.positions,
      routes: result.routes
        ? new Map(edgeKeys.map((edgeKey, i) => [edgeKey, result.routes![i] ?? []]))
        : null,
      kind,
      key,
    })
    const result = this.#runner.run(request)
    if (result instanceof Promise) {
      this.#busy = true
      void result.then((done) => {
        if (this.#layoutKey !== key) return
        this.#busy = false
        this.apply(placed(done))
        this.requestUpdate()
      })
    } else {
      this.#busy = false
      this.apply(placed(result))
    }
  }

  private readFont(): void {
    const style = getComputedStyle(this)
    const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    this.#font = { size: root * 0.875, family: style.getPropertyValue('--font-ui') }
  }

  /** px at a 14 px text into the element's own text size. */
  private unit(px: number): number {
    return (px * this.#font.size) / 14
  }

  private wordWidth(text: string): number {
    return textWidth(text, this.#font.family) + 8
  }

  /** The counter a node carries, if any: what it shows and what it does. */
  private counterOf(node: DrawnNode, model: GraphModel): Counter | null {
    if (node.group) {
      const type = typeOf(this.data?.types ?? [], node.type)
      const count = node.group.members.length
      return { count, open: false, label: `Open ${count} ${plural(type)}`, busy: false }
    }
    if (node.more) {
      const busy = this.#loading.has(node.id)
      return {
        count: node.more,
        open: false,
        busy,
        label: busy ? `${node.more} relaties worden opgehaald` : `Haal ${node.more} relaties op`,
      }
    }
    const behind = model.behind.get(node.id)?.length ?? 0
    if (!behind) return null
    const open = !this.#collapsed.has(node.id)
    return {
      count: behind,
      open,
      busy: false,
      label: `Klap ${behind} ${behind === 1 ? 'relatie' : 'relaties'} ${open ? 'in' : 'uit'}`,
    }
  }

  /** The counter's width: its circle, or as wide as its sign and number; on a mark, 2 px of
   * clear target round a smaller drawing. */
  private counterWidth(count: number, small = false): number {
    const digits = String(count).length
    if (small)
      return Math.max(COUNTER.size, 4 + 2 * (COUNTER.pad - 1) + 10 + 1 + digits * COUNTER.digit)
    return Math.max(COUNTER.size, 2 * COUNTER.pad + COUNTER.sign + 1 + digits * COUNTER.digit)
  }

  /** The room a card keeps at its end for its counter, in px at zoom 1. */
  private roomFor(node: DrawnNode, model: GraphModel): number {
    const counter = this.counterOf(node, model)
    return counter ? this.counterWidth(counter.count) + COUNTER.gap : 0
  }

  /** A card's size: a fixed width, its name in one or two lines, and its status or group under it. */
  private cardSize(node: DrawnNode, model: GraphModel): { width: number; height: number } {
    const chrome = 2 + 2 * CARD.padX + CARD.icon + CARD.gap + this.roomFor(node, model)
    const sub = this.subOf(node, model)
    // A status starts after its dot.
    const dot = node.status ? 14 : 0
    const widest = (text: string, weight: number) =>
      Math.max(
        0,
        ...text.split(/\s+/).map((word) => textWidth(word, this.#font.family, weight, 14)),
      )
    // As wide as the longest word and two lines of each text need, from 168 px up to 240.
    const longest = Math.max(widest(node.label, 700), sub ? widest(sub, 400) + dot : 0)
    let width = Math.min(CARD.wide, Math.max(CARD.width, Math.ceil(chrome + longest + 1)))
    const inTwoLines = (room: number) =>
      this.lineCount(node.label, room, 700) <= 2 &&
      (!sub || this.lineCount(sub, room - dot, 400) <= 2)
    while (width < CARD.wide && !inTwoLines(width - chrome)) width += 8
    const text = width - chrome
    const lines = Math.min(2, this.lineCount(node.label, text, 700))
    const subLines = sub ? Math.min(2, this.lineCount(sub, text - dot, 400)) : 0
    const height = Math.max(
      CARD.min,
      2 * CARD.padY +
        lines * CARD.line +
        (subLines ? CARD.sub - CARD.line + subLines * CARD.line : 0) +
        2,
    )
    return { width: this.unit(width), height: this.unit(height) }
  }

  /** The line under a card's name: its status, or where a group hangs. */
  private subOf(node: DrawnNode, model: GraphModel): string {
    if (node.status) return node.status.label
    if (!node.group) return ''
    return `${node.group.members.length} bij ${model.byId.get(node.group.parent)?.label ?? ''}`
  }

  /** How many lines text takes in a width, wrapping at its spaces. */
  private lineCount(text: string, width: number, weight: number): number {
    const words = text.split(/\s+/).filter(Boolean)
    let lines = 1
    let used = 0
    const space = textWidth(' ', this.#font.family, weight, 14)
    for (const word of words) {
      const length = textWidth(word, this.#font.family, weight, 14)
      if (used && used + space + length > width) {
        lines++
        used = length
      } else used += (used ? space : 0) + length
    }
    return lines
  }

  /** A new layout: what stood moves to its new place, a new node comes from its neighbour. */
  private apply(layout: Placed): void {
    const before = this.#layout ? this.positionsNow() : null
    const previous = this.#layout
    this.#layout = layout
    const duration = before && !prefersReducedMotion() ? durationMs(this, '--dur-graph') : 0
    if (before && duration > 0) {
      const from: Record<string, Point> = {}
      const model = this.#model!
      for (const id of Object.keys(layout.positions)) {
        const start =
          before[id] ??
          [...(model.neighbours.get(id) ?? [])].map((other) => before[other]).find(Boolean)
        if (start) from[id] = start
      }
      this.#motion = { from, start: performance.now(), duration }
      this.tick()
    } else this.#motion = null
    // A node that left fades where it stood.
    if (previous && before && duration > 0) {
      for (const [id, at] of Object.entries(before)) {
        if (layout.positions[id] || this.#leaving.has(id)) continue
        const node = this.#nodesSeen.get(id)
        const size = this.#sizesSeen.get(id)
        if (node && size) this.#leaving.set(id, { node, at, size })
      }
      clearTimeout(this.#fadeTimer)
      this.#fadeTimer = setTimeout(() => {
        this.#leaving.clear()
        this.requestUpdate()
      }, duration)
    }
    for (const id of Object.keys(layout.positions)) this.#leaving.delete(id)
    this.#nodesSeen = new Map(this.#model!.nodes.map((node) => [node.id, node]))
    this.#sizesSeen = new Map(this.#sizes)
  }

  private tick(): void {
    if (this.#frame) return
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0
      this.requestUpdate()
      if (this.#motion && performance.now() - this.#motion.start < this.#motion.duration)
        this.tick()
      else this.#motion = null
    })
  }

  /** Where each node stands now, on its way from its last place to its new one. */
  private positionsNow(): Record<string, Point> {
    const layout = this.#layout
    if (!layout) return {}
    const motion = this.#motion
    if (!motion) return layout.positions
    const t = Math.min(1, (performance.now() - motion.start) / motion.duration)
    const eased = easing(this, '--ease-in-motion')(t)
    const now: Record<string, Point> = {}
    for (const [id, to] of Object.entries(layout.positions)) {
      const from = motion.from[id]
      now[id] = from
        ? { x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased }
        : to
    }
    return now
  }

  /* --- What the reader does ----------------------------------------------------- */

  private select(id: string | null): void {
    const model = this.#model
    const node = id ? model?.byId.get(id) : null
    this.#selected = node ? node.id : null
    for (const surface of this.surfaces()) surface.tip = null
    this.emit(
      'lintje-node-select',
      node ? { id: node.id, label: node.label } : { id: null, label: null },
    )
    this.requestUpdate()
  }

  private toggle(node: DrawnNode): void {
    const model = this.#model
    if (!model) return
    if (node.group) {
      this.#opened.add(node.id)
      this.emit('lintje-node-toggle', { id: node.id, open: true })
    } else if (node.more) {
      if (this.#loading.has(node.id)) return
      this.#loading.add(node.id)
      this.emit('lintje-node-expand', { id: node.id })
    } else if (this.#collapsed.has(node.id)) {
      this.#collapsed.delete(node.id)
      this.emit('lintje-node-toggle', { id: node.id, open: true })
    } else if (model.behind.has(node.id)) {
      this.#collapsed.add(node.id)
      this.emit('lintje-node-toggle', { id: node.id, open: false })
    } else return
    for (const surface of this.surfaces()) surface.tip = null
    this.#stale = true
    this.requestUpdate()
  }

  private toggleType(key: string): void {
    if (this.#hiddenTypes.has(key)) this.#hiddenTypes.delete(key)
    else this.#hiddenTypes.add(key)
    this.requestUpdate()
  }

  private leave(surface: Surface): void {
    clearTimeout(surface.leaveTimer)
    surface.leaveTimer = setTimeout(() => this.hover(surface, null), 0)
  }

  private surfaces(): Surface[] {
    return this.#modal ? [this.#tile, this.#modal] : [this.#tile]
  }

  private hover(surface: Surface, hover: Hover, delay = TOOLTIP_DELAY): void {
    clearTimeout(surface.leaveTimer)
    const same =
      hover &&
      surface.hover &&
      'node' in hover &&
      'node' in surface.hover &&
      hover.node === surface.hover.node
    if (same && delay) return
    surface.hover = hover
    clearTimeout(surface.tipTimer)
    if (!hover) surface.tip = null
    else if (!delay) surface.tip = hover
    else {
      surface.tip = null
      surface.tipTimer = setTimeout(() => {
        surface.tip = surface.hover
        this.requestUpdate()
      }, delay)
    }
    this.requestUpdate()
  }

  /** The view a surface shows: the reader's, or the whole drawing fitted. */
  private viewOf(surface: Surface): View | null {
    if (surface.view) return surface.view
    if (!this.#layout) return null
    return fit(boundsOf(this.#layout.positions, this.#sizes), surface, surface.controls)
  }

  private zoom(surface: Surface, factor: number, at?: Point): void {
    const view = this.viewOf(surface)
    if (!view) return
    surface.view = zoomAt(view, at ?? { x: surface.width / 2, y: surface.height / 2 }, factor)
    this.requestUpdate()
  }

  /** The chosen node and its neighbours in view. */
  private zoomToSelection(surface: Surface): void {
    const model = this.#model
    const layout = this.#layout
    const id = this.#selected
    if (!model || !layout || !id || !layout.positions[id]) return
    const ids = [id, ...(model.neighbours.get(id) ?? [])]
    surface.view = fit(boundsOf(layout.positions, this.#sizes, ids), surface, surface.controls)
    this.requestUpdate()
  }

  /** Brings a node into view when the keyboard reaches it outside. */
  private reveal(surface: Surface, id: string): void {
    const view = this.viewOf(surface)
    const at = this.#layout?.positions[id]
    if (!view || !at) return
    const x = at.x * view.k + view.x
    const y = at.y * view.k + view.y
    const margin = 48
    if (x < margin || y < margin || x > surface.width - margin || y > surface.height - margin) {
      surface.view = centreOn(view, at, surface)
    }
  }

  private focusNode(surface: Surface, id: string): void {
    surface.stop = id
    this.reveal(surface, id)
    this.requestUpdate()
    void this.updateComplete.then(() => {
      surface.area?.querySelector<HTMLElement>(`[data-node="${CSS.escape(id)}"]`)?.focus()
    })
  }

  /** The neighbour that lies most in the arrow's direction. */
  private neighbourTowards(id: string, dx: number, dy: number): string | null {
    const model = this.#model
    const positions = this.#layout?.positions
    const from = positions?.[id]
    if (!model || !from || !positions) return null
    let best: string | null = null
    let most = 0
    for (const other of model.neighbours.get(id) ?? []) {
      const to = positions[other]
      const node = model.byId.get(other)
      if (!to || !node || this.#hiddenTypes.has(node.type)) continue
      const length = Math.hypot(to.x - from.x, to.y - from.y) || 1
      const cosine = ((to.x - from.x) * dx + (to.y - from.y) * dy) / length
      if (cosine > most) {
        most = cosine
        best = other
      }
    }
    return best
  }

  private onKey(surface: Surface, event: KeyboardEvent): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-node]')
    const id = target?.dataset.node
    if (event.key === 'Escape') {
      if (surface.tip) {
        this.hover(surface, null)
        event.stopPropagation()
      } else if (this.#selected) {
        this.select(null)
        event.stopPropagation()
      }
      return
    }
    if (!id || !target?.matches('.lintje-graph__node')) return
    const arrows: Record<string, [number, number]> = {
      ArrowRight: [1, 0],
      ArrowLeft: [-1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }
    const arrow = arrows[event.key]
    const next =
      event.key === 'Home'
        ? this.#model?.centre
        : arrow
          ? this.neighbourTowards(id, ...arrow)
          : null
    if (event.key !== 'Home' && !arrow) return
    event.preventDefault()
    if (next) this.focusNode(surface, next)
  }

  private onWheel(surface: Surface, event: WheelEvent): void {
    if (!zoomsWith(event)) {
      surface.hint = hintText()
      clearTimeout(surface.hintTimer)
      surface.hintTimer = setTimeout(() => {
        surface.hint = null
        this.requestUpdate()
      }, HINT_MS)
      this.requestUpdate()
      return
    }
    event.preventDefault()
    const box = surface.area!.getBoundingClientRect()
    this.zoom(surface, 2 ** wheelDoublings(event), {
      x: event.clientX - box.left,
      y: event.clientY - box.top,
    })
  }

  /** What a pointer on the drawing itself does: drag it, or pinch it with two fingers. */
  private onPointerDown(surface: Surface, event: PointerEvent): void {
    const target = event.target as Element
    if (target.closest('button, .lintje-graph__overview')) return
    const box = surface.area!.getBoundingClientRect()
    const at = { x: event.clientX - box.left, y: event.clientY - box.top }
    if (event.pointerType === 'touch') {
      // One finger moves the page; two zoom the drawing.
      surface.touches.set(event.pointerId, at)
      if (surface.touches.size === 2) {
        const [a, b] = [...surface.touches.values()]
        const view = this.viewOf(surface)
        if (view) surface.pinch = { distance: Math.hypot(a!.x - b!.x, a!.y - b!.y), view }
      }
      return
    }
    const view = this.viewOf(surface)
    if (!view || event.button !== 0) return
    surface.area!.setPointerCapture?.(event.pointerId)
    surface.drag = { x: event.clientX, y: event.clientY, view, moved: false, id: event.pointerId }
  }

  private onPointerMove(surface: Surface, event: PointerEvent): void {
    if (event.pointerType === 'touch' && surface.touches.has(event.pointerId)) {
      const box = surface.area!.getBoundingClientRect()
      surface.touches.set(event.pointerId, {
        x: event.clientX - box.left,
        y: event.clientY - box.top,
      })
      if (surface.pinch && surface.touches.size === 2) {
        const [a, b] = [...surface.touches.values()]
        const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y)
        const middle = { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 }
        surface.view = zoomAt(surface.pinch.view, middle, distance / surface.pinch.distance)
        this.requestUpdate()
      }
      return
    }
    const drag = surface.drag
    if (!drag || drag.id !== event.pointerId) return
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_FROM) return
    drag.moved = true
    surface.view = { k: drag.view.k, x: drag.view.x + dx, y: drag.view.y + dy }
    this.requestUpdate()
  }

  private onPointerUp(surface: Surface, event: PointerEvent): void {
    if (event.pointerType === 'touch') {
      surface.touches.delete(event.pointerId)
      if (surface.touches.size < 2) surface.pinch = null
      return
    }
    const drag = surface.drag
    if (!drag || drag.id !== event.pointerId) return
    surface.drag = null
    // A click on the drawing, not on a node, undoes the choice.
    if (!drag.moved && event.type === 'pointerup' && this.#selected) this.select(null)
    this.requestUpdate()
  }

  private onOverview(
    surface: Surface,
    event: MouseEvent,
    map: { scale: number; x: number; y: number },
  ): void {
    const view = this.viewOf(surface)
    if (!view) return
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const world = {
      x: (event.clientX - box.left - map.x) / map.scale,
      y: (event.clientY - box.top - map.y) / map.scale,
    }
    surface.view = centreOn(view, world, surface)
    this.requestUpdate()
  }

  /* --- The file ------------------------------------------------------------------ */

  private relationRows(): CellValue[][] {
    const data = this.data
    if (!data) return []
    const names = new Map(data.nodes.map((node) => [node.id, node.label]))
    const withValue = data.edges.some((edge) => edge.value != null)
    return data.edges
      .filter((edge) => names.has(edge.from) && names.has(edge.to))
      .map((edge) => {
        const word = edge.label || 'verbonden met'
        const row: CellValue[] = [names.get(edge.from)!, word, names.get(edge.to)!]
        if (withValue) row.push(edge.value ?? null, edge.unit ?? '')
        return row
      })
  }

  private csv(): void {
    const data = this.data
    if (!data?.download) return
    const withValue = data.edges.some((edge) => edge.value != null)
    downloadCsv(data.download.filename, [
      ['Van', 'Relatie', 'Naar', ...(withValue ? ['Aantal', 'Eenheid'] : [])],
      ...this.relationRows(),
    ])
  }

  /* --- Drawing ------------------------------------------------------------------ */

  private typeColor(key: string): string | undefined {
    const data = this.data
    if (!data || data.typeColors === false) return undefined
    const index = data.types.findIndex((type) => type.key === key)
    if (index < 0) return undefined
    const color = data.types[index]!.color ?? DATA_COLORS[index % DATA_COLORS.length]!
    // An icon stands for a word, so dark yellow takes its colour for text.
    return color === 'dark-yellow' ? 'var(--color-chart-dark-yellow-text)' : chartToken(color)
  }

  private legend(): TemplateResult | typeof nothing {
    const data = this.data as GraphData
    const model = this.#model
    if (!model || !data.types.length) return nothing
    const counts = new Map<string, number>()
    for (const node of model.nodes) {
      counts.set(
        node.type,
        (counts.get(node.type) ?? 0) + (node.group ? node.group.members.length : 1),
      )
    }
    const items: LegendItem[] = data.types.map((type) => ({
      label: type.label,
      key: type.key,
      icon: type.icon,
      color: this.typeColor(type.key) ?? 'var(--color-text-primary)',
      count: counts.get(type.key) ?? 0,
      hidden: this.#hiddenTypes.has(type.key),
      // One kind alone switched off would leave an empty drawing.
      fixed: data.types.length < 2,
    }))
    return renderLegend({ items, onToggle: (key) => this.toggleType(key) })
  }

  protected override render(): TemplateResult | typeof nothing {
    const data = this.data
    if (!data) return nothing
    const ready = (data.state ?? 'ready') === 'ready'
    const mobile = this.#mobile.matches
    const subtitle = mobile && data.mobileSubtitle ? data.mobileSubtitle : data.subtitle
    const height = data.height ?? (mobile ? GRAPH_HEIGHT.mobile : GRAPH_HEIGHT.desktop)

    return html`<lintje-tile
      id=${this.id ? `${this.id}-tile` : nothing}
      span=${data.span ?? nothing}
      heading=${data.title ?? nothing}
      icon=${data.icon ?? nothing}
      subtitle=${subtitle ?? nothing}
      intro=${data.intro ?? nothing}
      footnote=${data.footnote ?? nothing}
      ?expandable=${Boolean(data.expandable) && ready}
      ?download=${Boolean(data.download) && ready}
      state=${data.state ?? 'ready'}
      message=${data.message ?? nothing}
      last-known=${data.lastKnown ?? nothing}
      content-height=${`${height}px`}
      @lintje-tile-expand=${(event: Event) => {
        event.stopPropagation()
        this.expand(true)
      }}
      @lintje-tile-download=${(event: Event) => {
        event.stopPropagation()
        this.csv()
      }}
    >
      ${
        data.notice
          ? html`<lintje-announcement slot="notice" compact .data=${data.notice}></lintje-announcement>`
          : nothing
      }
      ${this.content(height)}
    </lintje-tile>

    ${this.renderExpandModal(
      this.expanded && this.#modal ? this.drawing(this.#modal, null) : nothing,
      {
        heading: data.title,
        subtitle,
        footnote: data.footnote,
        csv: data.download ? () => this.csv() : undefined,
      },
    )}`
  }

  private content(height: number): TemplateResult | typeof nothing {
    const data = this.data as GraphData
    switch (data.state ?? 'ready') {
      case 'loading':
        return html`<div slot="loading">${renderChartSkeleton({ kind: 'map', height: `${height}px`, status: false })}</div>`
      case 'empty':
      case 'error':
        return nothing
      default:
        return this.drawing(this.#tile, height)
    }
  }

  /** The legend and the drawing of one surface; `height` null takes the modal's. */
  private drawing(surface: Surface, height: number | null): TemplateResult {
    const data = this.data as GraphData
    const mobile = this.#mobile.matches
    return html`<div class="lintje-graph ${mobile ? 'is-phone' : ''} ${height === null ? 'lintje-graph--expanded' : ''}">
      ${this.legend()}
      <div class="lintje-graph__area" ${ref(surface.attach)}
           ${styleProps({ height: height === null ? null : `${height}px` })}
           @wheel=${{ handleEvent: (event: WheelEvent) => this.onWheel(surface, event), passive: false }}
           @pointerdown=${(event: PointerEvent) => this.onPointerDown(surface, event)}
           @pointermove=${(event: PointerEvent) => this.onPointerMove(surface, event)}
           @pointerup=${(event: PointerEvent) => this.onPointerUp(surface, event)}
           @pointercancel=${(event: PointerEvent) => this.onPointerUp(surface, event)}
           @dblclick=${(event: MouseEvent) => {
             if ((event.target as Element).closest('button')) return
             const box = surface.area!.getBoundingClientRect()
             this.zoom(surface, event.shiftKey ? 1 / 2 : 2, {
               x: event.clientX - box.left,
               y: event.clientY - box.top,
             })
           }}
           @keydown=${(event: KeyboardEvent) => this.onKey(surface, event)}>
        ${this.picture(surface, data)}
      </div>
    </div>`
  }

  private picture(surface: Surface, data: GraphData): TemplateResult {
    const model = this.#model!
    const layout = this.#layout
    const view = this.viewOf(surface)
    const descId = `${this.id || 'lintje-graph'}-desc-${surface === this.#tile ? 'tile' : 'modal'}`
    const busy = this.#busy
      ? html`<div class="lintje-graph__busy">
          <lintje-spinner size="24" stacked label=${`Bezig met indelen van ${model.nodes.length} knopen`}></lintje-spinner>
        </div>`
      : nothing
    if (!layout || !view) {
      return html`<p id=${descId} class="visually-hidden">${data.description}</p>${busy}`
    }
    const k = view.k
    const level = levelAt(k)
    const now = this.positionsNow()
    const screen = (point: Point): Point => ({ x: point.x * k + view.x, y: point.y * k + view.y })
    const shown = model.nodes.filter((node) => !this.#hiddenTypes.has(node.type) && now[node.id])
    const shownIds = new Set(shown.map((node) => node.id))

    // What stands in the light: the node under the pointer, else the chosen one, with its
    // neighbours and its lines; a line under the pointer with its two ends.
    const hover = surface.hover
    const focus =
      hover && 'node' in hover && shownIds.has(hover.node)
        ? hover.node
        : this.#selected && shownIds.has(this.#selected)
          ? this.#selected
          : null
    let litNodes: Set<string> | null = null
    let litEdges: Set<string> | null = null
    if (hover && 'edge' in hover) {
      const edge = model.edges.find((item) => item.key === hover.edge)
      if (edge) {
        litNodes = new Set([edge.from, edge.to])
        litEdges = new Set([edge.key])
      }
    } else if (focus) {
      litNodes = new Set([focus, ...(model.neighbours.get(focus) ?? [])])
      litEdges = new Set(
        model.edges
          .filter((edge) => edge.from === focus || edge.to === focus)
          .map((edge) => edge.key),
      )
    }
    const dim = (id: string) => Boolean(litNodes && !litNodes.has(id))

    // Each node's outline on the screen.
    const shapes = new Map<string, Shape>()
    for (const node of shown) {
      const centre = screen(now[node.id]!)
      const size = this.#sizes.get(node.id)!
      shapes.set(
        node.id,
        level === 'card'
          ? {
              cx: centre.x,
              cy: centre.y,
              hw: (size.width * k) / 2,
              hh: (size.height * k) / 2,
              round: false,
            }
          : { cx: centre.x, cy: centre.y, hw: MARK.radius, hh: MARK.radius, round: true },
      )
    }

    const edges = model.edges.filter((edge) => shownIds.has(edge.from) && shownIds.has(edge.to))
    const most = Math.max(0, ...edges.map((edge) => edge.value ?? 0))
    const widthOf = (edge: DrawnEdge) =>
      edge.value && most
        ? STROKE.min + (STROKE.max - STROKE.min) * Math.sqrt(edge.value / most)
        : STROKE.min
    const routed = new Map<string, Point[]>()
    if (layout.routes && level === 'card' && !this.#motion) {
      for (const edge of edges) {
        const route = layout.routes.get(edge.key)
        if (route?.length) routed.set(edge.key, route.map(screen))
      }
    }
    const isLit = (edge: DrawnEdge) => Boolean(litEdges?.has(edge.key))
    // The lines in the light place their words first.
    const ordered = [...edges].sort((a, b) => Number(isLit(b)) - Number(isLit(a)))
    const routeInput: RouteEdge[] = ordered.map((edge) => ({
      key: edge.key,
      from: edge.from,
      to: edge.to,
      label: edge.label,
      direction: edge.direction,
      width: widthOf(edge),
      labelled: level === 'card' || isLit(edge),
      lit: isLit(edge),
    }))
    const routes = new Map(
      routeEdges(routeInput, shapes, {
        lines: this.lines,
        layered:
          layout.kind === 'layered-right'
            ? 'right'
            : layout.kind === 'layered-down'
              ? 'down'
              : null,
        routed,
        labelWidth: (text) => this.wordWidth(text),
      }).map((route) => [route.key, route]),
    )

    const lines = svg`<svg class="lintje-graph__lines" width=${surface.width} height=${surface.height}
        viewBox="0 0 ${surface.width} ${surface.height}" aria-hidden="true" focusable="false">
      <desc>${data.description}</desc>
      ${repeat(
        edges,
        (edge) => edge.key,
        (edge) => {
          const route = routes.get(edge.key)
          if (!route) return nothing
          const lit = isLit(edge)
          const hot = Boolean(hover && 'edge' in hover && hover.edge === edge.key)
          return svg`<g class="lintje-graph__edge ${lit ? 'is-lit' : ''} ${litEdges && !lit ? 'is-dim' : ''} ${hot ? 'is-hot' : ''}">
            <path class="lintje-graph__line" d=${route.d} stroke-width=${round(widthOf(edge) + (hot ? 1 : 0))}></path>
            ${route.arrows.map((d) => svg`<path class="lintje-graph__arrow" d=${d}></path>`)}
            <path class="lintje-graph__hit" d=${route.d}
                  @pointerenter=${(event: PointerEvent) => {
                    const box = surface.area!.getBoundingClientRect()
                    this.hover(surface, {
                      edge: edge.key,
                      at: { x: event.clientX - box.left, y: event.clientY - box.top },
                    })
                  }}
                  @pointerleave=${() => this.leave(surface)}></path>
          </g>`
        },
      )}
      ${repeat(
        ordered.filter((edge) => routes.get(edge.key)?.label),
        (edge) => edge.key,
        (edge) => {
          const at = routes.get(edge.key)!.label!
          const lit = isLit(edge)
          return svg`<text class="lintje-graph__word ${lit ? 'is-lit' : ''}"
                           x=${at.x} y=${at.y}>${edge.label}</text>`
        },
      )}
    </svg>`

    // The tab stop: the node the keyboard was on, else the chosen one, else the centre.
    if (!surface.stop || !shownIds.has(surface.stop)) {
      surface.stop =
        (this.#selected && shownIds.has(this.#selected) ? this.#selected : null) ??
        (model.centre && shownIds.has(model.centre) ? model.centre : (shown[0]?.id ?? null))
    }
    const named =
      level === 'card' ? new Set<string>() : this.markNames(shown, shapes, level, hover, surface)
    const nodes = [
      ...shown.map((node) => ({ node, leaving: false })),
      ...[...this.#leaving.values()]
        .filter(({ node }) => !shownIds.has(node.id))
        .map(({ node }) => ({ node, leaving: true })),
    ]

    const box = boundsOf(layout.positions, this.#sizes)
    const showOverview = !fits(box, view, surface)
    const map = overview(box, OVERVIEW)

    return html`<p id=${descId} class="visually-hidden">${data.description}</p>
      ${lines}
      <div class="lintje-graph__nodes lintje-graph__nodes--${level}" role="group" aria-labelledby=${descId}
           ${styleProps({ '--lintje-graph-k': k.toFixed(4) })}>
        ${repeat(
          nodes,
          ({ node }) => node.id,
          ({ node, leaving }) => {
            if (leaving) {
              const gone = this.#leaving.get(node.id)!
              const centre = screen(gone.at)
              const size = gone.size
              return this.renderNode(surface, node, model, level, {
                x: centre.x,
                y: centre.y,
                size,
                dim: false,
                named: false,
                leaving: true,
              })
            }
            const shape = shapes.get(node.id)!
            return this.renderNode(surface, node, model, level, {
              x: shape.cx,
              y: shape.cy,
              size: this.#sizes.get(node.id)!,
              dim: dim(node.id),
              named: named.has(node.id),
              leaving: false,
            })
          },
        )}
      </div>
      ${this.tooltip(surface, level)}
      ${busy}
      ${surface.hint ? html`<p class="lintje-graph__hint" role="status">${surface.hint}</p>` : nothing}
      ${this.controls(surface)}
      ${
        showOverview
          ? html`<div class="lintje-graph__overview" aria-hidden="true"
                    ${styleProps({ width: `${OVERVIEW.width}px`, height: `${OVERVIEW.height}px` })}
                    @click=${(event: MouseEvent) => this.onOverview(surface, event, map)}>
              ${shown.map((node) => {
                const at = now[node.id]!
                return html`<span class="lintje-graph__overview-dot"
                  ${styleProps({ left: `${round(map.x + at.x * map.scale)}px`, top: `${round(map.y + at.y * map.scale)}px` })}></span>`
              })}
              <span class="lintje-graph__overview-view" ${styleProps({
                left: `${round(map.x + (-view.x / k) * map.scale)}px`,
                top: `${round(map.y + (-view.y / k) * map.scale)}px`,
                width: `${round((surface.width / k) * map.scale)}px`,
                height: `${round((surface.height / k) * map.scale)}px`,
              })}></span>
            </div>`
          : nothing
      }`
  }

  /**
   * Which marks show their name beside them: the one pointed at and the chosen one first, then
   * the busiest, each only where it covers no node and no other name. Far out, only the first two.
   */
  private markNames(
    shown: DrawnNode[],
    shapes: Map<string, Shape>,
    level: Level,
    hover: Hover,
    area: { width: number; height: number },
  ): Set<string> {
    const model = this.#model!
    const must = new Set([this.#selected, hover && 'node' in hover ? hover.node : null])
    const ranked = [...shown].sort(
      (a, b) =>
        Number(must.has(b.id)) - Number(must.has(a.id)) ||
        (model.neighbours.get(b.id)?.size ?? 0) - (model.neighbours.get(a.id)?.size ?? 0),
    )
    const boxes = [...shapes.values()].map((shape) => ({
      x: shape.cx - shape.hw,
      y: shape.cy - shape.hh,
      w: 2 * shape.hw,
      h: 2 * shape.hh,
    }))
    const kept: { x: number; y: number; w: number; h: number }[] = []
    const overlaps = (a: (typeof kept)[number], b: (typeof kept)[number]) =>
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
    const named = new Set<string>()
    for (const node of ranked) {
      const forced = must.has(node.id)
      if (level === 'icon' && !forced) continue
      const shape = shapes.get(node.id)!
      const width = textWidth(node.label, this.#font.family, 400, 14) + 12
      const box = { x: shape.cx + MARK.radius + MARK.gap, y: shape.cy - 10, w: width, h: 20 }
      const outside = box.x + box.w > area.width || box.y < 0 || box.y + box.h > area.height
      if (
        !forced &&
        (outside ||
          boxes.some((other) => overlaps(box, other)) ||
          kept.some((other) => overlaps(box, other)))
      )
        continue
      kept.push(box)
      named.add(node.id)
    }
    return named
  }

  /**
   * One node and its counter. The node is one button in either form, a card or a mark, so a
   * change of zoom keeps the element that has the focus.
   */
  private renderNode(
    surface: Surface,
    node: DrawnNode,
    model: GraphModel,
    level: Level,
    spot: {
      x: number
      y: number
      size: { width: number; height: number }
      dim: boolean
      named: boolean
      leaving: boolean
    },
  ): TemplateResult {
    const data = this.data as GraphData
    const type = typeOf(data.types, node.type)
    const card = level === 'card'
    const selected = this.#selected === node.id
    const stop = surface.stop === node.id && !spot.leaving
    const counter = spot.leaving ? null : this.counterOf(node, model)
    const hovered = Boolean(
      surface.hover && 'node' in surface.hover && surface.hover.node === node.id,
    )
    const quiet = counter?.open && !hovered && !selected && surface.focused !== node.id
    const k = this.viewOf(surface)?.k ?? 1
    const color = this.typeColor(node.type)
    const classes = [
      'lintje-graph__node',
      card ? 'lintje-graph__card' : 'lintje-graph__mark',
      card && node.group ? 'lintje-graph__card--group' : '',
      !card && counter ? 'lintje-graph__mark--counted' : '',
      selected ? 'is-selected' : '',
      spot.dim ? 'is-dim' : '',
      hovered ? 'is-hover' : '',
      spot.leaving ? 'is-leaving' : '',
    ].join(' ')
    const sub = node.status
      ? renderStatusDot({
          tone: node.status.tone ?? 'neutral',
          label: node.status.label,
          size: 8,
          className: 'lintje-graph__status',
        })
      : node.group
        ? this.subOf(node, model)
        : ''
    const kind = `, ${node.group ? `groep ${type.plural ?? type.label}` : type.label}`
    const glyph = node.initials
      ? renderAvatar(
          { name: node.label, initials: node.initials },
          { size: 'small', className: 'lintje-graph__avatar' },
        )
      : renderIcon(type.icon, { size: card ? 20 : 16, className: 'lintje-graph__icon' })
    const position = card
      ? {
          transform: `translate(${round(spot.x - (spot.size.width * k) / 2)}px, ${round(spot.y - (spot.size.height * k) / 2)}px)`,
          '--lintje-graph-w': `${(spot.size.width / this.#font.size).toFixed(4)}em`,
          '--lintje-graph-h': `${(spot.size.height / this.#font.size).toFixed(4)}em`,
          '--lintje-graph-room': `${counter ? ((this.counterWidth(counter.count) + COUNTER.gap) / 14).toFixed(4) : 0}em`,
          '--lintje-graph-type': color ?? null,
        }
      : {
          transform: `translate(${round(spot.x - MARK.radius)}px, ${round(spot.y - MARK.radius)}px)`,
          '--lintje-graph-type': color ?? null,
        }
    const enter = () => this.hover(surface, { node: node.id })
    const leave = () => this.leave(surface)
    // A blur also comes from a button the render takes away: the update waits a task.
    const blur = () => {
      surface.focused = null
      this.leave(surface)
    }
    const nodeButton = html`<button type="button" class=${classes} data-node=${node.id}
        tabindex=${stop ? 0 : -1}
        aria-pressed=${selected ? 'true' : 'false'}
        ${styleProps(position)}
        @click=${() => this.select(selected ? null : node.id)}
        @pointerenter=${enter} @pointerleave=${leave}
        @focus=${() => {
          surface.focused = node.id
          surface.stop = node.id
          this.hover(surface, { node: node.id }, 0)
        }}
        @blur=${blur}>
      <span class="lintje-graph__glyph">${glyph}</span>
      <span class="lintje-graph__text">
        <span class="lintje-graph__name ${card || spot.named ? '' : 'visually-hidden'}">${node.label}</span>
        ${sub ? html`<span class="lintje-graph__sub ${card ? '' : 'visually-hidden'}">${sub}</span>` : nothing}
        <span class="visually-hidden">${kind}</span>
      </span>
    </button>`
    return html`${nodeButton}${counter ? this.renderCounter(surface, node, counter, card, spot, k, stop, quiet ?? false) : nothing}`
  }

  private renderCounter(
    surface: Surface,
    node: DrawnNode,
    counter: Counter,
    card: boolean,
    spot: { x: number; y: number; size: { width: number; height: number } },
    k: number,
    stop: boolean,
    quiet: boolean,
  ): TemplateResult {
    const enter = () => this.hover(surface, { node: node.id })
    const leave = () => this.leave(surface)
    const blur = () => {
      surface.focused = null
      this.leave(surface)
    }
    const width = this.counterWidth(counter.count, !card)
    // In a card at the end of its name line; on a mark on its rim, top right, clear of the
    // mark's own target.
    const at = card
      ? {
          x:
            spot.x +
            (spot.size.width * k) / 2 -
            this.unit(COUNTER.inset) * k -
            (counter.open ? COUNTER.size : width),
          y: spot.y - COUNTER.size / 2,
        }
      : { x: spot.x - 2, y: spot.y - MARK.radius - COUNTER.size + 2 }
    const sign = card ? COUNTER.sign : 10
    return html`<button type="button"
        class="lintje-graph__counter ${card ? '' : 'lintje-graph__counter--small'} ${counter.open ? 'is-open' : ''} ${quiet ? 'is-quiet' : ''}"
        tabindex=${stop ? 0 : -1}
        aria-label=${counter.label}
        aria-busy=${counter.busy ? 'true' : nothing}
        ${styleProps({ transform: `translate(${round(at.x)}px, ${round(at.y)}px)` })}
        @click=${() => this.toggle(node)}
        @pointerenter=${enter} @pointerleave=${leave}
        @focus=${() => {
          surface.focused = node.id
          this.requestUpdate()
        }}
        @blur=${blur}>${
          counter.busy
            ? html`<lintje-spinner size="16" current></lintje-spinner>`
            : counter.open
              ? renderIcon('functioneel-minus', { size: sign })
              : html`${renderIcon('functioneel-plus', { size: sign })}<span>${counter.count}</span>`
        }</button>`
  }

  /** What the tooltip says, for a node or a line; none for the chosen node, whose relations the host shows. */
  private tooltip(surface: Surface, level: Level): TemplateResult | typeof nothing {
    const tip = surface.tip
    const model = this.#model
    const data = this.data
    if (!tip || !model || !data) return nothing
    let title = ''
    let note = ''
    let lines: string[] = []
    if ('node' in tip) {
      const node = model.byId.get(tip.node)
      if (!node || tip.node === this.#selected || this.#hiddenTypes.has(node.type)) return nothing
      const type = typeOf(data.types, node.type)
      title = node.label
      const kind = node.status ? `${type.label}, ${node.status.label}` : type.label
      if (node.group) {
        const parent = model.byId.get(node.group.parent)?.label ?? ''
        note = `${node.group.members.length} bij ${parent}, klik om te openen`
        const names = node.group.members.map((id) => model.names.get(id) ?? id)
        lines = names.length > 4 ? [...names.slice(0, 4), `nog ${names.length - 4}`] : names
      } else {
        const hidden = this.#collapsed.has(node.id) ? (model.behind.get(node.id)?.length ?? 0) : 0
        const special = hidden
          ? `${hidden} ${hidden === 1 ? 'relatie' : 'relaties'} verborgen`
          : node.more
            ? `${node.more} relaties nog niet opgehaald`
            : ''
        note = special ? (level === 'card' ? special : `${kind}, ${special}`) : kind
        lines = relationLines(model, node.id)
      }
    } else {
      const edge = model.edges.find((item) => item.key === tip.edge)
      if (!edge) return nothing
      const from = model.byId.get(edge.from)?.label ?? edge.from
      const to = model.byId.get(edge.to)?.label ?? edge.to
      title =
        edge.direction === 'none'
          ? `${from} en ${to}`
          : edge.direction === 'both'
            ? `${from} ↔ ${to}`
            : `${from} → ${to}`
      const figure =
        edge.value != null ? `${formatNumber(edge.value)}${edge.unit ? ` ${edge.unit}` : ''}` : ''
      note = [edge.label || 'verbonden', figure].filter(Boolean).join(', ')
    }
    return html`<div class="lintje-tooltip lintje-graph__tip" role="tooltip">
      <p class="lintje-graph__tip-title">${title}</p>
      ${note ? html`<p class="lintje-graph__tip-note">${note}</p>` : nothing}
      ${lines.length ? html`<ul class="lintje-graph__tip-list">${lines.map((line) => html`<li>${line}</li>`)}</ul>` : nothing}
    </div>`
  }

  private controls(surface: Surface): TemplateResult {
    const buttons = [
      {
        label: 'Inzoomen',
        icon: 'functioneel-plus',
        text: '+',
        act: () => this.zoom(surface, ZOOM.step),
      },
      {
        label: 'Uitzoomen',
        icon: 'functioneel-minus',
        text: '−',
        act: () => this.zoom(surface, 1 / ZOOM.step),
      },
      {
        label: 'Passend',
        icon: 'functioneel-refresh',
        flip: 'horizontal' as const,
        text: 'Passend',
        act: () => {
          surface.view = null
          this.requestUpdate()
        },
      },
      ...(this.#selected && this.#model?.byId.has(this.#selected)
        ? [
            {
              label: 'Bij selectie',
              icon: 'functioneel-vergrootglas-plus',
              text: 'Bij selectie',
              act: () => this.zoomToSelection(surface),
            },
          ]
        : []),
    ]
    return html`<div class="lintje-graph__zoom">
      ${buttons.map((button) => {
        const glyph = renderIcon(button.icon, {
          size: 16,
          flip: 'flip' in button ? button.flip : undefined,
        })
        return html`<lintje-tooltip class="lintje-graph__zoom-tip" text=${button.label} placement="left" no-describe>
          <button type="button" class="lintje-graph__zoom-button" aria-label=${button.label}
                  @click=${button.act}>${glyph === nothing ? button.text : glyph}</button>
        </lintje-tooltip>`
      })}
    </div>`
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    this.placeTips()
    this.handFocus()
  }

  /** The node or counter in the drawing that holds the focus, with the node it belongs to. */
  private focusedPart(): FocusedPart | null {
    const active = this.shadowRoot?.activeElement as HTMLElement | null
    const surface = this.surfaces().find((item) => item.area?.contains(active))
    const owner = active?.dataset.node
      ? active
      : (active?.previousElementSibling as HTMLElement | null)
    const node = owner?.dataset.node
    if (!active || !surface || !node) return null
    return { surface, element: active, node, group: this.#model?.byId.get(node)?.group }
  }

  /**
   * A node or counter that held the focus and is gone, or fading, hands it on: to the node that
   * folded it away, to the first member of the group it opened, else to the centre.
   */
  private handFocus(): void {
    const before = this.#focusBefore
    this.#focusBefore = null
    const model = this.#model
    if (!before || !model) return
    if (before.element.isConnected && !before.element.matches('.is-leaving')) return
    const shown = (id: string | null | undefined) =>
      id &&
      before.surface.area?.querySelector<HTMLElement>(
        `[data-node="${CSS.escape(id)}"]:not(.is-leaving)`,
      )
    const folder = [...this.#collapsed].find((id) => model.behind.get(id)?.includes(before.node))
    const target =
      shown(before.node) ||
      shown(folder) ||
      shown(before.group?.members[0]) ||
      shown(before.group?.parent) ||
      shown(model.centre)
    // After the update, so the focus that follows is a change of its own.
    if (target) queueMicrotask(() => target.focus())
  }

  /** Each tooltip 12 px under its node or the pointer, above it when the room is too small. */
  private placeTips(): void {
    for (const surface of this.surfaces()) {
      const area = surface.area
      const tip = area?.querySelector<HTMLElement>('.lintje-graph__tip')
      if (!area || !tip || !surface.tip) continue
      let anchor: Rect
      if ('node' in surface.tip) {
        const node = area.querySelector(`[data-node="${CSS.escape(surface.tip.node)}"]`)
        const rect = (
          node?.matches('.lintje-graph__mark') ? node.querySelector('.lintje-graph__glyph') : node
        )?.getBoundingClientRect()
        if (!rect) continue
        anchor = rect
      } else {
        const box = area.getBoundingClientRect()
        const x = box.left + surface.tip.at.x
        const y = box.top + surface.tip.at.y
        anchor = { top: y, bottom: y, left: x, right: x, width: 0 }
      }
      const size = { width: tip.offsetWidth, height: tip.offsetHeight }
      stand(tip, place(anchor, size, viewport(), 'bottom-center', 12))
    }
  }
}

define('lintje-graph', LintjeGraph)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-graph': LintjeGraph
  }
}
