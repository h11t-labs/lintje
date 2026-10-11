/**
 * The map's surface: Leaflet carries the map — the projection, the panes, dragging, zooming and
 * the tiles of a basemap — and the design system draws the data itself, into Leaflet's svg
 * renderer (`marks.ts`). One instance hangs on the `ChartController`; `sync()` runs on every
 * render. Geometry is unprojected (`*.lonlat.json`) and projected here once, at the zoom the
 * map opens on; a pan or a zoom moves the drawing's group, not its paths.
 */
import * as L from 'leaflet'
import { nothing as nothingTemplate, render } from 'lit'
import type { ChartController } from '../shared/controller'
import { prefersReducedMotion } from '../../../../core/motion'
import { clearance, hidden, keyboardFocus, overlayBoxes, REVEAL_MARGIN, type Box } from './reveal'
import { mapDrawings, type MapDrawing } from './drawings'
import { renderData, renderRegion, type LandShape, type Project } from './marks'
import { distanceKm, flatRing, idsInArea, rectRing } from './area'
import { GEOS, type FeatureCollection } from './geo'
import type { MapArea, MapSpec, MapTool, MapValue, WmsBasemap } from '../shared/types'

// Leaflet's own prefix puts a flag in front of the credit; the attribution stays neutral.
const LEAFLET_PREFIX =
  '<a href="https://leafletjs.com" title="A JavaScript library for interactive maps">Leaflet</a>'

/** The whole area, 8 px off the edge. */
const HOME_PADDING: L.PointTuple = [8, 8]
/** How far in a map goes from its home: three doublings, eight times. */
const MAX_DOUBLINGS = 3
const SVG_NS = 'http://www.w3.org/2000/svg'
/**
 * How far a circle reaches before it takes in a pole, in km: past it Mercator cannot draw it as
 * one ring, so it grows no further.
 */
function poleReach([, lat]: [number, number]): number {
  return Math.max(1, (90 - Math.abs(lat)) * 111.2 - 100)
}

/** A press that moves less is a click: with a tool on, a click sets a point. */
const DRAG_SLACK = 4

/** A lasso point closer than this to the first closes the ring, in px. */
const CLOSE_PX = 10

/**
 * A symbol's place in the group, as CSS: a transform property, not the attribute, so that a zoom
 * animation can transition it. `data-at` holds the reference pixels the marks were drawn at.
 */
function symbolTransform(symbol: SVGGElement, scale: number): string {
  const [x, y] = (symbol.dataset.at ?? '0 0').split(' ')
  return `translate(${x}px, ${y}px) scale(${scale})`
}

/** Leaflet's zoom animation: `cubic-bezier(0, 0, 0.25, 1)`, sampled at a share `t` of its time. */
function leafletEase(t: number): number {
  // The curve's x for a parameter u, and the u that lands on t, by bisection.
  const x = (u: number) => 3 * 0.25 * (1 - u) * u * u + u * u * u
  const y = (u: number) => 3 * (1 - u) * u * u + u * u * u
  let low = 0
  let high = 1
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2
    if (x(mid) < t) low = mid
    else high = mid
  }
  return y((low + high) / 2)
}

/**
 * The easing that keeps a symbol's size while the svg around it scales by `ratio` along
 * Leaflet's curve: the product of the two must stay one, so the symbol's progress `g` follows
 * `r·e / (1 + (r − 1)·e)` for the svg's progress `e`.
 */
function reciprocalEasing(ratio: number): string {
  const steps = 16
  const points: string[] = []
  for (let i = 0; i <= steps; i++) {
    const e = leafletEase(i / steps)
    points.push(((ratio * e) / (1 + (ratio - 1) * e)).toFixed(4))
  }
  return `linear(${points.join(', ')})`
}

