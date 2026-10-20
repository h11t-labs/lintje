/**
 * The sortable list: the reorder and drop arithmetic, the keyboard path with what the status
 * line says, and the events. happy-dom has no layout, so the pointer drag is checked on
 * `dropIndex()` and in the browser; a tap needs none.
 */
import { describe, expect, it } from 'vitest'
import './sortable-list'
import { dropIndex, moveItem, type LintjeSortableList, type SortableItem } from './sortable-list'

const ITEMS: SortableItem[] = [
  { id: 'titel', label: 'Titel' },
  { id: 'categorie', label: 'Categorie' },
  { id: 'ernst', label: 'Ernst' },
  { id: 'datum', label: 'Datum' },
]

async function mount(props: Partial<LintjeSortableList> = {}): Promise<LintjeSortableList> {
  const element = Object.assign(document.createElement('lintje-sortable-list'), {
    items: ITEMS,
    ...props,
  })
  document.body.append(element)
  await element.updateComplete
  return element
}

const grip = (element: LintjeSortableList, id: string): HTMLElement =>
  [...element.shadowRoot!.querySelectorAll<HTMLElement>('.lintje-sortable-list__grip')].find(
    (node) => node.dataset.id === id,
  )!
const labels = (element: LintjeSortableList): string[] =>
  [...element.shadowRoot!.querySelectorAll('.lintje-sortable-list__label')].map(
    (node) => node.textContent ?? '',
  )
const status = (element: LintjeSortableList): string =>
  element.shadowRoot!.querySelector('[role="status"]')!.textContent ?? ''
const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()))

/** What the status line says, after its fill frame. */
async function said(element: LintjeSortableList): Promise<string> {
  await frame()
  await element.updateComplete
  return status(element)
}

async function press(element: LintjeSortableList, id: string, key: string): Promise<void> {
  grip(element, id).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  await element.updateComplete
}

async function pointer(element: LintjeSortableList, target: Element, type: string): Promise<void> {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      composed: true,
      cancelable: true,
      button: 0,
      pointerId: 1,
      clientY: 10,
    }),
  )
  await element.updateComplete
}

/** A tap let go on the grip it pressed: down, up and the click that follows. */
async function tapGrip(element: LintjeSortableList, id: string): Promise<void> {
  await pointer(element, grip(element, id), 'pointerdown')
  await pointer(element, grip(element, id), 'pointerup')
  grip(element, id).dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
  await element.updateComplete
}

const rowOf = (element: LintjeSortableList, id: string): HTMLElement =>
  grip(element, id).closest('li')!
const lifted = (element: LintjeSortableList, id: string): boolean =>
  rowOf(element, id).classList.contains('is-lifted')

/** Gives the rows boxes, 48 px high every 52 px, so a drag can measure them. */
function lay(element: LintjeSortableList): void {
  element.shadowRoot!.querySelectorAll<HTMLElement>('li').forEach((row, index) => {
    row.getBoundingClientRect = () => new DOMRect(0, index * 52, 300, 48)
  })
}

async function drag(element: LintjeSortableList, id: string, type: string, clientY: number) {
  grip(element, id).dispatchEvent(
    new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerId: 2, clientY }),
  )
  await element.updateComplete
}

function collect(element: LintjeSortableList, name: string): unknown[] {
  const details: unknown[] = []
  element.addEventListener(name, (event) => details.push((event as CustomEvent).detail))
  return details
}

describe('moveItem() and dropIndex()', () => {
  it('moves one entry and keeps the rest in order', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 2, 1)).toEqual(['a', 'c', 'b', 'd'])
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 3)).toEqual(['b', 'c', 'd', 'a'])
    expect(moveItem(['a', 'b'], 1, 9)).toEqual(['a', 'b'])
  })

  it('passes a row once the dragged row covers half of it, up and down alike', () => {
    // Rows 44 high, 4 apart; the second (top 48, bottom 92) is dragged past the others.
    const middles = [22, 118, 166]
    const at = (dy: number): number => dropIndex(middles, 1, 48 + dy, 92 + dy)
    expect(at(0)).toBe(1)
    expect(at(25)).toBe(1)
    expect(at(27)).toBe(2)
    expect(at(-25)).toBe(1)
    expect(at(-27)).toBe(0)
    expect(at(500)).toBe(3)
  })
})

