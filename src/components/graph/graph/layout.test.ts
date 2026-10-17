/** The layouts: each the same for the same request, and each in its own shape. */
import { describe, expect, it } from 'vitest'
import { computeLayout, type LayoutRequest } from './layout'
import type { GraphLayout } from '../../../types'

const box = (id: string) => ({ id, width: 168, height: 40 })

function request(kind: GraphLayout, extra: Partial<LayoutRequest> = {}): LayoutRequest {
  return {
    kind,
    nodes: ['a', 'b', 'c', 'd', 'e'].map(box),
    edges: [
      { from: 'a', to: 'b' },
      { from: 'a', to: 'c' },
      { from: 'b', to: 'd' },
      { from: 'c', to: 'e' },
    ],
    centre: 'a',
    ...extra,
  }
}

describe('a layout', () => {
  it.each(['layered-right', 'layered-down', 'force', 'radial'] as const)(
    'draws %s the same for the same graph',
    (kind) => {
      expect(computeLayout(request(kind))).toEqual(computeLayout(request(kind)))
    },
  )

  it('places every node', () => {
    for (const kind of ['layered-right', 'layered-down', 'force', 'radial'] as const) {
      expect(Object.keys(computeLayout(request(kind)).positions).sort(), kind).toEqual([
        'a',
        'b',
        'c',
        'd',
        'e',
      ])
    }
  })

  it('layers to the right: every relation goes rightwards, along a route of its own', () => {
    const { positions, routes } = computeLayout(request('layered-right'))
    for (const [from, to] of [
      ['a', 'b'],
      ['b', 'd'],
    ]) {
      expect(positions[to]!.x).toBeGreaterThan(positions[from]!.x)
    }
    expect(routes).toHaveLength(4)
  })

  it('layers downwards: every relation goes down', () => {
    const { positions } = computeLayout(request('layered-down'))
    expect(positions.b!.y).toBeGreaterThan(positions.a!.y)
    expect(positions.d!.y).toBeGreaterThan(positions.b!.y)
  })

  it('puts the centre in the middle of its rings, its neighbours on the first', () => {
    const { positions } = computeLayout(request('radial'))
    expect(positions.a).toEqual({ x: 0, y: 0 })
    const ring = (id: string) => Math.hypot(positions[id]!.x / 1.3, positions[id]!.y)
    expect(ring('b')).toBeCloseTo(ring('c'))
    expect(ring('d')).toBeGreaterThan(ring('b'))
  })

  it('keeps what stood by force where it stood and puts a new node near its neighbour', () => {
    const before = computeLayout(request('force')).positions
    const grown = request('force', {
      nodes: [...request('force').nodes, box('f')],
      edges: [...request('force').edges, { from: 'e', to: 'f' }],
      previous: before,
    })
    const after = computeLayout(grown).positions
    for (const id of ['a', 'b', 'c', 'd', 'e']) expect(after[id]).toEqual(before[id])
    const distance = Math.hypot(after.f!.x - after.e!.x, after.f!.y - after.e!.y)
    expect(distance).toBeLessThan(400)
  })

  it('keeps nodes by force apart', () => {
    const { positions } = computeLayout(request('force'))
    const ids = Object.keys(positions)
    for (const a of ids)
      for (const b of ids) {
        if (a >= b) continue
        expect(
          Math.hypot(positions[a]!.x - positions[b]!.x, positions[a]!.y - positions[b]!.y),
        ).toBeGreaterThan(100)
      }
  })
})
