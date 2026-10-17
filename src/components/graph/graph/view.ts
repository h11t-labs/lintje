/**
 * The zoom: where the graph's own units land on the screen (`screen = world · k + t`), fitting,
 * zooming round a point, and the overview map's scale. Pure arithmetic.
 */
import type { Point } from './layout'

export interface View {
  k: number
  x: number
  y: number
}

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

/** How a node is drawn at a zoom: a card, a mark with its name where it fits, or a mark alone. */
export type Level = 'card' | 'mark' | 'icon'

export const ZOOM = { min: 0.15, max: 3, fit: 1.25, step: 1.25 } as const
const CARD_FROM = 0.7
const MARK_FROM = 0.35
/** The room a fitted drawing keeps from the edge of its area. */
const FIT_PAD = 24

export function levelAt(k: number): Level {
  return k >= CARD_FROM ? 'card' : k >= MARK_FROM ? 'mark' : 'icon'
}

/** The box round the given nodes, each of its own size. */
export function boundsOf(
  positions: Record<string, Point>,
  sizes: Map<string, { width: number; height: number }>,
  ids: Iterable<string> = Object.keys(positions),
): Bounds {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const id of ids) {
    const point = positions[id]
    const size = sizes.get(id)
    if (!point || !size) continue
    x0 = Math.min(x0, point.x - size.width / 2)
    y0 = Math.min(y0, point.y - size.height / 2)
    x1 = Math.max(x1, point.x + size.width / 2)
    y1 = Math.max(y1, point.y + size.height / 2)
  }
  if (x0 === Infinity) return { x: 0, y: 0, width: 1, height: 1 }
  return { x: x0, y: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) }
}

/**
 * The view that shows the whole box in the area, never closer than `ZOOM.fit`; `right` keeps a
 * strip of the area clear, where the zoom buttons stand.
 */
export function fit(box: Bounds, area: { width: number; height: number }, right = 0): View {
  const width = area.width - right
  const k = Math.max(
    ZOOM.min,
    Math.min((width - 2 * FIT_PAD) / box.width, (area.height - 2 * FIT_PAD) / box.height, ZOOM.fit),
  )
  return {
    k,
    x: (width - box.width * k) / 2 - box.x * k,
    y: (area.height - box.height * k) / 2 - box.y * k,
  }
}

/** Zooms by `factor` round a point of the area, so what is under it stays there. */
export function zoomAt(view: View, at: Point, factor: number): View {
  const k = Math.min(ZOOM.max, Math.max(ZOOM.min, view.k * factor))
  const scale = k / view.k
  return { k, x: at.x - (at.x - view.x) * scale, y: at.y - (at.y - view.y) * scale }
}

/** Centres a point of the graph in the area at the view's zoom. */
export function centreOn(view: View, point: Point, area: { width: number; height: number }): View {
  return { k: view.k, x: area.width / 2 - point.x * view.k, y: area.height / 2 - point.y * view.k }
}

export function fits(box: Bounds, view: View, area: { width: number; height: number }): boolean {
  const left = box.x * view.k + view.x
  const top = box.y * view.k + view.y
  return (
    left >= -1 &&
    top >= -1 &&
    left + box.width * view.k <= area.width + 1 &&
    top + box.height * view.k <= area.height + 1
  )
}

/** The overview map: the scale and offset that put the whole box in a frame of `size`. */
export function overview(
  box: Bounds,
  size: { width: number; height: number },
): { scale: number; x: number; y: number } {
  const pad = 8
  const scale = Math.min((size.width - 2 * pad) / box.width, (size.height - 2 * pad) / box.height)
  return {
    scale,
    x: (size.width - box.width * scale) / 2 - box.x * scale,
    y: (size.height - box.height * scale) / 2 - box.y * scale,
  }
}
