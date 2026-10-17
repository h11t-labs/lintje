/** The graph as drawn: groups, the centre, what hangs behind a node, folds and the default layout. */
import { describe, expect, it } from 'vitest'
import { buildModel, defaultLayout, groupId, relationLines } from './model'
import type { GraphEdge, GraphNode, GraphNodeType } from '../../../types'

const TYPES: GraphNodeType[] = [
  {
    key: 'org',
    label: 'Organisatie',
    plural: 'organisaties',
    icon: 'gebouwen-basis-kantoorgebouw',
  },
  { key: 'person', label: 'Persoon', plural: 'personen', icon: 'personen-genderneutraal' },
]

const node = (id: string, type = 'org', extra: Partial<GraphNode> = {}): GraphNode => ({
  id,
  label: id.toUpperCase(),
  type,
  ...extra,
})
const edge = (from: string, to: string, extra: Partial<GraphEdge> = {}): GraphEdge => ({
  from,
  to,
  ...extra,
})

/** A hub with `count` people hanging on it, and one more organisation beside it. */
function hub(count: number) {
  const people = Array.from({ length: count }, (_, i) => node(`p${i}`, 'person'))
  return {
    types: TYPES,
    nodes: [node('hub'), node('other'), ...people],
    edges: [
      edge('hub', 'other'),
      ...people.map((person) => edge(person.id, 'hub', { label: 'werkt bij' })),
    ],
  }
}

describe('the model', () => {
  it('leaves out a line to a node it does not know and a line to itself', () => {
    const model = buildModel({
      types: TYPES,
      nodes: [node('a'), node('b')],
      edges: [edge('a', 'b'), edge('a', 'x'), edge('b', 'b')],
    })
    expect(model.edges.map((item) => [item.from, item.to])).toEqual([['a', 'b']])
  })

  it('gives two lines between the same nodes keys of their own', () => {
    const model = buildModel({
      types: TYPES,
      nodes: [node('a'), node('b')],
      edges: [edge('a', 'b', { label: 'een' }), edge('a', 'b', { label: 'twee' })],
    })
    expect(new Set(model.edges.map((item) => item.key)).size).toBe(2)
  })

  it('reads a relation without a direction as one with an arrow at `to`', () => {
    const model = buildModel({
      types: TYPES,
      nodes: [node('a'), node('b')],
      edges: [edge('a', 'b')],
    })
    expect(model.edges[0]!.direction).toBe('to')
  })

  it('gathers more than five leaves of one kind on one node into a group', () => {
    const model = buildModel(hub(6))
    const group = model.byId.get(groupId('hub', 'person'))
    expect(group?.label).toBe('Personen')
    expect(group?.group).toEqual({ parent: 'hub', members: ['p0', 'p1', 'p2', 'p3', 'p4', 'p5'] })
    expect(model.nodes.map((item) => item.id)).toEqual(['hub', 'other', groupId('hub', 'person')])
    // The group's line takes the word and the direction of its first member's.
    expect(model.edges.find((item) => item.from === groupId('hub', 'person'))).toMatchObject({
      to: 'hub',
      label: 'werkt bij',
    })
  })

  it('leaves five leaves of one kind as they are', () => {
    expect(buildModel(hub(5)).nodes).toHaveLength(7)
  })

  it('shows the members of a group the reader opened', () => {
    const model = buildModel(hub(6), { opened: [groupId('hub', 'person')] })
    expect(model.nodes).toHaveLength(8)
  })

  it('keeps a node with relations still to load out of a group', () => {
    const data = hub(6)
    data.nodes[2] = { ...data.nodes[2]!, more: 3 }
    const model = buildModel(data)
    expect(model.byId.get(groupId('hub', 'person'))).toBeUndefined()
  })

  it('takes the busiest node as its centre, the first named on a tie', () => {
    expect(buildModel(hub(3)).centre).toBe('hub')
    const tie = buildModel({ types: TYPES, nodes: [node('a'), node('b')], edges: [edge('a', 'b')] })
    expect(tie.centre).toBe('a')
  })

  it('keeps the centre it had when the graph grows round another node', () => {
    const data = {
      types: TYPES,
      nodes: [node('a'), node('b'), node('c'), node('d')],
      edges: [edge('a', 'b'), edge('a', 'c'), edge('c', 'd')],
    }
    const grown = {
      ...data,
      nodes: [...data.nodes, node('e'), node('f'), node('g')],
      edges: [...data.edges, edge('d', 'e'), edge('d', 'f'), edge('d', 'g')],
    }
    expect(buildModel(grown).centre).toBe('d')
    expect(buildModel(grown, { centre: buildModel(data).centre }).centre).toBe('a')
  })

  it('hangs behind a node what the centre reaches only through it', () => {
    const model = buildModel({
      types: TYPES,
      nodes: [node('a'), node('b'), node('c'), node('d'), node('e')],
      edges: [edge('a', 'b'), edge('a', 'c'), edge('a', 'e'), edge('c', 'd'), edge('b', 'd')],
    })
    expect(model.centre).toBe('a')
    // d is reached through b and through c, so it hangs behind neither.
    expect(model.behind.get('b')).toBeUndefined()
    expect(model.behind.get('c')).toBeUndefined()
    expect(model.behind.get('a')?.sort()).toEqual(['b', 'c', 'd', 'e'])
  })

  it('reads the arrows both ways for what hangs behind a node', () => {
    const model = buildModel({
      types: TYPES,
      nodes: [node('a'), node('b'), node('c'), node('d')],
      edges: [edge('a', 'b'), edge('a', 'c'), edge('d', 'c')],
    })
    expect(model.behind.get('c')).toEqual(['d'])
  })

  it('hides what hangs behind a folded node, and its lines', () => {
    const model = buildModel(
      {
        types: TYPES,
        nodes: [node('a'), node('b'), node('c'), node('d')],
        edges: [edge('a', 'b'), edge('a', 'c'), edge('c', 'd')],
      },
      { collapsed: ['c'] },
    )
    expect(model.nodes.map((item) => item.id)).toEqual(['a', 'b', 'c'])
    expect(model.edges).toHaveLength(2)
    expect(model.behind.get('c')).toEqual(['d'])
  })

  it('leaves the centre alone when the centre itself is folded', () => {
    const model = buildModel(hub(3), { collapsed: ['hub'] })
    expect(model.nodes.map((item) => item.id)).toEqual(['hub'])
  })
})

