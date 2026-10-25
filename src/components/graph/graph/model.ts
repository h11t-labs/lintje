/**
 * The graph as drawn, from the graph as the host sent it: the leaves gathered into groups, the
 * centre, what hangs behind each node, and the branches the reader folded. Pure: the element, the
 * layout worker and the tests read the same functions.
 */
import type {
  GraphData,
  GraphDirection,
  GraphEdge,
  GraphLayout,
  GraphNode,
  GraphNodeType,
} from '../../../types'

/** More leaves than this of one kind on one node become a group, as a pie folds into "Overig". */
export const GROUP_MAX = 5

/** Above this many nodes the layout is worked out away from the page, in a worker. */
export const LARGE_GRAPH = 100

/** A group's id: the node its members hang on and their kind. */
export function groupId(parent: string, type: string): string {
  return `groep:${parent}:${type}`
}

export interface DrawnNode extends GraphNode {
  /** A group of leaves: the node they hang on and their ids, in the host's order. */
  group?: { parent: string; members: string[] }
}

export interface DrawnEdge {
  /** Stable while both ends stay: the ends and how many before it share them. */
  key: string
  from: string
  to: string
  label: string
  direction: GraphDirection
  value?: number
  unit?: string
}

export interface GraphModel {
  nodes: DrawnNode[]
  edges: DrawnEdge[]
  byId: Map<string, DrawnNode>
  neighbours: Map<string, Set<string>>
  /** The busiest node; it stays while it is there, so opening a branch never moves it. */
  centre: string | null
  /** What hangs behind a node: all the centre reaches only through it. The centre has all. */
  behind: Map<string, string[]>
  /** The nodes a folded branch hides, drawn no more. */
  folded: Set<string>
  /** Every node's name as the host sent it, members of a group too. */
  names: Map<string, string>
  /** The layout the graph's shape asks for, read before any branch is folded. */
  layout: GraphLayout
}

const pair = (from: string, to: string): string => `${from}\u0000${to}`

function edgesOf(nodes: Map<string, GraphNode>, edges: GraphEdge[]): DrawnEdge[] {
  const seen = new Map<string, number>()
  return edges
    .filter((edge) => edge.from !== edge.to && nodes.has(edge.from) && nodes.has(edge.to))
    .map((edge) => {
      const ends = pair(edge.from, edge.to)
      const count = seen.get(ends) ?? 0
      seen.set(ends, count + 1)
      return {
        key: `${ends}\u0000${count}`,
        from: edge.from,
        to: edge.to,
        label: edge.label ?? '',
        direction: edge.direction ?? 'to',
        value: edge.value,
        unit: edge.unit,
      }
    })
}

export function adjacency(nodes: { id: string }[], edges: DrawnEdge[]): Map<string, Set<string>> {
  const neighbours = new Map(nodes.map((node) => [node.id, new Set<string>()]))
  for (const edge of edges) {
    neighbours.get(edge.from)?.add(edge.to)
    neighbours.get(edge.to)?.add(edge.from)
  }
  return neighbours
}

/**
 * More than `GROUP_MAX` leaves of one kind that hang only on one node become one node. Its edge
 * takes the word and the direction of its first member's.
 */
