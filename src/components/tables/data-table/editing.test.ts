/**
 * Editing a cell: the next-cell arithmetic, and the round trip with the host — open, save,
 * busy, refused, cancelled.
 */
import { describe, expect, it } from 'vitest'
import './data-table'
import { nextEditableCell } from './editing'
import type { DataTableData, TableCellRef } from '../../../types'

type TableElement = HTMLElement & { data: DataTableData; updateComplete: Promise<unknown> }

describe('nextEditableCell', () => {
  const all = () => true

  it('goes down in the same column and stops at the last row', () => {
    expect(nextEditableCell({ row: 0, column: 1 }, 'down', 3, 4, all)).toEqual({
      row: 1,
      column: 1,
    })
    expect(nextEditableCell({ row: 2, column: 1 }, 'down', 3, 4, all)).toBeNull()
  })

  it('tabs to the next editable cell, across the end of a row', () => {
    const editable = (_row: number, column: number) => column === 1 || column === 3
    expect(nextEditableCell({ row: 0, column: 1 }, 'next', 3, 4, editable)).toEqual({
      row: 0,
      column: 3,
    })
    expect(nextEditableCell({ row: 0, column: 3 }, 'next', 3, 4, editable)).toEqual({
      row: 1,
      column: 1,
    })
    expect(nextEditableCell({ row: 2, column: 3 }, 'next', 3, 4, editable)).toBeNull()
  })

  it('tabs back with Shift+Tab, and skips what cannot be edited', () => {
    const editable = (row: number, column: number) => column === 1 && row !== 1
    expect(nextEditableCell({ row: 2, column: 1 }, 'previous', 3, 4, editable)).toEqual({
      row: 0,
      column: 1,
    })
    expect(nextEditableCell({ row: 0, column: 1 }, 'previous', 3, 4, editable)).toBeNull()
    expect(nextEditableCell({ row: 0, column: 1 }, 'down', 3, 4, editable)).toEqual({
      row: 2,
      column: 1,
    })
  })
})

const data: DataTableData = {
  caption: 'Meldingen, bewerkbaar',
  rowKey: 'id',
  columns: [
    { key: 'title', header: 'Titel', editor: { kind: 'text' } },
    {
      key: 'category',
      header: 'Categorie',
      editor: { kind: 'select', options: [{ value: 'Veiligheid' }, { value: 'Overig' }] },
    },
    { key: 'date', header: 'Datum' },
  ],
  rows: [
    { id: 'm1', title: 'Onbeheerde tas', category: 'Veiligheid', date: '03-10-2026' },
    { id: 'm2', title: 'Verloren toegangspas', category: 'Overig', date: '03-10-2026' },
  ],
}

async function mount(extra: Partial<DataTableData> = {}): Promise<TableElement> {
  const element = document.createElement('lintje-data-table') as TableElement
  element.data = { ...structuredClone(data), ...extra }
  document.body.append(element)
  await element.updateComplete
  return element
}

function full(element: TableElement): HTMLTableElement {
  return element.shadowRoot?.querySelector('.lintje-data-table__full') as HTMLTableElement
}

function cell(element: TableElement, id: string, column: string): HTMLElement {
  return [...full(element).querySelectorAll<HTMLElement>('[data-cell]')].find(
    (candidate) => candidate.dataset.cell === `${id}\u001f${column}`,
  ) as HTMLElement
}

function key(target: Element, name: string, shiftKey = false): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: name, shiftKey, bubbles: true, composed: true }),
  )
}

