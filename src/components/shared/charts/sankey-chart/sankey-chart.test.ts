/**
 * The sankey: a node counts what flows through it, a band fills its share of its node, one scale
 * holds every step, a missing flow is a hatched stub and never a band of 0 (rule 15), a band of
 * less than 2 px is drawn at 2 with its real count in the words, and the drawing grows with its
 * busiest step. Below 768 px every transition is a bar per source (rule 9).
 *
 * happy-dom lays nothing out: what is checked is the model, the geometry and the markup.
 */
import { render } from 'lit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChartController, type ChartOptions } from '../shared/controller'
import {
  renderSankeyChart,
  sankeyHeight,
  sankeyLayout,
  sankeyModel,
  sankeyStops,
  type SankeyModel,
} from './sankey-chart'
import type { ChartSpec } from '../shared/types'

type SankeySpec = Extract<ChartSpec, { kind: 'sankey' }>

const THREE: SankeySpec = {
  kind: 'sankey',
  label: 'Aanvragen',
  steps: [
    { label: 'Ingediend', nodes: [{ id: 'in', label: 'Aanvragen' }] },
    {
      label: 'Volledigheid',
      nodes: [
        { id: 'compleet', label: 'Compleet' },
        { id: 'onvolledig', label: 'Onvolledig' },
      ],
    },
    {
      label: 'Uitkomst',
      nodes: [
        { id: 'toegekend', label: 'Toegekend' },
        { id: 'afgewezen', label: 'Afgewezen' },
        { id: 'ingetrokken', label: 'Ingetrokken' },
      ],
    },
  ],
  flows: [
    { from: 'in', to: 'compleet', value: 7400 },
    { from: 'in', to: 'onvolledig', value: 2600 },
    { from: 'compleet', to: 'toegekend', value: 5200 },
    { from: 'compleet', to: 'afgewezen', value: 1300 },
    { from: 'compleet', to: 'ingetrokken', value: 12 },
    { from: 'onvolledig', to: 'afgewezen', value: 700 },
    { from: 'onvolledig', to: 'ingetrokken', value: 1300 },
  ],
}

const nodeOf = (model: SankeyModel, id: string) =>
  model.steps.flatMap((step) => step.nodes).find((node) => node.id === id)!

const flat = { nameWidth: () => 60, valueWidth: () => 70 }

function draw(spec: SankeySpec, extra: Partial<ChartOptions> = {}, height?: number) {
  const host = document.createElement('div')
  document.body.append(host)
  const controller = new ChartController(() => render(renderSankeyChart(spec, options), host))
  controller.width = 800
  if (height != null) controller.height = height
  const options: ChartOptions = { controller, description: 'Een proces.', ...extra }
  render(renderSankeyChart(spec, options), host)
  const drawing = host.querySelector('svg[tabindex="0"]') as SVGSVGElement
  const key = (name: string) =>
    drawing.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }))
  return { host, controller, drawing, key }
}

const title = (host: Element) =>
  host.querySelector('.lintje-chart-tooltip__title')?.textContent?.trim()
const rows = (host: Element) =>
  [...host.querySelectorAll('.lintje-chart-tooltip__row')].map((row) =>
    row.textContent!.replace(/\s+/g, ' ').trim(),
  )
const status = (host: Element) => host.querySelector('[role="status"]')?.textContent?.trim()
const widths = (host: Element) =>
  [...host.querySelectorAll('.lintje-sankey__band')].map((band) => band.getAttribute('d'))

