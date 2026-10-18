/** The sortable list in a browser: a row dragged by its grip with a mouse and a finger, and the focus after. */
import { afterEach, describe, expect, it } from 'vitest'
import { cdp, server, userEvent } from 'vitest/browser'
import { deepActiveElement } from '../../../core/focus'
import './sortable-list'
import type { LintjeSortableList, SortableItem } from './sortable-list'

const ITEMS: SortableItem[] = [
  { id: 'naam', label: 'Naam' },
  { id: 'datum', label: 'Datum' },
  { id: 'status', label: 'Status' },
  { id: 'eigenaar', label: 'Eigenaar' },
]

async function mount(): Promise<LintjeSortableList> {
  const element = Object.assign(document.createElement('lintje-sortable-list'), {
    items: ITEMS,
    name: 'kolommen',
    label: 'Volgorde van de kolommen',
  })
  element.style.width = '400px'
  document.body.append(element)
  await element.updateComplete
  return element
}

const rows = (element: LintjeSortableList): HTMLElement[] => [
  ...element.shadowRoot!.querySelectorAll<HTMLElement>('.lintje-sortable-list__row'),
]
const grip = (element: LintjeSortableList, id: string): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>(`.lintje-sortable-list__grip[data-id="${id}"]`)!
const labels = (element: LintjeSortableList): string[] =>
  [...element.shadowRoot!.querySelectorAll('.lintje-sortable-list__label')].map(
    (node) => node.textContent ?? '',
  )

function collect(element: LintjeSortableList, name: string): unknown[] {
  const details: unknown[] = []
  element.addEventListener(name, (event) => details.push((event as CustomEvent).detail))
  return details
}

