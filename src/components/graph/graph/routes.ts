/**
 * The lines between the nodes, on the screen: straight from edge to edge, bent round a node in the
 * way, curved round the centre, along dagre's route or in right angles; their arrowheads; and
 * where each relation's word stands, clear of the nodes and of the other words.
 */
import type { GraphDirection, GraphLines } from '../../../types'
import type { Point } from './layout'

/** A node's outline on the screen: a box, or the circle of a mark. */
export interface Shape {
  cx: number
  cy: number
  /** Half the width and the height; a circle's radius twice. */
  hw: number
  hh: number
  round: boolean
}

export interface RouteEdge {
  key: string
  from: string
  to: string
  label: string
  direction: GraphDirection
  /** The stroke's width in px. */
  width: number
  /** The word shows: at reading zoom, or on a line in the light. */
  labelled: boolean
  /** The line is in the light: its word shows even where it has no clear place. */
  lit: boolean
}

export interface RouteOptions {
  lines: GraphLines
  /** The direction of a layered layout; `null` for force and radial. */
  layered: 'right' | 'down' | null
  /** dagre's route per edge key, on the screen; only while the cards are drawn. */
  routed?: Map<string, Point[]>
  /** The width a word takes, with its halo. */
  labelWidth: (text: string) => number
}

export interface Route {
  key: string
  /** The line's path. */
  d: string
  /** A filled triangle at each end that has an arrowhead. */
  arrows: string[]
  /** The word's centre, if it shows. */
  label: Point | null
}

/** The gap between a line's end and the node, and a word's height. */
const END_GAP = 3
const LABEL_HEIGHT = 16
/** How far a curve bows from its chord in `curved`, as a share of the chord. */
const BOW = 0.12
/** The offsets tried to bend a line round a node in its way. */
const DETOURS = [60, -60, 120, -120]

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const round = (value: number): number => Math.round(value * 10) / 10

function rectOf(shape: Shape): Rect {
  return { x: shape.cx - shape.hw, y: shape.cy - shape.hh, w: 2 * shape.hw, h: 2 * shape.hh }
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

/** Where a line from the shape's centre in direction (dx, dy) leaves its outline, `pad` beyond. */
export function border(shape: Shape, dx: number, dy: number, pad = END_GAP): Point {
  // Two nodes on one spot, as new ones are when they come out of their neighbour.
  if (!dx && !dy) return { x: shape.cx, y: shape.cy }
  const length = Math.hypot(dx, dy) || 1
  if (shape.round) {
    return {
      x: shape.cx + (dx / length) * (shape.hw + pad),
      y: shape.cy + (dy / length) * (shape.hw + pad),
    }
  }
  const sx = dx === 0 ? Infinity : Math.abs(shape.hw / dx)
  const sy = dy === 0 ? Infinity : Math.abs(shape.hh / dy)
  const s = Math.min(sx, sy)
  return { x: shape.cx + dx * s + (dx / length) * pad, y: shape.cy + dy * s + (dy / length) * pad }
}

/** Whether the segment p–q crosses the box (Liang–Barsky). */
export function segmentHits(p: Point, q: Point, box: Rect): boolean {
  let t0 = 0
  let t1 = 1
  const dx = q.x - p.x
  const dy = q.y - p.y
  const checks: [number, number][] = [
    [-dx, p.x - box.x],
    [dx, box.x + box.w - p.x],
    [-dy, p.y - box.y],
    [dy, box.y + box.h - p.y],
  ]
  for (const [edge, room] of checks) {
    if (edge === 0) {
      if (room < 0) return false
      continue
    }
    const t = room / edge
    if (edge < 0) {
      if (t > t1) return false
      if (t > t0) t0 = t
    } else {
      if (t < t0) return false
      if (t < t1) t1 = t
    }
  }
  return true
}

function quadraticAt(p: Point, c: Point, q: Point, t: number): Point {
  const u = 1 - t
  return {
    x: u * u * p.x + 2 * u * t * c.x + t * t * q.x,
    y: u * u * p.y + 2 * u * t * c.y + t * t * q.y,
  }
}

function curveHits(p: Point, c: Point, q: Point, boxes: Rect[]): boolean {
  for (let i = 1; i < 6; i++) {
    const { x, y } = quadraticAt(p, c, q, i / 6)
    if (boxes.some((box) => x > box.x && x < box.x + box.w && y > box.y && y < box.y + box.h))
      return true
  }
  return false
}

/** The point at share `t` along a polyline. */
export function along(points: Point[], t: number): Point {
  const lengths: number[] = []
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const length = Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y)
    lengths.push(length)
    total += length
  }
  let rest = t * total
  for (let i = 0; i < lengths.length; i++) {
    if (rest <= lengths[i]! || i === lengths.length - 1) {
      const f = lengths[i] ? rest / lengths[i]! : 0
      const a = points[i]!
      const b = points[i + 1]!
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }
    }
    rest -= lengths[i]!
  }
  return points[0] ?? { x: 0, y: 0 }
}

