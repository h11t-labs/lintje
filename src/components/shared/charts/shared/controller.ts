/**
 * The state a chart needs between renders; the charts themselves are render functions.
 * The host (a Lit element) creates one controller per chart and passes it in `ChartOptions`.
 */
import { lengthPx } from '../../../../core/length'
import { FrameResizeObserver } from '../../frame-resize-observer'
import { DEFAULT_PLOT_AREA, type PlotArea } from './scale'
// Type-only, so the module cycle (leaflet.ts needs this file) is erased at build.
import type { LeafletSurface } from '../map-chart/leaflet'
import type { ChartSelection } from './mark-select'
import type { SeriesKey } from './series-shapes'
import type { KeyMark } from './axes'
import type { MapArea, MapTool } from './types'
import { uniqueId } from '../../../../core/id'

/** What every `render*` takes besides its data. */
export interface ChartOptions {
  /** The state this chart keeps between renders. One per chart. */
  controller: ChartController
  /** The chart's `<desc>`: a readable summary, the accessible alternative. Required. */
  description: string
  /** Phone representation (below 768 px). The host decides, by media query. */
  mobile?: boolean
  /** Fixed px height, instead of the `--chart-h-main` / `--chart-h-small` token. */
  height?: number
  /** A plot area of your own, instead of the measured one. */
  plotArea?: PlotArea
  /** Drawn in the expand modal: takes the modal body's height and a looser layout. */
  expanded?: boolean
  /** Cross-drill: the chosen mark's id. The chart keeps no selection of its own. */
  selectedId?: string | null
  /**
   * The host keeps a selection (cross-drill): a mark with a `href` chooses, a toggle. Without it
   * the mark goes to its `href`, a link, also when the host cancels the event to route itself.
   * Default: whether `selectedId` is given.
   */
  choosing?: boolean
  /**
   * A mark that carries a `href` was activated; `newTab` for a modifier or middle click. Without
   * this the marks stay inert.
   */
  onSelect?: (mark: ChartSelection, newTab?: boolean) => void
  /** The selection was undone (chosen mark again, or Escape); the id travels for focus. */
  onClear?: (previousId: string) => void
}

/** The plot area a chart draws in: default margins, the chart's overrides, the measured size. */
export function chartArea(options: ChartOptions, margins: Partial<PlotArea> = {}): PlotArea {
  if (options.plotArea) return options.plotArea
  return {
    ...DEFAULT_PLOT_AREA,
    ...margins,
    width: options.controller.width,
    height: options.controller.height,
  }
}

export interface TooltipRow {
  label: string
  value: string
  /** The swatch; a row without one is a plain figure. */
  color?: string
  /** A line above the row, which sums up the rows before it: a total. */
  divider?: boolean
  /** The series' shape instead of a square swatch, as its legend draws it. */
  symbol?: SeriesKey
  /**
   * Instead of a square swatch, as its legend draws it: a line, plain or dashed (a norm), or
   * dotted (a forecast); an open square for a forecast bar; a dumbbell's ring or dot.
   */
  marker?: 'line' | 'dashed' | 'dotted' | 'open' | KeyMark
  /** A quieter line under the row before it, such as a forecast's margin. */
  note?: boolean
  /** A muted word after the value, such as "buiten de as". */
  aside?: string
}
export interface TooltipContent {
  /** A line above the title, in the muted text: what the title is part of. */
  kicker?: string
  title: string
  /** A word after the title in the muted colour, such as "raming". */
  note?: string
  rows: TooltipRow[]
  /** The events at this category, under the values: their number and text. */
  events?: { number: number; label: string }[]
}
export interface TooltipState {
  x: number
  y: number
  content: TooltipContent
  /** `left` stands the tooltip left of `x`, for a mark whose right side carries its label. */
  side?: 'left'
  /** Where the tooltip ends when it does not fit right of `x`; centred when it fits neither. */
  flip?: number
}

/** What the chart asks the controller to watch; set by the chart, not by the host. */
export interface MeasureSpec {
  /** Follow the element's width with a `ResizeObserver` (every axis chart). */
  width?: boolean
  /** Fixed height in px, or a token read on the element itself, e.g. '--chart-h-main'. */
  height?: number | string
  /** The token is the height of the whole chart: legend, axis title and border come off it. */
  fit?: boolean
}

/**
 * How long the pointer's tooltip waits before it follows the pointer to another mark or goes:
 * on its way to the tooltip the pointer may cross a neighbour (WCAG 1.4.13).
 */
export const POINTER_GRACE = 200

