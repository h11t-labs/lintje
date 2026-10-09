/**
 * The table's sort hit area.
 *
 * happy-dom has no layout, so a click on a coordinate cannot be replayed here.
 * What makes the cell's padding part of the hit area is structural and is
 * checked as such: the sortable `th` gives its padding away (the `--sortable`
 * modifier) and its whole content is the button, so there is no spot inside the
 * cell that is not inside the button. The rendered geometry is checked where it
 * runs, in headless Chrome.
 */
import { describe, expect, it } from 'vitest'
import './data-table'
import type { LintjePagination } from '../pagination/pagination'
import type { DataTableData, SortState } from '../../../types'

type TableElement = HTMLElement & { data: DataTableData; updateComplete: Promise<unknown> }

const data: DataTableData = {
  caption: 'Loketten met aanvragen',
  columns: [
    { key: 'name', header: 'Loket' },
    { key: 'requests', header: 'Aanvragen' },
    { key: 'note', header: 'Toelichting', sortable: false },
  ],
  rows: [
    { name: 'Utrecht', requests: 12, note: 'a' },
    { name: 'Rotterdam', requests: 30, note: 'b' },
  ],
  rowKey: 'name',
}

async function mount(): Promise<TableElement> {
  const element = document.createElement('lintje-data-table') as TableElement
  element.data = structuredClone(data)
  document.body.append(element)
  await element.updateComplete
  return element
}

function headerCells(element: TableElement): HTMLTableCellElement[] {
  const table = element.shadowRoot?.querySelector('.lintje-data-table__full')
  return [...(table?.querySelectorAll('thead th') ?? [])] as HTMLTableCellElement[]
}

describe('the sortable header cell', () => {
  it('hands its padding to a button that fills the cell', async () => {
    const element = await mount()
    const [nameCell] = headerCells(element)
    expect(nameCell.classList.contains('lintje-data-table__header-cell--sortable')).toBe(true)
    // Nothing inside the cell sits outside the button: every child is the button,
    // and no text leaks beside it. So the cell's padding belongs to the button.
    expect(nameCell.children.length).toBe(1)
    expect(nameCell.children[0]?.classList.contains('lintje-data-table__sort-button')).toBe(true)
    expect(nameCell.textContent?.trim()).toBe(nameCell.children[0]?.textContent?.trim())
  })

  it('leaves a column that cannot be sorted without a button', async () => {
    const element = await mount()
    const noteCell = headerCells(element)[2] as HTMLTableCellElement
    expect(noteCell.classList.contains('lintje-data-table__header-cell--sortable')).toBe(false)
    expect(noteCell.querySelector('.lintje-data-table__sort-button')).toBeNull()
  })

  it('sorts and reports the sort when the cell is clicked', async () => {
    const element = await mount()
    const events: (SortState | null)[] = []
    element.addEventListener('lintje-sort-change', (event) => {
      events.push((event as CustomEvent<SortState | null>).detail)
    })

    const requestsCell = headerCells(element)[1] as HTMLTableCellElement
    const button = requestsCell.querySelector('button') as HTMLButtonElement
    button.click()
    await element.updateComplete

    // A numeric column starts descending; the cell says so to a screen reader too.
    expect(events).toEqual([{ key: 'requests', direction: 'desc' }])
    expect(headerCells(element)[1]?.getAttribute('aria-sort')).toBe('descending')
    expect(headerCells(element)[1]?.classList.contains('is-active')).toBe(true)
    expect(headerCells(element)[0]?.getAttribute('aria-sort')).toBe('none')

    button.click()
    await element.updateComplete
    expect(events[1]).toEqual({ key: 'requests', direction: 'asc' })
    expect(headerCells(element)[1]?.getAttribute('aria-sort')).toBe('ascending')
  })
})