function gather(
  nodes: GraphNode[],
  edges: DrawnEdge[],
  opened: ReadonlySet<string>,
  types: GraphNodeType[],
): { nodes: DrawnNode[]; edges: DrawnEdge[] } {
  const degree = new Map<string, number>()
  for (const edge of edges) {
    degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1)
    degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1)
  }
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const leafOf = new Map<string, { parent: string; edge: DrawnEdge }>()
  for (const edge of edges) {
    const from = degree.get(edge.from) ?? 0
    const to = degree.get(edge.to) ?? 0
    if (from === 1 && to !== 1) leafOf.set(edge.from, { parent: edge.to, edge })
    else if (to === 1 && from !== 1) leafOf.set(edge.to, { parent: edge.from, edge })
  }
  const buckets = new Map<string, string[]>()
  for (const node of nodes) {
    const leaf = leafOf.get(node.id)
    if (!leaf || node.more) continue
    const id = groupId(leaf.parent, node.type)
    buckets.set(id, [...(buckets.get(id) ?? []), node.id])
  }
  const gone = new Set<string>()
  const groups: DrawnNode[] = []
  const links: DrawnEdge[] = []
  for (const [id, members] of buckets) {
    if (members.length <= GROUP_MAX || opened.has(id)) continue
    const { parent, edge } = leafOf.get(members[0]!)!
    const first = byId.get(members[0]!)!
    for (const member of members) gone.add(member)
    groups.push({
      id,
      label: pluralOf(types, first.type),
      type: first.type,
      group: { parent, members },
    })
    const outward = edge.from === parent
    links.push({
      ...edge,
      key: pair(outward ? parent : id, outward ? id : parent),
      from: outward ? parent : id,
      to: outward ? id : parent,
      value: undefined,
    })
  }
  return {
    nodes: [...nodes.filter((node) => !gone.has(node.id)), ...groups],
    edges: [...edges.filter((edge) => !gone.has(edge.from) && !gone.has(edge.to)), ...links],
  }
}

/** The node with the most relations; the first the host names wins a tie. */
export function busiest(
  nodes: { id: string }[],
  neighbours: Map<string, Set<string>>,
): string | null {
  let best: string | null = null
  let most = -1
  for (const node of nodes) {
    const count = neighbours.get(node.id)?.size ?? 0
    if (count > most) {
      best = node.id
      most = count
    }
  }
  return best
}

function reach(neighbours: Map<string, Set<string>>, start: string, without?: string): Set<string> {
  const seen = new Set([start])
  if (without) seen.add(without)
  const queue = [start]
  for (let i = 0; i < queue.length; i++) {
    for (const next of neighbours.get(queue[i]!) ?? []) {
      if (seen.has(next)) continue
      seen.add(next)
      queue.push(next)
    }
  }
  if (without) seen.delete(without)
  return seen
}

/**
 * What hangs behind each node: everything the centre reaches only through it, whichever way the
 * arrows point. Behind the centre hangs all it reaches, so folding it leaves the centre alone.
 */
export function behindSets(
  nodes: { id: string }[],
  neighbours: Map<string, Set<string>>,
  centre: string | null,
): Map<string, string[]> {
  const behind = new Map<string, string[]>()
  if (!centre || !neighbours.has(centre)) return behind
  const all = reach(neighbours, centre)
  for (const node of nodes) {
    if (!all.has(node.id)) continue
    const still = node.id === centre ? new Set([centre]) : reach(neighbours, centre, node.id)
    const hanging = [...all].filter((id) => id !== node.id && !still.has(id))
    if (hanging.length) behind.set(node.id, hanging)
  }
  return behind
}

export interface ModelOptions {
  /** Groups opened, by `groupId`. */
  opened?: Iterable<string>
  /** Nodes whose branch is folded. */
  collapsed?: Iterable<string>
  /** The centre the element kept; it stays while the graph still has it. */
  centre?: string | null
}

export function buildModel(
  data: Pick<GraphData, 'nodes' | 'edges' | 'types'>,
  options: ModelOptions = {},
): GraphModel {
  const unique = new Map<string, GraphNode>()
  for (const node of data.nodes) if (!unique.has(node.id)) unique.set(node.id, node)
  const names = new Map([...unique.values()].map((node) => [node.id, node.label]))
  const sent = edgesOf(unique, data.edges)
  const { nodes, edges } = gather(
    [...unique.values()],
    sent,
    new Set(options.opened ?? []),
    data.types,
  )
  const neighbours = adjacency(nodes, edges)
  const kept = options.centre && neighbours.has(options.centre) ? options.centre : null
  const centre = kept ?? busiest(nodes, neighbours)
  const behind = behindSets(nodes, neighbours, centre)
  const layout = defaultLayout({ nodes, edges, neighbours, centre })
  const folded = new Set<string>()
  for (const id of options.collapsed ?? [])
    for (const hidden of behind.get(id) ?? []) folded.add(hidden)
  const shown = nodes.filter((node) => !folded.has(node.id))
  const lines = edges.filter((edge) => !folded.has(edge.from) && !folded.has(edge.to))
  return {
    nodes: shown,
    edges: lines,
    byId: new Map(nodes.map((node) => [node.id, node])),
    neighbours: adjacency(shown, lines),
    centre,
    behind,
    folded,
    names,
    layout,
  }
}

