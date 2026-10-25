/** The lines on the screen: where they leave a node, how they bend, their arrows and their words. */
import { describe, expect, it } from 'vitest'
import { border, routeEdges, segmentHits, type RouteEdge, type Shape } from './routes'

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