export interface LeafletSyncOptions {
  unit: string
  active: string | null
  /** The series the legend switched off, as `seriesKey()` names them. */
  hidden: string[]
  /** The layers of a stack switched off, by their place in it. */
  hiddenLayers: number[]
  /** The area that chose marks, and the marks it chose. */
  area: MapArea | null
  chosen: string[]
  /** The drawing tool that is on, and what a finished area goes to. */
  tool: MapTool | null
  drawn: (area: MapArea) => void
  /** Escape with no area being drawn: the tool goes off. */
  stopTool: () => void
  /** Panning with the mouse, and zooming by double click and pinch; the host may switch them off. */
  drag: boolean
  zoom: boolean
  /** The scale bar shows: a move redraws the map so it follows. */
  scale: boolean
  select: (value: MapValue) => void
  clear: () => void
  /** Below 768 px, where a one-finger drag belongs to the page (rule 9). */
  mobile: boolean
}

function boundsOf(collection: FeatureCollection): L.LatLngBounds {
  const [west, south, east, north] = collection.bbox ?? [-180, -85, 180, 85]
  return L.latLngBounds([south, west], [north, east])
}

/** The shapes of the geometry as paths in reference pixels. */
function landOf(collection: FeatureCollection, project: Project): LandShape[] {
  return collection.features.map((feature) => ({
    id: feature.properties.id,
    name: feature.properties.name,
    d: feature.geometry.coordinates
      .flatMap((polygon) => polygon)
      .map(
        (ring) =>
          ring
            .map(([lon, lat], n) => {
              const [x, y] = project(lon, lat)
              return `${n ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`
            })
            .join('') + 'Z',
      )
      .join(''),
  }))
}

