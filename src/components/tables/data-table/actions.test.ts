/**
 * Row actions and the selection bar: the Shift+click range, the menu per row, the bar's
 * buttons and the events that leave the table.
 */
import { describe, expect, it } from 'vitest'
import './data-table'
import { rangeIds, withRange } from './actions'
import type { DataTableData } from '../../../types'

type TableElement = HTMLElement & { data: DataTableData; updateComplete: Promise<unknown> }

describe('rangeIds', () => {
  const order = ['a', 'b', 'c', 'd', 'e']

  it('takes every id between the anchor and the target, both ways', () => {
    expect(rangeIds(order, 'b', 'd')).toEqual(['b', 'c', 'd'])
    expect(rangeIds(order, 'd', 'b')).toEqual(['b', 'c', 'd'])
  })

  it('is only the target without an anchor, and nothing for an unknown target', () => {
    expect(rangeIds(order, null, 'c')).toEqual(['c'])
    expect(rangeIds(order, 'x', 'c')).toEqual(['c'])
    expect(rangeIds(order, 'a', 'x')).toEqual([])
  })

  it('adds a range to what is checked without doubling', () => {
    expect(withRange(['e', 'b'], ['b', 'c', 'd'])).toEqual(['e', 'b', 'c', 'd'])
  })
})

const data: DataTableData = {
  caption: 'Meldingen, met acties',
  rowKey: 'id',
  selectable: true,
  columns: [
    { key: 'title', header: 'Titel' },
    { key: 'status', header: 'Status' },
  ],
  rows: [
    { id: 'm1', title: 'Onbeheerde tas', status: 'In behandeling' },
    { id: 'm2', title: 'Verloren toegangspas', status: 'Concept' },
    { id: 'm3', title: 'Wachtrij bij de bezoekersbalie', status: 'Afgehandeld' },
  ],
  rowActions: [
    { value: 'openen', label: 'Openen' },
    'separator',
    { value: 'verwijderen', label: 'Verwijderen', danger: true },
  ],
  bulkActions: [
    { value: 'toewijzen', label: 'Toewijzen' },
    { value: 'verwijderen', label: 'Verwijderen', danger: true },
  ],
}

async function mount(extra: Partial<DataTableData> = {}): Promise<TableElement> {
  const element = document.createElement('lintje-data-table') as TableElement
  element.data = { ...structuredClone(data), ...extra }
  document.body.append(element)
  await element.updateComplete
  return element
}

function root(element: TableElement): ShadowRoot {
  return element.shadowRoot as ShadowRoot
}

function rowBoxes(element: TableElement): HTMLInputElement[] {
  return [
    ...root(element).querySelectorAll<HTMLInputElement>(
      '.lintje-data-table__full tbody .lintje-choice__input',
    ),
  ]
}

describe('row actions', () => {
  it('puts a menu at the end of every row, named after the row', async () => {
    const element = await mount()
    const menus = [...root(element).querySelectorAll('.lintje-data-table__full lintje-menu-button')]
    expect(menus).toHaveLength(3)
    expect(menus[1]?.getAttribute('label')).toBe('Acties voor Verloren toegangspas')
    expect(menus[1]?.hasAttribute('icon')).toBe(true)
    expect(menus[1]?.getAttribute('variant')).toBe('tertiary')
    const head = root(element).querySelector('.lintje-data-table__full thead th:last-child')
    expect(head?.textContent?.trim()).toBe('Acties')
  })

  it('turns the menu’s choice into lintje-row-action, and nothing else escapes', async () => {
    const element = await mount({ clickable: true, selectable: false })
    const seen: string[] = []
    for (const name of ['lintje-row-action', 'lintje-action', 'lintje-row-click']) {
      element.addEventListener(name, (event) =>
        seen.push(`${name} ${JSON.stringify((event as CustomEvent).detail)}`),
      )
    }
    const menu = root(element).querySelectorAll('.lintje-data-table__full lintje-menu-button')[0]
    menu?.dispatchEvent(
      new CustomEvent('lintje-action', { detail: 'openen', bubbles: true, composed: true }),
    )
    menu?.parentElement?.click()
    expect(seen).toEqual(['lintje-row-action {"id":"m1","action":"openen"}'])
  })
})