beforeEach(() => {
  // happy-dom lays nothing out: the chart measures a tile of 800 px.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    DOMRect.fromRect({ width: 800, height: 300 }),
  )
})

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('sankeyModel', () => {
  it('counts a node as what flows into it, a first node as what flows out', () => {
    const model = sankeyModel(THREE)
    expect(nodeOf(model, 'in').size).toBe(10000)
    expect(nodeOf(model, 'compleet').size).toBe(7400)
    expect(nodeOf(model, 'afgewezen').size).toBe(2000)
    expect(model.total).toBe(10000)
  })

  it('takes a value before the sum of the flows, also in a later step', () => {
    const spec: SankeySpec = {
      ...THREE,
      steps: THREE.steps.map((step, s) =>
        s === 1 ? { ...step, nodes: [{ ...step.nodes[0], value: 8000 }, step.nodes[1]] } : step,
      ),
    }
    const compleet = nodeOf(sankeyModel(spec), 'compleet')
    expect(compleet.size).toBe(8000)
    // What no flow takes ends there.
    expect(compleet.rest).toBe(8000 - 6512)
  })

  it('leaves out a flow that skips a step or names no node, also from the stops', () => {
    const model = sankeyModel({
      ...THREE,
      flows: [
        ...THREE.flows,
        { from: 'in', to: 'toegekend', value: 5 },
        { from: 'in', to: 'nergens', value: 5 },
      ],
    })
    expect(model.flows).toHaveLength(THREE.flows.length)
  })

  it('draws a missing flow as a stub at its source and makes its target a lower bound', () => {
    const model = sankeyModel({
      ...THREE,
      flows: THREE.flows.map((flow) =>
        flow.from === 'onvolledig' && flow.to === 'ingetrokken' ? { ...flow, value: null } : flow,
      ),
    })
    const onvolledig = nodeOf(model, 'onvolledig')
    expect(onvolledig.stub).toBe(2600 - 700)
    const ingetrokken = nodeOf(model, 'ingetrokken')
    expect(ingetrokken.atLeast).toBe(true)
    expect(ingetrokken.size).toBe(12)
  })

  it('gives a first node with a value one stub for its missing flows: value minus the known', () => {
    const model = sankeyModel({
      ...THREE,
      steps: THREE.steps.map((step, s) =>
        s === 0 ? { ...step, nodes: [{ ...step.nodes[0], value: 10000 }] } : step,
      ),
      flows: THREE.flows.map((flow) =>
        flow.to === 'onvolledig' ? { ...flow, value: null } : flow,
      ),
    })
    const first = nodeOf(model, 'in')
    expect(first.size).toBe(10000)
    expect(first.stub).toBe(2600)
    expect(model.problems).toEqual([])
  })

  it('without a value, a first node with a missing flow has no stub, a lower bound and a problem', () => {
    const model = sankeyModel({
      ...THREE,
      flows: THREE.flows.map((flow) =>
        flow.to === 'onvolledig' ? { ...flow, value: null } : flow,
      ),
    })
    const first = nodeOf(model, 'in')
    expect(first.size).toBe(7400)
    expect(first.stub).toBe(0)
    expect(first.atLeast).toBe(true)
    expect(model.problems).toHaveLength(1)
  })

  it('reads node by node, each with its flows out in the order of their targets', () => {
    const stops = sankeyStops(sankeyModel(THREE)).map((stop) =>
      stop.kind === 'flow'
        ? `${stop.flow.from.id}>${stop.flow.to.id}`
        : `${stop.kind}:${stop.node.id}`,
    )
    expect(stops).toEqual([
      'node:in',
      'in>compleet',
      'in>onvolledig',
      'node:compleet',
      'compleet>toegekend',
      'compleet>afgewezen',
      'compleet>ingetrokken',
      'node:onvolledig',
      'onvolledig>afgewezen',
      'onvolledig>ingetrokken',
      'node:toegekend',
      'node:afgewezen',
      'node:ingetrokken',
    ])
  })
})

