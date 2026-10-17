/**
 * Where each node stands, in the graph's own units (px at zoom 1): layered by dagre, by force with
 * d3-force, or in rings round the centre. Each is deterministic — the same request gives the same
 * picture — and plain data in and out, so it runs in the worker as well as on the page.
 */
import { graphlib, layout as dagreLayout } from '@dagrejs/dagre'
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationNodeDatum,
} from 'd3-force'
import type { GraphLayout } from '../../../types'

export interface Point {
  x: number
  y: number
}

export interface LayoutRequest {
  kind: GraphLayout
  /** Each node's box, centred on where it will stand. */
  nodes: { id: string; width: number; height: number }[]
  edges: { from: string; to: string }[]
  centre: string | null
  /** Where the nodes stood: force keeps them there and puts a new one beside its neighbour. */
  previous?: Record<string, Point>
}

export interface LayoutResult {
  positions: Record<string, Point>
  /** Per edge, in the request's order: the points dagre routed it along. */
  routes?: Point[][]
}

/** Room between two nodes side by side, between two ranks, and between two lines. */
const NODE_GAP = 32
const RANK_GAP = 72
const EDGE_GAP = 16

/** A force layout: the length a relation pulls to, the push between nodes, and its run. */
const LINK_DISTANCE = 170
const CHARGE = -900
const TICKS = 300
const NEIGHBOUR_DISTANCE = 120

/** Rings round the centre: the least room between two, and per node along a ring. */
const RING_GAP = 200
const RING_ROOM = 96
/** A card is wider than tall, so the rings are stretched sideways. */
const RING_STRETCH = 1.3

function layered(request: LayoutRequest, rankdir: 'LR' | 'TB'): LayoutResult {
  const graph = new graphlib.Graph({ multigraph: true })
  graph.setGraph({ rankdir, nodesep: NODE_GAP, ranksep: RANK_GAP, edgesep: EDGE_GAP })
  graph.setDefaultEdgeLabel(() => ({}))
  for (const node of request.nodes)
    graph.setNode(node.id, { width: node.width, height: node.height })
  // The words are placed on the lines afterwards, clear of the nodes, so they take no rank.
  request.edges.forEach((edge, index) => graph.setEdge(edge.from, edge.to, {}, `e${index}`))
  dagreLayout(graph)
  const positions: Record<string, Point> = {}
  for (const node of request.nodes) {
    const { x = 0, y = 0 } = graph.node(node.id) as { x?: number; y?: number }
    positions[node.id] = { x, y }
  }
  const routes = request.edges.map((edge, index) => {
    const routed = graph.edge(edge.from, edge.to, `e${index}`) as { points?: Point[] }
    return (routed.points ?? []).map(({ x, y }) => ({ x, y }))
  })
  return { positions, routes }
}

interface ForceNode extends SimulationNodeDatum {
  id: string
}

function force(request: LayoutRequest): LayoutResult {
  const { previous } = request
  const neighbours = new Map(request.nodes.map((node) => [node.id, [] as string[]]))
  for (const edge of request.edges) {
    neighbours.get(edge.from)?.push(edge.to)
    neighbours.get(edge.to)?.push(edge.from)
  }
  const nodes: ForceNode[] = request.nodes.map((node, index) => {
    const before = previous?.[node.id]
    if (before) return { id: node.id, x: before.x, y: before.y, fx: before.x, fy: before.y }
    const near = previous && neighbours.get(node.id)?.find((id) => previous[id])
    if (near) {
      // A new node comes beside the one it hangs on, each a little further round.
      const angle = index * 2.4
      return {
        id: node.id,
        x: previous[near]!.x + NEIGHBOUR_DISTANCE * Math.cos(angle),
        y: previous[near]!.y + NEIGHBOUR_DISTANCE * Math.sin(angle),
      }
    }
    return { id: node.id }
  })
  const radius = Math.max(
    0,
    ...request.nodes.map((node) => Math.hypot(node.width, node.height) / 2),
  )
  const links = request.edges.map((edge) => ({ source: edge.from, target: edge.to }))
  const simulation = forceSimulation(nodes)
    .force(
      'link',
      forceLink<ForceNode, { source: string; target: string }>(links)
        .id((node) => node.id)
        .distance(LINK_DISTANCE),
    )
    .force('charge', forceManyBody().strength(CHARGE))
    .force('collide', forceCollide(radius + EDGE_GAP))
    // A weak pull to the middle keeps a loose part of the graph from drifting away.
    .force('x', forceX(0).strength(0.02))
    .force('y', forceY(0).strength(0.02))
    .stop()
  if (!previous) simulation.force('center', forceCenter(0, 0))
  simulation.tick(TICKS)
  const positions: Record<string, Point> = {}
  for (const node of nodes) positions[node.id] = { x: node.x ?? 0, y: node.y ?? 0 }
  return { positions }
}

