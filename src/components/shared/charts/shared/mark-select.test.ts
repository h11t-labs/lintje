/**
 * Cross-drill: a chart mark on the map's own contract.
 *
 * What is checked per chart kind is the same three things, because the contract
 * is one: a mark whose data point carries no `href` is not a button, a mark that
 * does carry one emits `lintje-mark-select` with the URL the host minted, and the
 * chosen mark clicked again emits the clear with the tile's `clearHref`.
 *
 * happy-dom has no layout, so what is checked is the markup and the events.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import '../../../charts/chart/chart'
import type { ChartSpec } from './types'
import type { ChartData } from '../../../../types'

interface ChartElement extends HTMLElement {
  renderRoot: DocumentFragment | HTMLElement
  data?: ChartData | null
  updateComplete: Promise<unknown>
}

async function mountChart(chart: ChartSpec, extra: Partial<ChartData> = {}): Promise<ChartElement> {
  const element = document.createElement('lintje-chart') as ChartElement
  element.data = { chart, description: 'Een figuur om op door te klikken.', ...extra }
  document.body.append(element)
  await element.updateComplete
  return element
}

function mark(element: ChartElement, id: string): Element {
  const found = element.renderRoot.querySelector(`[data-mark-id="${id}"]`)
  if (!found) throw new Error(`no mark ${id}`)
  return found
}

/** The marks in one of the two `is-*` states, whichever kind of node they are. */
function inState(element: ChartElement, state: string): Element[] {
  return [...element.renderRoot.querySelectorAll(`.${state}`)]
}

async function click(element: ChartElement, node: Element): Promise<void> {
  node.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await element.updateComplete
}

let selects: CustomEvent[] = []

// One listener for the whole file: `document.body` survives `innerHTML = ''`, so
// a listener per test would count every event once per test that ran before it.
document.body.addEventListener('lintje-mark-select', (event) => selects.push(event as CustomEvent))

beforeEach(() => {
  document.body.innerHTML = ''
  selects = []
})

/** The five kinds that drill, each with one linked mark and one without. */
const KINDS: { name: string; chart: ChartSpec; id: string; inert: string }[] = [
  {
    name: 'bar',
    id: 'noord',
    inert: 'zuid',
    chart: {
      kind: 'bar',
      labels: ['Noord', 'Zuid'],
      values: [12, 8],
      links: [{ id: 'noord', href: '/p?nav.region=noord' }, null],
    },
  },
  {
    name: 'grouped-bar',
    id: 'noord',
    inert: 'zuid',
    chart: {
      kind: 'grouped-bar',
      labels: ['Noord', 'Zuid'],
      series: [
        {
          label: 'Nu',
          values: [12, 8],
          links: [{ id: 'noord', href: '/p?nav.region=noord' }, null],
        },
      ],
    },
  },
  {
    name: 'horizontal-bar',
    id: 'noord',
    inert: 'zuid',
    chart: {
      kind: 'horizontal-bar',
      rows: [
        { label: 'Noord', value: 12, id: 'noord', href: '/p?nav.region=noord' },
        { label: 'Zuid', value: 8 },
      ],
    },
  },
  {
    name: 'pie',
    id: 'noord',
    inert: 'zuid',
    chart: {
      kind: 'pie',
      segments: [
        { label: 'Noord', value: 12, id: 'noord', href: '/p?nav.region=noord' },
        { label: 'Zuid', value: 8 },
      ],
    },
  },
  {
    name: 'stacked-bar',
    id: 'noord',
    inert: 'zuid',
    chart: {
      kind: 'stacked-bar',
      labels: ['Noord', 'Zuid'],
      series: [
        {
          label: 'Nu',
          values: [12, 8],
          links: [{ id: 'noord', href: '/p?nav.region=noord' }, null],
        },
      ],
    },
  },
  {
    name: 'heatmap',
    id: 'noord',
    inert: 'zuid',
    chart: {
      kind: 'heatmap',
      columnLabels: ['ma'],
      rowLabels: ['Noord', 'Zuid'],
      values: [[12], [8]],
      links: [[{ id: 'noord', href: '/p?nav.region=noord' }], [null]],
    },
  },
]