describe('the pager', () => {
  async function paged(): Promise<TableElement> {
    const element = document.createElement('lintje-data-table') as TableElement
    element.data = {
      ...structuredClone(data),
      pageSize: 1,
      rows: Array.from({ length: 20 }, (_, index) => ({
        name: `Loket ${String(index + 1).padStart(2, '0')}`,
        requests: index,
      })),
    }
    document.body.append(element)
    await element.updateComplete
    return element
  }

  const pager = (element: TableElement, variant: 'full' | 'mobile'): LintjePagination =>
    element.shadowRoot!.querySelector(
      `lintje-pagination.lintje-data-table__pagination--${variant}`,
    ) as LintjePagination

  const names = (element: TableElement): string[] =>
    [...element.shadowRoot!.querySelectorAll('.lintje-data-table__full tbody th')].map(
      (cell) => cell.textContent?.trim() ?? '',
    )

  it('is lintje-pagination, as buttons, for each representation with its own page size', async () => {
    const element = await paged()
    const full = pager(element, 'full')
    const mobile = pager(element, 'mobile')
    await full.updateComplete
    expect(full.page).toBe(1)
    expect(full.pageCount).toBe(20)
    expect(full.pageSize).toBe(1)
    expect(full.total).toBe(20)
    expect(full.hasAttribute('href-template')).toBe(false)
    expect(full.shadowRoot!.querySelector('a')).toBeNull()
    expect(mobile.pageCount).toBe(4)
    expect(mobile.pageSize).toBe(5)
  })

  it('shows the chosen page and keeps the pager’s event to itself', async () => {
    const element = await paged()
    const outside: unknown[] = []
    element.addEventListener('lintje-page-change', (event) => outside.push(event))
    const full = pager(element, 'full')
    await full.updateComplete
    full.shadowRoot!.querySelector<HTMLButtonElement>('[aria-label="Ga naar pagina 20"]')!.click()
    await element.updateComplete
    await full.updateComplete
    expect(names(element)).toEqual(['Loket 20'])
    expect(full.page).toBe(20)
    expect(full.shadowRoot!.querySelector('.lintje-pagination__count')?.textContent).toBe(
      '20 van 20 rijen',
    )
    expect(outside).toEqual([])
  })

  it('goes back to the first page when the sort changes', async () => {
    const element = await paged()
    const full = pager(element, 'full')
    await full.updateComplete
    full.shadowRoot!.querySelector<HTMLButtonElement>('[aria-label="Ga naar pagina 3"]')!.click()
    await element.updateComplete
    headerCells(element)[1]!.querySelector('button')!.click()
    await element.updateComplete
    expect(pager(element, 'full').page).toBe(1)
  })

  it('moves back to the last page that still exists when the rows become fewer', async () => {
    const element = await paged()
    const state = element as unknown as { page: number; mobilePage: number }
    state.page = 19
    state.mobilePage = 3
    await element.updateComplete
    expect(names(element)).toEqual(['Loket 20'])
    element.data = { ...element.data, rows: element.data.rows.slice(0, 6) }
    await element.updateComplete
    expect(state.page).toBe(5)
    expect(state.mobilePage).toBe(1)
    expect(names(element)).toEqual(['Loket 06'])
    element.data = { ...element.data, rows: [] }
    await element.updateComplete
    expect(state.page).toBe(0)
    expect(state.mobilePage).toBe(0)
  })
})

// Read from disk, not imported: vitest does not run the CSS pipeline, so an `?inline`
// import comes back empty.
describe('a row is one line', () => {
  it('keeps every body cell on one line, so a value does not break at its hyphen', async () => {
    const { readFileSync } = await import('node:fs')
    const css = readFileSync('src/components/tables/data-table/data-table.css', 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    )
    expect(css).toMatch(/\.lintje-data-table__cell\s*\{[^}]*white-space: nowrap;/)
  })
})

describe('plain, on an application page', () => {
  it('draws the table without a tile, and its states too', async () => {
    const element = document.createElement('lintje-data-table') as TableElement & { plain: boolean }
    element.plain = true
    element.data = { ...structuredClone(data), title: 'Loketten' }
    document.body.append(element)
    await element.updateComplete
    const root = element.shadowRoot as ShadowRoot
    expect(element.hasAttribute('plain')).toBe(true)
    expect(root.querySelector('lintje-tile')).toBeNull()
    expect(root.querySelector('.lintje-data-table__full caption')?.textContent).toBe(data.caption)

    element.data = { ...structuredClone(data), state: 'empty', message: 'Nog geen loketten.' }
    await element.updateComplete
    expect(root.querySelector('.lintje-data-table__full')).toBeNull()
    expect(root.textContent).toContain('Nog geen loketten.')
  })
})

const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()))

/** What the table's own status region says, after its fill frame. */
async function said(element: TableElement): Promise<string> {
  await element.updateComplete
  await frame()
  await element.updateComplete
  const regions = [...element.shadowRoot!.querySelectorAll('.lintje-data-table > [role="status"]')]
  return regions.map((region) => region.textContent?.trim()).join('')
}