/** Share of the element — or of the viewport, for an element taller than that — that must show. */
const VISIBLE_SHARE = 0.35
/** However much a chart carries around its drawing, the drawing keeps this. */
const MIN_DRAWING = 120
const STEPS = Array.from({ length: 21 }, (_, i) => i / 20)

export class ChartController {
  /** Stable per chart: `<desc>` and the hatch pattern are addressed by it. */
  readonly id = uniqueId('lintje-chart')

  /* Measurement ----------------------------------------------------------- */

  width = DEFAULT_PLOT_AREA.width
  height = DEFAULT_PLOT_AREA.height
  inView = false

  /* Interaction ----------------------------------------------------------- */

  tooltip: TooltipState | null = null
  /** The category under the pointer or the keyboard; `null` for none. */
  hoverIndex: number | null = null
  /** What the keyboard's tooltip says, for the chart's status region; empty otherwise. */
  status = ''
  /** Where the next arrow key starts while no category is shown: the place before new data. */
  keyFrom: number | null = null
  hiddenSeries: string[] = []
  /** The series the reader points at or focuses in the legend; `null` for none. */
  emphasis: string | null = null
  /** The layers of a stacked map switched off in its legend, by their place in the stack. */
  hiddenLayers: number[] = []
  /** The parts a treemap on a phone shows opened, by their id. */
  openParts: string[] = []
  selectedCell: { row: number; column: number } | null = null
  /** What a wheel without its modifier shows, until its timer clears it. */
  mapHint: string | null = null
  mapHintTimer: ReturnType<typeof setTimeout> | null = null
  mapSelection: string | null = null
  /** The drawing tool that is on: a pointer on the map then draws instead of panning. */
  mapTool: MapTool | null = null
  /** The tool the map's one select button shows: the last one used, until a shape is chosen. */
  mapLastTool: MapTool | null = null
  /** The keyboard's focus is in the map: the drawing hint speaks of the keys. */
  mapKeyboard = false
  /** The menu of tools stands open, and which row takes the focus once it has drawn. */
  mapMenuOpen = false
  mapMenuFocus: 'first' | 'last' | 'checked' | null = null
  /** A legend of more than three layers is unfolded. */
  mapLegendOpen = false
  /** The area that chose marks, and the last one the host sent, compared as JSON. */
  mapArea: MapArea | null = null
  /** The area that steps aside while a new one is drawn, to come back if that one is undone. */
  mapAreaAside: MapArea | null = null
  hostArea: string | undefined = undefined
  // The last `selectedId` the host sent: the map adopts a new one but owns its selection in
  // between, or the host's value would win every render and a click could never clear it.
  hostSelection: string | null | undefined = undefined
  /** The map's surface, created on the first render; `detach()` destroys it. */
  leaflet: LeafletSurface | null = null
  /** Centre and zoom of the Leaflet map. `detach()` keeps it so a re-attach does not reset. */
  leafletView: { lat: number; lon: number; zoom: number } | null = null

  /** What the pointer's tooltip stands for (a category, a mark); `undefined` for the keyboard's. */
  private pointerKey: unknown = undefined
  private pointerTimer: ReturnType<typeof setTimeout> | null = null
  private readonly notify: () => void
  /** The data last drawn, and as JSON once its reference changed. */
  private drawn: unknown = undefined
  private drawnJson = ''
  /** The chart's box, once attached; the map finds its own buttons in it. */
  element: HTMLElement | null = null
  private measuring: MeasureSpec = {}
  private resizeObserver: FrameResizeObserver | null = null
  private intersectionObserver: IntersectionObserver | null = null

  constructor(requestUpdate: () => void) {
    this.notify = requestUpdate
  }

  requestUpdate(): void {
    this.notify()
  }

  // The tokens sit on the element's `:host`, not the document, so they are read from the element.
  get fontFamily(): string {
    return this.element ? getComputedStyle(this.element).getPropertyValue('--font-ui') : ''
  }

  /**
   * What to measure; applied by `attach` once the element exists. A spec that changes under a
   * standing chart is read here, since Lit calls a stable `ref` only when the element changes.
   */
  measure(spec: MeasureSpec): void {
    const same =
      spec.width === this.measuring.width &&
      spec.height === this.measuring.height &&
      spec.fit === this.measuring.fit
    this.measuring = spec
    if (same || !this.element) return
    this.read()
    this.watchSize(this.element)
  }

  /**
   * `ref` callback for the chart's outermost element; a bound property, so lit keeps it.
   * The viewBox is set 1:1 to the measured pixels so text is not squeezed in a narrow tile.
   */
  readonly attach = (element: Element | undefined): void => {
    if (element === this.element) return
    // Not `detach()`: the Leaflet surface follows its own container, and dropping it here made
    // the next render build a second map, which took the focus from a mark.
    this.unwatch()
    if (!(element instanceof HTMLElement)) return
    this.element = element

    // Measured in the first frame: a paint at the default width springs back and mistimes the intro.
    this.read()
    this.watchSize(element)
    this.watchVisibility(element)
  }

