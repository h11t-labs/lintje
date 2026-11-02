/**
 * The pie's order and folding: the host sends parts in any order and any number; the pie sorts
 * them by value, spreads the tints over the ladder with their number and folds more than five
 * into four and one "Overig" in the ladder's last step that is not a button. The legend table follows the slices
 * row for row; without the table the shared legend above does. The keyboard walks the slices in
 * the drawn order. happy-dom has no layout, so what is checked is the markup.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import '../../../charts/chart/chart'
import type { ChartData } from '../../../../types'
import type { ChartSpec } from '../shared/types'

interface ChartElement extends HTMLElement {
  renderRoot: DocumentFragment | HTMLElement
  data?: ChartData | null
  updateComplete: Promise<unknown>
}

type PieSpec = Extract<ChartSpec, { kind: 'pie' }>

const TINT = (n: number) => `var(--color-chart-tint-${n})`
const OTHER = 'var(--color-chart-other)'
const REMAINDER = 'var(--color-chart-remainder)'

async function pie(spec: Omit<PieSpec, 'kind'>, extra: Partial<ChartData> = {}) {
  const element = document.createElement('lintje-chart') as ChartElement
  element.data = {
    chart: { kind: 'pie', ...spec },
    description: 'Een taart om naar te kijken.',
    ...extra,
  }
  document.body.append(element)
  await element.updateComplete
  return element
}

const slices = (element: ChartElement) => [
  ...element.renderRoot.querySelectorAll<SVGPathElement>('path.lintje-pie-chart__segment'),
]
const fills = (element: ChartElement) => slices(element).map((path) => path.getAttribute('fill'))
const rows = (element: ChartElement) =>
  [...element.renderRoot.querySelectorAll('.lintje-pie-chart__row')].map((row) => ({
    label: row.querySelector('.lintje-pie-chart__label')?.textContent?.trim() ?? '',
    value: row.querySelector('.lintje-pie-chart__value')?.textContent?.trim() ?? '',
  }))

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('the pie', () => {
  it('draws the largest part first and darkest, whatever order the host sends', async () => {
    const element = await pie({
      segments: [
        { label: 'Klein', value: 1 },
        { label: 'Middel', value: 2 },
        { label: 'Groot', value: 3 },
      ],
    })
    expect(fills(element)).toEqual([TINT(1), TINT(2), TINT(4)])
    expect(rows(element).map((row) => row.label)).toEqual(['Groot', 'Middel', 'Klein'])
  })

  it('spreads two parts over the ladder: the first and the fourth step', async () => {
    const element = await pie({
      segments: [
        { label: 'A', value: 8 },
        { label: 'B', value: 3 },
      ],
    })
    expect(fills(element)).toEqual([TINT(1), TINT(4)])
  })

  it('takes the tints of the colour the spec brings', async () => {
    const element = await pie({
      color: 'violet',
      segments: [
        { label: 'A', value: 8 },
        { label: 'B', value: 3 },
      ],
    })
    expect(fills(element)).toEqual([
      'var(--color-chart-violet)',
      'var(--color-chart-violet-tint-4)',
    ])
  })

  it('folds eight parts into four and one "Overig" in the last step that is not a button', async () => {
    const element = await pie({
      segments: Array.from({ length: 8 }, (_, i) => ({
        label: `Post ${i + 1}`,
        value: i + 1,
        href: `/p/${i + 1}`,
      })),
    })
    expect(fills(element)).toEqual([TINT(1), TINT(2), TINT(3), TINT(4), TINT(5)])
    const [folded] = slices(element).slice(4)
    expect(folded.hasAttribute('data-mark-id')).toBe(false)
    expect(folded.hasAttribute('role')).toBe(false)
    expect(folded.hasAttribute('tabindex')).toBe(false)
    expect(
      slices(element)
        .slice(0, 4)
        .map((path) => path.getAttribute('role')),
    ).toEqual(['button', 'button', 'button', 'button'])
    // The largest four keep their own identity; the fifth is 1 + 2 + 3 + 4.
    expect(
      slices(element)
        .slice(0, 4)
        .map((path) => path.dataset.markId),
    ).toEqual(['Post 8', 'Post 7', 'Post 6', 'Post 5'])
    expect(rows(element)).toHaveLength(5)
    expect(rows(element)[4]).toEqual({ label: 'Overig', value: '10' })
  })

  it('folds into the host’s own "Overig" rather than drawing a second one', async () => {
    const element = await pie({
      segments: [
        ...Array.from({ length: 7 }, (_, i) => ({ label: `Post ${i + 1}`, value: 7 - i })),
        { label: 'Overig', value: 1 },
      ],
    })
    // 7 + 6 + 5 + 4 stay; 3 + 2 + 1 join the host's "Overig" of 1.
    expect(slices(element)).toHaveLength(5)
    expect(fills(element)).toEqual([TINT(1), TINT(2), TINT(3), TINT(4), TINT(5)])
    expect(rows(element).find((row) => row.label === 'Overig')?.value).toBe('7')
  })

  it('spreads "Overig" over the ladder with the parts, and keeps a colour the host gives', async () => {
    // Two parts and "Overig": steps 1, 2 and 4; `other` says "this is Overig".
    const three = await pie({
      segments: [
        { label: 'A', value: 8 },
        { label: 'B', value: 3 },
        { label: 'Rest van de aanvragen', value: 1, color: 'other' },
      ],
    })
    expect(fills(three)).toEqual([TINT(1), TINT(2), TINT(4)])
    document.body.innerHTML = ''
    // A host's "Overig" and five parts are six rungs: four parts stay.
    const six = await pie({
      segments: [
        ...Array.from({ length: 5 }, (_, i) => ({ label: `Post ${i + 1}`, value: 9 - i })),
        { label: 'Overig', value: 1 },
      ],
    })
    expect(new Set(fills(six)).size).toBe(5)
    document.body.innerHTML = ''
    // Every part a colour of its own: no ladder, so "Overig" is gray; a named colour wins.
    const named = await pie({
      segments: [
        { label: 'Ja', value: 8, color: 'green' },
        { label: 'Nee', value: 3, color: 'red' },
        { label: 'Overig', value: 1 },
      ],
    })
    expect(fills(named)).toEqual(['var(--color-chart-green)', 'var(--color-chart-red)', OTHER])
  })

  it('does not count a remainder as a part and keeps it last', async () => {
    const element = await pie({
      donut: true,
      segments: [
        { label: 'Vrij', value: 5, remainder: true },
        { label: 'Gereserveerd', value: 1 },
        { label: 'Bezet', value: 2 },
      ],
    })
    expect(fills(element)).toEqual([TINT(1), TINT(4), REMAINDER])
    expect(rows(element).map((row) => row.label)).toEqual(['Bezet', 'Gereserveerd', 'Vrij'])
  })

  it('lets a segment’s own colour win over its tint, without handing the tint on', async () => {
    const element = await pie({
      segments: [
        { label: 'Blauw', value: 5, color: 'dark-blue' },
        { label: 'B', value: 3 },
      ],
    })
    expect(fills(element)).toEqual(['var(--color-chart-dark-blue)', TINT(4)])
  })

  it('keeps each legend swatch the colour of its slice', async () => {
    const element = await pie({
      segments: [
        { label: 'B', value: 2 },
        { label: 'Overig', value: 1 },
        { label: 'A', value: 4 },
      ],
    })
    const markers = [
      ...element.renderRoot.querySelectorAll<HTMLElement>('.lintje-pie-chart__marker'),
    ].map((marker) => marker.style.background.replace(/\s/g, ''))
    expect(markers).toEqual(fills(element))
  })

  it('names the legend table after the description, out of sight', async () => {
    const element = await pie({
      segments: [
        { label: 'Groot', value: 60 },
        { label: 'Klein', value: 40 },
      ],
    })
    const caption = element.renderRoot.querySelector('.lintje-pie-chart__table caption')!
    expect(caption.textContent).toBe('Legenda: Een taart om naar te kijken.')
    expect(caption.classList.contains('visually-hidden')).toBe(true)
  })

  it('keeps the chosen slice chosen by its id after sorting, and its row with it', async () => {
    const element = await pie(
      {
        segments: [
          { label: 'Klein', value: 1, id: 'klein', href: '/p/klein' },
          { label: 'Groot', value: 3, id: 'groot', href: '/p/groot' },
        ],
      },
      { selectedId: 'klein' },
    )
    const [first, second] = slices(element)
    expect(first.dataset.markId).toBe('groot')
    expect(first.classList.contains('is-muted')).toBe(true)
    expect(second.dataset.markId).toBe('klein')
    expect(second.getAttribute('aria-pressed')).toBe('true')
    const states = [...element.renderRoot.querySelectorAll('.lintje-pie-chart__row')].map((row) =>
      row.classList.contains('is-selected'),
    )
    expect(states).toEqual([false, true])
  })
})

describe('a pie without a legend table', () => {
  const SEGMENTS = [
    { label: 'Rest', value: 5, remainder: true },
    { label: 'Overig', value: 8 },
    { label: 'Balie', value: 25 },
    { label: 'Online', value: 50 },
    { label: 'Post', value: 12 },
  ]

  const drawing = (element: ChartElement) =>
    element.renderRoot.querySelector<SVGSVGElement>('.lintje-pie-chart__svg')!
  const key = async (element: ChartElement, name: string) => {
    drawing(element).dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }))
    await element.updateComplete
  }
  const tooltip = (element: ChartElement) =>
    element.renderRoot.querySelector('.lintje-chart-tooltip__title')?.textContent
  const status = (element: ChartElement) =>
    element.renderRoot.querySelector('[role="status"]')?.textContent?.trim()
  const lifted = (element: ChartElement) =>
    slices(element).findIndex((path) => path.classList.contains('is-hovered'))

  it('takes the focus and walks its slices in the drawn order, tooltip and status along', async () => {
    const element = await pie({ legendTable: false, segments: SEGMENTS })
    expect(drawing(element).getAttribute('tabindex')).toBe('0')
    expect(drawing(element).getAttribute('role')).toBe('img')
    const order = ['Online', 'Balie', 'Post', 'Overig', 'Rest']
    for (const [i, label] of order.entries()) {
      await key(element, 'ArrowRight')
      expect(tooltip(element)).toBe(label)
      expect(lifted(element)).toBe(i)
    }
    expect(status(element)).toBe('Rest: Aantal 5 · 5%')
    await key(element, 'ArrowRight')
    expect(tooltip(element)).toBe('Rest')
    await key(element, 'Home')
    expect(tooltip(element)).toBe('Online')
    expect(status(element)).toBe('Online: Aantal 50 · 50%')
    await key(element, 'ArrowDown')
    expect(tooltip(element)).toBe('Balie')
    await key(element, 'ArrowUp')
    expect(tooltip(element)).toBe('Online')
    await key(element, 'End')
    expect(tooltip(element)).toBe('Rest')
    await key(element, 'ArrowLeft')
    expect(tooltip(element)).toBe('Overig')
  })

  it('keeps the keys of a clickable slice its own', async () => {
    const element = await pie({
      legendTable: false,
      segments: [
        { label: 'Groot', value: 3, id: 'groot', href: '/p/groot' },
        { label: 'Klein', value: 1, id: 'klein', href: '/p/klein' },
      ],
    })
    expect(drawing(element).getAttribute('role')).toBe('group')
    const [first] = slices(element)
    expect(first.getAttribute('tabindex')).toBe('0')
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await element.updateComplete
    expect(tooltip(element)).toBeUndefined()
  })

  it('has the shared legend above the drawing: one item per slice, in its tint, no buttons', async () => {
    const element = await pie({ legendTable: false, segments: SEGMENTS })
    const legend = element.renderRoot.querySelector('.lintje-legend')!
    expect(legend.compareDocumentPosition(drawing(element))).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    const items = [...legend.querySelectorAll('.lintje-legend__item')]
    expect(items.map((item) => item.textContent?.trim())).toEqual([
      'Online',
      'Balie',
      'Post',
      'Overig',
      'Rest',
    ])
    const swatches = items.map((item) =>
      (item.querySelector('.lintje-legend__marker') as HTMLElement).style.color.replace(/\s/g, ''),
    )
    expect(swatches).toEqual(fills(element))
    expect(legend.querySelector('button')).toBeNull()
    expect(element.renderRoot.querySelector('.lintje-pie-chart__table')).toBeNull()
  })

  it('lifts the slice of the legend item pointed at', async () => {
    const element = await pie({ legendTable: false, segments: SEGMENTS })
    const items = element.renderRoot.querySelectorAll('.lintje-legend__item')
    items[2].dispatchEvent(new MouseEvent('mouseenter'))
    await element.updateComplete
    expect(lifted(element)).toBe(2)
    items[2].dispatchEvent(new MouseEvent('mouseleave'))
    await element.updateComplete
    expect(lifted(element)).toBe(-1)
  })

  it('has no legend above a pie with its table: the table is the legend', async () => {
    const element = await pie({ segments: SEGMENTS })
    expect(element.renderRoot.querySelector('.lintje-legend')).toBeNull()
    expect(element.renderRoot.querySelector('.lintje-pie-chart__table')).not.toBeNull()
    expect(drawing(element).getAttribute('tabindex')).toBe('0')
  })
})
