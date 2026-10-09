/**
 * Column filters and the column chooser: the texts, the column order, and the events that
 * leave the table — and the one that must not.
 */
import { describe, expect, it } from 'vitest'
import './data-table'
import { chipText, columnsChange, filterOut, funnelLabel, shownColumns } from './filters'
import type { DataTableData, TableColumnData } from '../../../types'

type TableElement = HTMLElement & { data: DataTableData; updateComplete: Promise<unknown> }

const category: TableColumnData = {
  key: 'category',
  header: 'Categorie',
  filter: {
    kind: 'options',
    options: [
      { value: 'veiligheid', label: 'Veiligheid', count: 9 },
      { value: 'verkeer', label: 'Verkeer', count: 31 },
      { value: 'overlast', label: 'Overlast', count: 5 },
    ],
  },
}

describe('the filter texts', () => {
  it('name the funnel with what is chosen', () => {
    expect(funnelLabel(category, undefined)).toBe('Filter op categorie')
    expect(funnelLabel(category, ['veiligheid', 'overlast'])).toBe('Filter op categorie, 2 gekozen')
  })

  it('write the chip with the options’ labels', () => {
    expect(chipText(category, ['veiligheid', 'overlast'])).toBe('Categorie: Veiligheid, Overlast')
    expect(chipText({ key: 'title', header: 'Titel' }, 'toegangspas')).toBe('Titel: ‘toegangspas’')
  })

  it('tell an empty filter as null', () => {
    expect(filterOut([])).toBeNull()
    expect(filterOut('  ')).toBeNull()
    expect(filterOut(' pas ')).toBe('pas')
  })
})

describe('the column order', () => {
  const columns: TableColumnData[] = ['a', 'b', 'c', 'd'].map((key) => ({ key, header: key }))

  it('keeps the first column first and shown, and orders and hides the rest', () => {
    expect(shownColumns(columns, ['d', 'b', 'c'], ['c']).map((column) => column.key)).toEqual([
      'a',
      'd',
      'b',
    ])
    expect(shownColumns(columns, null, ['a']).map((column) => column.key)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ])
    // A key the order does not name keeps its place at the end.
    expect(shownColumns(columns, ['c'], []).map((column) => column.key)).toEqual([
      'a',
      'c',
      'b',
      'd',
    ])
  })

  it('tells every key in its order and the ones not shown', () => {
    expect(columnsChange('a', ['c', 'b', 'd'], ['c', 'd'])).toEqual({
      order: ['a', 'c', 'b', 'd'],
      hidden: ['b'],
    })
  })
})

