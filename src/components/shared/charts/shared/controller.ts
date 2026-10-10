/**
 * The state a chart needs between renders; the charts themselves are render functions.
 * The host (a Lit element) creates one controller per chart and passes it in `ChartOptions`.
 */
import { lengthPx } from '../../../../core/length'
import { DEFAULT_PLOT_AREA, type PlotArea } from './scale'
// Type-only, so the module cycle (leaflet.ts needs this file) is erased at build.
import type { LeafletSurface } from '../map-chart/leaflet'
import type { ChartSelection } from './mark-select'
import type { SeriesKey } from './series-shapes'
import type { MapArea, MapTool } from './types'

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
  /** A mark that carries a `href` was activated. Without this the marks stay inert. */
  onSelect?: (mark: ChartSelection) => void
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
}
export interface TooltipContent {
  title: string
  rows: TooltipRow[]
}
export interface TooltipState {
  x: number
  y: number
  content: TooltipContent
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

/** Share of the element — or of the viewport, for an element taller than that — that must show. */
const VISIBLE_SHARE = 0.35
/** However much a chart carries around its drawing, the drawing keeps this. */
const MIN_DRAWING = 120
const STEPS = Array.from({ length: 21 }, (_, i) => i / 20)

let sequence = 0

export class ChartController {
  /** Stable per chart: `<desc>` and the hatch pattern are addressed by it. */
  readonly id = `lintje-chart-${++sequence}`

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
  hiddenSeries: string[] = []
  /** The layers of a stacked map switched off in its legend, by their place in the stack. */
  hiddenLayers: number[] = []
  hoverSegment: number | null = null
  selectedCell: { row: number; column: number } | null = null
  dimmedClass: number | null = null
  /** What a wheel without its modifier shows, until its timer clears it. */
  mapHint: string | null = null
  mapHintTimer: ReturnType<typeof setTimeout> | null = null
  mapSelection: string | null = null
  /** The drawing tool that is on: a pointer on the map then draws instead of panning. */
  mapTool: MapTool | null = null
  /** The tool the map's one select button shows: the last one used, until a shape is chosen. */
  mapLastTool: MapTool | null = null
  /** The menu of tools stands open, and which row takes the focus once it has drawn. */
  mapMenuOpen = false
  mapMenuFocus: 'first' | 'last' | 'checked' | null = null
  /** A legend of more than three layers is unfolded. */
  mapLegendOpen = false
  /** The area that chose marks, and the last one the host sent, compared as JSON. */
  mapArea: MapArea | null = null
  hostArea: string | undefined = undefined
  // The last `selectedId` the host sent: the map adopts a new one but owns its selection in
  // between, or the host's value would win every render and a click could never clear it.
  hostSelection: string | null | undefined = undefined
  /** The map's surface, created on the first render; `detach()` destroys it. */
  leaflet: LeafletSurface | null = null
  /** Centre and zoom of the Leaflet map. `detach()` keeps it so a re-attach does not reset. */
  leafletView: { lat: number; lon: number; zoom: number } | null = null

  private readonly notify: () => void
  /** The chart's box, once attached; the map finds its own buttons in it. */
  element: HTMLElement | null = null
  private measuring: MeasureSpec = {}
  private resizeObserver: ResizeObserver | null = null
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
    this.resizeObserver = new ResizeObserver(() => {
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

  /* Tooltip --------------------------------------------------------------- */

  /**
   * Coordinates are relative to the `data-tooltip-anchor` element, not the svg's parent.
   * `from` starts the anchor search; Leaflet passes its container because its events
   * do not have the drawn shape as `currentTarget`.
   */
  showTooltip(event: MouseEvent, content: TooltipContent, from?: Element): void {
    const target = from ?? event.currentTarget
    if (!(target instanceof Element)) return
    const anchor = target.closest('[data-tooltip-anchor]')
    if (!anchor) return
    const box = anchor.getBoundingClientRect()
    this.showTooltipAt(event.clientX - box.left, event.clientY - box.top, content)
  }

  /** The tooltip at a place relative to the `data-tooltip-anchor`: the keyboard's way in. */
  showTooltipAt(x: number, y: number, content: TooltipContent): void {
    this.tooltip = { x, y, content }
    this.watchEscape()
    this.requestUpdate()
  }

  hideTooltip(): void {
    if (!this.tooltip) return
    this.tooltip = null
    this.unwatchEscape()
    this.requestUpdate()
  }

  hoverAt(index: number | null, event?: MouseEvent, content?: TooltipContent): void {
    this.hoverIndex = index
    if (event && content) this.showTooltip(event, content)
    else {
      this.tooltip = null
      this.unwatchEscape()
      this.requestUpdate()
    }
  }

  /**
   * Escape on the chart hides its tooltip, and only then is it the chart's: a second Escape
   * goes on to a selection or an enclosing modal. Returns whether it hid one.
   */
  dismiss(event: KeyboardEvent): boolean {
    if (event.key !== 'Escape' || !this.tooltip) return false
    event.stopPropagation()
    this.hideTooltip()
    return true
  }

  /*
   * A tooltip under a resting pointer is dismissed with Escape wherever the focus is (WCAG
   * 1.4.13), so the window is listened to while one shows. It does not stop the key.
   */
  private readonly onWindowKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.hideTooltip()
  }

  private watching = false

  private watchEscape(): void {
    if (this.watching || typeof window === 'undefined') return
    this.watching = true
    window.addEventListener('keydown', this.onWindowKey)
  }

  private unwatchEscape(): void {
    if (!this.watching) return
    this.watching = false
    window.removeEventListener('keydown', this.onWindowKey)
  }

  toggleLayer(index: number): void {
    this.hiddenLayers = this.hiddenLayers.includes(index)
      ? this.hiddenLayers.filter((x) => x !== index)
      : [...this.hiddenLayers, index]
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