  private watchSize(element: HTMLElement): void {
    if (!this.measuring.width) {
      this.resizeObserver?.disconnect()
      this.resizeObserver = null
      return
    }
    if (this.resizeObserver) return
    this.resizeObserver = new FrameResizeObserver(() => {
      const { width, height } = this
      this.read()
      // The height token can change without a size change (the modal sets it after layout).
      if (this.width !== width || this.height !== height) this.requestUpdate()
    })
    this.resizeObserver.observe(element)
  }

  /** Stop observing; the host calls it when the chart leaves the DOM for good. */
  detach(): void {
    this.unwatch()
    this.clearPointerTimer()
    if (this.mapHintTimer) clearTimeout(this.mapHintTimer)
    this.mapHintTimer = null
    this.leaflet?.destroy()
    this.leaflet = null
  }

  private unwatch(): void {
    this.unwatchEscape()
    this.resizeObserver?.disconnect()
    this.intersectionObserver?.disconnect()
    this.resizeObserver = null
    this.intersectionObserver = null
    this.element = null
  }

  /**
   * Called with the data before each drawing. New data closes the tooltip and empties the
   * status, which speak of the old data; the place stays as the keyboard's starting point.
   */
  follow(data: unknown): void {
    if (data === this.drawn) return
    const first = this.drawn === undefined
    const json = JSON.stringify(data) ?? ''
    this.drawn = data
    if (first || json === this.drawnJson) {
      this.drawnJson = json
      return
    }
    this.drawnJson = json
    this.keyFrom = this.hoverIndex ?? this.keyFrom
    this.hoverIndex = null
    this.status = ''
    this.tooltip = null
    this.clearPointerTimer()
    this.pointerKey = undefined
    this.unwatchEscape()
  }

  /* Tooltip --------------------------------------------------------------- */

  /**
   * The pointer on a mark without a keyboard place of its own (a map's mark, a heatmap's cell):
   * the tooltip stands at the middle of what shows of the mark, not at the pointer, relative to
   * the `data-tooltip-anchor`. `from` is the mark when it is not the event's `currentTarget`.
   */
  showTooltip(event: MouseEvent, content: TooltipContent, from?: Element): void {
    const target = from ?? event.currentTarget
    if (!(target instanceof Element)) return
    const anchor = target.closest('[data-tooltip-anchor]')
    if (!anchor) return
    this.pointTo(target, () => {
      const area = anchor.getBoundingClientRect()
      const box = target.getBoundingClientRect()
      this.showTooltipAt(
        (Math.max(box.left, area.left) + Math.min(box.right, area.right)) / 2 - area.left,
        (Math.max(box.top, area.top) + Math.min(box.bottom, area.bottom)) / 2 - area.top,
        content,
      )
    })
  }

  /**
   * The pointer is on the mark or category `key`, and `show` stands its tooltip. The same key
   * changes nothing; another waits `POINTER_GRACE`, so the pointer can cross a neighbour on its
   * way to the tooltip, and the tooltip under the pointer keeps it.
   */
  pointTo(key: unknown, show: () => void): void {
    this.clearPointerTimer()
    if (this.tooltip && key === this.pointerKey) return
    const go = () => {
      this.pointerTimer = null
      show()
      this.pointerKey = key
    }
    if (this.tooltip && this.pointerKey !== undefined) {
      this.pointerTimer = setTimeout(go, POINTER_GRACE)
    } else go()
  }

  /** The pointer left the marks: the tooltip goes after `POINTER_GRACE`, unless it reaches it. */
  pointerLeft(): void {
    this.clearPointerTimer()
    if (!this.tooltip || this.pointerKey === undefined) return
    this.pointerTimer = setTimeout(() => {
      this.pointerTimer = null
      this.hoverAt(null)
    }, POINTER_GRACE)
  }

  /** The pointer is on the tooltip: it stays, and goes once the pointer leaves it too. */
  enterTooltip(): void {
    this.clearPointerTimer()
  }

  leaveTooltip(): void {
    this.pointerLeft()
  }

  private clearPointerTimer(): void {
    if (this.pointerTimer) clearTimeout(this.pointerTimer)
    this.pointerTimer = null
  }