const data: DataTableData = {
  caption: 'Meldingen, gefilterd',
  rowKey: 'id',
  columns: [
    { key: 'title', header: 'Titel', filter: { kind: 'text' } },
    category,
    { key: 'date', header: 'Datum' },
  ],
  rows: [
    { id: 'm1', title: 'Onbeheerde tas', category: 'veiligheid', date: '03-10-2026' },
    { id: 'm2', title: 'Geluid bij de taxistandplaats', category: 'overlast', date: '02-10-2026' },
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

function funnels(element: TableElement): HTMLButtonElement[] {
  return [...root(element).querySelectorAll<HTMLButtonElement>('.lintje-data-table__funnel')]
}

describe('a column filter', () => {
  it('puts a funnel in a filterable header only, closed', async () => {
    const element = await mount()
    expect(funnels(element)).toHaveLength(2)
    const button = funnels(element)[1] as HTMLButtonElement
    expect(button.getAttribute('aria-label')).toBe('Filter op categorie')
    expect(button.getAttribute('aria-expanded')).toBe('false')
    const date = root(element).querySelectorAll('.lintje-data-table__full thead th')[2]
    expect(date?.querySelector('.lintje-data-table__funnel')).toBeNull()
  })

  it('marks a filtered column and shows its chip with the count of rows', async () => {
    const element = await mount({
      filters: { category: ['veiligheid', 'overlast'] },
      totalRows: 131,
    })
    const head = root(element).querySelectorAll('.lintje-data-table__full thead th')[1]
    expect(head?.classList.contains('is-filtered')).toBe(true)
    expect(head?.querySelector('.lintje-data-table__filter-dot')?.getAttribute('aria-label')).toBe(
      'Gefilterd',
    )
    expect(funnels(element)[1]?.getAttribute('aria-label')).toBe('Filter op categorie, 2 gekozen')
    const chip = root(element).querySelector('.lintje-data-table__chip')
    expect(chip?.textContent?.trim()).toBe('Categorie: Veiligheid, Overlast')
    expect(root(element).querySelector('.lintje-data-table__filter-total')?.textContent).toBe(
      '2 van 131 rijen',
    )
  })

  it('opens a popover and sends the checked values on "Toepassen"', async () => {
    const element = await mount()
    const changes: unknown[] = []
    element.addEventListener('lintje-filter-change', (event) =>
      changes.push((event as CustomEvent).detail),
    )
    funnels(element)[1]?.click()
    await element.updateComplete
    expect(funnels(element)[1]?.getAttribute('aria-expanded')).toBe('true')
    const popover = root(element).querySelector('lintje-popover') as HTMLElement
    expect(popover.getAttribute('label')).toBe('Filter op categorie')
    const boxes = popover.querySelectorAll<HTMLInputElement>('.lintje-choice__input')
    expect(popover.querySelectorAll('.lintje-data-table__filter-count')[1]?.textContent).toBe('31')
    boxes[1]?.click()
    await element.updateComplete
    const [, apply] = [...popover.querySelectorAll<HTMLElement>('lintje-button')]
    apply?.click()
    await element.updateComplete
    expect(changes).toEqual([{ column: 'category', value: ['verkeer'] }])
    expect(root(element).querySelector('lintje-popover')).toBeNull()
  })

  it('clears from the chip with null', async () => {
    const element = await mount({ filters: { title: 'pas' } })
    const changes: unknown[] = []
    element.addEventListener('lintje-filter-change', (event) =>
      changes.push((event as CustomEvent).detail),
    )
    const clear = root(element).querySelector<HTMLButtonElement>('.lintje-data-table__chip-clear')
    expect(clear?.getAttribute('aria-label')).toBe('Filter op titel wissen')
    clear?.click()
    expect(changes).toEqual([{ column: 'title', value: null }])
  })
})

describe('the column chooser', () => {
  it('lists the columns after the first and keeps the list’s own events in', async () => {
    const element = await mount({ columnChooser: true, hiddenColumns: ['date'] })
    const outside: string[] = []
    element.addEventListener('lintje-checked-change', () => outside.push('checked'))
    const columns: unknown[] = []
    element.addEventListener('lintje-columns-change', (event) =>
      columns.push((event as CustomEvent).detail),
    )
    const heads = root(element).querySelectorAll('.lintje-data-table__full thead th')
    // The two shown columns and the actions column, whose head holds the chooser.
    expect(heads).toHaveLength(3)

    const button = root(element).querySelector<HTMLElement>('.lintje-data-table__chooser-button')
    expect(button?.getAttribute('aria-label')).toBe('Kolommen kiezen')
    button?.click()
    await element.updateComplete
    const list = root(element).querySelector('lintje-sortable-list') as HTMLElement & {
      items: { id: string; checked?: boolean }[]
    }
    expect(list.hasAttribute('checkable')).toBe(true)
    expect(list.items).toEqual([
      { id: 'category', label: 'Categorie', checked: true },
      { id: 'date', label: 'Datum', checked: false },
    ])

    list.dispatchEvent(
      new CustomEvent('lintje-checked-change', {
        detail: ['category', 'date'],
        bubbles: true,
        composed: true,
      }),
    )
    await element.updateComplete
    expect(outside).toEqual([])
    expect(columns).toEqual([{ order: ['title', 'category', 'date'], hidden: [] }])
    expect(root(element).querySelectorAll('.lintje-data-table__full thead th')).toHaveLength(4)
  })
})

describe('a table without the new fields', () => {
  it('draws none of the extensions', async () => {
    const element = document.createElement('lintje-data-table') as TableElement
    element.data = {
      caption: 'Loketten',
      rowKey: 'name',
      selectable: true,
      checkedIds: ['Utrecht'],
      columns: [
        { key: 'name', header: 'Loket' },
        { key: 'requests', header: 'Aanvragen' },
      ],
      rows: [{ name: 'Utrecht', requests: 12 }],
    }
    document.body.append(element)
    await element.updateComplete
    const shadow = root(element)
    for (const selector of [
      '.lintje-data-table__toolbar',
      '.lintje-data-table__selection',
      '.lintje-data-table__funnel',
      '.lintje-data-table__action-cell',
      '[data-cell]',
      '.lintje-data-table__filter-total',
      'lintje-popover',
    ]) {
      expect(shadow.querySelector(selector), selector).toBeNull()
    }
  })
})