describe('a name that opens its row', () => {
  it('is a button in a selectable table and sends lintje-row-open, not lintje-row-click', async () => {
    const element = await mount({ openable: true })
    const seen: string[] = []
    for (const name of ['lintje-row-open', 'lintje-row-click', 'lintje-checked-change']) {
      element.addEventListener(name, (event) =>
        seen.push(`${name} ${JSON.stringify((event as CustomEvent).detail)}`),
      )
    }
    const names = [
      ...root(element).querySelectorAll('.lintje-data-table__full .lintje-data-table__open'),
    ]
    expect(names.map((name) => name.textContent?.trim())).toEqual([
      'Onbeheerde tas',
      'Verloren toegangspas',
      'Wachtrij bij de bezoekersbalie',
    ])
    ;(names[1] as HTMLElement).click()
    expect(seen).toEqual(['lintje-row-open {"id":"m2","label":"Verloren toegangspas"}'])
  })

  it('is not edited in its cell, even with an editor', async () => {
    const element = await mount({
      openable: true,
      columns: [
        { key: 'title', header: 'Titel', editor: { kind: 'text' } },
        { key: 'status', header: 'Status', editor: { kind: 'text' } },
      ],
    })
    const name = root(element).querySelector('.lintje-data-table__full tbody th')
    expect(name?.hasAttribute('data-cell')).toBe(false)
    expect(name?.querySelector('.lintje-data-table__open')).not.toBeNull()
    expect(
      root(element).querySelectorAll('.lintje-data-table__full tbody td[data-cell]'),
    ).toHaveLength(3)
  })

  it('stays plain text without openable', async () => {
    const element = await mount()
    expect(root(element).querySelector('.lintje-data-table__open')).toBeNull()
  })
})

describe('the selection bar', () => {
  it('is absent until a row is checked', async () => {
    const element = await mount()
    expect(root(element).querySelector('.lintje-data-table__selection')).toBeNull()
  })

  it('shows the count, a button per action and sends lintje-bulk-action', async () => {
    const element = await mount({ checkedIds: ['m1', 'm3'] })
    const bar = root(element).querySelector('.lintje-data-table__selection') as HTMLElement
    expect(bar.getAttribute('role')).toBe('toolbar')
    expect(bar.querySelector('.lintje-data-table__selection-count')?.textContent).toBe(
      '2 geselecteerd',
    )
    // The count is read from the table's own region, which stands before the bar does.
    expect(bar.querySelector('[role="status"]')).toBeNull()
    const buttons = [...bar.querySelectorAll('lintje-button')]
    expect(buttons.map((button) => button.textContent?.trim())).toEqual([
      'Toewijzen',
      'Verwijderen',
      'Selectie opheffen',
    ])
    expect(buttons[1]?.getAttribute('variant')).toBe('danger-secondary')
    expect(buttons[1]?.getAttribute('size')).toBe('compact')

    const bulk: unknown[] = []
    element.addEventListener('lintje-bulk-action', (event) =>
      bulk.push((event as CustomEvent).detail),
    )
    ;(buttons[1] as HTMLElement).click()
    expect(bulk).toEqual([{ ids: ['m1', 'm3'], action: 'verwijderen' }])

    const checked: string[][] = []
    element.addEventListener('lintje-checked-change', (event) =>
      checked.push((event as CustomEvent<string[]>).detail),
    )
    ;(buttons[2] as HTMLElement).click()
    await element.updateComplete
    expect(checked).toEqual([[]])
    expect(root(element).querySelector('.lintje-data-table__selection')).toBeNull()
  })

  it('checks a range with Shift+click', async () => {
    const element = await mount()
    const checked: string[][] = []
    element.addEventListener('lintje-checked-change', (event) =>
      checked.push((event as CustomEvent<string[]>).detail),
    )
    rowBoxes(element)[0]?.click()
    await element.updateComplete
    rowBoxes(element)[2]?.dispatchEvent(new MouseEvent('click', { shiftKey: true, bubbles: true }))
    await element.updateComplete
    expect(checked.at(-1)).toEqual(['m1', 'm2', 'm3'])
  })

  it('draws a row that cannot be chosen disabled and leaves it out of "Alles selecteren"', async () => {
    const element = await mount({ uncheckableIds: ['m2'] })
    expect(rowBoxes(element)[1]?.disabled).toBe(true)
    const checked: string[][] = []
    element.addEventListener('lintje-checked-change', (event) =>
      checked.push((event as CustomEvent<string[]>).detail),
    )
    root(element)
      .querySelector<HTMLInputElement>('.lintje-data-table__full thead .lintje-choice__input')
      ?.click()
    expect(checked).toEqual([['m1', 'm3']])
  })
})
