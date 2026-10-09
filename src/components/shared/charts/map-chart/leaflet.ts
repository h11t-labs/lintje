/**
 * The map's second rendering: the same data on a WMS basemap, drawn by Leaflet. One instance
 * hangs on the `ChartController`; `sync()` runs on every render and does nothing unless the
 * data changed. Geometry is unprojected (`*.lonlat.json`): Leaflet projects it itself.
 */
import * as L from 'leaflet'
import worldLonLat from '../../../../../assets/geo/world.lonlat.json'
import netherlandsLonLat from '../../../../../assets/geo/netherlands.lonlat.json'
import type { ChartController } from '../shared/controller'
import { formatNumber } from '../../../../core/format'
import { DEFAULT_SERIES_COLOR, seriesColor } from '../shared/colors'
import { markPath } from '../shared/series-shapes'
import { prefersReducedMotion } from '../../../../core/motion'
import { clearance, hidden, keyboardFocus, overlayBoxes, REVEAL_MARGIN, type Box } from './reveal'
import { mapDrawings, withUnit, type MapDrawing } from './drawings'
import type { MapTileData, MapValue, WmsBasemap } from '../shared/types'

type Drawn = L.Layer & { getElement(): Element | null | undefined }

type FeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.MultiPolygon,
  { id: string; name: string }
>

const GEOS: Record<string, FeatureCollection> = {
  world: worldLonLat as unknown as FeatureCollection,
  netherlands: netherlandsLonLat as unknown as FeatureCollection,
}

const CLASSES = 5

// Leaflet's own prefix puts a flag in front of the credit; the attribution stays neutral.
const LEAFLET_PREFIX =
  '<a href="https://leafletjs.com" title="A JavaScript library for interactive maps">Leaflet</a>'

const ARC_STEPS = 24
const ARC_BOW = 0.18

export interface LeafletSyncOptions {
  unit: string
  active: string | null
  select: (value: MapValue) => void
  clear: () => void
  /** Below 768 px, where a one-finger drag belongs to the page (rule 9). */
  mobile: boolean
}

function boundsOf(collection: FeatureCollection): L.LatLngBoundsExpression {
  const [west, south, east, north] = collection.bbox ?? [-180, -85, 180, 85]
  return [
    [south, west],
    [north, east],
  ]
}

function classFor(value: number, max: number): number {
  if (max <= 0) return 0
  return Math.min(CLASSES - 1, Math.floor((value / max) * CLASSES))
}

/** The flow as points on a quadratic curve, computed in longitude/latitude. */
function arc(from: L.LatLngTuple, to: L.LatLngTuple): L.LatLngTuple[] {
  const [aLat, aLon] = from
  const [bLat, bLon] = to
  const dLon = bLon - aLon
  const dLat = bLat - aLat
  const length = Math.hypot(dLon, dLat)
  if (length === 0) return [from, to]
  const sign = -dLon >= 0 ? 1 : -1
  const cLon = (aLon + bLon) / 2 + sign * dLat * ARC_BOW
  const cLat = (aLat + bLat) / 2 + sign * -dLon * ARC_BOW
  const points: L.LatLngTuple[] = []
  for (let i = 0; i <= ARC_STEPS; i++) {
    const t = i / ARC_STEPS
    const u = 1 - t
    points.push([
      u * u * aLat + 2 * u * t * cLat + t * t * bLat,
      u * u * aLon + 2 * u * t * cLon + t * t * bLon,
    ])
  }
  return points
}

