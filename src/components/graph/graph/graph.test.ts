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

  it('sets it all back with its reset: every branch open, nothing chosen', async () => {
    const element = await mount(graphData({ collapsed: ['c'], selected: 'a' }))
    const toggles = listen(element, 'lintje-node-toggle')
    const selects = listen(element, 'lintje-node-select')
    root(element)
      .querySelector<HTMLButtonElement>('button[aria-label="Tekening terugzetten"]')!
      .click()
    await element.updateComplete
    expect(toggles).toEqual([{ id: 'c', open: true }])
    expect(selects).toEqual([{ id: null, label: null }])
    expect(nodeOf(element, 'p1')).not.toBeNull()
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

  describe('a line with an id', () => {
    /** The graph with an id on each line but the ministry's to Dienst A, drawn as cards. */
    const withIds = (extra: Partial<GraphData> = {}) =>
      graphData({
        layout: 'layered-down',
        edges: graphData().edges.map((item) =>
          item.to === 'a' ? item : { ...item, id: `${item.from}-${item.to}` },
        ),
        ...extra,
      })
    const words = (element: LintjeGraph) => [
      ...root(element).querySelectorAll<SVGTextElement>('.lintje-graph__word'),
    ]
    const wordOf = (element: LintjeGraph, label: string, nth = 0) =>
      words(element).filter((item) => item.textContent === label)[nth]!
    const stops = (element: LintjeGraph) => [
      ...root(element).querySelectorAll<HTMLButtonElement>('.lintje-graph__line-stop'),
    ]
    const area = (element: LintjeGraph) =>
      root(element).querySelector<HTMLElement>('.lintje-graph__area')!
    /** A press and release of a pointer at a point of the drawing, and its click. */
    function tap(element: LintjeGraph, at: { x: number; y: number }, pointerType = 'mouse') {
      const init = { clientX: at.x, clientY: at.y, bubbles: true, composed: true, pointerType }
      area(element).dispatchEvent(new PointerEvent('pointerdown', { ...init, button: 0 }))
      area(element).dispatchEvent(new PointerEvent('pointerup', init))
      area(element).dispatchEvent(new MouseEvent('click', init))
    }
    const at = (word: SVGTextElement) => ({
      x: Number(word.getAttribute('x')),
      y: Number(word.getAttribute('y')),
    })
    const key = (target: Element, name: string) =>
      target.dispatchEvent(
        new KeyboardEvent('keydown', { key: name, bubbles: true, composed: true }),
      )

    it('changes nothing in a graph without ids', async () => {
      const element = await mount(graphData({ layout: 'layered-down' }))
      expect(root(element).querySelectorAll('.lintje-graph__frame')).toHaveLength(0)
      expect(stops(element)).toHaveLength(0)
      const heard = listen(element, 'lintje-edge-select')
      tap(element, at(wordOf(element, 'werkt met')))
      await element.updateComplete
      expect(heard).toEqual([])
      expect(root(element).querySelectorAll('.lintje-graph__hit')).toHaveLength(0)
      // A double click on a line zooms, as before.
      const before = nodeOf(element, 'min')!.style.transform
      const point = at(wordOf(element, 'werkt met'))
      area(element).dispatchEvent(
        new MouseEvent('dblclick', { clientX: point.x, clientY: point.y, bubbles: true }),
      )
      await element.updateComplete
      expect(nodeOf(element, 'min')!.style.transform).not.toBe(before)
    })

    it('frames the word of a choosable line only', async () => {
      const element = await mount(withIds())
      const framed = words(element).filter((word) =>
        word.classList.contains('lintje-graph__word--framed'),
      )
      expect(framed.length).toBe(4)
      expect(root(element).querySelectorAll('.lintje-graph__frame')).toHaveLength(4)
      // Each choosable line has a target of its own, for the browser's touch adjustment.
      expect(root(element).querySelectorAll('.lintje-graph__hit')).toHaveLength(4)
    })

    it('is chosen with a click on its word, which a second click keeps', async () => {
      const element = await mount(withIds())
      const heard = listen(element, 'lintje-edge-select')
      tap(element, at(wordOf(element, 'werkt met')))
      await element.updateComplete
      tap(element, at(wordOf(element, 'werkt met')))
      await element.updateComplete
      expect(heard).toEqual([{ id: 'c-p1', from: 'c', to: 'p1', label: 'werkt met' }])
      const chosen = root(element).querySelector('.lintje-graph__edge.is-selected')!
      // At least 3 px thick, so the number it may carry is still read.
      expect(chosen.querySelector('.lintje-graph__line')!.getAttribute('stroke-width')).toBe('3')
      expect(wordOf(element, 'werkt met').classList.contains('is-selected')).toBe(true)
      // Its two nodes stay in the light, the rest steps back.
      expect(nodeOf(element, 'p1')!.classList.contains('is-dim')).toBe(false)
      expect(nodeOf(element, 'a')!.classList.contains('is-dim')).toBe(true)
    })

    it('is chosen with a finger, and a tap beside the lines undoes it', async () => {
      const element = await mount(withIds())
      const heard = listen(element, 'lintje-edge-select')
      tap(element, at(wordOf(element, 'werkt met')), 'touch')
      await element.updateComplete
      tap(element, { x: 2, y: 2 }, 'touch')
      await element.updateComplete
      expect(heard).toEqual([
        { id: 'c-p1', from: 'c', to: 'p1', label: 'werkt met' },
        { id: null, from: null, to: null, label: null },
      ])
    })

    it('is not chosen after a drag', async () => {
      const element = await mount(withIds())
      const heard = listen(element, 'lintje-edge-select')
      const point = at(wordOf(element, 'werkt met'))
      const init = { clientX: point.x, clientY: point.y, bubbles: true, composed: true }
      area(element).dispatchEvent(
        new PointerEvent('pointerdown', { ...init, button: 0, pointerId: 1 }),
      )
      area(element).dispatchEvent(
        new PointerEvent('pointermove', { ...init, clientX: point.x + 40, pointerId: 1 }),
      )
      area(element).dispatchEvent(new PointerEvent('pointerup', { ...init, pointerId: 1 }))
      area(element).dispatchEvent(new MouseEvent('click', init))
      await element.updateComplete
      expect(heard).toEqual([])
    })

    it('is no choice without an id, and a click on it undoes the choice', async () => {
      const element = await mount(withIds({ selectedEdge: 'c-p1' }))
      const heard = listen(element, 'lintje-edge-select')
      tap(element, at(wordOf(element, 'stuurt', 0)))
      await element.updateComplete
      expect(heard).toEqual([{ id: null, from: null, to: null, label: null }])
    })

    it('undoes the chosen node when chosen, and the other way round', async () => {
      const element = await mount(withIds({ selected: 'a' }))
      const nodes = listen(element, 'lintje-node-select')
      const lines = listen(element, 'lintje-edge-select')
      tap(element, at(wordOf(element, 'werkt met')))
      await element.updateComplete
      expect(nodes).toEqual([{ id: null, label: null }])
      expect(nodeOf(element, 'a')!.getAttribute('aria-pressed')).toBe('false')
      nodeOf(element, 'b')!.click()
      await element.updateComplete
      expect(lines).toEqual([
        { id: 'c-p1', from: 'c', to: 'p1', label: 'werkt met' },
        { id: null, from: null, to: null, label: null },
      ])
      expect(root(element).querySelector('.lintje-graph__edge.is-selected')).toBeNull()
    })

    it('opens with a double click when chosen, and a double click on a choosable line never zooms', async () => {
      const element = await mount(withIds({ selectedEdge: 'c-p1' }))
      const heard = listen(element, 'lintje-edge-open')
      const before = nodeOf(element, 'min')!.style.transform
      const point = at(wordOf(element, 'werkt met'))
      area(element).dispatchEvent(
        new MouseEvent('dblclick', { clientX: point.x, clientY: point.y, bubbles: true }),
      )
      await element.updateComplete
      expect(heard).toEqual([{ id: 'c-p1' }])
      expect(nodeOf(element, 'min')!.style.transform).toBe(before)
      // Elsewhere on the drawing a double click zooms as before.
      area(element).dispatchEvent(
        new MouseEvent('dblclick', { clientX: 2, clientY: 2, bubbles: true }),
      )
      await element.updateComplete
      expect(nodeOf(element, 'min')!.style.transform).not.toBe(before)
    })

    it('is undone with Escape, and from the reset', async () => {
      const element = await mount(withIds({ selectedEdge: 'c-p1' }))
      const heard = listen(element, 'lintje-edge-select')
      key(nodeOf(element, 'c')!, 'Escape')
      await element.updateComplete
      element.data = withIds({ selectedEdge: 'c-p2' })
      await element.updateComplete
      root(element)
        .querySelector<HTMLButtonElement>('button[aria-label="Tekening terugzetten"]')!
        .click()
      await element.updateComplete
      expect(heard).toEqual([
        { id: null, from: null, to: null, label: null },
        { id: null, from: null, to: null, label: null },
      ])
    })

    it('has no tooltip when chosen', async () => {
      const element = await mount(withIds({ layout: 'layered-down' }))
      nodeOf(element, 'c')!.focus()
      await element.updateComplete
      const line = stops(element).find((stop) =>
        stop.getAttribute('aria-label')?.includes('Partner 1'),
      )!
      line.focus()
      await element.updateComplete
      expect(root(element).querySelector('.lintje-graph__tip')).not.toBeNull()
      line.click()
      await element.updateComplete
      expect(root(element).querySelector('.lintje-graph__tip')).toBeNull()
    })

    it('comes after its node and the counter in the Tab order, clockwise from straight up', async () => {
      // `c` holds the most lines: one up to the ministry, three down to its partners.
      const element = await mount(
        withIds({
          layout: 'layered-down',
          nodes: [...graphData().nodes, node('p3', 'Partner 3', 'partner')],
          edges: [...withIds().edges, { from: 'c', to: 'p3', label: 'werkt met', id: 'c-p3' }],
        }),
      )
      const order = [
        ...root(element).querySelectorAll<HTMLElement>(
          '.lintje-graph__nodes [tabindex="0"], .lintje-graph__line-stop',
        ),
      ].map((stop) => stop.dataset.node ?? stop.getAttribute('aria-label'))
      expect(order[0]).toBe('c')
      expect(order[1]).toBe('Klap 6 relaties in')
      // Up to the ministry first, then down round the clock: right to left below `c`.
      const x = (id: string) =>
        Number(/translate\(([\d.-]+)px/.exec(nodeOf(element, id)!.style.transform)![1])
      const below = ['p1', 'p2', 'p3'].sort((a, b) => x(b) - x(a))
      expect(order.slice(2)).toEqual([
        'stuurt: Ministerie van Wonen → Dienst C',
        ...below.map((id) => `werkt met: Dienst C → Partner ${id.slice(1)}`),
      ])
    })

    it('chooses with Space, opens with Enter when chosen, and says it is chosen', async () => {
      const element = await mount(withIds())
      const chosen = listen(element, 'lintje-edge-select')
      const opened = listen(element, 'lintje-edge-open')
      const line = stops(element).find((stop) =>
        stop.getAttribute('aria-label')?.startsWith('stuurt'),
      )!
      line.focus()
      key(line, 'Enter')
      await element.updateComplete
      expect(line.getAttribute('aria-pressed')).toBe('true')
      line.click()
      key(line, 'Enter')
      await element.updateComplete
      expect(chosen).toEqual([{ id: 'min-b', from: 'min', to: 'b', label: 'stuurt' }])
      expect(opened).toEqual([{ id: 'min-b' }])
    })

    it('takes the focus when chosen by pointer, so Escape undoes it, without a ring', async () => {
      const element = await mount(withIds())
      const heard = listen(element, 'lintje-edge-select')
      // The pointer rests on the line first, as a mouse does: its tooltip waits to come.
      const point = at(wordOf(element, 'werkt met'))
      area(element).dispatchEvent(
        new PointerEvent('pointermove', { clientX: point.x, clientY: point.y, bubbles: true }),
      )
      tap(element, point)
      await new Promise((done) => setTimeout(done, 400))
      await element.updateComplete
      const active = root(element).activeElement as HTMLElement
      expect(active.dataset.edge).toBeDefined()
      expect(root(element).querySelector('.lintje-graph__ring')).toBeNull()
      key(active, 'Escape')
      await element.updateComplete
      expect(heard).toEqual([
        { id: 'c-p1', from: 'c', to: 'p1', label: 'werkt met' },
        { id: null, from: null, to: null, label: null },
      ])
    })

    it('goes round the clock by where they end when right-angled lines leave alike', async () => {
      const element = await mount(
        withIds({
          lines: 'orthogonal',
          nodes: [...graphData().nodes, node('p3', 'Partner 3', 'partner')],
          edges: [...withIds().edges, { from: 'c', to: 'p3', label: 'werkt met', id: 'c-p3' }],
        }),
      )
      const order = stops(element).map((stop) => stop.getAttribute('aria-label'))
      const x = (id: string) =>
        Number(/translate\(([\d.-]+)px/.exec(nodeOf(element, id)!.style.transform)![1])
      const below = ['p1', 'p2', 'p3'].sort((a, b) => x(b) - x(a))
      expect(order).toEqual([
        'stuurt: Ministerie van Wonen → Dienst C',
        ...below.map((id) => `werkt met: Dienst C → Partner ${id.slice(1)}`),
      ])
    })

    it('never shows a node and a line chosen together: what the host set last wins', async () => {
      const element = await mount(withIds({ selected: 'c', selectedEdge: 'c-p1' }))
      // Set at once, the line wins.
      expect(nodeOf(element, 'c')!.getAttribute('aria-pressed')).toBe('false')
      expect(root(element).querySelector('.lintje-graph__edge.is-selected')).not.toBeNull()
      element.data = withIds({ selected: 'b', selectedEdge: 'c-p1' })
      await element.updateComplete
      expect(nodeOf(element, 'b')!.getAttribute('aria-pressed')).toBe('true')
      expect(root(element).querySelector('.lintje-graph__edge.is-selected')).toBeNull()
      element.data = withIds({ selected: 'b', selectedEdge: 'c-p2' })
      await element.updateComplete
      expect(nodeOf(element, 'b')!.getAttribute('aria-pressed')).toBe('false')
      // Escape undoes the line and brings no node back.
      const heard = listen(element, 'lintje-node-select')
      key(nodeOf(element, 'c')!, 'Escape')
      await element.updateComplete
      expect(nodeOf(element, 'b')!.getAttribute('aria-pressed')).toBe('false')
      expect(heard).toEqual([])
    })

    it('keeps the focused line at full strength under a pointer elsewhere', async () => {
      const element = await mount(withIds())
      stops(element)[0]!.focus()
      await element.updateComplete
      nodeOf(element, 'p2')!.dispatchEvent(new PointerEvent('pointerenter'))
      await element.updateComplete
      const ring = root(element).querySelector('.lintje-graph__ring')!
      expect(ring.closest('.lintje-graph__edge')!.classList.contains('is-dim')).toBe(false)
    })

    it('opens nothing on a held Enter', async () => {
      const element = await mount(withIds())
      const opened = listen(element, 'lintje-edge-open')
      const line = stops(element)[0]!
      line.focus()
      key(line, 'Enter')
      await element.updateComplete
      line.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true, composed: true }),
      )
      await element.updateComplete
      expect(line.getAttribute('aria-pressed')).toBe('true')
      expect(opened).toEqual([])
    })

    it('keeps the word of the chosen line, in its frame, when zoomed out', async () => {
      const element = await mount(withIds({ selectedEdge: 'c-p1' }))
      const out = root(element).querySelector<HTMLButtonElement>('button[aria-label="Uitzoomen"]')!
      out.click()
      out.click()
      await element.updateComplete
      expect(root(element).querySelector('.lintje-graph__nodes--card')).toBeNull()
      expect(words(element).map((word) => word.textContent)).toEqual(['werkt met'])
      expect(root(element).querySelectorAll('.lintje-graph__frame')).toHaveLength(1)
    })

    it('draws the focus ring along the line that has the focus', async () => {
      const element = await mount(withIds())
      expect(root(element).querySelector('.lintje-graph__ring')).toBeNull()
      stops(element)[0]!.focus()
      await element.updateComplete
      expect(root(element).querySelectorAll('.lintje-graph__ring')).toHaveLength(1)
    })
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