describe('the status region', () => {
  it('says a sort and a page, and names the pager after the caption', async () => {
    const element = document.createElement('lintje-data-table') as TableElement
    element.data = {
      ...structuredClone(data),
      pageSize: 1,
      rows: Array.from({ length: 3 }, (_, index) => ({ name: `Loket ${index}`, requests: index })),
    }
    document.body.append(element)
    await element.updateComplete
    headerCells(element)[1]!.querySelector('button')!.click()
    expect(await said(element)).toBe('Gesorteerd op aanvragen, aflopend.')

    const full = element.shadowRoot!.querySelector(
      'lintje-pagination.lintje-data-table__pagination--full',
    ) as LintjePagination
    expect(full.label).toBe('Paginering Loketten met aanvragen')
    await full.updateComplete
    full.shadowRoot!.querySelector<HTMLButtonElement>('[aria-label="Ga naar pagina 2"]')!.click()
    expect(await said(element)).toBe('Pagina 2 van 3')
  })

  it('says how many rows a filter left when the host gives no total', async () => {
    const element = document.createElement('lintje-data-table') as TableElement
    element.data = {
      ...structuredClone(data),
      columns: [
        { key: 'name', header: 'Loket', filter: { kind: 'text' } },
        { key: 'requests', header: 'Aanvragen' },
      ],
      filters: { name: 'Utr' },
    }
    document.body.append(element)
    await element.updateComplete
    element.addEventListener('lintje-filter-change', () => {
      element.data = { ...element.data, filters: {}, rows: structuredClone(data.rows) }
    })
    element.shadowRoot!.querySelector<HTMLButtonElement>('.lintje-data-table__chip-clear')!.click()
    expect(await said(element)).toBe('2 rijen')
  })
})

describe('a threshold cell', () => {
  it('carries a glyph beside the number, and the words for a screen reader', async () => {
    const element = document.createElement('lintje-data-table') as TableElement
    element.data = {
      ...structuredClone(data),
      columns: [
        { key: 'name', header: 'Loket' },
        {
          key: 'requests',
          header: 'Aanvragen',
          threshold: { value: 25, caution: 10, direction: 'above-is-bad' },
        },
      ],
      rows: [
        { name: 'Utrecht', requests: 12 },
        { name: 'Rotterdam', requests: 30 },
        { name: 'Delft', requests: 2 },
      ],
    } as DataTableData
    document.body.append(element)
    await element.updateComplete
    const cells = [
      ...element.shadowRoot!.querySelectorAll('.lintje-data-table__full .lintje-threshold-cell'),
    ]
    const glyphs = cells.map((cell) => cell.querySelector('svg')?.getAttribute('aria-hidden'))
    // Delft, Rotterdam, Utrecht: within, over, near the norm.
    expect(glyphs).toEqual([undefined, 'true', 'true'])
    expect(cells.map((cell) => cell.querySelector('.visually-hidden')?.textContent)).toEqual([
      ' · binnen norm',
      ' · boven norm',
      ' · dicht bij norm',
    ])
  })
})

describe('a clickable row', () => {
  it('leaves Enter on the name button to that button', async () => {
    const element = document.createElement('lintje-data-table') as TableElement
    element.data = { ...structuredClone(data), clickable: true, openable: true }
    document.body.append(element)
    await element.updateComplete
    const clicks: unknown[] = []
    element.addEventListener('lintje-row-click', (event) => clicks.push(event))
    const open = element.shadowRoot!.querySelector<HTMLElement>(
      '.lintje-data-table__full .lintje-data-table__open',
    )!
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    open.dispatchEvent(enter)
    expect(enter.defaultPrevented).toBe(false)
    expect(clicks).toEqual([])
    const row = element.shadowRoot!.querySelector<HTMLElement>('.lintje-data-table__full tbody tr')!
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(clicks).toHaveLength(1)
    const mobileRow = element.shadowRoot!.querySelector('.lintje-data-table__mobile-row')!
    expect(mobileRow.getAttribute('aria-selected')).toBe('false')
  })
})