/** The size of an arrowhead for a line of this width. */
function arrowLength(width: number): number {
  return width > 2.5 ? 11 : 8
}

/** A triangle with its tip at `tip`, pointing along (dx, dy). */
function arrow(tip: Point, dx: number, dy: number, width: number): string {
  const length = Math.hypot(dx, dy) || 1
  const ux = dx / length
  const uy = dy / length
  const size = arrowLength(width)
  const bx = tip.x - ux * size
  const by = tip.y - uy * size
  const half = size / 2
  return `M ${round(tip.x)} ${round(tip.y)} L ${round(bx - uy * half)} ${round(by + ux * half)} L ${round(bx + uy * half)} ${round(by - ux * half)} Z`
}

/** Moves an end back along its direction, so a thick line stops under its arrowhead. */
function pullBack(end: Point, from: Point, by: number): Point {
  const dx = end.x - from.x
  const dy = end.y - from.y
  const length = Math.hypot(dx, dy) || 1
  const step = Math.min(by, length / 2)
  return { x: end.x - (dx / length) * step, y: end.y - (dy / length) * step }
}

interface Geometry {
  /** Points the line passes; with `control`, the ends of one quadratic curve. */
  points: Point[]
  control?: Point
  /** Bends smoothed into curves, for a routed line drawn `curved`. */
  smooth?: boolean
}

/** Right angles for a layered layout: out of the far side, into the near one, spread when shared. */
function orthogonalPorts(
  edges: RouteEdge[],
  shapes: Map<string, Shape>,
  right: boolean,
): Map<string, { out: number; in: number; offset: number }> {
  const axis = (shape: Shape): number => (right ? shape.cy : shape.cx)
  const outs = new Map<string, RouteEdge[]>()
  const ins = new Map<string, RouteEdge[]>()
  for (const edge of edges) {
    const a = shapes.get(edge.from)
    const b = shapes.get(edge.to)
    if (!a || !b) continue
    const ahead = right ? b.cx - b.hw > a.cx + a.hw + 16 : b.cy - b.hh > a.cy + a.hh + 16
    if (!ahead) continue
    outs.set(edge.from, [...(outs.get(edge.from) ?? []), edge])
    ins.set(edge.to, [...(ins.get(edge.to) ?? []), edge])
  }
  const ports = new Map<string, { out: number; in: number; offset: number }>()
  const spread = (list: RouteEdge[], shape: Shape, end: 'from' | 'to') => {
    const sorted = [...list].sort(
      (a, b) =>
        axis(shapes.get(a[end === 'from' ? 'to' : 'from'])!) -
        axis(shapes.get(b[end === 'from' ? 'to' : 'from'])!),
    )
    const span = right ? shape.hh : shape.hw
    const step = Math.min(12, (2 * span - 8) / Math.max(1, sorted.length - 1))
    sorted.forEach((edge, j) => {
      const port = ports.get(edge.key) ?? { out: 0, in: 0, offset: 0 }
      const place = axis(shape) + (j - (sorted.length - 1) / 2) * step
      if (end === 'from') port.out = place
      else {
        port.in = place
        port.offset = (j - (sorted.length - 1) / 2) * 8
      }
      ports.set(edge.key, port)
    })
  }
  for (const [id, list] of outs) spread(list, shapes.get(id)!, 'from')
  for (const [id, list] of ins) spread(list, shapes.get(id)!, 'to')
  return ports
}