export class LeafletSurface {
  readonly #controller: ChartController
  #container: HTMLElement | null = null
  #map: L.Map | null = null
  #tiles: L.TileLayer | null = null
  #attribution: L.Control.Attribution | null = null
  /** The design system's own group in Leaflet's svg, holding the whole drawing. */
  #group: SVGGElement | null = null
  /** The area being drawn, over the drawing, placed as it is. */
  #draftGroup: SVGGElement | null = null
  #draft: {
    area: MapArea
    /** A rectangle's first corner; its ring follows the pointer from there. */
    corner: [number, number] | null
    /** Where the press began, in client pixels, while the pointer is down. */
    press: { x: number; y: number } | null
    dragged: boolean
  } | null = null
  #resize: ResizeObserver | null = null
  #basemapKey = ''
  #geo = ''
  #home: L.LatLngBounds | null = null
  #framed = false
  /** The zoom the drawing is projected at; the group's transform takes it to the current one. */
  #referenceZoom = 0
  #land: LandShape[] = []
  #options: LeafletSyncOptions = {
    unit: '',
    active: null,
    hidden: [],
    hiddenLayers: [],
    area: null,
    chosen: [],
    tool: null,
    drawn: () => {},
    stopTool: () => {},
    drag: true,
    zoom: true,
    scale: false,
    select: () => {},
    clear: () => {},
    mobile: false,
  }
  #data: MapSpec | null = null

  constructor(controller: ChartController) {
    this.#controller = controller
  }

  /** The Leaflet map, once the container has a size; a test looks at it. */
  get map(): L.Map | null {
    return this.#map
  }

  /**
   * `ref` callback for the container. The map is built by the `ResizeObserver`, not here: Lit
   * commits a `ref` while the node is in its template fragment (0 × 0), and Leaflet would write
   * `position: relative` over the stylesheet.
   */
  readonly attach = (element: Element | undefined): void => {
    if (element === this.#container) return
    this.destroy()
    if (!(element instanceof HTMLElement)) return
    this.#container = element
    // Leaflet measures only when told to, so a box change needs the observer too.
    this.#resize = new ResizeObserver(() => this.#onResize())
    this.#resize.observe(element)
    // A box that has its size already (a test without layout) does not wait for the observer.
    this.#onResize()
  }

  /** Applying synchronously is deliberate: a selection must land in the frame of its panel. */
  sync(data: MapSpec, options: LeafletSyncOptions): void {
    this.#data = data
    this.#options = options
    if (this.#container && this.#map) this.#apply(data)
    else this.#onResize()
  }

  #onResize(): void {
    const container = this.#container
    if (!container || !container.clientWidth || !container.clientHeight) return
    if (this.#map) {
      this.#map.invalidateSize({ animate: false })
      this.#limits()
      return
    }
    if (this.#data) this.#apply(this.#data)
  }

  zoomIn(): void {
    this.#map?.zoomIn()
  }

  zoomOut(): void {
    this.#map?.zoomOut()
  }

  /** A wheel with its key: so many doublings around the pointer, fractional. */
  zoomBy(event: MouseEvent, doublings: number): void {
    const map = this.#map
    if (!map) return
    const zoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), map.getZoom() + doublings))
    map.setZoomAround(map.mouseEventToContainerPoint(event), zoom, { animate: false })
  }

  /**
   * The scale bar: a round distance in metres (1, 2 or 5 times a power of ten), at most `room`
   * px wide, measured across the middle of the view, where Mercator's scale holds for what the
   * reader looks at.
   */
  scaleBar(room = 96): { width: number; metres: number } | null {
    const map = this.#map
    if (!map || !this.#framed) return null
    const y = map.getSize().y / 2
    const metres = map.distance(
      map.containerPointToLatLng([0, y]),
      map.containerPointToLatLng([room, y]),
    )
    if (!(metres > 0)) return null
    const step = 10 ** Math.floor(Math.log10(metres))
    const lead = metres / step
    const round = (lead >= 5 ? 5 : lead >= 2 ? 2 : 1) * step
    return { width: Math.round((room * round) / metres), metres: round }
  }

  home(): void {
    this.#controller.leafletView = null
    if (this.#map && this.#home) this.#map.fitBounds(this.#home, { padding: HOME_PADDING })
  }

  destroy(): void {
    document.removeEventListener('keydown', this.#onEscape, true)
    this.#resize?.disconnect()
    this.#resize = null
    this.#map?.remove()
    this.#map = null
    this.#tiles = null
    this.#attribution = null
    this.#group = null
    this.#draftGroup = null
    this.#draft = null
    this.#basemapKey = ''
    this.#geo = ''
    this.#land = []
    this.#framed = false
    this.#container = null
  }

  #apply(data: MapSpec): void {
    const map = this.#ensureMap()
    // Leaflet's drag calls `preventDefault` on every touchmove, which would swallow the
    // page's scroll on a phone. Pinch, double tap and the tile's buttons still zoom.
    // A tool takes the pointer: dragging draws, and a double click closes a lasso.
    const drawing = this.#options.tool != null
    const { drag, zoom } = this.#options
    if (this.#options.mobile || drawing || !drag) map.dragging.disable()
    else map.dragging.enable()
    if (drawing || !zoom) map.doubleClickZoom.disable()
    else map.doubleClickZoom.enable()
    if (zoom) map.touchZoom.enable()
    else map.touchZoom.disable()
    this.#container?.classList.toggle('is-drawing', drawing)
    if (!drawing && this.#draft) this.#cancelDraft()
    // Drawing keeps the focus where it was, so Escape is heard on the document while a tool is on.
    if (drawing) document.addEventListener('keydown', this.#onEscape, true)
    else document.removeEventListener('keydown', this.#onEscape, true)
    this.#ensureGeo(map, data.geo ?? 'world')
    if (data.basemap) this.#ensureTiles(map, data.basemap)
    else this.#dropTiles(map)
    this.#draw(map, data)
  }

  #ensureMap(): L.Map {
    if (this.#map) return this.#map
    const container = this.#container as HTMLElement
    const map = L.map(container, {
      zoomControl: false,
      // Leaflet's own wheel zoom is off: the map's area handles the wheel, with its key, so a
      // page scrolling past the map is not caught by it.
      scrollWheelZoom: false,
      // Fractional zoom, so `fitBounds` fills the tile instead of snapping to a whole zoom.
      zoomSnap: 0,
      // The credit is a condition of a basemap's tiles; without them there is nothing to credit.
      attributionControl: false,
      // The view stays over the map, as far as the zoom allows.
      maxBoundsViscosity: 1,
    })
    map.on('moveend zoomend viewreset', () => {
      this.#place()
      this.#remember()
      // The scale bar is the map's own markup: it follows a move with a render.
      if (this.#options.scale) this.#controller.requestUpdate()
    })
    map.on('zoomend', () => this.#bound())
    map.on('zoomanim', (event) => this.#glide((event as L.ZoomAnimEvent).zoom))
    // A click on a mark stops at the mark (`marks.ts`), or one gesture would select and clear.
    map.on('click', () => this.#options.clear())
    // A tool on: the pointer draws. Taken in the capture phase, before a mark or Leaflet sees it.
    container.addEventListener('pointerdown', (event) => this.#press(event), true)
    container.addEventListener('pointermove', (event) => this.#move(event), true)
    container.addEventListener('pointerup', (event) => this.#release(event), true)
    container.addEventListener('click', (event) => this.#swallow(event), true)
    container.addEventListener('dblclick', (event) => this.#closeLasso(event), true)
    // The renderer's svg holds the drawing; Leaflet positions it in layer points and scales it
    // along with a zoom animation. It exists once the map has a view.
    L.svg({ padding: 0.5 }).addTo(map)
    this.#map = map
    return map
  }

  /** The design system's own group in the renderer's svg, once. */
  #ensureGroup(map: L.Map): SVGGElement | null {
    if (this.#group) return this.#group
    const svg = map.getPane('overlayPane')?.querySelector('svg')
    if (!svg) return null
    const group = document.createElementNS(SVG_NS, 'g')
    group.setAttribute('class', 'lintje-map-chart__data')
    group.addEventListener('focusin', (event) => this.#reveal(event.target as Element))
    group.addEventListener('keydown', (event) => {
      // A choice opens the selection panel, which may stand over the chosen mark.
      if (event.key !== 'Enter' && event.key !== ' ') return
      const mark = event.target as Element
      requestAnimationFrame(() => this.#reveal(mark))
    })
    svg.append(group)
    this.#group = group
    const draft = document.createElementNS(SVG_NS, 'g')
    draft.setAttribute('class', 'lintje-map-chart__draft')
    svg.append(draft)
    this.#draftGroup = draft
    return group
  }

  /** The geometry: its home, the bounds the view keeps to, and a fresh projection of its land. */
  #ensureGeo(map: L.Map, geo: string): void {
    if (geo === this.#geo) return
    // Another geometry: the view kept for the old one has nowhere to go.
    if (this.#geo) this.#controller.leafletView = null
    this.#geo = geo
    this.#home = boundsOf(GEOS[geo] ?? GEOS.world)
    this.#framed = false
    this.#frame()
    this.#referenceZoom = map.getZoom()
    this.#land = landOf(GEOS[geo] ?? GEOS.world, this.#project)
  }

  /** The opening view, once per geometry; the container has a size, or `fitBounds` zooms deepest. */
  #frame(): void {
    const map = this.#map
    if (this.#framed || !map || !this.#home) return
    this.#framed = true
    this.#limits()
    const kept = this.#controller.leafletView
    if (kept) map.setView([kept.lat, kept.lon], kept.zoom, { animate: false })
    else map.fitBounds(this.#home, { padding: HOME_PADDING })
    this.#bound()
  }

  /** Out no further than the whole area, in three doublings past it. */
  #limits(): void {
    const map = this.#map
    if (!map || !this.#home) return
    const min = map.getBoundsZoom(this.#home, false, L.point(HOME_PADDING))
    map.setMinZoom(min)
    map.setMaxZoom(min + MAX_DOUBLINGS)
    this.#bound()
  }

  /**
   * The view's middle stays over the area: its bounds grown by half the view on every side, at
   * this zoom. The area's own bounds would leave a wide tile almost no room to pan sideways.
   */
  #bound(): void {
    const map = this.#map
    if (!map || !this.#home) return
    const zoom = map.getZoom()
    if (!Number.isFinite(zoom)) return
    const half = map.getSize().divideBy(2)
    const northWest = map.project(this.#home.getNorthWest(), zoom).subtract(half)
    const southEast = map.project(this.#home.getSouthEast(), zoom).add(half)
    map.setMaxBounds(L.latLngBounds(map.unproject(northWest, zoom), map.unproject(southEast, zoom)))
  }

  #remember(): void {
    const map = this.#map
    if (!map || !this.#framed) return
    const centre = map.getCenter()
    this.#controller.leafletView = { lat: centre.lat, lon: centre.lng, zoom: map.getZoom() }
  }

  readonly #project: Project = (lon, lat) => {
    const point = (this.#map as L.Map).project([lat, lon], this.#referenceZoom)
    return [point.x, point.y]
  }

  #ensureTiles(map: L.Map, basemap: WmsBasemap): void {
    const key = [
      basemap.url,
      basemap.layers,
      basemap.format,
      basemap.version,
      basemap.transparent,
      basemap.attribution,
    ].join('|')
    if (this.#tiles && key === this.#basemapKey) return
    if (this.#tiles) map.removeLayer(this.#tiles)
    this.#basemapKey = key
    this.#attribution ??= L.control.attribution({ prefix: LEAFLET_PREFIX }).addTo(map)
    this.#tiles = L.tileLayer.wms(basemap.url, {
      layers: basemap.layers,
      format: basemap.format ?? 'image/png',
      // 1.3.0 asks for `CRS=EPSG:3857`, not the 1.1.1 `SRS=`.
      version: basemap.version ?? '1.3.0',
      transparent: basemap.transparent ?? false,
      attribution: basemap.attribution,
      // One world, not a row of them: the repeat reads as data.
      noWrap: true,
    })
    this.#tiles.addTo(map)
  }

  #dropTiles(map: L.Map): void {
    if (this.#tiles) map.removeLayer(this.#tiles)
    this.#tiles = null
    this.#basemapKey = ''
    this.#attribution?.remove()
    this.#attribution = null
  }

  /** The drawings the legend has not switched off. */
  #visibleDrawings(data: MapSpec): MapDrawing[] {
    return mapDrawings(data, this.#options.unit).filter(
      (drawing) => !this.#options.hiddenLayers.includes(drawing.index),
    )
  }

  /** The drawing, over again on every sync; Lit touches only what changed. */
  #draw(map: L.Map, data: MapSpec): void {
    const group = this.#ensureGroup(map)
    if (!group) return
    render(
      renderData(
        this.#land,
        mapDrawings(data, this.#options.unit),
        {
          id: this.#controller.id,
          active: this.#options.active,
          controller: this.#controller,
          select: this.#options.select,
          project: this.#project,
          tiled: Boolean(data.basemap),
          hidden: new Set(this.#options.hidden),
          hiddenLayers: new Set(this.#options.hiddenLayers),
          chosen: new Set(this.#options.chosen),
        },
        this.#options.area,
      ),
      group,
    )
    // An area chose: what it did not choose steps back, as while it was drawn. Something is
    // chosen, a mark or an area: the flows not chosen step back.
    group.classList.toggle('has-area', this.#options.area != null)
    group.classList.toggle(
      'has-selection',
      this.#options.area != null || this.#options.active != null,
    )
    this.#place(map)
  }

  /**
   * Puts the drawing where the view is: a layer point is the reference pixel scaled to the zoom,
   * less the pixel origin. A symbol keeps its pixel size by scaling back; so does the hatch.
   */
  #place(map = this.#map): void {
    const group = this.#group
    if (!map || !group) return
    const scale = map.getZoomScale(map.getZoom(), this.#referenceZoom)
    const origin = map.getPixelOrigin()
    const transform = `translate(${-origin.x} ${-origin.y}) scale(${scale})`
    group.setAttribute('transform', transform)
    this.#draftGroup?.setAttribute('transform', transform)
    const inverse = 1 / scale
    for (const symbol of this.#symbols()) {
      symbol.style.transitionTimingFunction = ''
      symbol.style.transform = symbolTransform(symbol, inverse)
    }
    group
      .querySelector('.lintje-map-chart__hatch')
      ?.setAttribute('patternTransform', `rotate(45) scale(${inverse})`)
  }

  /**
   * A zoom animation is Leaflet scaling the svg over a quarter second; a symbol scales back along
   * the reciprocal of that curve, so its size holds through the animation instead of jumping at
   * its end. Position is in the group's own units and needs no move.
   */
  #glide(zoom: number): void {
    const map = this.#map
    const group = this.#group
    if (!map || !group) return
    const ratio = map.getZoomScale(zoom, map.getZoom())
    const inverse = 1 / map.getZoomScale(zoom, this.#referenceZoom)
    const easing = reciprocalEasing(ratio)
    for (const symbol of this.#symbols()) {
      symbol.style.transitionTimingFunction = easing
      symbol.style.transform = symbolTransform(symbol, inverse)
    }
  }

  /* --- Drawing an area --------------------------------------------------- */

  #lonLat(event: MouseEvent): [number, number] {
    const at = (this.#map as L.Map).mouseEventToLatLng(event)
    return [at.lng, at.lat]
  }

  /**
   * A press with a tool on starts an area, or, between clicks, adds to it: a drag draws the whole
   * area in one stroke; clicks set a lasso's corners one by one, a circle's middle and then its
   * edge, or a rectangle's two corners, for a pointer that does not drag (WCAG 2.5.7).
   */
  #press(event: PointerEvent): void {
    const tool = this.#options.tool
    if (!tool || !this.#map || event.button !== 0) return
    event.stopPropagation()
    event.preventDefault()
    const point = this.#lonLat(event)
    const draft = this.#draft
    if (!draft) {
      this.#draft = {
        area:
          tool === 'circle'
            ? { kind: 'circle', centre: point, radiusKm: 0 }
            : { kind: 'lasso', ring: [point] },
        corner: tool === 'rect' ? point : null,
        press: { x: event.clientX, y: event.clientY },
        dragged: false,
      }
    } else {
      draft.press = { x: event.clientX, y: event.clientY }
      draft.dragged = false
    }
    ;(event.target as Element).setPointerCapture?.(event.pointerId)
    this.#renderDraft()
  }

  #move(event: PointerEvent): void {
    const draft = this.#draft
    if (!draft || !this.#map) return
    event.stopPropagation()
    const point = this.#lonLat(event)
    const { area, press } = draft
    if (press && !draft.dragged) {
      if (Math.abs(event.clientX - press.x) + Math.abs(event.clientY - press.y) < DRAG_SLACK) return
      draft.dragged = true
    }
    if (area.kind === 'circle')
      area.radiusKm = Math.min(distanceKm(area.centre, point), poleReach(area.centre))
    else if (draft.corner) area.ring = rectRing(draft.corner, point)
    else if (press) area.ring.push(point)
    else this.#renderDraft(point)
    if (area.kind === 'circle' || draft.corner || press) this.#renderDraft()
  }

  #release(event: PointerEvent): void {
    const draft = this.#draft
    if (!draft) return
    event.stopPropagation()
    const { area, dragged } = draft
    draft.press = null
    if (dragged) return this.#finish()
    // A click: the circle's edge after its middle, a rectangle's second corner, or a lasso's
    // next corner, or its close.
    if (area.kind === 'circle') {
      if (area.radiusKm > 0) this.#finish()
      return
    }
    const point = this.#lonLat(event)
    if (draft.corner) {
      if (this.#notSame(draft.corner, point)) {
        area.ring = rectRing(draft.corner, point)
        this.#finish()
      }
      return
    }
    if (area.ring.length > 2 && this.#nearFirst(event)) return this.#finish()
    if (area.ring.length > 1 || this.#notSame(area.ring[0], point)) area.ring.push(point)
    this.#renderDraft()
  }

  #notSame(a: [number, number], b: [number, number]): boolean {
    return a[0] !== b[0] || a[1] !== b[1]
  }

  #nearFirst(event: MouseEvent): boolean {
    const map = this.#map as L.Map
    const area = this.#draft?.area
    if (area?.kind !== 'lasso') return false
    const [lon, lat] = area.ring[0]
    const first = map.latLngToContainerPoint([lat, lon])
    return first.distanceTo(map.mouseEventToContainerPoint(event)) <= CLOSE_PX
  }

  /** With a tool on, the click that ends a press is the drawing's, not a mark's or the map's. */
  #swallow(event: MouseEvent): void {
    if (this.#options.tool) event.stopPropagation()
  }

  #closeLasso(event: MouseEvent): void {
    if (!this.#options.tool) return
    event.stopPropagation()
    event.preventDefault()
    const area = this.#draft?.area
    if (area?.kind === 'lasso' && area.ring.length > 2) this.#finish()
  }

  #finish(): void {
    const area = this.#draft?.area
    this.#cancelDraft()
    if (!area) return
    // A ring of fewer than three corners, a flat rectangle or a circle without a radius chooses
    // nothing.
    const drawn =
      area.kind === 'lasso' ? area.ring.length > 2 && !flatRing(area.ring) : area.radiusKm > 0
    if (drawn) this.#options.drawn(area)
  }

  /** Escape stops what is being drawn, and otherwise the tool. */
  readonly #onEscape = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !this.#options.tool) return
    event.stopPropagation()
    event.preventDefault()
    if (this.#draft) this.#cancelDraft()
    else this.#options.stopTool()
  }

  #cancelDraft(): void {
    this.#draft = null
    if (this.#draftGroup) render(nothingTemplate, this.#draftGroup)
    cancelAnimationFrame(this.#previewFrame)
    this.#preview(null)
  }

  /** The symbols of the drawing and of the area being drawn: what keeps its size in pixels. */
  #symbols(): SVGGElement[] {
    return [this.#group, this.#draftGroup].flatMap((group) =>
      group ? [...group.querySelectorAll<SVGGElement>('.lintje-map-chart__symbol')] : [],
    )
  }

  /** The area while it is drawn; a lasso between clicks runs on to the pointer. */
  #renderDraft(pointer?: [number, number]): void {
    const draft = this.#draft
    if (!draft || !this.#draftGroup) return
    const area: MapArea =
      pointer && draft.area.kind === 'lasso'
        ? { kind: 'lasso', ring: [...draft.area.ring, pointer] }
        : draft.area
    render(renderRegion(area, this.#project, true), this.#draftGroup)
    this.#place()
    this.#schedulePreview(area)
  }

  #previewFrame = 0

  /** What the area would choose, lit while it is drawn; once a frame, as a drag moves often. */
  #schedulePreview(area: MapArea | null): void {
    cancelAnimationFrame(this.#previewFrame)
    this.#previewFrame = requestAnimationFrame(() => this.#preview(area))
  }

  #preview(area: MapArea | null): void {
    const group = this.#group
    const data = this.#data
    if (!group || !data) return
    const usable =
      area &&
      (area.kind === 'lasso' ? area.ring.length > 2 : area.radiusKm > 0) &&
      this.#draft != null
    const ids = new Set(usable ? idsInArea(area, this.#visibleDrawings(data), data.geo) : [])
    for (const mark of group.querySelectorAll('[data-mark-id]'))
      mark.classList.toggle('is-preview', ids.has(mark.getAttribute('data-mark-id')!))
    group.classList.toggle('is-previewing', usable === true)
  }

  /**
   * Pans the keyboard's mark into the view, clear of the overlays (WCAG 2.4.11): a mark off the
   * view would still be a Tab stop.
   */
  #reveal(element: Element): void {
    const map = this.#map
    const container = this.#container
    if (!map || !container || !keyboardFocus(element)) return
    const origin = container.getBoundingClientRect()
    const rect = element.getBoundingClientRect()
    const box: Box = {
      left: rect.left - origin.left,
      right: rect.right - origin.left,
      top: rect.top - origin.top,
      bottom: rect.bottom - origin.top,
    }
    const size = map.getSize()
    const view: Box = { left: 0, top: 0, right: size.x, bottom: size.y }
    const overlays = container.parentElement
      ? overlayBoxes(container.parentElement).map((overlay) => ({
          left: overlay.left - origin.left,
          right: overlay.right - origin.left,
          top: overlay.top - origin.top,
          bottom: overlay.bottom - origin.top,
        }))
      : []
    const animate = !prefersReducedMotion()
    const shift = clearance(box, view, overlays, REVEAL_MARGIN)
    if (shift) {
      if (shift[0] || shift[1]) map.panBy([-shift[0], -shift[1]], { animate })
      return
    }
    // Larger than the room between the overlays: only a mark nothing of shows moves, to the middle.
    if (!hidden(box, view, overlays)) return
    map.panBy([(box.left + box.right) / 2 - size.x / 2, (box.top + box.bottom) / 2 - size.y / 2], {
      animate,
    })
  }
}