describe('sankeyLayout', () => {
  const layout = (spec: SankeySpec, height = 400) =>
    sankeyLayout(sankeyModel(spec), { width: 800, height, ...flat })

  it('fills each node exactly with its bands, out and in', () => {
    const model = sankeyModel(THREE)
    const placed = sankeyLayout(model, { width: 800, height: 400, ...flat })
    const first = nodeOf(model, 'in')
    const box = placed.node.get(first)!
    const out = first.outflow.map((flow) => placed.band.get(flow)!)
    expect(out[0].a).toBeCloseTo(box.y)
    expect(out[1].a).toBeCloseTo(out[0].a + out[0].thickness)
    expect(out[1].a + out[1].thickness).toBeCloseTo(box.y + box.h)
    const afgewezen = nodeOf(model, 'afgewezen')
    const target = placed.node.get(afgewezen)!
    const into = afgewezen.inflow.map((flow) => placed.band.get(flow)!)
    expect(into[0].b).toBeCloseTo(target.y)
    expect(into[1].b + into[1].thickness).toBeCloseTo(target.y + target.h)
  })

  it('keeps the sum of a node when a small band is drawn wider, and leaves what ends there empty', () => {
    const model = sankeyModel(THREE)
    const placed = sankeyLayout(model, { width: 800, height: 400, ...flat })
    const compleet = nodeOf(model, 'compleet')
    const box = placed.node.get(compleet)!
    const out = compleet.outflow.map((flow) => placed.band.get(flow)!)
    // The 12 is drawn at 2 px around the middle of its real place.
    const real = 12 * placed.scale
    expect(out[2].a + out[2].thickness / 2).toBeCloseTo(out[1].a + out[1].thickness + real / 2)
    expect(out[1].a + out[1].thickness + real + compleet.rest * placed.scale).toBeCloseTo(
      box.y + box.h,
    )
  })

  it('holds one scale over every step: the same count is the same height', () => {
    const model = sankeyModel(THREE)
    const placed = sankeyLayout(model, { width: 800, height: 400, ...flat })
    for (const node of model.steps.flatMap((step) => step.nodes)) {
      expect(placed.node.get(node)!.h).toBeCloseTo(node.size * placed.scale)
    }
    // The step with the least room per count sets it.
    const first = placed.node.get(nodeOf(model, 'in'))!
    expect(first.h).toBeLessThanOrEqual(400 - 24 + 1e-6)
  })

  it('draws a band under 2 px at 2 px', () => {
    const placed = layout(THREE)
    const small = [...placed.band.entries()].find(([flow]) => flow.value === 12)![1]
    expect(placed.scale * 12).toBeLessThan(2)
    expect(small.thickness).toBe(2)
  })

  it('runs the bands after a middle step 96 px straight', () => {
    const model = sankeyModel(THREE)
    const placed = sankeyLayout(model, { width: 800, height: 400, ...flat })
    const after = placed.band.get(nodeOf(model, 'compleet').outflow[0])!
    expect(after.xs - after.x0).toBe(96)
    const first = placed.band.get(nodeOf(model, 'in').outflow[0])!
    expect(first.xs).toBe(first.x0)
  })

  it('shows every count or none: too narrow, only the names stay', () => {
    expect(layout(THREE).values).toBe(true)
    const narrow = sankeyLayout(sankeyModel(THREE), {
      width: 360,
      height: 400,
      nameWidth: () => 60,
      valueWidth: () => 90,
    })
    expect(narrow.values).toBe(false)
  })
})

describe('sankeyHeight', () => {
  it('grows with the step with the most nodes', () => {
    const six: SankeySpec = {
      ...THREE,
      steps: [
        THREE.steps[0],
        {
          label: 'Uitkomst',
          nodes: Array.from({ length: 6 }, (_, i) => ({ id: `u${i}`, label: `Uitkomst ${i}` })),
        },
      ],
      flows: Array.from({ length: 6 }, (_, i) => ({ from: 'in', to: `u${i}`, value: 100 })),
    }
    expect(sankeyHeight(six)).toBeGreaterThan(sankeyHeight(THREE))
    expect(sankeyHeight(six)).toBeGreaterThan(260)
  })
})