describe('an editable cell', () => {
  it('is a tab stop described as editable, and opens on Enter with a named field', async () => {
    const element = await mount()
    const title = cell(element, 'm2', 'title')
    expect(title.tagName).toBe('TH')
    expect(title.getAttribute('tabindex')).toBe('0')
    const hint = element.shadowRoot?.getElementById(title.getAttribute('aria-describedby') ?? '')
    expect(hint?.textContent).toContain('Enter of F2')

    key(title, 'Enter')
    await element.updateComplete
    const input = cell(element, 'm2', 'title').querySelector('input') as HTMLInputElement
    expect(input.getAttribute('aria-label')).toBe('Titel van rij 2')
    expect(input.value).toBe('Verloren toegangspas')
  })

  it('saves with Enter, shows the value as busy and opens the cell below', async () => {
    const element = await mount()
    const edits: (TableCellRef & { value: string })[] = []
    element.addEventListener('lintje-cell-edit', (event) =>
      edits.push((event as CustomEvent).detail),
    )
    key(cell(element, 'm1', 'title'), 'F2')
    await element.updateComplete
    const input = cell(element, 'm1', 'title').querySelector('input') as HTMLInputElement
    input.value = 'Onbeheerde rugzak'
    key(input, 'Enter')
    await element.updateComplete

    expect(edits).toEqual([{ id: 'm1', column: 'title', value: 'Onbeheerde rugzak' }])
    const busy = cell(element, 'm1', 'title')
    expect(busy.classList.contains('is-busy')).toBe(true)
    expect(busy.querySelector('lintje-spinner')).not.toBeNull()
    expect(busy.textContent).toContain('Onbeheerde rugzak')
    expect(cell(element, 'm2', 'title').querySelector('input')).not.toBeNull()
    const said = [...(element.shadowRoot?.querySelectorAll('[role="status"]') ?? [])].map(
      (region) => region.textContent,
    )
    expect(said).toContain('Wordt opgeslagen')
  })

  it('moves to the next editable cell with Tab, a select for a select column', async () => {
    const element = await mount()
    key(cell(element, 'm1', 'title'), 'Enter')
    await element.updateComplete
    key(cell(element, 'm1', 'title').querySelector('input') as HTMLInputElement, 'Tab')
    await element.updateComplete
    const select = cell(element, 'm1', 'category').querySelector('select') as HTMLSelectElement
    expect(select).not.toBeNull()
    expect(select.getAttribute('aria-label')).toBe('Categorie van rij 1')
  })

  it('cancels with Escape without telling the host', async () => {
    const element = await mount()
    let told = false
    element.addEventListener('lintje-cell-edit', () => (told = true))
    key(cell(element, 'm1', 'title'), 'Enter')
    await element.updateComplete
    const input = cell(element, 'm1', 'title').querySelector('input') as HTMLInputElement
    input.value = 'Iets anders'
    key(input, 'Escape')
    await element.updateComplete
    expect(told).toBe(false)
    expect(cell(element, 'm1', 'title').querySelector('input')).toBeNull()
  })

  it('stays busy while the host lists it, and opens with the error when refused', async () => {
    const element = await mount()
    key(cell(element, 'm1', 'title'), 'Enter')
    await element.updateComplete
    const input = cell(element, 'm1', 'title').querySelector('input') as HTMLInputElement
    input.value = '???'
    key(input, 'Escape') // nothing sent
    await element.updateComplete
    key(cell(element, 'm1', 'title'), 'Enter')
    await element.updateComplete
    const again = cell(element, 'm1', 'title').querySelector('input') as HTMLInputElement
    again.value = '???'
    key(again, 'Enter')
    await element.updateComplete

    element.data = { ...element.data, busyCells: [{ id: 'm1', column: 'title' }] }
    await element.updateComplete
    expect(cell(element, 'm1', 'title').classList.contains('is-busy')).toBe(true)

    element.data = {
      ...element.data,
      busyCells: [],
      cellErrors: [{ id: 'm1', column: 'title', message: 'Titel is te kort' }],
    }
    await element.updateComplete
    const refused = cell(element, 'm1', 'title')
    const field = refused.querySelector('input') as HTMLInputElement
    expect(field.value).toBe('???')
    expect(field.getAttribute('aria-invalid')).toBe('true')
    const message = element.shadowRoot?.getElementById(field.getAttribute('aria-describedby') ?? '')
    expect(message?.textContent).toBe('Titel is te kort')

    key(field, 'Escape')
    await element.updateComplete
    expect(cell(element, 'm1', 'title').querySelector('input')).toBeNull()
    expect(cell(element, 'm1', 'title').textContent).toContain('Onbeheerde tas')
  })

  it('does not drill down when a cell in a clickable row is clicked or opened', async () => {
    const element = await mount({ clickable: true })
    let clicks = 0
    element.addEventListener('lintje-row-click', () => clicks++)
    const title = cell(element, 'm1', 'title')
    title.click()
    key(title, 'Enter')
    await element.updateComplete
    expect(clicks).toBe(0)
  })
})
