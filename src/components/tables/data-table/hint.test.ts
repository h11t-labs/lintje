/**
 * A column's hint: the "i" beside its head, the head's description, the phone's head and the
 * column chooser.
 */
import { afterEach, describe, expect, it } from 'vitest'
import './data-table'
import type { DataTableData, SortState } from '../../../types'

type TableElement = HTMLElement & { data: DataTableData; updateComplete: Promise<unknown> }
type Tip = HTMLElement & { open: boolean; placement: string; updateComplete: Promise<unknown> }

const data: DataTableData = {
  caption: 'Loketten met soort, wachttijd en bezetting',
  columns: [
    { key: 'name', header: 'Loket' },
    { key: 'kind', header: 'Soort', hint: 'Balie of servicepunt.' },
    { key: 'wait', header: 'Wacht', mobileMeasure: true, hint: 'In minuten.' },
    { key: 'staffing', header: 'Bez.', sortable: false, hint: 'Het deel dat bezet is.' },
    { key: 'requests', header: 'Aanvragen' },
  ],
  rows: [
    { name: 'Utrecht', kind: 'Balie', wait: 12, staffing: 90, requests: 4 },
    { name: 'Rotterdam', kind: 'Servicepunt', wait: 30, staffing: 80, requests: 7 },
  ],
  rowKey: 'name',
  columnChooser: true,
}

async function mount(extra: Partial<DataTableData> = {}): Promise<TableElement> {
  const element = document.createElement('lintje-data-table') as TableElement
  element.data = { ...structuredClone(data), ...extra }
  document.body.append(element)
  await element.updateComplete
  return element
}

afterEach(() => document.body.replaceChildren())

const heads = (element: TableElement, table: 'full' | 'mobile'): HTMLTableCellElement[] => [
  ...element.shadowRoot!.querySelectorAll<HTMLTableCellElement>(
    `.lintje-data-table__${table} thead th`,
  ),
]

const head = (element: TableElement, header: string): HTMLTableCellElement =>
  heads(element, 'full').find((th) => th.textContent?.includes(header))!

/** The text an `aria-describedby` points at, within the table's root. */
function description(element: TableElement, node: Element): string | null {
  const id = node.getAttribute('aria-describedby')
  if (!id) return null
  return element.shadowRoot!.getElementById(id)?.textContent?.trim() ?? null
}

describe('a column with a hint', () => {
  it('stands its "i" beside the sort button, never in it', async () => {
    const element = await mount()
    const th = head(element, 'Soort')
    const button = th.querySelector('.lintje-data-table__sort-button')!
    const tip = th.querySelector<Tip>('lintje-toggletip')!
    expect(tip).not.toBeNull()
    expect(button.contains(tip)).toBe(false)
    expect(button.compareDocumentPosition(tip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(tip.getAttribute('label')).toBe('Toelichting bij Soort')
    expect(tip.textContent?.trim()).toBe('Balie of servicepunt.')
  })

  it('opens its explanation on a click without sorting', async () => {
    const element = await mount()
    const sorts: (SortState | null)[] = []
    element.addEventListener('lintje-sort-change', (event) =>
      sorts.push((event as CustomEvent<SortState | null>).detail),
    )
    const tip = head(element, 'Soort').querySelector<Tip>('lintje-toggletip')!
    await tip.updateComplete
    tip.shadowRoot!.querySelector<HTMLButtonElement>('.lintje-toggletip__trigger')!.click()
    await tip.updateComplete
    expect(tip.open).toBe(true)
    expect(sorts).toEqual([])
    expect(head(element, 'Soort').getAttribute('aria-sort')).toBe('none')
  })

  it('opens towards the left in a right-aligned column', async () => {
    const element = await mount()
    expect(head(element, 'Soort').querySelector<Tip>('lintje-toggletip')!.placement).toBe(
      'bottom-start',
    )
    expect(head(element, 'Wacht').querySelector<Tip>('lintje-toggletip')!.placement).toBe(
      'bottom-end',
    )
  })

  it('describes the sort button, or the head when the column does not sort', async () => {
    const element = await mount()
    const sorting = head(element, 'Wacht')
    expect(description(element, sorting.querySelector('.lintje-data-table__sort-button')!)).toBe(
      'In minuten.',
    )
    expect(sorting.hasAttribute('aria-describedby')).toBe(false)
    const plain = head(element, 'Bez.')
    expect(description(element, plain)).toBe('Het deel dat bezet is.')
    // The description is hidden, so it does not join the head's name that every cell hears.
    const id = plain.getAttribute('aria-describedby')!
    expect(element.shadowRoot!.getElementById(id)!.hidden).toBe(true)
  })

  it('leaves a column without a hint as it was', async () => {
    const element = await mount()
    const th = head(element, 'Aanvragen')
    expect(th.querySelector('lintje-toggletip')).toBeNull()
    expect(th.classList.contains('lintje-data-table__header-cell--hinted')).toBe(false)
    expect(th.querySelector('.lintje-data-table__header-inner')).toBeNull()
    expect(
      th.querySelector('.lintje-data-table__sort-button')!.hasAttribute('aria-describedby'),
    ).toBe(false)
  })

  it('gives every copy of the head its own description id, the modal’s too', async () => {
    const element = await mount({ expandable: true })
    ;(element as unknown as { expand(open: boolean): void }).expand(true)
    await element.updateComplete
    const ids = [...element.shadowRoot!.querySelectorAll('[aria-describedby]')]
      .map((node) => node.getAttribute('aria-describedby')!)
      .filter((id) => id.startsWith('lintje-data-table-hint-'))
    // Tile and modal, each with its desktop and its phone table.
    for (const copy of ['tile-full', 'tile-phone', 'modal-full', 'modal-phone']) {
      expect(ids.some((id) => id.startsWith(`lintje-data-table-hint-${copy}-`))).toBe(true)
    }
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(element.shadowRoot!.getElementById(id)).not.toBeNull()
  })
})

describe('a hint on a phone', () => {
  it('stands at the measure column’s head, not in a row’s detail', async () => {
    const element = await mount()
    const [, measure] = heads(element, 'mobile')
    expect(measure!.querySelector<Tip>('lintje-toggletip')?.placement).toBe('bottom-end')
    expect(description(element, measure!.querySelector('.lintje-data-table__sort-button')!)).toBe(
      'In minuten.',
    )
    expect(
      element.shadowRoot!.querySelectorAll('.lintje-data-table__mobile tbody lintje-toggletip'),
    ).toHaveLength(0)
  })
})

describe('a hint in the column chooser', () => {
  it('stands under the column’s name', async () => {
    const element = await mount()
    element.shadowRoot!.querySelector<HTMLElement>('.lintje-data-table__chooser-button')!.click()
    await element.updateComplete
    const list = element.shadowRoot!.querySelector('lintje-sortable-list') as HTMLElement & {
      items: { id: string; hint?: string }[]
      updateComplete: Promise<unknown>
    }
    expect(list.items.map((item) => [item.id, item.hint])).toEqual([
      ['kind', 'Balie of servicepunt.'],
      ['wait', 'In minuten.'],
      ['staffing', 'Het deel dat bezet is.'],
      ['requests', undefined],
    ])
    await list.updateComplete
    const boxes = [...list.shadowRoot!.querySelectorAll<HTMLElement>('lintje-checkbox')]
    expect(boxes[0]!.getAttribute('hint')).toBe('Balie of servicepunt.')
    expect(boxes[3]!.hasAttribute('hint')).toBe(false)
  })
})
