/**
 * The data on the map, drawn by the design system itself into Leaflet's svg: the land, then every
 * drawing in the host's order, the first at the bottom. Geometry is projected once, at the zoom
 * the surface took as its reference; a pan or a zoom moves the group that holds it, so a mark
 * with a pixel size (a point, the destination of the flows) is a `__symbol` the surface places
 * and scales back by itself. Every event a mark answers stops at the mark: the map's own click
 * clears the selection, and its double click zooms.
 */
import { svg, nothing, type SVGTemplateResult } from 'lit'
import { repeat } from 'lit/directives/repeat.js'
import { styleProps } from '../../../../core/style-props'
import { formatNumber } from '../../../../core/format'
import { staggerStyle } from '../shared/stagger'
import { DEFAULT_SERIES_COLOR, seriesColor } from '../shared/colors'
import { markPath } from '../shared/series-shapes'
import type { ChartController } from '../shared/controller'
import { withUnit, type MapDrawing } from './drawings'
import { isRect } from './area'
import type { MapArea, MapSeriesKey, MapValue } from '../shared/types'

/** Longitude and latitude to the surface's reference pixels. */
export type Project = (lon: number, lat: number) => [number, number]

/** A shape of the map's own geometry, as a path in reference pixels. */
export interface LandShape {
  id: string
  name: string
  d: string
}

export const CLASSES = [
  'var(--color-chart-seq-1)',
  'var(--color-chart-seq-2)',
  'var(--color-chart-seq-3)',
  'var(--color-chart-seq-4)',
  'var(--color-chart-seq-5)',
]

export function classFor(value: number, max: number): number {
  if (max <= 0) return 0
  return Math.min(4, Math.floor((value / max) * 5))
}

/** What every mark draws with. */
export interface MarksContext {
  /** The controller's id, which names the hatch pattern. */
  id: string
  active: string | null
  /** The marks a drawn area chose: outlined as a chosen mark is, the flows beside them muted. */
  chosen: Set<string>
  controller: ChartController
  select: (value: MapValue) => void
  project: Project
  /** On a basemap the tiles are the land: only the areas with a row are drawn. */
  tiled: boolean
  /** The series the legend switched off, as `seriesKey(drawing, series)`: not drawn. */
  hidden: Set<string>
  /** The layers the legend switched off, by their place in the stack: drawn `is-off`, so they can go with a motion. */
  hiddenLayers: Set<number>
}

const hasRing = (value: MapValue): boolean => (value.polygon?.length ?? 0) > 2

/** The radius of a point with a figure: between 3 and 18 px, by the square root of its share. */
export function pointRadius(value: number, max: number): number {
  return 3 + Math.sqrt(value / max) * 15
}

/** A series of one layer, as the legend switches it: a colour may serve several layers. */
export const seriesKey = (drawing: MapDrawing, series: MapSeriesKey): string =>
  `${drawing.index}:${series}`

/** Chosen by a click or inside a drawn area. */
const isChosen = (context: MarksContext, id: string): boolean =>
  context.active === id || context.chosen.has(id)

/** The classes of a mark's root: chosen, and off while its layer or series is switched off. */
const markState = (context: MarksContext, id: string, off: boolean): string =>
  `${isChosen(context, id) ? 'is-selected' : ''} ${off ? 'is-off' : ''}`