async function settle(element: LintjeSortableList): Promise<void> {
  await element.updateComplete
  await new Promise((done) => requestAnimationFrame(done))
  await element.updateComplete
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('lintje-sortable-list with a mouse', () => {
  it('moves the first row below the last and keeps the focus on its grip', async () => {
    const element = await mount()
    const local = collect(element, 'lintje-change')
    const values = collect(element, 'lintje-values-change')
    const last = rows(element)[3]!
    await userEvent.dragAndDrop(grip(element, 'naam'), last, {
      targetPosition: { x: 40, y: last.offsetHeight - 2 },
    })
    await settle(element)
    expect(labels(element)).toEqual(['Datum', 'Status', 'Eigenaar', 'Naam'])
    expect(local).toEqual([['datum', 'status', 'eigenaar', 'naam']])
    expect(values).toEqual([{ kolommen: ['datum', 'status', 'eigenaar', 'naam'] }])
    expect(deepActiveElement()).toBe(grip(element, 'naam'))
  })

  it('tells no order when a row is put down where it was picked up', async () => {
    const element = await mount()
    const local = collect(element, 'lintje-change')
    const second = rows(element)[1]!
    // A short drag that stays above the next row's middle.
    await userEvent.dragAndDrop(grip(element, 'datum'), second, {
      targetPosition: { x: 40, y: second.offsetHeight - 2 },
    })
    await settle(element)
    expect(labels(element)).toEqual(['Naam', 'Datum', 'Status', 'Eigenaar'])
    expect(local).toEqual([])
  })
})

describe('lintje-sortable-list with the keyboard', () => {
  it('moves a row down and keeps the focus on its grip at every step', async () => {
    const element = await mount()
    const local = collect(element, 'lintje-change')
    grip(element, 'datum').focus()
    await userEvent.keyboard(' ')
    await userEvent.keyboard('{ArrowDown}')
    await settle(element)
    expect(deepActiveElement()).toBe(grip(element, 'datum'))
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.keyboard(' ')
    await settle(element)
    expect(labels(element)).toEqual(['Naam', 'Status', 'Eigenaar', 'Datum'])
    expect(local).toEqual([['naam', 'status', 'eigenaar', 'datum']])
    expect(deepActiveElement()).toBe(grip(element, 'datum'))
    expect(grip(element, 'datum').getAttribute('aria-pressed')).toBe('false')
  })
})

// Playwright drives no touch in WebKit; Chromium takes it through the DevTools protocol.
describe.skipIf(server.browser !== 'chromium')('lintje-sortable-list with a finger', () => {
  async function touch(
    type: 'touchStart' | 'touchMove' | 'touchEnd',
    x: number,
    y: number,
  ): Promise<void> {
    // The test runs in a scaled frame; the protocol speaks in the page's coordinates.
    const frame = window.frameElement!.getBoundingClientRect()
    const scale = frame.width / window.innerWidth
    const touchPoints =
      type === 'touchEnd' ? [] : [{ x: frame.left + x * scale, y: frame.top + y * scale }]
    await cdp().send('Input.dispatchTouchEvent', { type, touchPoints })
  }

  it('moves a row by its grip without the page taking the gesture for a scroll', async () => {
    const element = await mount()
    const local = collect(element, 'lintje-change')
    const kinds: string[] = []
    const start = grip(element, 'naam')
    start.addEventListener('pointerdown', (event) => kinds.push(event.pointerType))
    start.addEventListener('pointercancel', () => kinds.push('cancel'))
    const from = start.getBoundingClientRect()
    const to = rows(element)[2]!.getBoundingClientRect()
    const x = from.left + from.width / 2
    await touch('touchStart', x, from.top + from.height / 2)
    for (const step of [0.25, 0.5, 0.75, 1]) {
      const y = from.top + (to.bottom - 2 - from.top) * step
      await touch('touchMove', x, y)
    }
    await touch('touchEnd', x, to.bottom - 2)
    await settle(element)
    expect(kinds).toEqual(['touch'])
    expect(labels(element)).toEqual(['Datum', 'Status', 'Naam', 'Eigenaar'])
    expect(local).toEqual([['datum', 'status', 'naam', 'eigenaar']])
    expect(deepActiveElement()).toBe(grip(element, 'naam'))
  })
})

const middle = (box: DOMRect): number => box.top + box.height / 2

/** The box of the first line of a text. */
function firstLine(text: Element): DOMRect {
  const range = document.createRange()
  range.selectNodeContents(text)
  return range.getClientRects()[0]!
}

/** The middles of a row's grip, its box and the first line of its label. */
function line(row: HTMLElement): number[] {
  const check = row.querySelector('lintje-checkbox')!.shadowRoot!
  return [
    middle(row.querySelector('.lintje-sortable-list__grip')!.getBoundingClientRect()),
    middle(check.querySelector('.lintje-choice__box')!.getBoundingClientRect()),
    middle(firstLine(check.querySelector('.lintje-choice__label')!)),
  ]
}

describe('lintje-sortable-list rows', () => {
  afterEach(() => {
    document.documentElement.style.fontSize = ''
  })

  it('stand at the touch height on one line and grow with a label that wraps', async () => {
    const element = await mount()
    const touchHeight = rows(element)[0]!.getBoundingClientRect().height
    expect(touchHeight).toBe(48)
    element.checkable = true
    element.items = [
      { id: 'naam', label: 'Naam' },
      { id: 'lang', label: 'Datum van de laatste wijziging door de behandelaar van de aanvraag' },
    ]
    await settle(element)
    const [short, long] = rows(element).map((row) => row.getBoundingClientRect())
    expect(short!.height).toBe(touchHeight)
    expect(long!.height).toBeGreaterThan(touchHeight)
    const label = rows(element)[1]!.querySelector('lintje-checkbox')!
    const text = label.shadowRoot!.querySelector('.lintje-choice__label')!.getBoundingClientRect()
    expect(text.bottom).toBeLessThanOrEqual(long!.bottom)
  })

  // At the default size and at 200 %: a larger letter makes the row and its line taller alike.
  for (const size of ['', '32px']) {
    it(`keep grip, box and the first line of a label on one line${size ? ' at 200 %' : ''}`, async () => {
      document.documentElement.style.fontSize = size
      const element = await mount()
      element.checkable = true
      element.items = [
        { id: 'naam', label: 'Naam' },
        { id: 'lang', label: 'Datum van de laatste wijziging door de behandelaar van de aanvraag' },
      ]
      await settle(element)
      const [short, long] = rows(element)
      const one = middle(short!.getBoundingClientRect())
      for (const at of line(short!)) expect(Math.abs(at - one)).toBeLessThan(2)
      const [atGrip, atBox, atFirst] = line(long!)
      expect(Math.abs(atGrip! - atFirst!)).toBeLessThan(2)
      expect(Math.abs(atBox! - atFirst!)).toBeLessThan(2)
      expect(atFirst!).toBeLessThan(middle(long!.getBoundingClientRect()) - 10)
      // The grip's hit area is the row's height.
      const hit = getComputedStyle(grip(element, 'lang'), '::after')
      expect(parseFloat(hit.height)).toBeCloseTo(long!.getBoundingClientRect().height, 0)
    })
  }
})