describe('the layout a graph takes by its shape', () => {
  const layoutOf = (nodes: GraphNode[], edges: GraphEdge[]) =>
    defaultLayout(buildModel({ types: TYPES, nodes, edges }))
  const ids = (...list: string[]) => list.map((id) => node(id))

  it('lays a chain of directed relations out to the right', () => {
    expect(
      layoutOf(ids('a', 'b', 'c', 'd', 'e'), [
        edge('a', 'c'),
        edge('b', 'c'),
        edge('c', 'd'),
        edge('d', 'e'),
      ]),
    ).toBe('layered-right')
  })

  it('puts a hub in the middle of its rings', () => {
    expect(
      layoutOf(ids('hub', 'a', 'b', 'c', 'd', 'e'), [
        edge('hub', 'a'),
        edge('hub', 'b'),
        edge('hub', 'c'),
        edge('hub', 'd'),
        edge('a', 'e', { direction: 'none' }),
      ]),
    ).toBe('radial')
  })

  it('lays a hierarchy with two parents out downwards', () => {
    expect(
      layoutOf(ids('top', 'l', 'r', 'a', 'b', 'c', 'x'), [
        edge('top', 'l', { direction: 'none' }),
        edge('top', 'r', { direction: 'none' }),
        edge('l', 'a', { direction: 'none' }),
        edge('l', 'b', { direction: 'none' }),
        edge('r', 'b', { direction: 'none' }),
        edge('r', 'c', { direction: 'none' }),
        edge('b', 'x'),
      ]),
    ).toBe('layered-down')
  })

  it('lays a ring of references, or a relation both ways, out by force', () => {
    expect(layoutOf(ids('a', 'b', 'c'), [edge('a', 'b'), edge('b', 'c'), edge('c', 'a')])).toBe(
      'force',
    )
    expect(layoutOf(ids('a', 'b'), [edge('a', 'b', { direction: 'both' })])).toBe('force')
  })

  it('lays a large network out by force', () => {
    const many = Array.from({ length: 101 }, (_, i) => node(`n${i}`))
    expect(
      layoutOf(
        many,
        many.slice(1).map((item, i) => edge(`n${i}`, item.id)),
      ),
    ).toBe('force')
  })
})

describe('the relations as sentences', () => {
  const model = buildModel({
    types: TYPES,
    nodes: [node('zaak'), node('a'), node('b'), node('c'), node('d'), node('e')],
    edges: [
      edge('zaak', 'a', { label: 'aanvrager' }),
      edge('b', 'zaak', { label: 'behandelt' }),
      edge('zaak', 'c', { direction: 'none' }),
      edge('zaak', 'd', { label: 'verwijzen naar elkaar', direction: 'both' }),
      edge('zaak', 'e', { label: 'bijlage' }),
    ],
  })

  it('reads each relation from the node, with an arrow for its direction', () => {
    expect(relationLines(model, 'zaak', 10)).toEqual([
      'aanvrager → A',
      'B → behandelt',
      'verbonden met C',
      'verwijzen naar elkaar ↔ D',
      'bijlage → E',
    ])
  })

  it('names at most four and counts the rest', () => {
    expect(relationLines(model, 'zaak')).toEqual([
      'aanvrager → A',
      'B → behandelt',
      'verbonden met C',
      'verwijzen naar elkaar ↔ D',
      'nog 1',
    ])
  })
})