/**
 * Rings round the centre, a ring per step away from it. The first ring goes round evenly from the
 * top; on each further ring the children stand in the angle of their parent.
 */
function radial(request: LayoutRequest): LayoutResult {
  const ids = request.nodes.map((node) => node.id)
  const centre = request.centre && ids.includes(request.centre) ? request.centre : ids[0]
  const positions: Record<string, Point> = {}
  if (!centre) return { positions }
  const neighbours = new Map(ids.map((id) => [id, [] as string[]]))
  for (const edge of request.edges) {
    neighbours.get(edge.from)?.push(edge.to)
    neighbours.get(edge.to)?.push(edge.from)
  }
  const ring = new Map([[centre, 0]])
  const parent = new Map<string, string>()
  const order = [centre]
  for (let i = 0; i < order.length; i++) {
    const id = order[i]!
    for (const next of neighbours.get(id) ?? []) {
      if (ring.has(next)) continue
      ring.set(next, ring.get(id)! + 1)
      parent.set(next, id)
      order.push(next)
    }
  }
  // A node the centre does not reach stands on the first ring.
  for (const id of ids) {
    if (ring.has(id)) continue
    ring.set(id, 1)
    parent.set(id, centre)
    order.push(id)
  }
  const rings: string[][] = []
  for (const id of order) (rings[ring.get(id)!] ??= []).push(id)
  const angle = new Map([[centre, 0]])
  positions[centre] = { x: 0, y: 0 }
  let radius = 0
  for (let r = 1; r < rings.length; r++) {
    const members = rings[r] ?? []
    const count = members.length
    if (!count) continue
    radius = Math.max(radius + RING_GAP, (count * RING_ROOM) / Math.PI)
    if (r === 1) {
      members.forEach((id, j) => angle.set(id, -Math.PI / 2 + (j * 2 * Math.PI) / count))
    } else {
      // The ring in its parents' order, evenly spaced: a large family takes the room it needs,
      // a small one stays close to its parent.
      const byParent = new Map<string, string[]>()
      for (const id of members) {
        const p = parent.get(id)!
        byParent.set(p, [...(byParent.get(p) ?? []), id])
      }
      const parents = [...byParent.keys()].sort((a, b) => angle.get(a)! - angle.get(b)!)
      const ordered = parents.flatMap((p) => byParent.get(p)!)
      const step = Math.min((2 * Math.PI) / count, (RING_GAP * 1.2) / radius)
      const first = byParent.get(parents[0]!)!.length
      const start = angle.get(parents[0]!)! - ((first - 1) / 2) * step
      ordered.forEach((id, j) => angle.set(id, start + j * step))
    }
    for (const id of members) {
      const a = angle.get(id)!
      positions[id] = { x: radius * RING_STRETCH * Math.cos(a), y: radius * Math.sin(a) }
    }
  }
  return { positions }
}

export function computeLayout(request: LayoutRequest): LayoutResult {
  switch (request.kind) {
    case 'layered-right':
      return layered(request, 'LR')
    case 'layered-down':
      return layered(request, 'TB')
    case 'radial':
      return radial(request)
    default:
      return force(request)
  }
}
