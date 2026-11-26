/** The lines on the screen: where they leave a node, how they bend, their arrows and their words. */
import { describe, expect, it } from 'vitest'
import {
  along,
  border,
  distanceTo,
  leaveAngle,
  nearestRoute,
  routeEdges,
  segmentHits,
  type RouteEdge,
  type Shape,
} from './routes'

const card = (cx: number, cy: number): Shape => ({ cx, cy, hw: 80, hh: 20, round: false })
const mark = (cx: number, cy: number): Shape => ({ cx, cy, hw: 14, hh: 14, round: true })

const line = (from: string, to: string, extra: Partial<RouteEdge> = {}): RouteEdge => ({
  key: `${from}-${to}`,
  from,
  to,
  label: '',
  direction: 'to',
  width: 1.5,
  labelled: true,
  lit: false,
  ...extra,
})

const options = {
  lines: 'straight' as const,
  layered: null,
  labelWidth: (text: string) => text.length * 7,
}

describe('a line', () => {
  it('leaves a card at its edge and a mark at its circle, a little away', () => {
    expect(border(card(0, 0), 1, 0)).toEqual({ x: 83, y: 0 })
    expect(border(mark(0, 0), 0, 1)).toEqual({ x: 0, y: 17 })
  })

  it('knows when it crosses a box', () => {
    const box = { x: -10, y: -10, w: 20, h: 20 }
    expect(segmentHits({ x: -50, y: 0 }, { x: 50, y: 0 }, box)).toBe(true)
    expect(segmentHits({ x: -50, y: 30 }, { x: 50, y: 30 }, box)).toBe(false)
  })

  it('runs straight between two nodes with nothing in the way', () => {
    const shapes = new Map([
      ['a', card(0, 0)],
      ['b', card(400, 0)],
    ])
    const [route] = routeEdges([line('a', 'b')], shapes, options)
    expect(route!.d).toMatch(/^M [\d.]+ 0 L [\d.]+ 0$/)
  })

  it('bends round a node in its way', () => {
    const shapes = new Map([
      ['a', card(0, 0)],
      ['b', card(600, 0)],
      ['c', card(300, 0)],
    ])
    const [route] = routeEdges([line('a', 'b')], shapes, options)
    expect(route!.d).toContain(' Q ')
  })

  it('bows when curved', () => {
    const shapes = new Map([
      ['a', mark(0, 0)],
      ['b', mark(300, 0)],
    ])
    const [route] = routeEdges([line('a', 'b')], shapes, { ...options, lines: 'curved' })
    expect(route!.d).toContain(' Q ')
  })

  it('draws right angles in a layered layout', () => {
    const shapes = new Map([
      ['a', card(0, 0)],
      ['b', card(300, 80)],
    ])
    const [route] = routeEdges([line('a', 'b')], shapes, {
      ...options,
      lines: 'orthogonal',
      layered: 'right',
    })
    const points = [...route!.d.matchAll(/[ML] ([\d.-]+) ([\d.-]+)/g)].map(([, x, y]) => [
      Number(x),
      Number(y),
    ])
    expect(points).toHaveLength(4)
    expect(points[0]![1]).toBe(points[1]![1])
    expect(points[1]![0]).toBe(points[2]![0])
  })

  it('carries an arrowhead at the end its direction points to', () => {
    const shapes = new Map([
      ['a', card(0, 0)],
      ['b', card(400, 0)],
    ])
    const routes = routeEdges(
      [
        line('a', 'b', { key: 'to' }),
        line('a', 'b', { key: 'both', direction: 'both' }),
        line('a', 'b', { key: 'none', direction: 'none' }),
      ],
      shapes,
      options,
    )
    expect(routes.map((route) => route.arrows.length)).toEqual([1, 2, 0])
  })
})

describe('the word on a line', () => {
  it('stands on the line, clear of the nodes', () => {
    const shapes = new Map([
      ['a', card(0, 0)],
      ['b', card(400, 0)],
    ])
    const [route] = routeEdges([line('a', 'b', { label: 'aanvrager' })], shapes, options)
    expect(route!.label).toEqual({ x: 200, y: 0 })
  })

  it('makes way for a word placed before it', () => {
    const shapes = new Map([
      ['a', card(0, 0)],
      ['b', card(400, 0)],
    ])
    const [first, second] = routeEdges(
      [
        line('a', 'b', { key: 'one', label: 'een woord' }),
        line('a', 'b', { key: 'two', label: 'een woord' }),
      ],
      shapes,
      options,
    )
    expect(second!.label).not.toEqual(first!.label)
  })

  it('stays away where it has no clear place, unless its line is in the light', () => {
    const shapes = new Map([
      ['a', card(0, 0)],
      ['b', card(170, 0)],
    ])
    const word = 'een heel lang woord'
    expect(routeEdges([line('a', 'b', { label: word })], shapes, options)[0]!.label).toBeNull()
    expect(
      routeEdges([line('a', 'b', { label: word, lit: true })], shapes, options)[0]!.label,
    ).not.toBeNull()
  })

  it('shows only when asked', () => {
    const shapes = new Map([
      ['a', card(0, 0)],
      ['b', card(400, 0)],
    ])
    const [route] = routeEdges(
      [line('a', 'b', { label: 'aanvrager', labelled: false })],
      shapes,
      options,
    )
    expect(route!.label).toBeNull()
  })
})

