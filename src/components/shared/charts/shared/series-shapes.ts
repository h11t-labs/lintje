/**
 * The shapes a map point may take, one per data series (rule 13: colour is never the only
 * carrier). Every shape has the area of a circle of the given radius (π r²), so no series is
 * louder than another at the same value.
 */
import { DATA_COLORS } from '../../../../tokens/colors'

/** The series names: the data colours, in their canonical order. */
export const SERIES_KEYS = DATA_COLORS

export type SeriesKey = (typeof SERIES_KEYS)[number]

export function isSeriesKey(value: unknown): value is SeriesKey {
  return typeof value === 'string' && (SERIES_KEYS as readonly string[]).includes(value)
}

const SHAPES = [
  'circle',
  'square',
  'triangle',
  'diamond',
  'hexagon',
  'triangle-down',
  'pentagon',
  'plus',
  'cross',
  'octagon',
  'triangle-right',
  'triangle-left',
  'star',
  'star-4',
  'hourglass',
  'rectangle',
  'kite',
] as const

export type SeriesShape = (typeof SHAPES)[number]

export function seriesShape(series: SeriesKey): SeriesShape {
  return SHAPES[SERIES_KEYS.indexOf(series)]
}

/**
 * The circumradius of a regular `n`-gon whose area equals that of a circle of
 * radius 1: area = ½·n·R²·sin(2π/n) = π.
 */
function circumradius(n: number): number {
  return Math.sqrt((2 * Math.PI) / (n * Math.sin((2 * Math.PI) / n)))
}

function polygon(n: number, rotation: number, radius: number): [number, number][] {
  const r = circumradius(n) * radius
  return Array.from({ length: n }, (_, i) => {
    const angle = rotation + (i * 2 * Math.PI) / n
    return [r * Math.cos(angle), r * Math.sin(angle)] as [number, number]
  })
}

/**
 * Five squares in a cross: 5·s² = π r², so the side is r·√(π/5). A rotation keeps the area;
 * π/4 turns the plus into the diagonal cross.
 */
function plus(radius: number, rotation = 0): [number, number][] {
  const h = (radius * Math.sqrt(Math.PI / 5)) / 2
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  const corners: [number, number][] = [
    [-h, -3 * h],
    [h, -3 * h],
    [h, -h],
    [3 * h, -h],
    [3 * h, h],
    [h, h],
    [h, 3 * h],
    [-h, 3 * h],
    [-h, h],
    [-3 * h, h],
    [-3 * h, -h],
    [-h, -h],
  ]
  return corners.map(([x, y]) => [x * cos - y * sin, x * sin + y * cos])
}

/** A star of `n` points, the inner radius half the outer: area n·½·R²·sin(π/n). */
function star(n: number, radius: number): [number, number][] {
  const inner = 0.5
  const outer = radius * Math.sqrt(Math.PI / (n * inner * Math.sin(Math.PI / n)))
  return Array.from({ length: 2 * n }, (_, k) => {
    const r = k % 2 === 0 ? outer : inner * outer
    const angle = -Math.PI / 2 + (k * Math.PI) / n
    return [r * Math.cos(angle), r * Math.sin(angle)] as [number, number]
  })
}

/** A bar twice as wide as it is tall: 2a · a = π r². */
function rectangle(radius: number): [number, number][] {
  const a = radius * Math.sqrt(Math.PI / 2)
  const b = a / 2
  return [
    [-a, -b],
    [a, -b],
    [a, b],
    [-a, b],
  ]
}

/** Two triangles meeting at the centre, height 1.25 × their width: 2ab = π r². */
function hourglass(radius: number): [number, number][] {
  const a = radius * Math.sqrt(Math.PI / 2.5)
  const b = 1.25 * a
  return [
    [-a, -b],
    [a, -b],
    [0, 0],
    [a, b],
    [-a, b],
    [0, 0],
  ]
}

/** A diamond twice as tall as wide: diagonals p and 2p, area p². */
function kite(radius: number): [number, number][] {
  const p = radius * Math.sqrt(Math.PI)
  return [
    [0, -p],
    [p / 2, 0],
    [0, p],
    [-p / 2, 0],
  ]
}

/** The corners of a series' shape around (0, 0); `null` for the circle. Exported for tests. */
export function seriesShapePoints(shape: SeriesShape, radius = 1): [number, number][] | null {
  const up = -Math.PI / 2
  switch (shape) {
    case 'circle':
      return null
    case 'square':
      return polygon(4, Math.PI / 4, radius)
    case 'diamond':
      return polygon(4, up, radius)
    case 'triangle':
      return polygon(3, up, radius)
    case 'triangle-down':
      return polygon(3, Math.PI / 2, radius)
    case 'pentagon':
      return polygon(5, up, radius)
    case 'hexagon':
      return polygon(6, up, radius)
    case 'plus':
      return plus(radius)
    case 'cross':
      return plus(radius, Math.PI / 4)
    case 'octagon':
      return polygon(8, up, radius)
    case 'triangle-right':
      return polygon(3, 0, radius)
    case 'triangle-left':
      return polygon(3, Math.PI, radius)
    case 'star':
      return star(5, radius)
    case 'star-4':
      return star(4, radius)
    case 'hourglass':
      return hourglass(radius)
    case 'rectangle':
      return rectangle(radius)
    case 'kite':
      return kite(radius)
  }
}

/** The `d` of a series' shape, centred on (0, 0) or on `cx`/`cy`. */
export function seriesShapePath(shape: SeriesShape, radius = 1, cx = 0, cy = 0): string {
  const points = seriesShapePoints(shape, radius)
  if (!points) {
    return `M ${cx - radius} ${cy} a ${radius} ${radius} 0 1 0 ${radius * 2} 0 a ${radius} ${radius} 0 1 0 ${-radius * 2} 0 Z`
  }
  const round = (n: number) => Number(n.toFixed(3))
  return `${points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${round(cx + x)} ${round(cy + y)}`)
    .join(' ')} Z`
}

/** The `d` of the point a map draws for `series`; a circle without one. */
export function markPath(series: SeriesKey | undefined, radius: number, cx = 0, cy = 0): string {
  return seriesShapePath(series ? seriesShape(series) : 'circle', radius, cx, cy)
}