describe('the phone representation', () => {
  const wide: DataTableData = {
    ...structuredClone(data),
    columns: [
      { key: 'name', header: 'Loket' },
      { key: 'requests', header: 'Aanvragen', mobileMeasure: true },
      { key: 'note', header: 'Toelichting' },
      { key: 'staff', header: 'Medewerkers' },
    ],
    rows: [
      { name: 'Utrecht', requests: 12, note: 'a', staff: null },
      { name: 'Rotterdam', requests: 30, note: 'b', staff: 4 },
    ],
    rowActions: [{ value: 'openen', label: 'Openen' }],
  }

  async function phone(extra: Partial<DataTableData> = {}): Promise<TableElement> {
    const element = document.createElement('lintje-data-table') as TableElement
    element.data = { ...structuredClone(wide), ...extra }
    document.body.append(element)
    await element.updateComplete
    return element
  }

  const mobile = (element: TableElement): HTMLTableElement =>
    element.shadowRoot!.querySelector('.lintje-data-table__mobile') as HTMLTableElement

  it('keeps the row menu and opens the other columns under the row', async () => {
    const element = await phone()
    const table = mobile(element)
    const menus = table.querySelectorAll('tbody lintje-menu-button')
    expect(menus.length).toBe(2)
    // Sorted on the name: Rotterdam, then Utrecht.
    expect(menus[1]!.getAttribute('label')).toBe('Acties voor Utrecht')

    const toggle = table.querySelectorAll<HTMLButtonElement>(
      '.lintje-data-table__mobile-toggle',
    )[1]!
    expect(toggle.getAttribute('aria-label')).toBe('Alle gegevens van Utrecht')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    const detail = table.querySelector(`#${toggle.getAttribute('aria-controls')}`) as HTMLElement
    expect(detail.hidden).toBe(true)

    toggle.click()
    await element.updateComplete
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(detail.hidden).toBe(false)
    const list = detail.querySelector('lintje-description-list') as HTMLElement & {
      items: { label: string; value: unknown }[]
    }
    // A missing value stays missing, never 0 (rule 15).
    expect(list.items).toEqual([
      { label: 'Toelichting', value: 'a' },
      { label: 'Medewerkers', value: null },
    ])
  })

  it('sorts on every column from the Sorteren menu, and says which', async () => {
    const element = await phone()
    const menu = element.shadowRoot!.querySelector(
      '.lintje-data-table__sort-menu',
    ) as HTMLElement & {
      items: { value?: string; checked?: boolean }[]
    }
    expect(menu.items.filter((item) => item.value?.startsWith('column:')).length).toBe(4)
    const sorts: unknown[] = []
    element.addEventListener('lintje-sort-change', (event) =>
      sorts.push((event as CustomEvent).detail),
    )
    menu.dispatchEvent(new CustomEvent('lintje-action', { detail: 'column:staff' }))
    await element.updateComplete
    menu.dispatchEvent(new CustomEvent('lintje-action', { detail: 'direction:asc' }))
    await element.updateComplete
    expect(sorts).toEqual([
      { key: 'staff', direction: 'desc' },
      { key: 'staff', direction: 'asc' },
    ])
    expect(await said(element)).toBe('Gesorteerd op medewerkers, oplopend.')
  })

  it('marks the measure header sorted only when the sort is on it', async () => {
    const element = await phone()
    const header = (): HTMLElement => mobile(element).querySelectorAll('thead th')[1] as HTMLElement
    expect(header().getAttribute('aria-sort')).toBe('none')
    expect(header().querySelector('.lintje-data-table__sort-icon')?.textContent).toBe('▲▼')
    header().querySelector('button')!.click()
    await element.updateComplete
    expect(header().getAttribute('aria-sort')).toBe('descending')
    expect(header().querySelector('.lintje-data-table__sort-icon')?.textContent).toBe('▼')
  })
})

describe('the focus when its control leaves', () => {
  const active = (element: TableElement): Element | null => element.shadowRoot!.activeElement

  it('goes from the last chip’s cross to its column’s funnel', async () => {
    const element = document.createElement('lintje-data-table') as TableElement
    element.data = {
      ...structuredClone(data),
      columns: [
        { key: 'name', header: 'Loket', filter: { kind: 'text' } },
        { key: 'requests', header: 'Aanvragen' },
      ],
      filters: { name: 'Utr' },
    }
    document.body.append(element)
    await element.updateComplete
    const cross = element.shadowRoot!.querySelector<HTMLButtonElement>(
      '.lintje-data-table__chip-clear',
    )!
    cross.focus()
    cross.click()
    await element.updateComplete
    await element.updateComplete
    expect(active(element)?.classList.contains('lintje-data-table__funnel')).toBe(true)
  })

  it('says when "Selectie opheffen" empties the selection', async () => {
    const element = document.createElement('lintje-data-table') as TableElement
    element.data = {
      ...structuredClone(data),
      selectable: true,
      checkedIds: ['Utrecht'],
      bulkActions: [{ value: 'toewijzen', label: 'Toewijzen' }],
    }
    document.body.append(element)
    await element.updateComplete
    // happy-dom cannot hold focus inside a nested shadow root; the browser test checks where it goes.
    element.shadowRoot!.querySelector<HTMLElement>('.lintje-data-table__selection-clear')!.click()
    expect(await said(element)).toBe('Selectie opgeheven')
    expect(element.shadowRoot!.querySelector('.lintje-data-table__selection')).toBeNull()
  })
})

