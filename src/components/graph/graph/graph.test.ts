/**
 * `<lintje-graph>`: what a host sees and hears. happy-dom has no layout, so the drawing takes its
 * default size; what is checked is the markup, the events and the state the host keeps.
 */
import { afterEach, describe, expect, it } from 'vitest'
import './graph'
import type { LintjeGraph } from './graph'
import type { GraphData, GraphEdge, GraphNode } from '../../../types'

const node = (
  id: string,
  label: string,
  type = 'org',
  extra: Partial<GraphNode> = {},
): GraphNode => ({
  id,
  label,
  type,
  ...extra,
})
const edge = (from: string, to: string, label?: string): GraphEdge => ({ from, to, label })

/** A ministry with three services; one of them works with two partners. */
function graphData(extra: Partial<GraphData> = {}): GraphData {
  return {
    title: 'Samenwerking',
    description: 'Een ministerie met drie diensten.',
    types: [
      { key: 'org', label: 'Rijksoverheid', icon: 'gebouwen-basis-kantoorgebouw' },
      { key: 'partner', label: 'Partner', plural: 'Partners', icon: 'personen-genderneutraal' },
    ],
    nodes: [
      node('min', 'Ministerie van Wonen'),
      node('a', 'Dienst A'),
      node('b', 'Dienst B'),
      node('c', 'Dienst C'),
      node('p1', 'Partner 1', 'partner'),
      node('p2', 'Partner 2', 'partner'),
    ],
    edges: [
      edge('min', 'a', 'stuurt'),
      edge('min', 'b', 'stuurt'),
      edge('min', 'c', 'stuurt'),
      edge('c', 'p1', 'werkt met'),
      edge('c', 'p2', 'werkt met'),
    ],
    ...extra,
  }
}

async function mount(data: GraphData): Promise<LintjeGraph> {
  const element = document.createElement('lintje-graph')
  element.data = data
  document.body.append(element)
  await element.updateComplete
  return element
}

const root = (element: LintjeGraph) => element.shadowRoot!
const nodeOf = (element: LintjeGraph, id: string) =>
  root(element).querySelector<HTMLButtonElement>(`[data-node="${id}"]`)
const counterOf = (element: LintjeGraph, id: string) =>
  nodeOf(element, id)?.nextElementSibling?.matches('.lintje-graph__counter')
    ? (nodeOf(element, id)!.nextElementSibling as HTMLButtonElement)
    : null