function geometry(
  edge: RouteEdge,
  a: Shape,
  b: Shape,
  others: Rect[],
  options: RouteOptions,
  ports: Map<string, { out: number; in: number; offset: number }> | null,
): Geometry {
  const routed = options.routed?.get(edge.key)
  if (options.lines === 'orthogonal' && options.layered) {
    const port = ports?.get(edge.key)
    const right = options.layered === 'right'
    if (port) {
      if (right) {
        const start = { x: a.cx + a.hw + END_GAP, y: port.out }
        const end = { x: b.cx - b.hw - END_GAP, y: port.in }
        const mid = (start.x + end.x) / 2 + port.offset
        return { points: [start, { x: mid, y: start.y }, { x: mid, y: end.y }, end] }
      }
      const start = { x: port.out, y: a.cy + a.hh + END_GAP }
      const end = { x: port.in, y: b.cy - b.hh - END_GAP }
      const mid = (start.y + end.y) / 2 + port.offset
      return { points: [start, { x: start.x, y: mid }, { x: end.x, y: mid }, end] }
    }
    if (routed && routed.length > 1) return { points: routed }
    const dx = b.cx - a.cx
    const dy = b.cy - a.cy
    if (Math.abs(dx) < a.hw + b.hw + 24 || Math.abs(dy) < 8) {
      return { points: [border(a, dx, dy), border(b, -dx, -dy)] }
    }
    const start = { x: a.cx + (dx > 0 ? a.hw + END_GAP : -a.hw - END_GAP), y: a.cy }
    const end = { x: b.cx, y: b.cy + (dy > 0 ? -b.hh - END_GAP : b.hh + END_GAP) }
    return { points: [start, { x: end.x, y: start.y }, end] }
  }
  // Curved, a layered line follows dagre's route as one smooth line; straight, it goes straight.
  if (routed && routed.length > 1 && options.lines === 'curved')
    return { points: routed, smooth: true }
  const start = border(a, b.cx - a.cx, b.cy - a.cy)
  const end = border(b, a.cx - b.cx, a.cy - b.cy)
  // A line between two free nodes bends round whatever stands in its way, and bows when curved.
  const nx = -(end.y - start.y)
  const ny = end.x - start.x
  const chord = Math.hypot(nx, ny) || 1
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
  const bow = options.lines === 'curved' ? BOW * chord : 0
  const blocked = others.some((box) => segmentHits(start, end, box))
  if (!bow && !blocked) return { points: [start, end] }
  for (const offset of bow ? [bow, -bow, ...DETOURS] : DETOURS) {
    const control = { x: mid.x + (nx / chord) * offset, y: mid.y + (ny / chord) * offset }
    if (!curveHits(start, control, end, others)) return { points: [start, end], control }
  }
  return bow
    ? {
        points: [start, end],
        control: { x: mid.x + (nx / chord) * bow, y: mid.y + (ny / chord) * bow },
      }
    : { points: [start, end] }
}

