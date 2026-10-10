/** The map: draws the pre-projected geometry from `assets/geo/`. */
import { html, svg, nothing, type SVGTemplateResult, type TemplateResult } from 'lit'
import { ref } from 'lit/directives/ref.js'
import { styleProps } from '../../../../core/style-props'
import worldGeo from '../../../../../assets/geo/world.json'
import netherlandsGeo from '../../../../../assets/geo/netherlands.json'
import { formatNumber, formatCompactNumber } from '../../../../core/format'
import { staggerStyle } from '../shared/stagger'
import { chartIcon, ZOOM_CONTROLS } from '../shared/chart-icons'
import { renderIcon } from '../../../../icons/render'
import { renderTooltip } from '../shared/tooltip'
import { LeafletSurface } from './leaflet'
import { clearance, hidden, keyboardFocus, overlayBoxes, REVEAL_MARGIN, type Box } from './reveal'
import { DEFAULT_SERIES_COLOR, seriesColor } from '../shared/colors'
import { markPath } from '../shared/series-shapes'
import { drawingRole } from '../shared/axes'
import type { ChartController, ChartOptions } from '../shared/controller'
import { mapDrawings, withUnit, type DrawingVariant, type MapDrawing } from './drawings'
import type { MapSeriesKey, MapSpec, MapValue } from '../shared/types'

type Geo = typeof worldGeo

const GEOS: Record<string, Geo> = { world: worldGeo, netherlands: netherlandsGeo }

function project(geo: Geo, lon: number, lat: number): [number, number] {
  const { x0, y1, scale, margin, kind } = geo.projection
  const [px, py] =
    kind === 'rd'
      ? [(lon - 5.38763) * Math.cos((lat * Math.PI) / 180), lat - 52.15616]
      : [
          lon,
          (Math.log(Math.tan(Math.PI / 4 + (Math.max(-83, Math.min(83, lat)) * Math.PI) / 360)) *
            180) /
            Math.PI,
        ]
  return [(px - x0) * scale + margin, (y1 - py) * scale + margin]
}

const CLASSES = [
  'var(--color-chart-seq-1)',
  'var(--color-chart-seq-2)',
  'var(--color-chart-seq-3)',
  'var(--color-chart-seq-4)',
  'var(--color-chart-seq-5)',
]

function classFor(value: number, max: number) {
  if (max <= 0) return 0
  return Math.min(4, Math.floor((value / max) * 5))
}

/** A centre kept so that a view `box` wide stays inside a map `size` wide. */
function clampTo(value: number, box: number, size: number): number {
  return Math.min(size - box / 2, Math.max(box / 2, value))
}

/**
 * Moves the view so the keyboard's mark shows (WCAG 2.4.11): into the zoomed view, and clear of
 * the overlays at every zoom. What the clamped centre cannot take, past the map's edge, is
 * `mapNudge`, which ends when the focus leaves the map. The view is read from the svg, so a
 * check a frame after a render sees that render.
 */
function revealMark(mark: SVGGraphicsElement, controller: ChartController, geo: Geo): void {
  const drawing = mark.ownerSVGElement
  if (!drawing || typeof mark.getBBox !== 'function' || !keyboardFocus(mark)) return
  const [x, y, width, height] = (drawing.getAttribute('viewBox') ?? '').split(' ').map(Number)
  const bbox = mark.getBBox()
  const box: Box = {
    left: bbox.x,
    top: bbox.y,
    right: bbox.x + bbox.width,
    bottom: bbox.y + bbox.height,
  }
  let view: Box = { left: x, top: y, right: x + width, bottom: y + height }
  let overlays: Box[] = []
  let margin = 0
  // The overlays and the svg's own box, which `meet` makes wider than the viewBox, are measured
  // in client pixels and turned into the map's units.
  const ctm = drawing.getScreenCTM?.()
  const rect = drawing.getBoundingClientRect()
  if (ctm && ctm.a > 0 && rect.width > 0 && drawing.parentElement) {
    const toMap = (client: Box): Box => ({
      left: (client.left - ctm.e) / ctm.a,
      right: (client.right - ctm.e) / ctm.a,
      top: (client.top - ctm.f) / ctm.d,
      bottom: (client.bottom - ctm.f) / ctm.d,
    })
    view = toMap(rect)
    overlays = overlayBoxes(drawing.parentElement).map(toMap)
    margin = REVEAL_MARGIN / ctm.a
  }
  let shift = clearance(box, view, overlays, margin)
  if (!shift) {
    // Larger than the room between the overlays: only a mark nothing of shows moves, to the middle.
    if (!hidden(box, view, overlays)) return
    shift = [
      (view.left + view.right - box.left - box.right) / 2,
      (view.top + view.bottom - box.top - box.bottom) / 2,
    ]
  }
  const [dx, dy] = shift
  if (!dx && !dy) return
  // The drawing moves by the shift, so the view moves the other way.
  const left = x - dx
  const top = y - dy
  const centre = {
    x: clampTo(left + width / 2, width, geo.width),
    y: clampTo(top + height / 2, height, geo.height),
  }
  controller.mapCentre = centre
  controller.mapNudge = { x: left + width / 2 - centre.x, y: top + height / 2 - centre.y }
  controller.requestUpdate()
}