  /** The tooltip at a place relative to the `data-tooltip-anchor`: the keyboard's way in. */
  /** `place`: `left` stands it left of `x`; a number is where it ends when it does not fit right. */
  showTooltipAt(x: number, y: number, content: TooltipContent, place?: 'left' | number): void {
    this.pointerKey = undefined
    this.tooltip = {
      x,
      y,
      content,
      side: place === 'left' ? 'left' : undefined,
      flip: typeof place === 'number' ? place : undefined,
    }
    this.watchEscape()
    this.requestUpdate()
  }

  hideTooltip(): void {
    this.clearPointerTimer()
    this.pointerKey = undefined
    if (!this.tooltip) return
    this.tooltip = null
    this.unwatchEscape()
    this.requestUpdate()
  }

  /** No category under the pointer or the keyboard: the tooltip goes at once. */
  hoverAt(index: number | null): void {
    this.hoverIndex = index
    this.clearPointerTimer()
    this.pointerKey = undefined
    this.tooltip = null
    this.unwatchEscape()
    this.requestUpdate()
  }

  /**
   * Escape on the chart hides its tooltip, and only then is it the chart's: a second Escape
   * goes on to a selection or an enclosing modal. Returns whether it hid one.
   */
  dismiss(event: KeyboardEvent): boolean {
    if (event.key !== 'Escape' || !this.tooltip) return false
    event.stopPropagation()
    event.preventDefault()
    this.hideTooltip()
    return true
  }

  /*
   * A tooltip under a resting pointer is dismissed with Escape wherever the focus is (WCAG
   * 1.4.13), so the window is listened to while one shows, before anything else hears the key.
   * That Escape is the tooltip's: a window around it sees it prevented and stays open. One from
   * inside the chart is left to the chart's own `dismiss`.
   */
  private readonly onWindowKey = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !this.tooltip) return
    if (this.element && event.composedPath().includes(this.element)) return
    event.preventDefault()
    this.hideTooltip()
  }

  private watching = false

  private watchEscape(): void {
    if (this.watching || typeof window === 'undefined') return
    this.watching = true
    window.addEventListener('keydown', this.onWindowKey, true)
  }

  private unwatchEscape(): void {
    if (!this.watching) return
    this.watching = false
    window.removeEventListener('keydown', this.onWindowKey, true)
  }

  toggleLayer(index: number): void {
    this.hiddenLayers = this.hiddenLayers.includes(index)
      ? this.hiddenLayers.filter((x) => x !== index)
      : [...this.hiddenLayers, index]
    this.requestUpdate()
  }

  toggleOpen(id: string): void {
    this.openParts = this.openParts.includes(id)
      ? this.openParts.filter((x) => x !== id)
      : [...this.openParts, id]
    this.requestUpdate()
  }

  emphasise(label: string | null): void {
    if (this.emphasis === label) return
    this.emphasis = label
    this.requestUpdate()
  }

  toggleSeries(label: string): void {
    this.hiddenSeries = this.hiddenSeries.includes(label)
      ? this.hiddenSeries.filter((x) => x !== label)
      : [...this.hiddenSeries, label]
    this.requestUpdate()
  }

  /* --- internals --------------------------------------------------------- */

  private read(): void {
    const element = this.element
    if (!element) return
    if (this.measuring.width) {
      this.width = Math.max(160, Math.round(element.getBoundingClientRect().width))
    }
    const height = this.measuring.height
    if (typeof height === 'number') this.height = height
    else if (typeof height === 'string') {
      // Read on the element, not :root, so a local override (the modal's) is picked up.
      const value = Math.round(lengthPx(element, height, 0))
      if (value)
        this.height = this.measuring.fit ? Math.max(MIN_DRAWING, value - this.extras()) : value
    }
  }

  /**
   * What the chart draws around its drawing (legend, axis title, border).
   * Settles in one extra pass: the first read measures 0, the ResizeObserver then finds the
   * real number, and the next render leaves the element token-high.
   */
  private extras(): number {
    const element = this.element
    if (!element) return 0
    const around = element.getBoundingClientRect().height - this.height
    return around > 0 ? Math.ceil(around) : 0
  }

  /** `inView` gates the animations in chart.css; once only, and at once without the observer. */
  private watchVisibility(element: HTMLElement): void {
    if (this.inView) return
    if (typeof IntersectionObserver === 'undefined') {
      this.enter()
      return
    }
    this.intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        const viewport = entry.rootBounds?.height ?? window.innerHeight
        if (
          entry.intersectionRatio >= VISIBLE_SHARE ||
          entry.intersectionRect.height >= viewport * VISIBLE_SHARE
        ) {
          this.enter()
        }
      },
      { threshold: STEPS },
    )
    this.intersectionObserver.observe(element)
  }

  private enter(): void {
    this.intersectionObserver?.disconnect()
    this.intersectionObserver = null
    if (this.inView) return
    this.inView = true
    this.requestUpdate()
  }
}
