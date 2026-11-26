/** `paging: 'host'`: the host sorts and pages, the table shows its page and waits for the next. */
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../shared/download', () => ({ downloadCsv: vi.fn() }))

import { downloadCsv } from '../../shared/download'
import './data-table'
import type { LintjePagination } from '../pagination/pagination'
import type { DataTableData, SortState } from '../../../types'

type TableElement = HTMLElement & { data: DataTableData; updateComplete: Promise<unknown> }

/** One page of a host's 13 rows; equal requests, so a sort of the table's own would move them. */
const pageOf = (page: number): DataTableData['rows'] =>
  Array.from({ length: page === 3 ? 3 : 5 }, (_, index) => {
    const number = (page - 1) * 5 + index + 1
    return { id: `r${number}`, name: `Loket ${String(number).padStart(2, '0')}`, requests: 7 }
  })

const hostData = (page = 1, extra: Partial<DataTableData> = {}): DataTableData => ({
  caption: 'Loketten met aanvragen',
  columns: [
    { key: 'name', header: 'Loket' },
    { key: 'requests', header: 'Aanvragen' },
  ],
  rows: pageOf(page),
  rowKey: 'id',
  pageSize: 5,
  paging: 'host',
  page,
  rowCount: 13,
  ...extra,
})

async function mount(data: DataTableData = hostData()): Promise<TableElement> {
  const element = document.createElement('lintje-data-table') as TableElement
  element.data = data
  document.body.append(element)
  await element.updateComplete
  return element
}

afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

const root = (element: TableElement): ShadowRoot => element.shadowRoot as ShadowRoot

const names = (element: TableElement): string[] =>
  [
    ...root(element).querySelectorAll(
      '.lintje-data-table__full tbody:not(.lintje-data-table__sizer) th',
    ),
  ].map((cell) => cell.textContent?.trim() ?? '')

const sortButton = (element: TableElement, index: number): HTMLButtonElement =>
  root(element).querySelectorAll<HTMLButtonElement>(
    '.lintje-data-table__full thead .lintje-data-table__sort-button',
  )[index]!

const pager = (element: TableElement, variant: 'full' | 'mobile' = 'full'): LintjePagination =>
  root(element).querySelector(
    `lintje-pagination.lintje-data-table__pagination--${variant}`,
  ) as LintjePagination

const busy = (element: TableElement): (string | null)[] =>
  [...root(element).querySelectorAll('table')].map((table) => table.getAttribute('aria-busy'))

const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()))

async function said(element: TableElement): Promise<string> {
  await element.updateComplete
  await frame()
  await element.updateComplete
  return [...root(element).querySelectorAll('.lintje-data-table > [role="status"]')]
    .map((region) => region.textContent?.trim())
    .join('')
}

async function goTo(element: TableElement, page: number): Promise<void> {
  const full = pager(element)
  await full.updateComplete
  full
    .shadowRoot!.querySelector<HTMLButtonElement>(`[aria-label="Ga naar pagina ${page}"]`)!
    .click()
  await element.updateComplete
}

describe('the host’s order', () => {
  it('stands as given, also for equal values, and a header only asks', async () => {
    const element = await mount()
    const sorts: (SortState | null)[] = []
    element.addEventListener('lintje-sort-change', (event) =>
      sorts.push((event as CustomEvent<SortState | null>).detail),
    )
    const before = names(element)
    expect(before[0]).toBe('Loket 01')
    sortButton(element, 1).click()
    await element.updateComplete
    expect(sorts).toEqual([{ key: 'requests', direction: 'desc' }])
    expect(names(element)).toEqual(before)
    // The arrow shows the choice while the old rows stand.
    const header = root(element).querySelectorAll('.lintje-data-table__full thead th')[1]!
    expect(header.getAttribute('aria-sort')).toBe('descending')
    expect(busy(element)).toEqual(['true', 'true'])
    expect(await said(element)).toBe('')
  })

  it('ends the wait with the host’s rows, its sort and its page, and says the sort once', async () => {
    const element = await mount(hostData(2))
    sortButton(element, 1).click()
    await element.updateComplete
    // The specimen-like echo of a checked change is no answer: the rows are the same.
    element.data = { ...element.data, checkedIds: [] }
    expect(busy(element)).toEqual(['true', 'true'])
    const sort: SortState = { key: 'requests', direction: 'desc' }
    element.data = { ...hostData(1), sort, rows: [...pageOf(1)].reverse() }
    expect(await said(element)).toBe('Gesorteerd op aanvragen, aflopend.')
    expect(busy(element)).toEqual([null, null])
    expect(names(element)[0]).toBe('Loket 05')
    expect(pager(element).page).toBe(1)
    element.data = { ...element.data, rows: pageOf(1) }
    // A later answer that was not asked for says nothing new.
    expect(await said(element)).toBe('Gesorteerd op aanvragen, aflopend.')
  })

  it('takes the host’s sort back when it refuses the choice', async () => {
    const element = await mount()
    sortButton(element, 1).click()
    await element.updateComplete
    element.data = { ...element.data, rows: pageOf(1) }
    await element.updateComplete
    const header = root(element).querySelectorAll('.lintje-data-table__full thead th')[1]!
    expect(header.getAttribute('aria-sort')).toBe('none')
  })
})