describe('lintje-sortable-list', () => {
  it('names every grip after its row and has a status line', async () => {
    const element = await mount()
    expect(grip(element, 'ernst').getAttribute('aria-label')).toBe('Ernst verplaatsen')
    expect(grip(element, 'ernst').getAttribute('aria-pressed')).toBe('false')
    expect(element.shadowRoot!.querySelector('[role="status"]')).not.toBeNull()
  })

  it('picks up, moves and puts down with the keyboard, saying every step', async () => {
    const element = await mount({ name: 'kolommen' })
    const local = collect(element, 'lintje-change')
    const values = collect(element, 'lintje-values-change')

    await press(element, 'ernst', ' ')
    expect(await said(element)).toBe('Ernst opgepakt. Plaats 3 van 4.')
    expect(grip(element, 'ernst').getAttribute('aria-pressed')).toBe('true')

    await press(element, 'ernst', 'ArrowUp')
    expect(await said(element)).toBe('Plaats 2 van 4.')
    expect(labels(element)).toEqual(['Titel', 'Ernst', 'Categorie', 'Datum'])
    // Nothing is told while the row is still in the hand.
    expect(local).toEqual([])

    await press(element, 'ernst', 'Enter')
    expect(await said(element)).toBe('Ernst neergelegd op plaats 2.')
    const order = ['titel', 'ernst', 'categorie', 'datum']
    expect(local).toEqual([order])
    expect(values).toEqual([{ kolommen: order }])
  })

  it('puts the row back on Escape and tells nothing', async () => {
    const element = await mount({ name: 'kolommen' })
    const values = collect(element, 'lintje-values-change')
    await press(element, 'categorie', 'Enter')
    await press(element, 'categorie', 'ArrowDown')
    await press(element, 'categorie', 'ArrowDown')
    expect(labels(element)).toEqual(['Titel', 'Ernst', 'Datum', 'Categorie'])
    await press(element, 'categorie', 'Escape')
    expect(labels(element)).toEqual(['Titel', 'Categorie', 'Ernst', 'Datum'])
    expect(await said(element)).toBe('Categorie teruggezet op plaats 2.')
    expect(values).toEqual([])
  })

  it('says the place again on a second press at the edge, emptying the line first', async () => {
    const element = await mount()
    await press(element, 'titel', ' ')
    await press(element, 'titel', 'ArrowUp')
    expect(await said(element)).toBe('Plaats 1 van 4.')
    await press(element, 'titel', 'ArrowUp')
    expect(status(element)).toBe('')
    expect(await said(element)).toBe('Plaats 1 van 4.')
    expect(labels(element)).toEqual(['Titel', 'Categorie', 'Ernst', 'Datum'])
  })

  it('does not move a row that was not picked up', async () => {
    const element = await mount()
    await press(element, 'ernst', 'ArrowUp')
    expect(labels(element)).toEqual(['Titel', 'Categorie', 'Ernst', 'Datum'])
  })

  it('picks up on a tap and puts down on a tap on another grip, without a drag', async () => {
    const element = await mount({ name: 'kolommen' })
    const values = collect(element, 'lintje-values-change')
    const tap = (id: string): Promise<void> => tapGrip(element, id)

    await tap('datum')
    expect(await said(element)).toBe('Datum opgepakt. Plaats 4 van 4.')
    expect(grip(element, 'datum').getAttribute('aria-pressed')).toBe('true')
    expect(values).toEqual([])

    await tap('categorie')
    expect(labels(element)).toEqual(['Titel', 'Datum', 'Categorie', 'Ernst'])
    expect(await said(element)).toBe('Datum neergelegd op plaats 2.')
    expect(grip(element, 'datum').getAttribute('aria-pressed')).toBe('false')
    expect(values).toEqual([{ kolommen: ['titel', 'datum', 'categorie', 'ernst'] }])

    // A tap on the grip in the hand puts the row down where it is.
    await tap('ernst')
    await tap('ernst')
    expect(await said(element)).toBe('Ernst neergelegd op plaats 4.')
    expect(values).toHaveLength(1)
  })

  it('keeps the row in the hand until a tap on another grip is let go there', async () => {
    const element = await mount({ name: 'kolommen' })
    const values = collect(element, 'lintje-values-change')
    await tapGrip(element, 'datum')
    await pointer(element, grip(element, 'categorie'), 'pointerdown')
    // The press leaves the focus on the grip in the hand, also where a browser sends a mousedown.
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    grip(element, 'categorie').dispatchEvent(down)
    expect(down.defaultPrevented).toBe(true)
    expect(labels(element)).toEqual(['Titel', 'Categorie', 'Ernst', 'Datum'])
    expect(grip(element, 'datum').getAttribute('aria-pressed')).toBe('true')
    expect(values).toEqual([])
    await pointer(element, grip(element, 'categorie'), 'pointerup')
    grip(element, 'categorie').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await element.updateComplete
    expect(labels(element)).toEqual(['Titel', 'Datum', 'Categorie', 'Ernst'])
    expect(values).toEqual([{ kolommen: ['titel', 'datum', 'categorie', 'ernst'] }])
  })

  it('moves the row on the release, tells it once, and keeps it lifted until it has landed', async () => {
    const element = await mount({ name: 'kolommen' })
    const values = collect(element, 'lintje-values-change')
    await tapGrip(element, 'datum')
    await tapGrip(element, 'categorie')
    expect(labels(element)).toEqual(['Titel', 'Datum', 'Categorie', 'Ernst'])
    expect(values).toEqual([{ kolommen: ['titel', 'datum', 'categorie', 'ernst'] }])
    expect(grip(element, 'datum').getAttribute('aria-pressed')).toBe('false')
    expect(lifted(element, 'datum')).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 20))
    await element.updateComplete
    expect(lifted(element, 'datum')).toBe(false)
    expect(values).toHaveLength(1)
  })

  it.each(['pointerup outside', 'pointercancel'])(
    'keeps the row in the hand and the order when a tap on a grip ends in a %s',
    async (end) => {
      const element = await mount({ name: 'kolommen' })
      const local = collect(element, 'lintje-change')
      await tapGrip(element, 'datum')
      await pointer(element, grip(element, 'titel'), 'pointerdown')
      if (end === 'pointercancel') {
        await pointer(element, grip(element, 'titel'), 'pointercancel')
        // A click after a cancel is not that tap's: it puts nothing down either.
        grip(element, 'titel').dispatchEvent(new MouseEvent('click', { bubbles: true }))
      } else {
        await pointer(element, document.body, 'pointerup')
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      }
      await element.updateComplete
      expect(labels(element)).toEqual(['Titel', 'Categorie', 'Ernst', 'Datum'])
      expect(grip(element, 'datum').getAttribute('aria-pressed')).toBe('true')
      expect(local).toEqual([])
      // The next tap counts.
      await tapGrip(element, 'titel')
      expect(labels(element)).toEqual(['Datum', 'Titel', 'Categorie', 'Ernst'])
      expect(local).toEqual([['datum', 'titel', 'categorie', 'ernst']])
    },
  )

  it.each(['Escape', 'pointercancel'])(
    'puts every row back and tells nothing when a drag ends in %s',
    async (end) => {
      const element = await mount({ name: 'kolommen' })
      const local = collect(element, 'lintje-change')
      lay(element)
      await drag(element, 'datum', 'pointerdown', 180)
      await drag(element, 'datum', 'pointermove', 10)
      expect(rowOf(element, 'titel').style.transform).not.toBe('')
      if (end === 'Escape') {
        // Wherever the focus is: here, on the page.
        const key = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
        document.body.dispatchEvent(key)
        expect(key.defaultPrevented).toBe(true)
        await element.updateComplete
      } else await drag(element, 'datum', 'pointercancel', 10)
      await drag(element, 'datum', 'pointerup', 10)
      expect(labels(element)).toEqual(['Titel', 'Categorie', 'Ernst', 'Datum'])
      for (const id of ['titel', 'categorie', 'ernst', 'datum']) {
        expect(rowOf(element, id).style.transform).toBe('')
      }
      expect(local).toEqual([])
      // Once the drag is over, an Escape is the page's again.
      const later = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      document.body.dispatchEvent(later)
      expect(later.defaultPrevented).toBe(false)
    },
  )

  it('with checkable draws a box per row and tells the checked ids', async () => {
    const element = await mount({
      checkable: true,
      items: ITEMS.map((item) => ({ ...item, checked: item.id !== 'datum' })),
    })
    const checked = collect(element, 'lintje-checked-change')
    const local = collect(element, 'lintje-change')
    const boxes = [...element.shadowRoot!.querySelectorAll('lintje-checkbox')]
    expect(boxes.map((box) => box.getAttribute('label'))).toEqual([
      'Titel',
      'Categorie',
      'Ernst',
      'Datum',
    ])
    await boxes[0]!.updateComplete
    const input = boxes[0]!.shadowRoot!.querySelector('input')!
    input.checked = false
    input.dispatchEvent(new Event('change', { bubbles: true }))
    expect(checked).toEqual([['categorie', 'ernst']])
    // The box's own lintje-change stops at the list.
    expect(local).toEqual([])
  })
})