describe('a date column', () => {
  it('sorts by the date, not by the text of the day', async () => {
    const element = document.createElement('lintje-data-table') as TableElement
    element.data = {
      caption: 'Afspraken',
      columns: [
        { key: 'name', header: 'Afspraak' },
        { key: 'on', header: 'Datum', editor: { kind: 'date' } },
      ],
      rows: [
        { name: 'Maart', on: '02-03-2026' },
        { name: 'Januari', on: '15-01-2026' },
        { name: 'Leeg', on: null },
        { name: 'December', on: '31-12-2025' },
      ],
      rowKey: 'name',
      defaultSort: { key: 'on', direction: 'asc' },
    }
    document.body.append(element)
    await element.updateComplete
    const table = element.shadowRoot?.querySelector('.lintje-data-table__full')
    const names = [...(table?.querySelectorAll('tbody tr') ?? [])].map((row) =>
      row.firstElementChild?.textContent?.trim(),
    )
    expect(names).toEqual(['Leeg', 'December', 'Januari', 'Maart'])
  })
})

describe('the expanded table', () => {
  it('keeps every id once in the shadow root, the edit hint among them', async () => {
    const element = document.createElement('lintje-data-table') as TableElement & {
      expanded: boolean
    }
    element.data = {
      ...structuredClone(data),
      expandable: true,
      columns: [
        { key: 'name', header: 'Loket' },
        { key: 'requests', header: 'Aanvragen', editor: { kind: 'number' } },
      ],
    }
    document.body.append(element)
    await element.updateComplete
    element.expanded = true
    await element.updateComplete
    const root = element.shadowRoot as ShadowRoot
    expect(root.querySelectorAll('.lintje-data-table__full')).toHaveLength(2)
    const ids = [...root.querySelectorAll('[id]')].map((node) => node.id)
    expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([])
    const hint = root.querySelector('td[aria-describedby]')?.getAttribute('aria-describedby')
    expect(hint && root.getElementById(hint)).toBeTruthy()
  })
})

describe('a truncated column', () => {
  const note = 'Controle aan de F-pier vertraagd door een storing in de poortjes'

  async function mountTruncated(extra: Partial<DataTableData> = {}): Promise<TableElement> {
    const element = document.createElement('lintje-data-table') as TableElement
    element.data = {
      caption: 'Loketten met een lange toelichting',
      columns: [
        { key: 'name', header: 'Loket' },
        { key: 'note', header: 'Toelichting', truncate: true },
      ],
      rows: [
        { name: 'Utrecht', note },
        { name: 'Zwolle', note: null },
      ],
      rowKey: 'name',
      ...extra,
    }
    document.body.append(element)
    await element.updateComplete
    return element
  }

  const noteCell = (element: TableElement, name: string): HTMLElement => {
    const rows = element.shadowRoot!.querySelectorAll('.lintje-data-table__full tbody tr')
    const row = [...rows].find(
      (candidate) => candidate.querySelector('th')?.textContent?.trim() === name,
    )
    return row!.querySelector('td') as HTMLElement
  }

  it('hides the drawn copy, with the whole value in its title and for a reader', async () => {
    const cell = noteCell(await mountTruncated(), 'Utrecht')
    expect(cell.classList.contains('lintje-data-table__cell--truncate')).toBe(true)
    const drawn = cell.querySelector('.lintje-data-table__cell-text')!
    expect(drawn.getAttribute('aria-hidden')).toBe('true')
    expect(drawn.getAttribute('title')).toBe(note)
    expect(drawn.textContent?.trim()).toBe(note)
    expect(cell.querySelector(':scope > .visually-hidden')?.textContent).toBe(note)
  })

  it('draws a missing value as the dash, said once', async () => {
    const cell = noteCell(await mountTruncated(), 'Zwolle')
    expect(cell.querySelector('.lintje-data-table__cell-text')).toBeNull()
    expect(cell.querySelectorAll('.visually-hidden')).toHaveLength(1)
    expect(cell.querySelector('.visually-hidden')?.textContent).toBe('geen gegevens')
  })

  it('leaves the phone representation whole', async () => {
    const element = await mountTruncated()
    const mobile = element.shadowRoot!.querySelector('.lintje-data-table__mobile')!
    expect(mobile.querySelector('.lintje-data-table__cell-text')).toBeNull()
    expect(mobile.querySelector('.lintje-data-table__mobile-measure')?.textContent?.trim()).toBe(
      note,
    )
  })

  it('truncates a name that opens its row inside the button', async () => {
    const element = await mountTruncated({
      columns: [{ key: 'name', header: 'Loket', truncate: true }],
      openable: true,
    })
    const name = element.shadowRoot!.querySelector('.lintje-data-table__full tbody th')!
    expect(name.classList.contains('lintje-data-table__cell--truncate')).toBe(true)
    const button = name.querySelector('.lintje-data-table__open')!
    expect(button.querySelector('.visually-hidden')?.textContent).toBe('Utrecht')
  })
})