/** A click or a double click on a mark is the mark's, not the map's. */
function stop(event: Event): void {
  event.stopPropagation()
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

/** Draw-in stagger in x-order, west to east. */
function westToEast(marks: MapValue[]) {
  const order = new Map([...marks].sort((a, b) => a.lon! - b.lon!).map((mark, n) => [mark.id, n]))
  return (mark: MapValue) => staggerStyle(order.get(mark.id) ?? 0, marks.length)
}

const at = (x: number, y: number): string => `${x.toFixed(2)} ${y.toFixed(2)}`

/**
 * The land: the shapes of the map's own geometry, plain. On a basemap the tiles are the land. A
 * shape without a row stays plain land: hatching it would label every country outside the scope
 * "geen gegevens".
 */
function renderLand(land: LandShape[], context: MarksContext): SVGTemplateResult[] {
  if (context.tiled) return []
  return land.map(
    (shape) =>
      svg`<path d=${shape.d} class="lintje-map-chart__land" fill="var(--color-map-land)" />`,
  )
}

/** A ring of `[lon, lat]` as a closed path in reference pixels. */
function pathOf(ring: [number, number][], project: Project): string {
  return (
    ring
      .map(([lon, lat], n) => {
        const [x, y] = project(lon, lat)
        return `${n ? 'L' : 'M'}${at(x, y)}`
      })
      .join('') + 'Z'
  )
}

/**
 * The areas with a row, in the classes: a choropleth's are the shapes of the geometry, a
 * polygon's carry their own outline; one drawing for both. An area without a figure is hatched,
 * never coloured as zero (rule 15). Built like a point: a ring behind the shape for the focus,
 * and without a figure the surface with the hatch over it, so the ring never shows through it.
 */
function renderAreas(drawing: MapDrawing, context: MarksContext, land: LandShape[], off: boolean) {
  const { id, controller, select, project } = context
  const shapes = new Map(land.map((shape) => [shape.id, shape.d]))
  const outline = (value: MapValue): string | undefined =>
    drawing.variant === 'choropleth'
      ? shapes.get(value.id)
      : hasRing(value)
        ? pathOf(value.polygon!, project)
        : undefined
  const drawn = drawing.values.filter((value) => outline(value))
  // Keyed by id: a mark keeps its element when another goes, so it does not draw in again.
  return repeat(
    drawn,
    (value) => value.id,
    (value) => {
      const d = outline(value)!
      const missing = value.value == null
      const fill = missing
        ? 'var(--color-chart-hatch)'
        : CLASSES[classFor(value.value!, drawing.max)]
      const figure = missing ? 'geen gegevens' : withUnit(formatNumber(value.value!), drawing.unit)
      return svg`
      <g class="lintje-map-chart__polygon is-clickable ${markState(context, value.id, off)}"
         data-mark-id=${value.id}
         role="button" tabindex=${off ? -1 : 0} aria-hidden=${off ? 'true' : nothing}
         aria-pressed=${String(isChosen(context, value.id))}
         aria-label=${`${value.label}: ${figure}${value.detail ? `, ${value.detail}` : ''}`}
         @click=${(event: MouseEvent) => {
           stop(event)
           select(value)
         }}
         @dblclick=${stop}
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
    },
  )
}

/** Flows: line width = count. The bow of the arc is a share of its length, in pixels. */
function renderFlows(
  drawing: MapDrawing,
  context: MarksContext,
  off: boolean,
): SVGTemplateResult | typeof nothing {
  const { controller, select, project } = context
  const destination = drawing.destination
  if (!destination) return nothing
  const drawn = drawing.values.filter((value) => value.lon != null && value.value != null)
  const stagger = westToEast(drawn)
  const [bx, by] = project(destination.lon, destination.lat)
  return svg`
    <g class="lintje-map-chart__flows">
      ${repeat(
        drawn,
        (value) => value.id,
        (value) => {
          const [ax, ay] = project(value.lon!, value.lat!)
          const mx = (ax + bx) / 2
          const my = (ay + by) / 2 - Math.hypot(bx - ax, by - ay) * 0.18
          const thickness = 1 + (value.value! / drawing.max) * 7
          const route = `${value.label} → ${destination.label}`
          return svg`
        <path
          d=${`M${at(ax, ay)}Q${at(mx, my)} ${at(bx, by)}`}
          pathLength="1"
          ${styleProps(stagger(value))}
          class="lintje-map-chart__flow is-clickable ${markState(context, value.id, off)}"
          stroke-width=${thickness}
          data-mark-id=${value.id}
          role="button" tabindex=${off ? -1 : 0} aria-hidden=${off ? 'true' : nothing}
          aria-pressed=${String(isChosen(context, value.id))}
          aria-label=${`${route}: ${withUnit(formatNumber(value.value!), drawing.unit)}${value.detail ? `, ${value.detail}` : ''}`}
          @keydown=${onChoose(select, value)}
          @click=${(event: MouseEvent) => {
            stop(event)
            select(value)
          }}
          @dblclick=${stop}
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
        },
      )}
      <g class="lintje-map-chart__symbol" data-at=${at(bx, by)}>
        <circle r="5" class="lintje-map-chart__destination" />
      </g>
    </g>
  `
}

/** Points with size, and the scope picker (same drawing, different behavior). */
function renderPoints(drawing: MapDrawing, context: MarksContext, off: boolean) {
  const { id, controller, select, project, hidden } = context
  const placed = drawing.values.filter((value) => value.lon != null)
  // Off with its layer, or with its series.
  const gone = (value: MapValue): boolean =>
    off || Boolean(value.series && hidden.has(seriesKey(drawing, value.series)))
  const stagger = westToEast(placed)
  return repeat(
    placed,
    (value) => value.id,
    (value) => {
      const [x, y] = project(value.lon!, value.lat!)
      // A point without a figure takes the picker's fixed size (rule 15).
      const radius =
        drawing.variant === 'points' && value.value != null
          ? pointRadius(value.value, drawing.max)
          : 6
      // A series gives the point a data colour and its own shape (rule 13).
      const colour = seriesColor(value.series)
      const seriesName = (value.series && drawing.seriesLabels?.[value.series]) || undefined
      const figure =
        value.value == null ? 'geen gegevens' : withUnit(formatNumber(value.value), drawing.unit)
      const d = markPath(value.series, radius)
      return svg`
      <g ${styleProps(stagger(value))}
         class="lintje-map-chart__point lintje-map-chart__symbol ${markState(context, value.id, gone(value))}"
         data-at=${at(x, y)}
         data-mark-id=${value.id}
         role="button" tabindex=${gone(value) ? -1 : 0} aria-hidden=${gone(value) ? 'true' : nothing}
         aria-pressed=${String(isChosen(context, value.id))}
         aria-label=${`${value.label}: ${figure}${seriesName ? `, ${seriesName}` : ''}`}
         @click=${(event: MouseEvent) => {
           stop(event)
           select(value)
         }}
         @dblclick=${stop}
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
        <!-- The figure grows in: its own group, as the animation's transform would replace the
             placement of the point. The focus ring is behind the shape, shown on focus only. -->
        <g class="lintje-map-chart__point-figure">
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
      </g>
    `
    },
  )
}

/**
 * The circle on the earth around a centre, as a ring of `[lon, lat]`: on a Mercator map it is a
 * little taller than wide away from the equator, and its edge passes through every point at the
 * radius, the pointer that drew it included.
 */
function circleRing([lon, lat]: [number, number], km: number, steps = 72): [number, number][] {
  const rad = Math.PI / 180
  const d = km / 6371
  const lat1 = lat * rad
  const lon1 = lon * rad
  const ring: [number, number][] = []
  for (let i = 0; i < steps; i++) {
    const bearing = (i / steps) * 2 * Math.PI
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearing),
    )
    const lon2 =
      lon1 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
        Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
      )
    // Past the date line the ring runs on, rather than jump across the whole map.
    let next = lon2 / rad
    const previous = ring.at(-1)?.[0]
    if (previous != null) while (next - previous > 180) next -= 360
    if (previous != null) while (previous - next > 180) next += 360
    ring.push([next, lat2 / rad])
  }
  return ring
}

/** A drawn area, in the reference pixels; a circle with its middle. `draft` is the area while it is drawn. */
export function renderRegion(
  area: MapArea | null,
  project: Project,
  draft = false,
): SVGTemplateResult | typeof nothing {
  if (!area) return nothing
  const classes = `lintje-map-chart__region ${draft ? 'lintje-map-chart__region--draft' : ''}`
  if (area.kind === 'circle') {
    const [cx, cy] = project(...area.centre)
    const d =
      area.radiusKm > 0
        ? circleRing(area.centre, area.radiusKm)
            .map(([lon, lat], n) => {
              const [x, y] = project(lon, lat)
              return `${n ? 'L' : 'M'}${at(x, y)}`
            })
            .join('') + 'Z'
        : ''
    return svg`
      ${d ? svg`<path class=${classes} d=${d} />` : nothing}
      <g class="lintje-map-chart__symbol" data-at=${at(cx, cy)}>
        <circle class="lintje-map-chart__region-centre" r="4" />
      </g>
    `
  }
  if (area.ring.length < 2) return nothing
  const d =
    area.ring
      .map(([lon, lat], n) => {
        const [x, y] = project(lon, lat)
        return `${n ? 'L' : 'M'}${at(x, y)}`
      })
      // A lasso being drawn runs open to the pointer; a rectangle is a box from its first corner.
      .join('') + (draft && !isRect(area.ring) ? '' : 'Z')
  return svg`<path class=${classes} d=${d} />`
}

/** The whole drawing: the hatch, the land, then the drawings in order, each as one of three kinds. */
export function renderData(
  land: LandShape[],
  drawings: MapDrawing[],
  context: MarksContext,
  area: MapArea | null = null,
): SVGTemplateResult {
  return svg`
    <defs>
      <pattern id="map-hatch-${context.id}" class="lintje-map-chart__hatch" width="6" height="6"
               patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-chart-hatch)" stroke-width="2" />
      </pattern>
    </defs>
    ${renderLand(land, context)}
    ${repeat(
      drawings,
      (drawing) => drawing.index,
      (drawing) => {
        const off = context.hiddenLayers.has(drawing.index)
        return drawing.variant === 'polygons' || drawing.variant === 'choropleth'
          ? renderAreas(drawing, context, land, off)
          : drawing.variant === 'flows'
            ? renderFlows(drawing, context, off)
            : renderPoints(drawing, context, off)
      },
    )}
    ${renderRegion(area, context.project)}
  `
}