function pathOf(points: Point[], control?: Point, smooth = false, right = true): string {
  const [first] = points
  if (!first) return ''
  const start = `M ${round(first.x)} ${round(first.y)}`
  if (control) {
    const last = points[points.length - 1]!
    return `${start} Q ${round(control.x)} ${round(control.y)} ${round(last.x)} ${round(last.y)}`
  }
  if (smooth && points.length > 2) {
    let d = start
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!
      const b = points[i]!
      const c1 = right ? { x: (a.x + b.x) / 2, y: a.y } : { x: a.x, y: (a.y + b.y) / 2 }
      const c2 = right ? { x: (a.x + b.x) / 2, y: b.y } : { x: b.x, y: (a.y + b.y) / 2 }
      d += ` C ${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(b.x)} ${round(b.y)}`
    }
    return d
  }
  return points.map((point, i) => `${i ? 'L' : 'M'} ${round(point.x)} ${round(point.y)}`).join(' ')
}

/** Every line, in the order given; a word placed earlier keeps its place against a later one. */
export function routeEdges(
  edges: RouteEdge[],
  shapes: Map<string, Shape>,
  options: RouteOptions,
): Route[] {
  const boxes = new Map([...shapes].map(([id, shape]) => [id, rectOf(shape)]))
  const nodeBoxes = [...boxes.values()]
  const ports =
    options.lines === 'orthogonal' && options.layered
      ? orthogonalPorts(edges, shapes, options.layered === 'right')
      : null
  const words: Rect[] = []
  const routes: Route[] = []
  for (const edge of edges) {
    const a = shapes.get(edge.from)
    const b = shapes.get(edge.to)
    if (!a || !b) continue
    const others = nodeBoxes.filter(
      (box) => box !== boxes.get(edge.from) && box !== boxes.get(edge.to),
    )
    const shape = geometry(edge, a, b, others, options, ports)
    const points = shape.points.map((point) => ({ ...point }))
    const control = shape.control
    const arrows: string[] = []
    const length = arrowLength(edge.width)
    const last = points.length - 1
    // The direction an end is reached from: the curve's control point, else the point before.
    const beforeEnd = control ?? points[last - 1] ?? points[0]!
    const afterStart = control ?? points[1] ?? points[last]!
    if (edge.direction !== 'none') {
      const tip = points[last]!
      arrows.push(arrow(tip, tip.x - beforeEnd.x, tip.y - beforeEnd.y, edge.width))
      points[last] = pullBack(tip, beforeEnd, length * 0.8)
    }
    if (edge.direction === 'both') {
      const tip = points[0]!
      arrows.push(arrow(tip, tip.x - afterStart.x, tip.y - afterStart.y, edge.width))
      points[0] = pullBack(tip, afterStart, length * 0.8)
    }
    let label: Point | null = null
    if (edge.label && edge.labelled) {
      const width = options.labelWidth(edge.label)
      const candidates: Point[] = []
      if (control)
        candidates.push(
          quadraticAt(shape.points[0]!, control, shape.points[shape.points.length - 1]!, 0.5),
        )
      for (const t of [0.5, 0.38, 0.62, 0.28, 0.72, 0.18, 0.82])
        candidates.push(along(shape.points, t))
      const clear = candidates.find((candidate) => {
        const box = {
          x: candidate.x - width / 2,
          y: candidate.y - LABEL_HEIGHT / 2,
          w: width,
          h: LABEL_HEIGHT,
        }
        return (
          !nodeBoxes.some((node) => overlaps(box, node)) &&
          !words.some((word) => overlaps(box, word))
        )
      })
      // A word with no clear place stays away, unless its line is in the light.
      const at = clear ?? (edge.lit ? candidates[0]! : null)
      if (at) {
        words.push({ x: at.x - width / 2, y: at.y - LABEL_HEIGHT / 2, w: width, h: LABEL_HEIGHT })
        label = { x: round(at.x), y: round(at.y) }
      }
    }
    routes.push({
      key: edge.key,
      d: pathOf(points, control, shape.smooth, options.layered !== 'down'),
      arrows,
      label,
    })
  }
  return routes
}
