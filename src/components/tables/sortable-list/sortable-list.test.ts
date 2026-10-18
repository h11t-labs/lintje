/**
 * The sortable list: the reorder and drop arithmetic, the keyboard path with what the status
 * line says, and the events. happy-dom has no layout, so a drag is given row boxes to measure;
 * a tap needs none.
 */
import { describe, expect, it } from 'vitest'
import './sortable-list'
import { dragIndex, moveItem, type LintjeSortableList, type SortableItem } from './sortable-list'

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

/** No row draws a drop line: the list itself shows the order. */
const lines = (element: LintjeSortableList): number =>
  element.shadowRoot!.querySelectorAll('.is-drop-before, .is-drop-after, [class*="drop"]').length
const rowOf = (element: LintjeSortableList, id: string): HTMLElement =>
  grip(element, id).closest('li')!

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
const lifted = (element: LintjeSortableList, id: string): boolean =>
  grip(element, id).closest('li')!.classList.contains('is-lifted')

function collect(element: LintjeSortableList, name: string): unknown[] {
  const details: unknown[] = []
  element.addEventListener(name, (event) => details.push((event as CustomEvent).detail))
  return details
}

describe('moveItem() and dragIndex()', () => {
  it('moves one entry and keeps the rest in order', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 2, 1)).toEqual(['a', 'c', 'b', 'd'])
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 3)).toEqual(['b', 'c', 'd', 'a'])
    expect(moveItem(['a', 'b'], 1, 9)).toEqual(['a', 'b'])
  })

  it('passes a neighbour when the dragged row’s centre passes that neighbour’s middle', () => {
    const slots = [24, 76, 128, 180]
    expect(dragIndex(slots, 70, 0)).toBe(0)
    expect(dragIndex(slots, 80, 0)).toBe(1)
    expect(dragIndex(slots, 500, 0)).toBe(3)
    // Back up, it passes the neighbour above at that one's middle, not before.
    expect(dragIndex(slots, 60, 1)).toBe(1)
    expect(dragIndex(slots, 20, 1)).toBe(0)
    expect(dragIndex(slots, -50, 3)).toBe(0)
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
    // Nothing moves while the press is down, and no line marks a place.
    expect(lines(element)).toBe(0)
    expect(labels(element)).toEqual(['Titel', 'Categorie', 'Ernst', 'Datum'])
    expect(grip(element, 'datum').getAttribute('aria-pressed')).toBe('true')
    expect(values).toEqual([])
    await pointer(element, grip(element, 'categorie'), 'pointerup')
    grip(element, 'categorie').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await element.updateComplete
    expect(labels(element)).toEqual(['Titel', 'Datum', 'Categorie', 'Ernst'])
    expect(values).toEqual([{ kolommen: ['titel', 'datum', 'categorie', 'ernst'] }])
  })

  it('says what happens out of sight only: the sentence is for a screen reader', async () => {
    const element = await mount()
    expect(element.shadowRoot!.querySelector('[role="status"]')!.className).toBe('visually-hidden')
  })

  it('moves the other rows out of the way while a row is dragged, and tells the order once', async () => {
    const element = await mount({ name: 'kolommen' })
    const local = collect(element, 'lintje-change')
    lay(element)
    await drag(element, 'titel', 'pointerdown', 24)
    // Past the middle of Categorie (76): Categorie takes the place above.
    await drag(element, 'titel', 'pointermove', 84)
    expect(rowOf(element, 'categorie').style.getPropertyValue('translate')).toBe('0 -52px')
    expect(rowOf(element, 'ernst').style.getPropertyValue('translate')).toBe('')
    expect(rowOf(element, 'titel').style.transform).toBe('translateY(60px)')
    expect(lines(element)).toBe(0)
    await drag(element, 'titel', 'pointermove', 140)
    expect(rowOf(element, 'ernst').style.getPropertyValue('translate')).toBe('0 -52px')
    // Ernst now stands at 76: only past that middle does it move back, not at its own 128.
    await drag(element, 'titel', 'pointermove', 110)
    expect(rowOf(element, 'ernst').style.getPropertyValue('translate')).toBe('0 -52px')
    await drag(element, 'titel', 'pointermove', 70)
    expect(rowOf(element, 'ernst').style.getPropertyValue('translate')).toBe('')
    expect(rowOf(element, 'categorie').style.getPropertyValue('translate')).toBe('0 -52px')
    expect(labels(element)).toEqual(['Titel', 'Categorie', 'Ernst', 'Datum'])
    expect(local).toEqual([])

    await drag(element, 'titel', 'pointerup', 70)
    expect(labels(element)).toEqual(['Categorie', 'Titel', 'Ernst', 'Datum'])
    expect(local).toEqual([['categorie', 'titel', 'ernst', 'datum']])
    expect(rowOf(element, 'categorie').style.getPropertyValue('translate')).toBe('')
    expect(rowOf(element, 'titel').style.transform).toBe('')
    expect(lines(element)).toBe(0)
  })

  it.each(['Escape', 'pointercancel'])(
    'puts every row back and tells nothing when a drag ends in %s',
    async (end) => {
      const element = await mount({ name: 'kolommen' })
      const local = collect(element, 'lintje-change')
      lay(element)
      await drag(element, 'datum', 'pointerdown', 180)
      await drag(element, 'datum', 'pointermove', 10)
      expect(rowOf(element, 'titel').style.getPropertyValue('translate')).toBe('0 52px')
      if (end === 'Escape') await press(element, 'datum', 'Escape')
      else await drag(element, 'datum', 'pointercancel', 10)
      await drag(element, 'datum', 'pointerup', 10)
      expect(labels(element)).toEqual(['Titel', 'Categorie', 'Ernst', 'Datum'])
      for (const id of ['titel', 'categorie', 'ernst']) {
        expect(rowOf(element, id).style.getPropertyValue('translate')).toBe('')
      }
      expect(rowOf(element, 'datum').style.transform).toBe('')
      expect(local).toEqual([])
    },
  )

  it('moves the row on the release, tells it once, and keeps it lifted until it has landed', async () => {
    const element = await mount({ name: 'kolommen' })
    const values = collect(element, 'lintje-values-change')
    await tapGrip(element, 'datum')
    await tapGrip(element, 'categorie')
    expect(labels(element)).toEqual(['Titel', 'Datum', 'Categorie', 'Ernst'])
    expect(values).toEqual([{ kolommen: ['titel', 'datum', 'categorie', 'ernst'] }])
    expect(lines(element)).toBe(0)
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