describe.each(KINDS)('cross-drill · $name', ({ chart, id, inert }) => {
  it('makes the mark that carries a href a button', async () => {
    const element = await mountChart(chart)
    const node = mark(element, id)
    // The heatmap's cell is a button already; the svg marks say so themselves.
    expect(node.getAttribute('role') ?? node.tagName.toLowerCase()).toBe('button')
    expect(node.getAttribute('aria-pressed')).toBe('false')
    expect(node.getAttribute('aria-label')).toContain('Noord')
  })

  it('makes the drawing around its buttons a group named by the description, not an image', async () => {
    const element = await mountChart(chart)
    // A button inside `role="img"` is hidden from the accessibility tree (WCAG 4.1.2).
    const drawing = mark(element, id).closest('svg')
    if (!drawing) return // the heatmap is a table
    expect(drawing.getAttribute('role')).toBe('group')
    expect(drawing.getAttribute('aria-labelledby')).toMatch(/-desc$/)
    // The focus ring is a filter of the drawing's own, with a gap in the surface, so an orange
    // mark keeps it; the CSS reaches it through the custom property.
    const ring = drawing.querySelector('filter[id^="focus-"]')
    expect(ring?.querySelector('.lintje-chart__focus-gap')).not.toBeNull()
    expect((drawing as SVGSVGElement).style.getPropertyValue('--lintje-focus-ring')).toBe(
      `url(#${ring?.id})`,
    )
  })

  it('leaves a mark without a href alone', async () => {
    const element = await mountChart(chart)
    expect(element.renderRoot.querySelector(`[data-mark-id="${inert}"]`)).toBeNull()
    const nodes = [...element.renderRoot.querySelectorAll('[role="button"]')]
    expect(nodes.every((node) => node.getAttribute('data-mark-id') === id)).toBe(true)
  })

  it('emits lintje-mark-select with the URL the host minted', async () => {
    const element = await mountChart(chart)
    await click(element, mark(element, id))
    expect(selects.at(-1)?.detail).toMatchObject({ id, href: '/p?nav.region=noord' })
  })

  it('emits the clear when the chosen mark is clicked again', async () => {
    const element = await mountChart(chart, { selectedId: id, clearHref: '/p' })
    const node = mark(element, id)
    expect(node.getAttribute('aria-pressed')).toBe('true')
    expect(node.getAttribute('class')).toContain('is-selected')
    await click(element, node)
    expect(selects.at(-1)?.detail).toMatchObject({ id: null, href: '/p' })
  })

  it('steps the other marks back while one is chosen', async () => {
    const plain = await mountChart(chart)
    const chosen = await mountChart(chart, { selectedId: id })
    // Nothing chosen: nothing dims. One chosen: everything else does.
    expect(inState(plain, 'is-muted')).toEqual([])
    expect(inState(chosen, 'is-muted').length).toBeGreaterThan(0)
    expect(mark(chosen, id).getAttribute('class')).not.toContain('is-muted')
  })

  it('ignores a selection that names no mark it draws', async () => {
    // The page may be drilled into something this chart does not show, or the
    // chosen mark dropped out of the period: that is no selection, not a grey chart.
    const element = await mountChart(chart, { selectedId: 'elders' })
    expect(inState(element, 'is-muted')).toEqual([])
    expect(inState(element, 'is-selected')).toEqual([])
    expect(mark(element, id).getAttribute('aria-pressed')).toBe('false')
  })

  it('emits the clear on Escape inside the chart', async () => {
    const element = await mountChart(chart, { selectedId: id, clearHref: '/p' })
    mark(element, id).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await element.updateComplete
    expect(selects.at(-1)?.detail).toMatchObject({ id: null, href: '/p' })
  })

  it('says nothing on Escape while nothing is chosen', async () => {
    const element = await mountChart(chart)
    mark(element, id).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await element.updateComplete
    expect(selects).toEqual([])
  })
})

describe('cross-drill · a chart that drills nowhere', () => {
  it('draws no button and sends nothing', async () => {
    const element = await mountChart({ kind: 'bar', labels: ['Noord'], values: [12] })
    expect(element.renderRoot.querySelector('[role="button"]')).toBeNull()
    expect(element.renderRoot.querySelector('[data-mark-id]')).toBeNull()
    expect(element.renderRoot.querySelector('.lintje-chart__svg')?.getAttribute('role')).toBe('img')
  })
})

describe('cross-drill · the keyboard', () => {
  it('activates a mark with Enter and with Space', async () => {
    const element = await mountChart(KINDS[0].chart)
    for (const key of ['Enter', ' ']) {
      mark(element, 'noord').dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
      await element.updateComplete
    }
    expect(selects).toHaveLength(2)
    expect(selects.at(-1)?.detail).toMatchObject({ id: 'noord' })
  })
})

describe('cross-drill · the pie’s legend', () => {
  const pie: ChartSpec = {
    kind: 'pie',
    segments: [
      { label: 'Noord', value: 12, id: 'noord', href: '/p?nav.region=noord' },
      { label: 'Zuid', value: 8, id: 'zuid', href: '/p?nav.region=zuid' },
    ],
  }
  const rows = (element: ChartElement) =>
    [...element.renderRoot.querySelectorAll('.lintje-pie-chart__row')].map((row) => row.className)

  it('dims the rows of the other slices and marks the chosen one', async () => {
    const [noord, zuid] = rows(await mountChart(pie, { selectedId: 'noord' }))
    expect(noord).toContain('is-selected')
    expect(zuid).toContain('is-muted')
  })

  it('leaves every row alone while nothing is chosen', async () => {
    for (const row of rows(await mountChart(pie))) {
      expect(row).not.toContain('is-muted')
      expect(row).not.toContain('is-selected')
    }
  })
})