describe('the sankey', () => {
  it('is never lower than the height token, and taller for a busy step', () => {
    const { drawing } = draw(THREE, {}, 260)
    expect(Number(drawing.getAttribute('height'))).toBe(Math.max(260, sankeyHeight(THREE)))
    const six: SankeySpec = {
      ...THREE,
      steps: [
        THREE.steps[0],
        {
          label: 'Uitkomst',
          nodes: Array.from({ length: 6 }, (_, i) => ({ id: `u${i}`, label: `Uitkomst ${i}` })),
        },
      ],
      flows: Array.from({ length: 6 }, (_, i) => ({ from: 'in', to: `u${i}`, value: 100 })),
    }
    const busy = draw(six, {}, 260).drawing
    expect(Number(busy.getAttribute('height'))).toBe(sankeyHeight(six))
  })

  it('names every node, with its count and share beside it', () => {
    const { host } = draw(THREE)
    const names = [...host.querySelectorAll('.lintje-sankey__name')].map((t) => t.textContent)
    expect(names).toEqual([
      'Aanvragen',
      'Compleet',
      'Onvolledig',
      'Toegekend',
      'Afgewezen',
      'Ingetrokken',
    ])
    const values = [...host.querySelectorAll('.lintje-sankey__value')].map((t) =>
      t.textContent!.replace(/\s+/g, ' ').trim(),
    )
    expect(values[1]).toBe('7.400 · 74%')
  })

  it('leaves the share out with share: false', () => {
    const { host } = draw({ ...THREE, share: false })
    const values = [...host.querySelectorAll('.lintje-sankey__value')].map((t) =>
      t.textContent!.trim(),
    )
    expect(values[1]).toBe('7.400')
  })

  it('draws no band for a missing flow but a stub, and writes its target as a lower bound', () => {
    const spec: SankeySpec = {
      ...THREE,
      flows: THREE.flows.map((flow) =>
        flow.from === 'onvolledig' && flow.to === 'ingetrokken' ? { ...flow, value: null } : flow,
      ),
    }
    const { host } = draw(spec)
    expect(host.querySelectorAll('.lintje-sankey__band')).toHaveLength(THREE.flows.length - 1)
    expect(host.querySelectorAll('.lintje-sankey__stub')).toHaveLength(1)
    const values = [...host.querySelectorAll('.lintje-sankey__value')].map((t) =>
      t.textContent!.trim(),
    )
    expect(values.at(-1)).toBe('≥ 12')
    const legend = [...host.querySelectorAll('.lintje-legend__label')].map((t) => t.textContent)
    expect(legend).toContain('Geen gegevens')
  })

  it('gives two missing flows of one node one stub, whose tooltip names both', () => {
    const spec: SankeySpec = {
      ...THREE,
      steps: THREE.steps.map((step, s) =>
        s === 1 ? { ...step, nodes: [step.nodes[0], { ...step.nodes[1], value: 2600 }] } : step,
      ),
      flows: THREE.flows.map((flow) =>
        flow.from === 'onvolledig'
          ? { ...flow, value: flow.to === 'afgewezen' ? 700 : null }
          : flow,
      ),
    }
    const withBoth: SankeySpec = {
      ...spec,
      flows: [
        ...spec.flows.filter((flow) => flow.from !== 'onvolledig'),
        { from: 'onvolledig', to: 'toegekend', value: null },
        { from: 'onvolledig', to: 'afgewezen', value: 700 },
        { from: 'onvolledig', to: 'ingetrokken', value: null },
      ],
    }
    const { host, key } = draw(withBoth)
    expect(host.querySelectorAll('.lintje-sankey__stub')).toHaveLength(1)
    const stops = sankeyStops(sankeyModel(withBoth))
    const at = stops.findIndex((stop) => stop.kind === 'stub')
    key('Home')
    for (let i = 0; i < at; i++) key('ArrowRight')
    expect(title(host)).toBe('Geen gegevens')
    expect(rows(host)).toEqual(['Onvolledig zonder Uitkomst 1.900', '→ Toegekend', '→ Ingetrokken'])
  })

  it('warns once when a first node misses a flow and has no value, and writes ≥', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const spec: SankeySpec = {
      ...THREE,
      flows: THREE.flows.map((flow) =>
        flow.to === 'onvolledig' ? { ...flow, value: null } : flow,
      ),
    }
    const { host, controller } = draw(spec)
    controller.requestUpdate()
    controller.requestUpdate()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(host.querySelectorAll('.lintje-sankey__stub')).toHaveLength(0)
    const values = [...host.querySelectorAll('.lintje-sankey__value')].map((t) =>
      t.textContent!.trim(),
    )
    expect(values[0]).toBe('≥ 7.400')
  })

  it('tells a small flow its real count in the tooltip and the live region', () => {
    const { host, key } = draw(THREE)
    const stops = sankeyStops(sankeyModel(THREE))
    const at = stops.findIndex((stop) => stop.kind === 'flow' && stop.flow.value === 12)
    key('Home')
    for (let i = 0; i < at; i++) key('ArrowRight')
    expect(title(host)).toBe('Compleet → Ingetrokken')
    expect(rows(host)[0]).toBe('Aanvragen 12')
    expect(status(host)).toBe('Compleet → Ingetrokken: 12 (0% van Compleet)')
  })

  it('walks the stops with the arrow keys, Home and End, and hides the tooltip on Escape', () => {
    const { host, key, drawing } = draw(THREE)
    key('ArrowRight')
    expect(title(host)).toBe('Aanvragen (Ingediend)')
    key('ArrowRight')
    expect(title(host)).toBe('Aanvragen → Compleet')
    expect(status(host)).toBe('Aanvragen → Compleet: 7.400 (74% van Aanvragen)')
    key('End')
    expect(title(host)).toBe('Ingetrokken (Uitkomst)')
    key('ArrowDown')
    expect(title(host)).toBe('Ingetrokken (Uitkomst)')
    key('ArrowUp')
    expect(title(host)).toBe('Afgewezen (Uitkomst)')
    expect(rows(host)).toContain('uit Compleet 1.300')
    drawing.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(host.querySelector('.lintje-chart-tooltip')).toBeNull()
  })

  it('on a flow steps every mark but it and its two nodes back, changing no width', () => {
    const { host, controller } = draw(THREE)
    const before = widths(host)
    const stops = sankeyStops(sankeyModel(THREE))
    controller.hoverIndex = stops.findIndex(
      (stop) =>
        stop.kind === 'flow' && stop.flow.to.id === 'afgewezen' && stop.flow.from.id === 'compleet',
    )
    controller.requestUpdate()
    expect(widths(host)).toEqual(before)
    expect(host.querySelectorAll('.lintje-sankey__band.is-active')).toHaveLength(1)
    expect(host.querySelectorAll('.lintje-sankey__band.is-dimmed')).toHaveLength(
      THREE.flows.length - 1,
    )
    const full = [...host.querySelectorAll('.lintje-sankey__node:not(.is-dimmed)')]
    expect(full).toHaveLength(2)
  })

  it('on a node brings what runs through it forward and the nodes at the other ends', () => {
    const { host, controller } = draw(THREE)
    const before = widths(host)
    const stops = sankeyStops(sankeyModel(THREE))
    controller.hoverIndex = stops.findIndex(
      (stop) => stop.kind === 'node' && stop.node.id === 'onvolledig',
    )
    controller.requestUpdate()
    expect(widths(host)).toEqual(before)
    // In from the first node, out to Afgewezen and Ingetrokken.
    expect(host.querySelectorAll('.lintje-sankey__band.is-active')).toHaveLength(3)
    expect(host.querySelectorAll('.lintje-sankey__node:not(.is-dimmed)')).toHaveLength(4)
    expect(host.querySelectorAll('.lintje-sankey__name')[0].closest('.is-dimmed')).toBeNull()
  })

  it('lists the flows out of a node, and what ends there', () => {
    const spec: SankeySpec = {
      ...THREE,
      steps: THREE.steps.map((step, s) =>
        s === 1 ? { ...step, nodes: [{ ...step.nodes[0], value: 8000 }, step.nodes[1]] } : step,
      ),
    }
    const { host, key } = draw(spec)
    key('Home')
    for (let i = 0; i < 3; i++) key('ArrowRight')
    expect(title(host)).toBe('Compleet (Volledigheid)')
    expect(rows(host)).toEqual([
      'Aanvragen 8.000',
      'van het totaal 80%',
      '→ Toegekend 5.200',
      '→ Afgewezen 1.300',
      '→ Ingetrokken 12',
      'eindigt hier 1.488',
    ])
  })

  it('makes a node or a flow with a href a button that selects', () => {
    const onSelect = vi.fn()
    const spec: SankeySpec = {
      ...THREE,
      flows: THREE.flows.map((flow, i) => (i === 0 ? { ...flow, href: '?stroom=1' } : flow)),
    }
    const { host } = draw(spec, { onSelect })
    const button = host.querySelector<SVGElement>('.lintje-sankey__band[role="button"]')!
    expect(button.getAttribute('aria-label')).toBe(
      'Aanvragen → Compleet: 7.400 (74% van Aanvragen)',
    )
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onSelect).toHaveBeenCalledWith({
      id: 'in→compleet',
      label: 'Aanvragen → Compleet',
      href: '?stroom=1',
    })
    expect(host.querySelector('svg')!.getAttribute('role')).toBe('group')
  })
})