describe('the line under the pointer', () => {
  /** A point between two lines, a share `toB` of the way from a's point to b's. */
  const between = (
    a: { points: { x: number; y: number }[] },
    b: typeof a,
    t: number,
    toB: number,
  ) => {
    const p = along(a.points, t)
    const q = along(b.points, t)
    return { x: p.x + (q.x - p.x) * toB, y: p.y + (q.y - p.y) * toB }
  }

  it('is the nearest of ten curved lines round a hub, not the one drawn on top', () => {
    const shapes = new Map<string, Shape>([['hub', mark(0, 0)]])
    const spokes = Array.from({ length: 10 }, (_, i) => {
      const angle = (i / 10) * 2 * Math.PI
      shapes.set(`n${i}`, mark(Math.cos(angle) * 160, Math.sin(angle) * 160))
      return line('hub', `n${i}`, { key: `s${i}` })
    })
    const routes = routeEdges(spokes, shapes, { ...options, lines: 'curved' })
    const [a, b] = [routes[3]!, routes[4]!]
    // Close to the hub, where both targets overlap, but nearer to the first.
    const point = between(a, b, 0.1, 0.4)
    expect(distanceTo(point, b)).toBeLessThanOrEqual(12)
    expect(nearestRoute(point, [a, b], shapes.values(), 12)).toBe(a)
    expect(nearestRoute(point, [b, a], shapes.values(), 12)).toBe(a)
    expect(nearestRoute(between(a, b, 0.1, 0.6), [a, b], shapes.values(), 12)).toBe(b)
  })

  it('is the nearest of two right-angled lines that run side by side', () => {
    const shapes = new Map([
      ['a', card(0, 0)],
      ['b', card(300, -20)],
      ['c', card(300, 20)],
    ])
    const routes = routeEdges(
      [line('a', 'b', { key: 'ab' }), line('a', 'c', { key: 'ac' })],
      shapes,
      { ...options, lines: 'orthogonal', layered: 'right' },
    )
    const [ab, ac] = routes as [(typeof routes)[number], (typeof routes)[number]]
    // Their bends run a few px apart: a point between them goes to the nearer.
    const x = ab.points[1]!.x
    const gap = Math.abs(ab.points[1]!.x - ac.points[1]!.x)
    expect(gap).toBeLessThan(24)
    const y = (ab.points[1]!.y + ab.points[2]!.y) / 2
    expect(nearestRoute({ x: x + 1, y }, [ac, ab], shapes.values(), 12)).toBe(ab)
    expect(
      nearestRoute(
        { x: ac.points[1]!.x + 1, y: (ac.points[1]!.y + ac.points[2]!.y) / 2 },
        [ab, ac],
        shapes.values(),
        12,
      ),
    ).toBe(ac)
  })

  it('is the line whose word the pointer is on, even nearer another line', () => {
    const word = { x: 100, y: -10, w: 80, h: 20 }
    const own = {
      points: [
        { x: 0, y: -40 },
        { x: 300, y: -40 },
      ],
      word,
    }
    const other = {
      points: [
        { x: 0, y: 8 },
        { x: 300, y: 8 },
      ],
      word: null,
    }
    expect(nearestRoute({ x: 140, y: 6 }, [own, other], [], 12)).toBe(own)
    expect(nearestRoute({ x: 40, y: 6 }, [own, other], [], 12)).toBe(other)
  })

  it('is none on a node, and none beyond 12 px', () => {
    const shapes = new Map([
      ['a', card(0, 0)],
      ['b', card(400, 0)],
    ])
    const routes = routeEdges([line('a', 'b')], shapes, options)
    expect(nearestRoute({ x: 200, y: 11 }, routes, shapes.values(), 12)).toBe(routes[0])
    expect(nearestRoute({ x: 200, y: 13 }, routes, shapes.values(), 12)).toBeNull()
    expect(nearestRoute({ x: 70, y: 2 }, routes, shapes.values(), 12)).toBeNull()
  })

  it('gives the word of a choosable line the box of its frame', () => {
    const shapes = new Map([
      ['a', card(0, 0)],
      ['b', card(400, 0)],
    ])
    const [route] = routeEdges(
      [line('a', 'b', { label: 'werkt bij', framed: true })],
      shapes,
      options,
    )
    // 63 px of word, 4 px of halo and 4 of frame each side; 20 px tall.
    expect(route!.word).toEqual({ x: 164.5, y: -10, w: 71, h: 20 })
  })
})

describe('the way a line leaves its node', () => {
  it('reads clockwise from straight up', () => {
    const from = { x: 0, y: 0 }
    expect(leaveAngle([from, { x: 0, y: -10 }], 'from')).toBe(0)
    expect(leaveAngle([from, { x: 10, y: 0 }], 'from')).toBeCloseTo(Math.PI / 2)
    expect(leaveAngle([from, { x: 0, y: 10 }], 'from')).toBeCloseTo(Math.PI)
    expect(leaveAngle([from, { x: -10, y: 0 }], 'from')).toBeCloseTo((3 * Math.PI) / 2)
    // At its far end a line leaves the other way.
    expect(leaveAngle([from, { x: 0, y: 10 }], 'to')).toBe(0)
  })
})