export class LeafletSurface {
  readonly #controller: ChartController
  #container: HTMLElement | null = null
  #map: L.Map | null = null
  #tiles: L.TileLayer | null = null
  #overlays: L.LayerGroup | null = null
  #renderer: L.SVG | null = null
  #resize: ResizeObserver | null = null
  #paths = new Map<string, Drawn>()
  /** The flows: only they step back while another mark is chosen. */
  #mutes = new Set<string>()
  /** A stack rebuilds on its `plots`, a one-variant map on its `values`. */
  #built: (Pick<MapTileData, 'variant' | 'geo' | 'destination'> & { source: unknown }) | null = null
  #basemapKey = ''
  #home: L.LatLngBoundsExpression | null = null
  #framed = false
  #options: LeafletSyncOptions = {
    unit: '',
    active: null,
    select: () => {},
    clear: () => {},
    mobile: false,
  }
  #data: MapTileData | null = null

  constructor(controller: ChartController) {
    this.#controller = controller
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
  }

  /** Applying synchronously is deliberate: a selection must land in the frame of its panel. */
  sync(data: MapTileData, options: LeafletSyncOptions): void {
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

  home(): void {
    this.#controller.leafletView = null
    if (this.#map && this.#home) this.#map.fitBounds(this.#home, { padding: [8, 8] })
  }

  destroy(): void {
    this.#resize?.disconnect()
    this.#resize = null
    this.#map?.remove()
    this.#map = null
    this.#tiles = null
    this.#overlays = null
    this.#renderer = null
    this.#paths.clear()
    this.#mutes.clear()
    this.#built = null
    this.#basemapKey = ''
    this.#framed = false
    this.#container = null
  }

  #apply(data: MapTileData): void {
    const basemap = data.basemap
    if (!basemap) return
    const map = this.#ensureMap(data)
    // Leaflet's drag calls `preventDefault` on every touchmove, which would swallow the
    // page's scroll on a phone. Pinch, double tap and the tile's buttons still zoom.
    if (this.#options.mobile) map.dragging.disable()
    else map.dragging.enable()
    this.#ensureTiles(map, basemap)
    this.#ensureOverlays(map, data)
    // After the overlays: the renderer's `<svg>` exists only once the first shape is added.
    this.#installHatch(map)
    this.#applySelection()
  }

  #ensureMap(data: MapTileData): L.Map {
    if (this.#map) return this.#map
    const container = this.#container as HTMLElement
    // The wheel zoom is off: inside a scrolling dashboard it traps the reader.
    this.#renderer = L.svg({ padding: 0.5 })
    const map = L.map(container, {
      zoomControl: false,
      scrollWheelZoom: false,
      // Fractional zoom, so `fitBounds` fills the tile instead of snapping to a whole zoom.
      zoomSnap: 0,
      renderer: this.#renderer,
    })
    map.attributionControl.setPrefix(LEAFLET_PREFIX)
    map.on('moveend zoomend', () => this.#remember())
    // A click on a mark must not reach here: every path sets `bubblingMouseEvents: false`,
    // or one gesture would select and clear.
    map.on('click', () => this.#options.clear())
    this.#map = map
    this.#home = boundsOf(GEOS[data.geo ?? 'world'] ?? GEOS.world)
    this.#frame()
    return map
  }

  /** The opening view, once, and only with a sized container: `fitBounds` on 0 × 0 zooms deepest. */
  #frame(): void {
    const map = this.#map
    const container = this.#container
    if (this.#framed || !map || !container || !this.#home) return
    if (!container.clientWidth || !container.clientHeight) return
    this.#framed = true
    const kept = this.#controller.leafletView
    if (kept) map.setView([kept.lat, kept.lon], kept.zoom, { animate: false })
    else map.fitBounds(this.#home, { padding: [8, 8] })
  }

  #remember(): void {
    const map = this.#map
    if (!map || !this.#framed) return
    const centre = map.getCenter()
    this.#controller.leafletView = { lat: centre.lat, lon: centre.lng, zoom: map.getZoom() }
  }

  /** The hatch for "geen gegevens", an SVG pattern; `userSpaceOnUse` keeps it 6 px at every zoom. */
  #installHatch(map: L.Map): void {
    const svg = map.getPane('overlayPane')?.querySelector('svg')
    if (!svg || svg.querySelector('defs')) return
    const ns = 'http://www.w3.org/2000/svg'
    const defs = document.createElementNS(ns, 'defs')
    const pattern = document.createElementNS(ns, 'pattern')
    pattern.setAttribute('id', this.#hatchId)
    pattern.setAttribute('width', '6')
    pattern.setAttribute('height', '6')
    pattern.setAttribute('patternUnits', 'userSpaceOnUse')
    pattern.setAttribute('patternTransform', 'rotate(45)')
    const line = document.createElementNS(ns, 'line')
    line.setAttribute('x1', '0')
    line.setAttribute('y1', '0')
    line.setAttribute('x2', '0')
    line.setAttribute('y2', '6')
    line.setAttribute('stroke', 'var(--color-chart-hatch)')
    line.setAttribute('stroke-width', '2')
    pattern.appendChild(line)
    defs.appendChild(pattern)
    svg.insertBefore(defs, svg.firstChild)
  }

  get #hatchId(): string {
    return `map-hatch-${this.#controller.id}`
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

  #ensureOverlays(map: L.Map, data: MapTileData): void {
    const source = data.variant === 'plots' ? data.plots : data.values
    const built = this.#built
    if (
      built &&
      built.source === source &&
      built.variant === data.variant &&
      built.geo === data.geo &&
      built.destination === data.destination
    )
      return
    this.#built = { source, variant: data.variant, geo: data.geo, destination: data.destination }
    this.#overlays?.remove()
    this.#paths.clear()
    this.#mutes.clear()
    const group = L.layerGroup().addTo(map)
    this.#overlays = group

    // The first drawing lands at the bottom and the last on top; a marker stands in Leaflet's
    // marker pane, over every path. A choropleth is the land on the svg map, so here too it
    // lies under the rest.
    const drawings = mapDrawings(data, this.#options.unit)
    const choropleths = drawings.filter((drawing) => drawing.variant === 'choropleth')
    for (const drawing of [...choropleths, ...drawings.filter((d) => !choropleths.includes(d))]) {
      if (drawing.variant === 'choropleth') this.#drawAreas(group, data, drawing)
      else if (drawing.variant === 'polygons') this.#drawPolygons(group, drawing)
      else if (drawing.variant === 'flows') this.#drawFlows(group, drawing)
      else this.#drawPoints(group, drawing)
    }
  }

  /** The class of an area by its figure, or the hatch without one (rule 15). */
  #areaStyle(value: MapValue, drawing: MapDrawing): L.PathOptions {
    const missing = value.value == null
    const modifier = missing
      ? 'lintje-map-leaflet__area--no-data'
      : `lintje-map-leaflet__area--class-${classFor(value.value as number, drawing.max) + 1}`
    // The colour comes from the class in CSS; only the hatch is an attribute, because its
    // pattern is addressed by a generated id.
    return {
      className: `lintje-map-leaflet__area ${modifier}`,
      weight: 1,
      bubblingMouseEvents: false,
      ...(missing ? { fillColor: `url(#${this.#hatchId})` } : {}),
    }
  }

  /** Only the areas in the selection: the basemap is the land here. */
  #drawAreas(group: L.LayerGroup, data: MapTileData, drawing: MapDrawing): void {
    const collection = GEOS[data.geo ?? 'world'] ?? GEOS.world
    const byId = new Map(drawing.values.map((value) => [value.id, value]))
    for (const feature of collection.features) {
      const row = byId.get(feature.properties.id)
      if (!row) continue
      const layer = L.geoJSON(feature as unknown as GeoJSON.GeoJsonObject, {
        style: this.#areaStyle(row, drawing),
      })
      layer.addTo(group)
      this.#register(row, layer, drawing)
    }
  }

  /** Areas that carry their own outline, as the areas of a choropleth. */
  #drawPolygons(group: L.LayerGroup, drawing: MapDrawing): void {
    for (const value of drawing.values) {
      if (!value.polygon || value.polygon.length < 3) continue
      // The contract's pairs are [lon, lat]; Leaflet takes [lat, lon].
      const ring = value.polygon.map(([lon, lat]): L.LatLngTuple => [lat, lon])
      const layer = L.polygon(ring, this.#areaStyle(value, drawing))
      layer.addTo(group)
      this.#register(value, layer, drawing)
    }
  }

  #drawFlows(group: L.LayerGroup, drawing: MapDrawing): void {
    const destination = drawing.destination
    if (!destination) return
    const to: L.LatLngTuple = [destination.lat, destination.lon]
    for (const value of drawing.values) {
      if (value.lon == null || value.lat == null || value.value == null) continue
      const line = L.polyline(arc([value.lat, value.lon], to), {
        className: 'lintje-map-leaflet__flow',
        weight: 1 + (value.value / drawing.max) * 7,
        bubblingMouseEvents: false,
      })
      line.addTo(group)
      this.#mutes.add(value.id)
      this.#register(value, line, drawing)
    }
    L.circleMarker(to, {
      className: 'lintje-map-leaflet__destination',
      radius: 5,
      weight: 2,
      bubblingMouseEvents: false,
    })
      .bindTooltip(destination.label)
      .addTo(group)
  }

  /** A series needs a shape, which a circle cannot carry, so that mark is a marker with an icon. */
  #drawPoints(group: L.LayerGroup, drawing: MapDrawing): void {
    for (const value of drawing.values) {
      if (value.lon == null || value.lat == null) continue
      const missing = value.value == null
      // A point without a figure takes the picker's fixed size, never the size of zero (rule 15).
      const radius =
        drawing.variant === 'points' && !missing
          ? 3 + Math.sqrt((value.value as number) / drawing.max) * 15
          : 6
      const classes = `lintje-map-leaflet__point${missing ? ' lintje-map-leaflet__point--no-data' : ''}`
      const mark: Drawn = value.series
        ? L.marker([value.lat, value.lon], {
            keyboard: false,
            icon: L.divIcon({
              // No colour in this markup: `style-src 'self'` drops style attributes, so
              // `describe` sets the custom properties through the CSSOM.
              className: `lintje-map-leaflet__mark${missing ? ' lintje-map-leaflet__mark--no-data' : ''}`,
              iconSize: [radius * 2, radius * 2],
              iconAnchor: [radius, radius],
              html:
                `<svg viewBox="0 0 ${radius * 2} ${radius * 2}" width="${radius * 2}" height="${radius * 2}">` +
                `<path d="${markPath(value.series, radius, radius, radius)}" class="lintje-map-leaflet__mark-shape" /></svg>`,
            }),
          })
        : L.circleMarker([value.lat, value.lon], {
            className: classes,
            radius,
            weight: 1,
            bubblingMouseEvents: false,
            ...(missing ? { fillColor: `url(#${this.#hatchId})` } : {}),
          })
      mark.addTo(group)
      this.#register(value, mark, drawing)
    }
  }

  readonly #described = new WeakSet<Element>()

  /** The unit, the series name and the route come from the mark's own layer. */
  #register(value: MapValue, layer: Drawn | L.GeoJSON, drawing: MapDrawing): void {
    const path: Drawn =
      layer instanceof L.GeoJSON ? (layer.getLayers()[0] as unknown as Drawn) : layer
    this.#paths.set(value.id, path)
    layer.on('click', () => this.#options.select(value))
    // Tab order, name and Enter/space for every shape. Leaflet creates the <path> when the
    // layer is added, so this runs then and again on a redraw.
    const { unit, destination } = drawing
    const figure = value.value == null ? 'geen gegevens' : withUnit(formatNumber(value.value), unit)
    const seriesName = value.series ? drawing.seriesLabels?.[value.series] : undefined
    const describe = () => {
      const element = path.getElement()
      if (!element) return
      element.setAttribute('tabindex', '0')
      element.setAttribute('role', 'button')
      element.setAttribute('aria-pressed', String(this.#options.active === value.id))
      element.setAttribute('data-mark-id', value.id)
      element.setAttribute(
        'aria-label',
        `${value.label}: ${figure}${seriesName ? `, ${seriesName}` : ''}`,
      )
      if (value.series) {
        const colour = seriesColor(value.series) ?? ''
        const style = (element as HTMLElement).style
        style.setProperty('--lintje-series', colour)
        // Missing is never zero (rule 15): hatched, the outline keeps the series colour.
        style.setProperty(
          '--lintje-series-fill',
          value.value == null ? `url(#${this.#hatchId})` : colour,
        )
      }
      // Leaflet keeps the element across re-adds: one listener is enough.
      if (this.#described.has(element)) return
      this.#described.add(element)
      element.addEventListener('focus', () => this.#reveal(path, element))
      element.addEventListener('keydown', (event) => {
        const { key } = event as KeyboardEvent
        if (key === 'Enter' || key === ' ') {
          event.preventDefault()
          this.#options.select(value)
          // The selection panel opens, and may stand over the chosen mark.
          requestAnimationFrame(() => this.#reveal(path, element))
        }
      })
    }
    if (path.getElement()) describe()
    layer.on('add', describe)
    layer.on('mousemove', (event: L.LeafletMouseEvent) => {
      const label =
        drawing.variant === 'flows' && destination
          ? `${value.label} → ${destination.label}${value.detail ? ` · ${value.detail}` : ''}`
          : value.label
      this.#showTooltip(event.originalEvent, {
        title: label,
        rows: [
          {
            label: unit,
            value: value.value == null ? 'geen gegevens' : formatNumber(value.value),
            color: value.value == null ? 'var(--color-chart-hatch)' : DEFAULT_SERIES_COLOR,
          },
        ],
      })
    })
    layer.on('mouseout', () => this.#controller.hideTooltip())
  }

  /**
   * Pans the keyboard's mark into the view, clear of the overlays (WCAG 2.4.11): off the view
   * the renderer clips a path to nothing, and it would still be a Tab stop.
   */
  #reveal(path: Drawn, element: Element): void {
    const map = this.#map
    const container = this.#container
    if (!map || !container || !keyboardFocus(element)) return
    const origin = container.getBoundingClientRect()
    const box = this.#boxOf(map, path, element, origin)
    if (!box) return
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
    // Larger than the room between the overlays: only a mark nothing of shows moves, zooming
    // out as far as it needs.
    if (!hidden(box, view, overlays)) return
    if ('getLatLng' in path) map.panTo((path as unknown as L.Marker).getLatLng(), { animate })
    else if ('getBounds' in path)
      map.fitBounds((path as unknown as L.Polyline).getBounds(), {
        maxZoom: map.getZoom(),
        padding: [REVEAL_MARGIN, REVEAL_MARGIN],
        animate,
      })
  }

  /** Where the mark stands, from its geometry: a clipped path's own box is empty. */
  #boxOf(map: L.Map, path: Drawn, element: Element, origin: DOMRect): Box | null {
    if ('getRadius' in path) {
      const centre = map.latLngToContainerPoint((path as unknown as L.CircleMarker).getLatLng())
      const radius = (path as unknown as L.CircleMarker).getRadius()
      return {
        left: centre.x - radius,
        right: centre.x + radius,
        top: centre.y - radius,
        bottom: centre.y + radius,
      }
    }
    // A marker is a box of its own, placed also outside the view.
    if ('getLatLng' in path) {
      const rect = element.getBoundingClientRect()
      return {
        left: rect.left - origin.left,
        right: rect.right - origin.left,
        top: rect.top - origin.top,
        bottom: rect.bottom - origin.top,
      }
    }
    if ('getBounds' in path) {
      const bounds = (path as unknown as L.Polyline).getBounds()
      const northWest = map.latLngToContainerPoint(bounds.getNorthWest())
      const southEast = map.latLngToContainerPoint(bounds.getSouthEast())
      return { left: northWest.x, right: southEast.x, top: northWest.y, bottom: southEast.y }
    }
    return null
  }

  #showTooltip(event: MouseEvent, content: Parameters<ChartController['showTooltip']>[1]): void {
    if (this.#container) this.#controller.showTooltip(event, content, this.#container)
  }

  #applySelection(): void {
    const active = this.#options.active
    for (const [id, path] of this.#paths) {
      const element = path.getElement()
      if (!element) continue
      element.classList.toggle('is-selected', id === active)
      element.classList.toggle('is-muted', this.#mutes.has(id) && Boolean(active) && id !== active)
      if (element.hasAttribute('role')) element.setAttribute('aria-pressed', String(id === active))
    }
  }
}