/** Draw-in stagger in x-order, west to east. */
function westToEast(marks: MapValue[]) {
  const order = new Map([...marks].sort((a, b) => a.lon! - b.lon!).map((mark, n) => [mark.id, n]))
  return (mark: MapValue) => staggerStyle(order.get(mark.id) ?? 0, marks.length)
}

/** What every mark of the svg map draws with. */
interface Marks {
  geo: Geo
  id: string
  active: string | null
  controller: ChartController
  select: (value: MapValue) => void
}

/** Enter or space chooses a mark, as a click does. */
function onChoose(select: (value: MapValue) => void, value: MapValue) {
  return (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      select(value)
    }
  }
}

const hasRing = (value: MapValue): boolean => (value.polygon?.length ?? 0) > 2

/**
 * Areas that carry their own outline, in the choropleth's classes. Built like a point: a ring
 * behind the shape for the focus, and without a figure the surface with the hatch over it, so
 * the ring never shows through the hatch (rule 15).
 */
function renderPolygons(drawing: MapDrawing, marks: Marks): SVGTemplateResult[] {
  const { geo, id, active, controller, select } = marks
  return drawing.values.filter(hasRing).map((value) => {
    const d =
      value
        .polygon!.map(([lon, lat], n) => {
          const [x, y] = project(geo, lon, lat)
          return `${n ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
        })
        .join('') + 'Z'
    const missing = value.value == null
    const fill = missing ? 'var(--color-chart-hatch)' : CLASSES[classFor(value.value!, drawing.max)]
    const figure = missing ? 'geen gegevens' : withUnit(formatNumber(value.value!), drawing.unit)
    return svg`
      <g class="lintje-map-chart__polygon is-clickable ${active === value.id ? 'is-selected' : ''}"
         data-mark-id=${value.id}
         role="button" tabindex="0"
         aria-pressed=${String(active === value.id)}
         aria-label=${`${value.label}: ${figure}${value.detail ? `, ${value.detail}` : ''}`}
         @click=${() => select(value)}
         @mousemove=${(event: MouseEvent) =>
           controller.showTooltip(event, {
             title: `${value.label}${value.detail ? ` · ${value.detail}` : ''}`,
             rows: [
               {
                 label: drawing.unit,
                 value: missing ? 'geen gegevens' : formatNumber(value.value!),
                 color: fill,
               },
             ],
           })}
         @mouseleave=${() => controller.hideTooltip()}
         @keydown=${onChoose(select, value)}>
        <path d=${d} class="lintje-map-chart__polygon-ring" />
        <path d=${d}
              class="lintje-map-chart__polygon-shape ${missing ? 'lintje-map-chart__polygon-shape--empty' : 'lintje-map-chart__polygon-shape--data'}"
              fill=${missing ? nothing : fill} />
        ${missing ? svg`<path d=${d} class="lintje-map-chart__polygon-hatch" fill="url(#map-hatch-${id})" />` : nothing}
      </g>
    `
  })
}

/** Flows: line width = count. */
function renderFlows(drawing: MapDrawing, marks: Marks): SVGTemplateResult | typeof nothing {
  const { geo, active, controller, select } = marks
  const destination = drawing.destination
  if (!destination) return nothing
  const drawn = drawing.values.filter((value) => value.lon != null && value.value != null)
  const stagger = westToEast(drawn)
  const [bx, by] = project(geo, destination.lon, destination.lat)
  return svg`
    <g class="lintje-map-chart__flows">
      ${drawn.map((value) => {
        const [ax, ay] = project(geo, value.lon!, value.lat!)
        const mx = (ax + bx) / 2
        const my = (ay + by) / 2 - Math.hypot(bx - ax, by - ay) * 0.18
        const thickness = 1 + (value.value! / drawing.max) * 7
        const route = `${value.label} → ${destination.label}`
        return svg`
        <path
          d=${`M${ax} ${ay}Q${mx} ${my} ${bx} ${by}`}
          pathLength="1"
          ${styleProps(stagger(value))}
          class="lintje-map-chart__flow is-clickable ${active === value.id ? 'is-selected' : active ? 'is-muted' : ''}"
          stroke-width=${thickness}
          data-mark-id=${value.id}
          role="button" tabindex="0"
          aria-pressed=${String(active === value.id)}
          aria-label=${`${route}: ${withUnit(formatNumber(value.value!), drawing.unit)}${value.detail ? `, ${value.detail}` : ''}`}
          @keydown=${onChoose(select, value)}
          @click=${() => select(value)}
          @mousemove=${(event: MouseEvent) =>
            controller.showTooltip(event, {
              title: `${route}${value.detail ? ` · ${value.detail}` : ''}`,
              rows: [
                {
                  label: drawing.unit,
                  value: formatNumber(value.value!),
                  color: DEFAULT_SERIES_COLOR,
                },
              ],
            })}
          @mouseleave=${() => controller.hideTooltip()} />
      `
      })}
      <circle cx=${bx} cy=${by} r="5" class="lintje-map-chart__destination" />
    </g>
  `
}

/** Points with size, and the scope picker (same drawing, different behavior). */
function renderPoints(drawing: MapDrawing, marks: Marks): SVGTemplateResult[] {
  const { geo, id, active, controller, select } = marks
  const placed = drawing.values.filter((value) => value.lon != null)
  const stagger = westToEast(placed)
  return placed.map((value) => {
    const [x, y] = project(geo, value.lon!, value.lat!)
    // A point without a figure takes the picker's fixed size (rule 15).
    const radius =
      drawing.variant === 'points' && value.value != null
        ? 3 + Math.sqrt(value.value / drawing.max) * 15
        : 6
    // A series gives the point a data colour and its own shape (rule 13).
    const colour = seriesColor(value.series)
    const seriesName = (value.series && drawing.seriesLabels?.[value.series]) || undefined
    const figure =
      value.value == null ? 'geen gegevens' : withUnit(formatNumber(value.value), drawing.unit)
    const d = markPath(value.series, radius, x, y)
    return svg`
      <g ${styleProps(stagger(value))}
         class="lintje-map-chart__point ${active === value.id ? 'is-selected' : ''}"
         data-mark-id=${value.id}
         role="button" tabindex="0"
         aria-pressed=${String(active === value.id)}
         aria-label=${`${value.label}: ${figure}${seriesName ? `, ${seriesName}` : ''}`}
         @click=${() => select(value)}
         @mousemove=${(event: MouseEvent) =>
           controller.showTooltip(event, {
             title: seriesName ? `${value.label} · ${seriesName}` : value.label,
             rows: [
               {
                 label: drawing.unit,
                 value: value.value == null ? 'geen gegevens' : formatNumber(value.value),
                 color: colour ?? DEFAULT_SERIES_COLOR,
               },
             ],
           })}
         @mouseleave=${() => controller.hideTooltip()}
         @keydown=${onChoose(select, value)}>
        <!-- The focus ring, behind the shape: shown on focus only (map-chart.css). -->
        <path d=${d} class="lintje-map-chart__point-ring" />
        <path d=${d}
              class="lintje-map-chart__point-shape ${value.value == null ? 'lintje-map-chart__point-shape--empty' : colour ? 'lintje-map-chart__point-shape--series' : ''}"
              ${styleProps({ '--lintje-series': colour })} />
        ${
          value.value == null
            ? svg`<path d=${d} class="lintje-map-chart__point-hatch" fill="url(#map-hatch-${id})" />`
            : nothing
        }
      </g>
    `
  })
}

/** The glyph of a drawing in the legend bottom left. */
function legendGlyph(variant: DrawingVariant): TemplateResult {
  if (variant === 'choropleth' || variant === 'polygons')
    return html`<span class="lintje-map-chart__scale">
      ${CLASSES.map((klass) => html`<i class="lintje-map-chart__scale-swatch" ${styleProps({ background: klass })}></i>`)}
    </span>`
  if (variant === 'flows')
    return html`<span class="lintje-map-chart__thickness"><i class="lintje-map-chart__thickness-sample"></i><i class="lintje-map-chart__thickness-sample"></i><i class="lintje-map-chart__thickness-sample"></i></span>`
  return html`<span class="lintje-map-chart__bubbles"><i class="lintje-map-chart__bubble"></i><i class="lintje-map-chart__bubble"></i><i class="lintje-map-chart__bubble"></i></span>`
}

/** What the glyph stands for: the range of the classes, or what a width or a size is. */
function legendText(drawing: MapDrawing): string {
  const { variant, unit } = drawing
  if (variant === 'choropleth' || variant === 'polygons')
    return withUnit(`0 – ${formatCompactNumber(drawing.max)}`, unit)
  const name = variant === 'flows' ? 'lijndikte' : 'grootte'
  return unit ? `${name} = ${unit}` : name
}

const NO_DATA = html`<span class="lintje-map-chart__no-data">
  <i class="lintje-map-chart__no-data-swatch"></i> geen gegevens
</span>`

/**
 * What the map sends back. `description` and `selectedId` come from the map's own data, so
 * the chart options of those names are omitted.
 */
export interface MapOptions extends Omit<ChartOptions, 'description' | 'onSelect' | 'selectedId'> {
  description?: string
  /** An area or point was clicked; the whole mark travels, as the panel needs its figure. */
  onSelect?: (mark: MapValue) => void
  /** The selection was undone (chosen mark again, empty map, Escape, close); travels the id. */
  onClear?: (previousId: string) => void
  onLayerChange?: (value: string) => void
}

export function renderMap(data: MapSpec, options: MapOptions): TemplateResult {
  const {
    controller,
    description = data.description,
    mobile = false,
    onSelect,
    onClear,
    onLayerChange,
  } = options
  const {
    variant,
    geo: geoName = 'world',
    unit = 'aantal',
    selectedId = null,
    layers,
    layer,
    basemap,
    selectLabel = 'Zet als bereik',
  } = data
  const id = controller.id
  const geo = GEOS[geoName]
  const expanded = Boolean(options.expanded)

  // In the tile the map picks its own height; in the modal it takes the body's. Below 768 px
  // the modal is full screen and its token is a drawing height, so `fit` is off.
  controller.measure(expanded ? { width: true, height: '--chart-h-main', fit: !mobile } : {})
  const areaHeight = expanded
    ? controller.height
    : (options.height ?? data.height ?? (mobile ? 220 : 400))

  const zoom = controller.zoom
  const legendOpen = controller.legendOpen ?? !mobile

  // A one-variant map is a stack of one. Each drawing scales to its own figures and speaks its
  // own unit; the ids are unique across the stack, so one selection serves all of it.
  const drawings = mapDrawings(data, unit)
  const stacked = variant === 'plots'

  // The host's `selectedId` is adopted once; after that the map owns its selection.
  if (controller.hostSelection !== selectedId) {
    controller.hostSelection = selectedId
    controller.mapSelection = selectedId
  }
  const active = controller.mapSelection
  const byId = new Map<string, MapValue>()
  const drawingOf = new Map<string, MapDrawing>()
  for (const drawing of drawings)
    for (const value of drawing.values) {
      byId.set(value.id, value)
      drawingOf.set(value.id, drawing)
    }
  const selection = active ? byId.get(active) : undefined
  const selectionDrawing = selection ? drawingOf.get(selection.id) : undefined
  // A choropleth colours the land: its rows by shape id, each with the drawing it scales to.
  const choropleth = new Map<string, { row: MapValue; drawing: MapDrawing }>()
  for (const drawing of drawings)
    if (drawing.variant === 'choropleth')
      for (const row of drawing.values) choropleth.set(row.id, { row, drawing })

  // One legend line per colour a mark uses, in the page's own `seriesLabels` order, named by the
  // first layer that uses it; sorting by colour name would reorder them when a series changes.
  const usedSeries: { key: MapSeriesKey; label: string }[] = []
  for (const drawing of drawings)
    for (const [key, label] of Object.entries(drawing.seriesLabels ?? {}) as [
      MapSeriesKey,
      string,
    ][])
      if (
        label &&
        !usedSeries.some((used) => used.key === key) &&
        drawing.values.some((value) => value.series === key)
      )
        usedSeries.push({ key, label })
  const seriesLabelOf = (value: MapValue) =>
    (value.series && drawingOf.get(value.id)?.seriesLabels?.[value.series]) || undefined
  const anyMissing = drawings.some((drawing) => drawing.values.some((value) => value.value == null))

  // The view: the zoom around a centre that a focused mark can move, kept inside the map.
  const boxWidth = geo.width / zoom
  const boxHeight = geo.height / zoom
  const centre = controller.mapCentre ?? { x: geo.width / 2, y: geo.height / 2 }
  const nudge = controller.mapNudge ?? { x: 0, y: 0 }
  const boxX = clampTo(centre.x, boxWidth, geo.width) - boxWidth / 2 + nudge.x
  const boxY = clampTo(centre.y, boxHeight, geo.height) - boxHeight / 2 + nudge.y
  const viewBox = `${boxX} ${boxY} ${boxWidth} ${boxHeight}`
  const interactive =
    geo.shapes.some((shape) => choropleth.has(shape.id)) ||
    drawings.some((drawing) =>
      drawing.variant === 'polygons'
        ? drawing.values.some(hasRing)
        : drawing.variant !== 'choropleth' &&
          drawing.values.some(
            (value) =>
              value.lon != null &&
              (drawing.variant !== 'flows' || (drawing.destination && value.value != null)),
          ),
    )

  const clear = () => {
    const previous = controller.mapSelection
    if (previous == null) return
    controller.mapSelection = null
    onClear?.(previous)
    controller.requestUpdate()
  }
  const select = (value: MapValue) => {
    if (value.id === active) return clear()
    controller.mapSelection = value.id
    onSelect?.(value)
    controller.requestUpdate()
  }
  const marks: Marks = { geo, id, active, controller, select }
  const setZoom = (next: number) => {
    controller.zoom = next
    controller.mapNudge = null
    if (next === 1) controller.mapCentre = null
    controller.requestUpdate()
  }

  // With a basemap the surface is Leaflet instead of the svg; the overlays and `select` are
  // shared. The surface lives on the controller so it survives a render.
  const leaflet = basemap ? (controller.leaflet ??= new LeafletSurface(controller)) : null
  leaflet?.sync(data, { unit, active, select, clear, mobile })

  const onZoom = (action: (typeof ZOOM_CONTROLS)[number]['action']) => {
    if (leaflet) {
      if (action === 'in') leaflet.zoomIn()
      else if (action === 'out') leaflet.zoomOut()
      else leaflet.home()
      return
    }
    setZoom(
      action === 'in' ? Math.min(6, zoom * 1.5) : action === 'out' ? Math.max(1, zoom / 1.5) : 1,
    )
  }

  return html`
    <div class="lintje-map-chart ${mobile ? 'lintje-map-chart--mobile' : ''} ${leaflet ? 'lintje-map-chart--basemap' : ''}"
         ${ref(controller.attach)} ?data-in-view=${controller.inView}
         @keydown=${(event: KeyboardEvent) => {
           if (event.key === 'Escape' && active) {
             event.stopPropagation()
             clear()
           }
         }}>
      ${
        usedSeries.length > 0
          ? html`
        <ul class="lintje-map-chart__series-legend">
          ${usedSeries.map(
            ({ key, label }) => html`
            <li class="lintje-map-chart__series-item">
              <svg class="lintje-map-chart__series-swatch" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
                <path d=${markPath(key, 5.5, 7, 7)} fill=${seriesColor(key) ?? 'currentColor'} />
              </svg>
              <span>${label}</span>
            </li>
          `,
          )}
          <!-- A mark without a figure is hatched and takes no series: no data
               colour stands for absence. The legend says so rather than leaving
               the reader with a pattern nobody explained (rule 15). -->
          ${
            anyMissing
              ? html`
            <li class="lintje-map-chart__series-item lintje-map-chart__no-data">
              <i class="lintje-map-chart__no-data-swatch"></i><span>geen meting</span>
            </li>
          `
              : nothing
          }
        </ul>
      `
          : nothing
      }
      <div class="lintje-map-chart__area" ${styleProps({ height: `${areaHeight}px` })} data-tooltip-anchor>
        ${
          leaflet
            ? html`
          <p class="visually-hidden">${description}</p>
          <div class="lintje-map-chart__leaflet" ${ref(leaflet.attach)}></div>
        `
            : html`<svg
          viewBox=${viewBox}
          class="lintje-map-chart__svg"
          width="100%"
          height=${areaHeight}
          role=${drawingRole(interactive)}
          aria-labelledby="${id}-desc"
          preserveAspectRatio="xMidYMid meet"
          @focusin=${(event: FocusEvent) =>
            revealMark(event.target as SVGGraphicsElement, controller, geo)}
          @focusout=${(event: FocusEvent) => {
            const next = event.relatedTarget as Node | null
            if (!controller.mapNudge || (next && (event.currentTarget as Element).contains(next)))
              return
            controller.mapNudge = null
            controller.requestUpdate()
          }}
          @keydown=${(event: KeyboardEvent) => {
            // A choice opens the selection panel, which may stand over the chosen mark.
            if (event.key !== 'Enter' && event.key !== ' ') return
            const mark = event.target as SVGGraphicsElement
            requestAnimationFrame(() => revealMark(mark, controller, geo))
          }}
          @click=${(event: MouseEvent) => {
            // A click outside a mark clears; a mark's own handler has already run.
            if (!(event.target as Element)?.closest('.lintje-map-chart__point, .is-clickable'))
              clear()
          }}
        >
          <desc id="${id}-desc">${description}</desc>
          <defs>
            <pattern id="map-hatch-${id}" width="6" height="6"
                     patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-chart-hatch)" stroke-width="2" />
            </pattern>
          </defs>

          <!-- Land areas. A choropleth gives every area in it its class; areas without a figure
               are hatched — never colored as zero (rule 15). -->
          ${geo.shapes.map((shape) => {
            const entry = choropleth.get(shape.id)
            const row = entry?.row
            // No row: outside the scope, plain land. Row without value: hatch. Else a class.
            // Hatching rowless shapes would label every country outside the scope "geen gegevens".
            const fill = !entry
              ? 'var(--color-map-land)'
              : entry.row.value == null
                ? `url(#map-hatch-${id})`
                : CLASSES[classFor(entry.row.value, entry.drawing.max)]
            const clickable = Boolean(row)
            return svg`
              <path
                d=${shape.d}
                class="lintje-map-chart__land ${row?.value != null ? 'lintje-map-chart__land--data' : ''} ${clickable ? 'is-clickable' : ''} ${active === shape.id ? 'is-selected' : ''}"
                data-mark-id=${clickable ? shape.id : nothing}
                aria-pressed=${clickable ? String(active === shape.id) : nothing}
                fill=${fill}
                @click=${clickable ? () => select(row!) : nothing}
                @mousemove=${
                  clickable
                    ? (event: MouseEvent) =>
                        controller.showTooltip(event, {
                          title: row!.label,
                          rows: [
                            {
                              label: entry!.drawing.unit,
                              value:
                                row!.value == null ? 'geen gegevens' : formatNumber(row!.value),
                              color: row!.value == null ? 'var(--color-chart-hatch)' : fill,
                            },
                          ],
                        })
                    : nothing
                }
                @mouseleave=${clickable ? () => controller.hideTooltip() : nothing}
                tabindex=${clickable ? 0 : nothing}
                role=${clickable ? 'button' : nothing}
                aria-label=${clickable ? `${row!.label}: ${row!.value == null ? 'geen gegevens' : formatNumber(row!.value)}` : nothing}
                @keydown=${clickable ? onChoose(select, row!) : nothing} />
            `
          })}

          <!-- The other drawings in the host's order, the first at the bottom: the order they
               paint in is the order the keyboard reaches them in. -->
          ${drawings.map((drawing) =>
            drawing.variant === 'polygons'
              ? renderPolygons(drawing, marks)
              : drawing.variant === 'flows'
                ? renderFlows(drawing, marks)
                : drawing.variant === 'points' || drawing.variant === 'scope-picker'
                  ? renderPoints(drawing, marks)
                  : nothing,
          )}
        </svg>`
        }
        ${renderTooltip(controller)}

        <!-- Layer switcher top left. -->
        ${
          layers && layers.length > 1
            ? html`
          <div class="lintje-map-chart__layers" role="group" aria-label="Kaartlaag">
            ${layers.map(
              (item) => html`
              <button type="button"
                      class="lintje-map-chart__layer ${item.value === layer ? 'is-active' : ''}"
                      aria-pressed=${item.value === layer}
                      @click=${() => onLayerChange?.(item.value)}>${item.label}</button>
            `,
            )}
          </div>
        `
            : nothing
        }

        <!-- Zoom and home top right. -->
        <div class="lintje-map-chart__zoom">
          ${ZOOM_CONTROLS.map(
            (control) => html`
            <button type="button" class="lintje-map-chart__zoom-button" aria-label=${control.label}
                    @click=${() => onZoom(control.action)}>${chartIcon(control.name, control.text)}</button>
          `,
          )}
        </div>

        <!-- Legend bottom left; on mobile collapsed into a button. -->
        <div class="lintje-map-chart__legend">
          ${
            mobile
              ? html`
            <button type="button" class="lintje-map-chart__legend-toggle"
                    aria-expanded=${legendOpen}
                    @click=${() => {
                      controller.legendOpen = !legendOpen
                      controller.requestUpdate()
                    }}>
              Legenda
            </button>
          `
              : nothing
          }
          ${
            legendOpen
              ? html`
            <div class="lintje-map-chart__legend-content ${stacked ? 'lintje-map-chart__legend-content--plots' : ''}">
              ${
                stacked
                  ? html`
                ${drawings.map(
                  (drawing) => html`
                  <span class="lintje-map-chart__legend-row">
                    ${legendGlyph(drawing.variant)}<span>${drawing.name} · ${legendText(drawing)}</span>
                  </span>
                `,
                )}
                ${anyMissing ? NO_DATA : nothing}
              `
                  : html`
                ${legendGlyph(variant as DrawingVariant)}<span>${legendText(drawings[0])}</span>
                ${variant === 'choropleth' || variant === 'polygons' ? NO_DATA : nothing}
              `
              }
            </div>
          `
              : nothing
          }
        </div>

        <!-- Selection panel bottom right. -->
        ${
          selection
            ? html`
          <div class="lintje-map-chart__selection">
            <span class="lintje-map-chart__selection-title">Geselecteerd</span>
            <!-- The way out of a selection that is always there, for mouse and
                 keyboard alike; the focus goes back to the mark it had. -->
            <button type="button" class="lintje-map-chart__selection-close"
                    aria-label="Selectie opheffen"
                    @click=${() => clear()}>${renderIcon('functioneel-kruis', { size: 14 })}</button>
            <b>${selection.label}</b>
            ${
              seriesLabelOf(selection)
                ? html`<span class="lintje-map-chart__selection-series">
                  <svg class="lintje-map-chart__series-swatch" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
                    <path d=${markPath(selection.series, 5.5, 7, 7)} fill=${seriesColor(selection.series) ?? 'currentColor'} />
                  </svg>${seriesLabelOf(selection)}
                </span>`
                : nothing
            }
            <span class="lintje-map-chart__selection-value">
              ${selection.value == null ? 'geen gegevens' : withUnit(formatNumber(selection.value), selectionDrawing?.unit ?? unit)}${selection.detail ? ` · ${selection.detail}` : ''}
            </span>
            <!-- Only when the mark carries a URL the host minted: without one
                 the link had nowhere to go and did nothing. -->
            ${
              onSelect && selection.href
                ? html`
              <button type="button" class="lintje-map-chart__set-scope"
                      @click=${() => onSelect(selection)}>
                ${selectLabel} ${renderIcon('functioneel-locatiemarker', { size: 14 })}
              </button>
            `
                : nothing
            }
          </div>
        `
            : nothing
        }
      </div>
    </div>
  `
}