/** A directed cycle, reading a relation without direction from `from` to `to`. */
function hasCycle(nodes: { id: string }[], edges: DrawnEdge[]): boolean {
  const out = new Map(nodes.map((node) => [node.id, [] as string[]]))
  for (const edge of edges) out.get(edge.from)?.push(edge.to)
  const state = new Map<string, 1 | 2>()
  const visit = (id: string): boolean => {
    state.set(id, 1)
    for (const next of out.get(id) ?? []) {
      const seen = state.get(next)
      if (seen === 1 || (seen === undefined && visit(next))) return true
    }
    state.set(id, 2)
    return false
  }
  return nodes.some((node) => !state.has(node.id) && visit(node.id))
}

/** The longest chain of relations, counted in relations; the graph has no directed cycle. */
function depth(nodes: { id: string }[], edges: DrawnEdge[]): number {
  const out = new Map(nodes.map((node) => [node.id, [] as string[]]))
  for (const edge of edges) out.get(edge.from)?.push(edge.to)
  const memo = new Map<string, number>()
  const longest = (id: string): number => {
    const known = memo.get(id)
    if (known !== undefined) return known
    memo.set(id, 0)
    const value = Math.max(0, ...(out.get(id) ?? []).map((next) => longest(next) + 1))
    memo.set(id, value)
    return value
  }
  return Math.max(0, ...nodes.map((node) => longest(node.id)))
}

/**
 * The layout a graph takes when the host names none, by its shape: a large network, a ring of
 * references or a relation both ways goes by force; a chain of directed relations is layered to
 * the right; one node that holds most of the others is the hub of rings; the rest is a
 * hierarchy, layered downwards.
 */
export function defaultLayout(
  model: Pick<GraphModel, 'nodes' | 'edges' | 'neighbours' | 'centre'>,
): GraphLayout {
  const { nodes, edges } = model
  if (nodes.length > LARGE_GRAPH) return 'force'
  if (edges.some((edge) => edge.direction === 'both') || hasCycle(nodes, edges)) return 'force'
  if (edges.every((edge) => edge.direction === 'to') && depth(nodes, edges) >= 3)
    return 'layered-right'
  const hub = model.centre ? (model.neighbours.get(model.centre)?.size ?? 0) : 0
  if (nodes.length > 2 && hub >= 0.6 * (nodes.length - 1)) return 'radial'
  return 'layered-down'
}

/** A type by its key; an unknown key still draws, as a type with only its key for a name. */
export function typeOf(types: GraphNodeType[], key: string): GraphNodeType {
  return types.find((type) => type.key === key) ?? { key, label: key, icon: '' }
}

/** A group's name: the plural of its kind, with a capital. */
function pluralOf(types: GraphNodeType[], key: string): string {
  const type = typeOf(types, key)
  const name = type.plural ?? type.label
  return name.charAt(0).toUpperCase() + name.slice(1)
}

/** A relation as one line, read from `id`: its word, then the other end, an arrow for direction. */
export function sentence(model: GraphModel, edge: DrawnEdge, id: string): string {
  const otherId = edge.from === id ? edge.to : edge.from
  const name = model.byId.get(otherId)?.label ?? otherId
  if (edge.direction === 'none') return `${edge.label || 'verbonden met'} ${name}`
  if (edge.direction === 'both') return `${edge.label || 'verbonden met'} ↔ ${name}`
  return edge.from === id
    ? `${edge.label || 'verbonden met'} → ${name}`
    : `${name} → ${edge.label || 'verbonden met'}`
}

/** The relations of a node as lines, as many as `max`, then "nog n". */
export function relationLines(model: GraphModel, id: string, max = 4): string[] {
  const lines = model.edges
    .filter((edge) => edge.from === id || edge.to === id)
    .map((edge) => sentence(model, edge, id))
  return lines.length > max ? [...lines.slice(0, max), `nog ${lines.length - max}`] : lines
}
