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

async function press(element: LintjeSortableList, id: string, key: string): Promise<void> {
  grip(element, id).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
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

  it('lands below every row whose middle is above the pointer', () => {
    const middles = [22, 70, 118]
    expect(dropIndex(middles, 0)).toBe(0)
    expect(dropIndex(middles, 50)).toBe(1)
    expect(dropIndex(middles, 500)).toBe(3)
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
    expect(status(element)).toBe('Ernst opgepakt. Plaats 3 van 4.')
    expect(grip(element, 'ernst').getAttribute('aria-pressed')).toBe('true')

    await press(element, 'ernst', 'ArrowUp')
    expect(status(element)).toBe('Plaats 2 van 4.')
    expect(labels(element)).toEqual(['Titel', 'Ernst', 'Categorie', 'Datum'])
    // Nothing is told while the row is still in the hand.
    expect(local).toEqual([])

    await press(element, 'ernst', 'Enter')
    expect(status(element)).toBe('Ernst neergelegd op plaats 2.')
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
    expect(status(element)).toBe('Categorie teruggezet op plaats 2.')
    expect(values).toEqual([])
  })

  it('does not move a row that was not picked up', async () => {
    const element = await mount()
    await press(element, 'ernst', 'ArrowUp')
    expect(labels(element)).toEqual(['Titel', 'Categorie', 'Ernst', 'Datum'])
  })

  it('picks up on a tap and puts down on a tap on another grip, without a drag', async () => {
    const element = await mount({ name: 'kolommen' })
    const values = collect(element, 'lintje-values-change')
    const tap = async (id: string): Promise<void> => {
      for (const type of ['pointerdown', 'pointerup']) {
        grip(element, id).dispatchEvent(
          new PointerEvent(type, { bubbles: true, button: 0, pointerId: 1, clientY: 10 }),
        )
        await element.updateComplete
      }
    }

    await tap('datum')
    expect(status(element)).toBe('Datum opgepakt. Plaats 4 van 4.')
    expect(grip(element, 'datum').getAttribute('aria-pressed')).toBe('true')
    expect(values).toEqual([])

    await tap('categorie')
    expect(labels(element)).toEqual(['Titel', 'Datum', 'Categorie', 'Ernst'])
    expect(status(element)).toBe('Datum neergelegd op plaats 2.')
    expect(grip(element, 'datum').getAttribute('aria-pressed')).toBe('false')
    expect(values).toEqual([{ kolommen: ['titel', 'datum', 'categorie', 'ernst'] }])

    // A tap on the grip in the hand puts the row down where it is.
    await tap('ernst')
    await tap('ernst')
    expect(status(element)).toBe('Ernst neergelegd op plaats 4.')
    expect(values).toHaveLength(1)
  })

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