describe('the sankey below 768 px', () => {
  it('becomes a bar per source with a row per target, and no drawing', () => {
    const { host } = draw(THREE, { mobile: true })
    expect(host.querySelector('.lintje-sankey__band')).toBeNull()
    const headings = [...host.querySelectorAll('.lintje-sankey__heading')].map((t) =>
      t.textContent!.trim(),
    )
    expect(headings).toEqual(['Ingediend → volledigheid', 'Volledigheid → uitkomst'])
    expect(host.querySelectorAll('.lintje-sankey__bar')).toHaveLength(3)
    const first = [...host.querySelectorAll('.lintje-sankey__source')][1]
    const lines = [...first.querySelectorAll('.lintje-sankey__row')].map((row) =>
      row.textContent!.replace(/\s+/g, ' ').trim(),
    )
    expect(lines).toEqual([
      'Toegekend 5.200 70%',
      'Afgewezen 1.300 18%',
      'Ingetrokken 12 0%',
      'eindigt hier 888 12%',
    ])
    expect(first.querySelectorAll('.lintje-sankey__piece')).toHaveLength(4)
    expect(first.querySelectorAll('.lintje-sankey__piece--rest')).toHaveLength(1)
    expect(host.querySelector('.lintje-legend')).toBeNull()
  })

  it('gives each missing flow its own row, and their piece one hatch', () => {
    const spec: SankeySpec = {
      ...THREE,
      steps: THREE.steps.map((step, s) =>
        s === 1 ? { ...step, nodes: [step.nodes[0], { ...step.nodes[1], value: 2600 }] } : step,
      ),
      flows: [
        ...THREE.flows.filter((flow) => flow.from !== 'onvolledig'),
        { from: 'onvolledig', to: 'toegekend', value: null },
        { from: 'onvolledig', to: 'afgewezen', value: 700 },
        { from: 'onvolledig', to: 'ingetrokken', value: null },
      ],
    }
    const { host } = draw(spec, { mobile: true })
    const source = [...host.querySelectorAll('.lintje-sankey__source')][2]
    expect(source.querySelectorAll('.lintje-sankey__piece--missing')).toHaveLength(1)
    const lines = [...source.querySelectorAll('.lintje-sankey__row')].map((row) =>
      row.textContent!.replace(/\s+/g, ' ').trim(),
    )
    expect(lines).toEqual([
      'Toegekend geen gegevens',
      'Afgewezen 700 27%',
      'Ingetrokken geen gegevens',
    ])
  })
})