describe('a compact change column', () => {
  async function cellsByName(): Promise<{
    element: TableElement
    cells: Map<string, HTMLElement>
  }> {
    const element = document.createElement('lintje-data-table') as TableElement
    element.data = {
      caption: 'Loketten met hun trend',
      columns: [
        { key: 'name', header: 'Loket' },
        { key: 'change', header: 'T.o.v. vorige week', format: 'change-compact', decimals: 1 },
      ],
      rows: [
        { name: 'Utrecht', change: 4.2 },
        { name: 'Rotterdam', change: -1.4 },
        { name: 'Zwolle', change: 0 },
      ],
      rowKey: 'name',
    }
    document.body.append(element)
    await element.updateComplete
    const cells = new Map<string, HTMLElement>()
    for (const row of element.shadowRoot!.querySelectorAll('.lintje-data-table__full tbody tr')) {
      const name = row.querySelector('th')?.textContent?.trim()
      const cell = row.querySelector('td')
      if (name && cell) cells.set(name, cell)
    }
    return { element, cells }
  }

  it('shows the glyph alone, in the tone of `change`', async () => {
    const { cells } = await cellsByName()
    const glyph = (name: string) => cells.get(name)!.querySelector('.lintje-data-table__change')!
    expect(glyph('Utrecht').textContent).toBe('▲')
    expect(glyph('Utrecht').classList.contains('lintje-data-table__change--up')).toBe(true)
    expect(glyph('Rotterdam').textContent).toBe('▼')
    expect(glyph('Rotterdam').classList.contains('lintje-data-table__change--down')).toBe(true)
    expect(glyph('Zwolle').textContent).toBe('●')
    expect(glyph('Zwolle').classList.contains('lintje-data-table__change--flat')).toBe(true)
  })

  it('keeps the whole change for a reader', async () => {
    const { cells } = await cellsByName()
    for (const cell of cells.values()) {
      expect(cell.querySelector('.lintje-data-table__change')?.getAttribute('aria-hidden')).toBe(
        'true',
      )
    }
    expect(cells.get('Utrecht')?.querySelector('.visually-hidden')?.textContent).toBe('▲ +4,2%')
    expect(cells.get('Rotterdam')?.querySelector('.visually-hidden')?.textContent).toBe('▼ -1,4%')
    expect(cells.get('Zwolle')?.querySelector('.visually-hidden')?.textContent).toBe('● 0,0%')
  })

  it('aligns right like a number', async () => {
    const { cells } = await cellsByName()
    expect(cells.get('Utrecht')?.classList.contains('lintje-data-table__cell--align-right')).toBe(
      true,
    )
  })

  it('shows the change whole as the phone row’s measure', async () => {
    const { element } = await cellsByName()
    const measures = [
      ...element.shadowRoot!.querySelectorAll(
        '.lintje-data-table__mobile .lintje-data-table__mobile-measure',
      ),
    ].map((measure) => measure.textContent?.trim())
    expect(measures).toContain('▲ +4,2%')
  })
})
