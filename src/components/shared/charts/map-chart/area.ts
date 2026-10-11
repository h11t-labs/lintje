/**
 * What lies wholly in an area drawn on the map: a lasso, a ring of `[lon, lat]` — a rectangle is
 * one of four corners — or a circle around a centre. A place is a point and lies in it by that point; an area of its own outline
 * or a shape of the map's geometry lies in it with every corner, and in a lasso with no edge
 * crossing the lasso's; a flow lies in it with both its ends and the top of its arc.
 */
import { geoOf } from './geo'
import type { MapDrawing } from './drawings'
import type { MapArea } from '../shared/types'

const EARTH_KM = 6371

/** The great-circle distance in km. */
export function distanceKm([lon1, lat1]: [number, number], [lon2, lat2]: [number, number]): number {
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLon = (lon2 - lon1) * rad
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Ray casting in longitude and latitude: true enough for the areas a reader draws. */
function inRing(ring: [number, number][], [lon, lat]: [number, number]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/**
 * A rectangle between two corners, as a lasso of four: in Mercator a line of one longitude or
 * latitude is straight, so the box on the screen is the box in degrees.
 */
export function rectRing(
  [lon1, lat1]: [number, number],
  [lon2, lat2]: [number, number],
): [number, number][] {
  return [
    [lon1, lat1],
    [lon2, lat1],
    [lon2, lat2],
    [lon1, lat2],
  ]
}

/** A ring of four corners that is a rectangle: what `rectRing` draws, for the panel's words. */
export function isRect(ring: [number, number][]): boolean {
  if (ring.length !== 4) return false
  const [a, b, c, d] = ring
  return a[1] === b[1] && b[0] === c[0] && c[1] === d[1] && d[0] === a[0]
}

/** A ring without any area: every corner on one line of longitude or of latitude. */
export const flatRing = (ring: [number, number][]): boolean =>
  ring.every(([lon]) => lon === ring[0][0]) || ring.every(([, lat]) => lat === ring[0][1])

export function inArea(area: MapArea, point: [number, number]): boolean {
  return area.kind === 'circle'
    ? distanceKm(area.centre, point) <= area.radiusKm
    : area.ring.length > 2 && inRing(area.ring, point)
}

/** Whether segments ab and cd cross, in longitude and latitude. */
function crosses(
  [ax, ay]: [number, number],
  [bx, by]: [number, number],
  [cx, cy]: [number, number],
  [dx, dy]: [number, number],
): boolean {
  const side = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) =>
    Math.sign((qx - px) * (ry - py) - (qy - py) * (rx - px))
  return (
    side(ax, ay, bx, by, cx, cy) * side(ax, ay, bx, by, dx, dy) < 0 &&
    side(cx, cy, dx, dy, ax, ay) * side(cx, cy, dx, dy, bx, by) < 0
  )
}

type Bounds = [west: number, south: number, east: number, north: number]

function boundsOf(points: [number, number][]): Bounds {
  let [west, south, east, north] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const [lon, lat] of points) {
    west = Math.min(west, lon)
    east = Math.max(east, lon)
    south = Math.min(south, lat)
    north = Math.max(north, lat)
  }
  return [west, south, east, north]
}

/** The box around the area: what lies outside it cannot be in it, and is passed over fast. */
function areaBounds(area: MapArea): Bounds {
  if (area.kind === 'lasso') return boundsOf(area.ring)
  const [lon, lat] = area.centre
  const dLat = area.radiusKm / 111.32
  const dLon = area.radiusKm / (111.32 * Math.max(0.01, Math.cos((lat * Math.PI) / 180)))
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat]
}

const within = ([w, s, e, n]: Bounds, [west, south, east, north]: Bounds): boolean =>
  w >= west && e <= east && s >= south && n <= north

/** A ring wholly in the area: every corner in it, and in a lasso no edge crossing its edges. */
function ringInArea(area: MapArea, ring: [number, number][]): boolean {
  if (ring.length === 0 || !within(boundsOf(ring), areaBounds(area))) return false
  if (!ring.every((point) => inArea(area, point))) return false
  if (area.kind === 'circle') return true
  const edges = (points: [number, number][]) =>
    points.map((point, i): [[number, number], [number, number]] => [
      point,
      points[(i + 1) % points.length],
    ])
  const lasso = edges(area.ring)
  return edges(ring).every(([a, b]) => lasso.every(([c, d]) => !crosses(a, b, c, d)))
}

/** The top of a flow's arc, bowed as `marks.ts` draws it: north of its middle by a share of its length. */
function arcTop(from: [number, number], to: [number, number]): [number, number] {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1])
  return [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2 + length * 0.18]
}

const outlines = new Map<string, Map<string, [number, number][][]>>()

/** The outer rings of each shape of a geometry, once. */
function shapeOutlines(geo: string | undefined): Map<string, [number, number][][]> {
  const key = geo ?? 'world'
  let found = outlines.get(key)
  if (found) return found
  found = new Map()
  for (const feature of geoOf(geo).features)
    found.set(
      feature.properties.id,
      feature.geometry.coordinates.map((polygon) => polygon[0] as [number, number][]),
    )
  outlines.set(key, found)
  return found
}

/** Whether a mark of a drawing lies wholly in the area. */
function markInArea(
  area: MapArea,
  drawing: MapDrawing,
  value: MapDrawing['values'][number],
  geo: string | undefined,
): boolean {
  if (drawing.variant === 'choropleth') {
    const rings = shapeOutlines(geo).get(value.id)
    return Boolean(rings?.length) && rings!.every((ring) => ringInArea(area, ring))
  }
  if (drawing.variant === 'polygons')
    return (value.polygon?.length ?? 0) > 2 && ringInArea(area, value.polygon!)
  if (value.lon == null || value.lat == null) return false
  const at: [number, number] = [value.lon, value.lat]
  if (drawing.variant === 'flows') {
    const end = drawing.destination
    if (!end) return false
    const to: [number, number] = [end.lon, end.lat]
    return [at, to, arcTop(at, to)].every((point) => inArea(area, point))
  }
  return inArea(area, at)
}

/** The ids of the marks of every drawing that lie wholly in the area, in drawing order. */
export function idsInArea(area: MapArea, drawings: MapDrawing[], geo?: string): string[] {
  const ids: string[] = []
  for (const drawing of drawings)
    for (const value of drawing.values)
      if (!ids.includes(value.id) && markInArea(area, drawing, value, geo)) ids.push(value.id)
  return ids
}