describe('the host’s pager', () => {
  it('shows the host’s page of the pages in rowCount, in both representations', async () => {
    const element = await mount(hostData(2))
    const full = pager(element)
    const mobile = pager(element, 'mobile')
    await full.updateComplete
    expect([full.page, full.pageCount, full.pageSize, full.total]).toEqual([2, 3, 5, 13])
    expect([mobile.page, mobile.pageCount, mobile.pageSize]).toEqual([2, 3, 5])
    expect(full.quiet).toBe(true)
    expect(names(element)).toEqual(pageOf(2).map((row) => row.name))
  })

  it('sends the page, shows it at once and says it when the rows come', async () => {
    const element = await mount()
    const pages: unknown[] = []
    element.addEventListener('lintje-page-change', (event) =>
      pages.push((event as CustomEvent).detail),
    )
    await goTo(element, 3)
    expect(pages).toEqual([{ page: 3 }])
    expect(pager(element).page).toBe(3)
    expect(names(element)[0]).toBe('Loket 01')
    expect(busy(element)).toEqual(['true', 'true'])
    // The pager stays quiet: the table speaks once, with the rows.
    await pager(element).updateComplete
    expect(pager(element).shadowRoot!.querySelector('[role="status"]')!.textContent?.trim()).toBe(
      '',
    )
    expect(await said(element)).toBe('')
    element.data = hostData(3)
    expect(await said(element)).toBe('Pagina 3 van 3')
    expect(busy(element)).toEqual([null, null])
  })

  it('keeps a short last page as tall as a full one', async () => {
    const element = await mount(hostData(3))
    expect(names(element)).toHaveLength(3)
    expect(root(element).querySelectorAll('.lintje-data-table__row--filler')).toHaveLength(2)
    expect(root(element).querySelectorAll('.lintje-data-table__mobile-row--filler')).toHaveLength(2)
  })

  it('counts the rows after the filters from the rows before them', async () => {
    const element = await mount(
      hostData(1, {
        columns: [
          { key: 'name', header: 'Loket' },
          { key: 'requests', header: 'Aanvragen', filter: { kind: 'text' } },
        ],
        filters: { requests: '7' },
        totalRows: 131,
      }),
    )
    expect(pager(element).total).toBe(13)
    expect(pager(element).filteredFrom).toBe(131)
  })
})

describe('the host’s selection', () => {
  it('checks this page and keeps the rows checked on other pages', async () => {
    const element = await mount(hostData(2, { selectable: true, checkedIds: ['r1'] }))
    const changes: string[][] = []
    element.addEventListener('lintje-checked-change', (event) =>
      changes.push((event as CustomEvent<string[]>).detail),
    )
    const all = root(element).querySelector<HTMLInputElement>(
      '.lintje-data-table__full thead .lintje-choice__input',
    )!
    expect(all.checked).toBe(false)
    all.click()
    await element.updateComplete
    expect(changes.at(-1)).toEqual(['r1', 'r6', 'r7', 'r8', 'r9', 'r10'])
    expect(all.checked).toBe(true)
    all.click()
    await element.updateComplete
    expect(changes.at(-1)).toEqual(['r1'])
  })
})

describe('the host’s download', () => {
  it('lets the tile’s download through to the host, also from the enlarged view', async () => {
    const element = await mount(
      hostData(1, { title: 'Loketten', download: { filename: 'loketten' }, expandable: true }),
    )
    const downloads: Event[] = []
    element.addEventListener('lintje-tile-download', (event) => downloads.push(event))
    const tile = root(element).querySelector('lintje-tile')!
    tile.dispatchEvent(new CustomEvent('lintje-tile-download', { bubbles: true, composed: true }))
    expect(downloads).toHaveLength(1)
    root(element)
      .querySelector('lintje-modal')!
      .dispatchEvent(new CustomEvent('lintje-download-csv', { bubbles: true, composed: true }))
    expect(downloads).toHaveLength(2)
    expect(downloadCsv).not.toHaveBeenCalled()
  })

  it('still writes the CSV itself without paging', async () => {
    const element = await mount({ ...hostData(), paging: undefined, download: { filename: 'x' } })
    const downloads: Event[] = []
    element.addEventListener('lintje-tile-download', (event) => downloads.push(event))
    root(element)
      .querySelector('lintje-tile')!
      .dispatchEvent(new CustomEvent('lintje-tile-download', { bubbles: true, composed: true }))
    expect(downloads).toHaveLength(0)
    expect(downloadCsv).toHaveBeenCalledOnce()
  })
})

describe('groups with the host’s pages', () => {
  it('are left out, with a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const element = await mount(hostData(1, { groupBy: 'requests' }))
    expect(root(element).querySelector('.lintje-data-table__group-row')).toBeNull()
    expect(names(element)).toHaveLength(5)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('groupBy'))
  })
})