function listen(element: LintjeGraph, name: string): unknown[] {
  const heard: unknown[] = []
  element.addEventListener(name, (event) => heard.push((event as CustomEvent).detail))
  return heard
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('lintje-graph', () => {
  it('draws every node as a button with its name and its kind', async () => {
    const element = await mount(graphData())
    const button = nodeOf(element, 'p1')!
    expect(button.localName).toBe('button')
    expect(button.textContent?.replace(/\s+/g, ' ').trim()).toBe('Partner 1 , Partner')
    expect(root(element).querySelectorAll('[data-node]')).toHaveLength(6)
  })

  it('describes its drawing for a screen reader', async () => {
    const element = await mount(graphData())
    const group = root(element).querySelector('.lintje-graph__nodes')!
    const label = root(element).getElementById(group.getAttribute('aria-labelledby')!)
    expect(label?.textContent).toBe('Een ministerie met drie diensten.')
    expect(root(element).querySelector('svg desc')?.textContent).toBe(
      'Een ministerie met drie diensten.',
    )
  })

  it('lists each kind in the legend with its icon and how many there are', async () => {
    const element = await mount(graphData())
    const items = [...root(element).querySelectorAll('.lintje-legend__item')].map((item) =>
      item.textContent?.replace(/\s+/g, ' ').trim(),
    )
    expect(items).toEqual(['Rijksoverheid 4', 'Partner 2'])
  })

  it('takes one Tab stop in the drawing: the centre, and its counter after it', async () => {
    const element = await mount(graphData())
    const stops = [
      ...root(element).querySelectorAll<HTMLElement>('.lintje-graph__nodes [tabindex="0"]'),
    ]
    expect(stops.map((stop) => stop.dataset.node ?? stop.getAttribute('aria-label'))).toEqual([
      'min',
      'Klap 5 relaties in',
    ])
  })

  it('asks to choose a node, and to undo it with a second click', async () => {
    const element = await mount(graphData())
    const heard = listen(element, 'lintje-node-select')
    nodeOf(element, 'a')!.click()
    await element.updateComplete
    expect(nodeOf(element, 'a')!.getAttribute('aria-pressed')).toBe('true')
    nodeOf(element, 'a')!.click()
    await element.updateComplete
    expect(heard).toEqual([
      { id: 'a', label: 'Dienst A' },
      { id: null, label: null },
    ])
  })

  it('shows the node the host chose, and undoes it with Escape', async () => {
    const element = await mount(graphData({ selected: 'c' }))
    const heard = listen(element, 'lintje-node-select')
    expect(nodeOf(element, 'c')!.getAttribute('aria-pressed')).toBe('true')
    // Out of the light: what does not hang on the chosen node steps back.
    expect(nodeOf(element, 'a')!.classList.contains('is-dim')).toBe(true)
    expect(nodeOf(element, 'p1')!.classList.contains('is-dim')).toBe(false)
    nodeOf(element, 'c')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
    )
    await element.updateComplete
    expect(heard).toEqual([{ id: null, label: null }])
  })

  it('folds what hangs behind a node, and asks the host to keep it so', async () => {
    const element = await mount(graphData())
    const heard = listen(element, 'lintje-node-toggle')
    const counter = counterOf(element, 'c')!
    expect(counter.getAttribute('aria-label')).toBe('Klap 2 relaties in')
    counter.click()
    await element.updateComplete
    expect(heard).toEqual([{ id: 'c', open: false }])
    expect(nodeOf(element, 'p1')).toBeNull()
    expect(counterOf(element, 'c')!.textContent?.trim()).toBe('2')
    expect(counterOf(element, 'c')!.getAttribute('aria-label')).toBe('Klap 2 relaties uit')
    counterOf(element, 'c')!.click()
    await element.updateComplete
    expect(heard).toEqual([
      { id: 'c', open: false },
      { id: 'c', open: true },
    ])
    expect(nodeOf(element, 'p1')).not.toBeNull()
  })

  it('draws a branch the host keeps folded', async () => {
    const element = await mount(graphData({ collapsed: ['c'] }))
    expect(nodeOf(element, 'p1')).toBeNull()
    expect(counterOf(element, 'c')!.classList.contains('is-open')).toBe(false)
  })

  it('gathers more than five leaves of one kind into a group the reader opens', async () => {
    const partners = Array.from({ length: 6 }, (_, i) =>
      node(`q${i}`, `Partner ${i + 1}`, 'partner'),
    )
    const data = graphData({
      nodes: [...graphData().nodes, ...partners],
      edges: [
        ...graphData().edges,
        ...partners.map((partner) => edge(partner.id, 'b', 'werkt voor')),
      ],
    })
    const element = await mount(data)
    const heard = listen(element, 'lintje-node-toggle')
    const group = nodeOf(element, 'groep:b:partner')!
    expect(group.textContent).toContain('Partners')
    expect(group.textContent).toContain('6 bij Dienst B')
    expect(counterOf(element, 'groep:b:partner')!.getAttribute('aria-label')).toBe(
      'Open 6 partners',
    )
    counterOf(element, 'groep:b:partner')!.click()
    await element.updateComplete
    expect(heard).toEqual([{ id: 'groep:b:partner', open: true }])
    expect(nodeOf(element, 'q0')).not.toBeNull()
  })

  it('asks for what the host has not loaded, and is busy until it comes', async () => {
    const data = graphData({
      nodes: graphData().nodes.map((item) => (item.id === 'a' ? { ...item, more: 3 } : item)),
    })
    const element = await mount(data)
    const heard = listen(element, 'lintje-node-expand')
    expect(counterOf(element, 'a')!.getAttribute('aria-label')).toBe('Haal 3 relaties op')
    counterOf(element, 'a')!.click()
    await element.updateComplete
    expect(heard).toEqual([{ id: 'a' }])
    expect(counterOf(element, 'a')!.getAttribute('aria-busy')).toBe('true')
    element.data = {
      ...data,
      nodes: [...graphData().nodes, node('x', 'Partner X', 'partner')],
      edges: [...data.edges, edge('a', 'x', 'werkt met')],
    }
    await element.updateComplete
    expect(counterOf(element, 'a')!.getAttribute('aria-busy')).toBeNull()
    expect(nodeOf(element, 'x')).not.toBeNull()
  })

  it('switches a kind off in its legend', async () => {
    const element = await mount(graphData())
    root(element).querySelectorAll<HTMLButtonElement>('.lintje-legend__button')[1]!.click()
    await element.updateComplete
    expect(nodeOf(element, 'p1')).toBeNull()
    expect(nodeOf(element, 'a')).not.toBeNull()
  })

  it('goes with an arrow to a neighbour, and home to the centre', async () => {
    const element = await mount(graphData({ layout: 'layered-down' }))
    nodeOf(element, 'min')!.focus()
    nodeOf(element, 'min')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }),
    )
    await element.updateComplete
    await element.updateComplete
    const below = root(element).activeElement as HTMLElement
    expect(['a', 'b', 'c']).toContain(below.dataset.node)
    expect(below.tabIndex).toBe(0)
    below.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Home', bubbles: true, composed: true }),
    )
    await element.updateComplete
    await element.updateComplete
    expect((root(element).activeElement as HTMLElement).dataset.node).toBe('min')
  })

  it('stops the events of its tile', async () => {
    const element = await mount(graphData({ expandable: true }))
    const heard = listen(element, 'lintje-tile-expand')
    root(element)
      .querySelector('lintje-tile')!
      .dispatchEvent(new CustomEvent('lintje-tile-expand', { bubbles: true, composed: true }))
    expect(heard).toEqual([])
  })
})
