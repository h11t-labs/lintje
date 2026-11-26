/** `paging: 'host'`: the host sorts and pages, the table shows its page and waits for the next. */
import { afterEach, describe, expect, it, vi } from 'vitest'
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

/** What a host does at once on a choice: write it and fetch, with the old rows standing. */
const loading = (element: TableElement, extra: Partial<DataTableData> = {}): void => {
  element.data = { ...element.data, ...extra, state: 'loading' }
}

describe('the host’s order', () => {
  it('stands as given, also against the table’s own default order', async () => {
    const shuffled = [3, 1, 5, 2, 4].map((number) => pageOf(1)[number - 1]!)
    const element = await mount({ ...hostData(), rows: shuffled, sort: null })
    expect(names(element)).toEqual(['Loket 03', 'Loket 01', 'Loket 05', 'Loket 02', 'Loket 04'])
  })

  it('a header only asks: the arrow shows the choice, busy, over the old rows', async () => {
    const element = await mount()
    const sorts: (SortState | null)[] = []
    element.addEventListener('lintje-sort-change', (event) =>
      sorts.push((event as CustomEvent<SortState | null>).detail),
    )
    const before = names(element)
    sortButton(element, 1).click()
    await element.updateComplete
    expect(sorts).toEqual([{ key: 'requests', direction: 'desc' }])
    expect(names(element)).toEqual(before)
    const header = root(element).querySelectorAll('.lintje-data-table__full thead th')[1]!
    expect(header.getAttribute('aria-sort')).toBe('descending')
    expect(busy(element)).toEqual(['true', 'true'])
    expect(await said(element)).toBe('')
  })

  it('waits while the host loads, then takes its answer and says the sort once', async () => {
    const element = await mount(hostData(2))
    sortButton(element, 1).click()
    await element.updateComplete
    const sort: SortState = { key: 'requests', direction: 'desc' }
    loading(element, { sort, page: 1 })
    // An echo of a checked change, with rows rebuilt by `.map()`, is no answer while it loads.
    loading(element, { rows: element.data.rows.map((row) => ({ ...row })), checkedIds: [] })
    await element.updateComplete
    expect(busy(element)).toEqual(['true', 'true'])
    expect(names(element)).toEqual(pageOf(2).map((row) => row.name))
    element.data = { ...hostData(1), sort, rows: [...pageOf(1)].reverse() }
    expect(await said(element)).toBe('Gesorteerd op aanvragen, aflopend.')
    expect(busy(element)).toEqual([null, null])
    expect(names(element)[0]).toBe('Loket 05')
    expect(pager(element).page).toBe(1)
    element.data = { ...element.data, rows: element.data.rows.map((row) => ({ ...row })) }
    // A later `data` that was not asked for says nothing new and moves nothing.
    expect(await said(element)).toBe('Gesorteerd op aanvragen, aflopend.')
    expect(pager(element).page).toBe(1)
  })

  it('takes the host’s sort back when it refuses the choice, and says nothing', async () => {
    const element = await mount()
    sortButton(element, 1).click()
    await element.updateComplete
    element.data = { ...element.data }
    await element.updateComplete
    const header = root(element).querySelectorAll('.lintje-data-table__full thead th')[1]!
    expect(header.getAttribute('aria-sort')).toBe('none')
    expect(busy(element)).toEqual([null, null])
    expect(await said(element)).toBe('')
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
    // A host that loads without writing the page still shows the choice.
    loading(element)
    await element.updateComplete
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

  it('ends the wait on a cached page, the same array as before', async () => {
    const first = pageOf(1)
    const element = await mount({ ...hostData(), rows: first })
    await goTo(element, 2)
    element.data = hostData(2)
    await said(element)
    await goTo(element, 1)
    element.data = { ...hostData(1), rows: first }
    expect(await said(element)).toBe('Pagina 1 van 3')
    expect(busy(element)).toEqual([null, null])
  })

  it('ends the wait when the fetch fails', async () => {
    const element = await mount()
    await goTo(element, 2)
    loading(element, { page: 2 })
    element.data = { ...element.data, state: 'error', message: 'Niet geladen' }
    await element.updateComplete
    expect(busy(element)).toEqual([])
    element.data = hostData(1)
    await element.updateComplete
    expect(busy(element)).toEqual([null, null])
  })

  it('ends the wait when the table stops being paged by the host', async () => {
    const element = await mount()
    await goTo(element, 2)
    element.data = { ...element.data, paging: 'client' }
    await element.updateComplete
    expect(busy(element)).toEqual([null, null])
    element.data = { ...element.data, paging: 'host' }
    await element.updateComplete
    expect(busy(element)).toEqual([null, null])
  })

  it('draws the skeleton on a first load, without rows to keep', async () => {
    const element = await mount({ ...hostData(), rows: [], state: 'loading' })
    expect(root(element).querySelector('table')).toBeNull()
  })

  it('keeps the enlarged table while the host loads', async () => {
    const element = await mount(hostData(1, { title: 'Loketten', expandable: true }))
    root(element)
      .querySelector('lintje-tile')!
      .dispatchEvent(new CustomEvent('lintje-tile-expand', { bubbles: true, composed: true }))
    await element.updateComplete
    loading(element, { page: 2 })
    await element.updateComplete
    expect(root(element).querySelectorAll('.lintje-data-table__full')).toHaveLength(2)
  })

  it('shows the last page for a page past it, with a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const element = await mount(
      hostData(9, { rows: pageOf(1).slice(0, 5), rowCount: 30, pageSize: 25 }),
    )
    await pager(element).updateComplete
    expect([pager(element).page, pager(element).pageCount]).toEqual([2, 2])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('page 9'))
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

/** Files the table writes itself; the unit window is shared, so the module cannot be mocked. */
function savedFiles(): Blob[] {
  const files: Blob[] = []
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    files.push(blob as Blob)
    return 'blob:loketten'
  })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  return files
}

describe('the host’s download', () => {
  it('lets the tile’s download through to the host, also from the enlarged view', async () => {
    const element = await mount(
      hostData(1, { title: 'Loketten', download: { filename: 'loketten' }, expandable: true }),
    )
    const files = savedFiles()
    const downloads: Event[] = []
    element.addEventListener('lintje-tile-download', (event) => downloads.push(event))
    const tile = root(element).querySelector('lintje-tile')!
    tile.dispatchEvent(new CustomEvent('lintje-tile-download', { bubbles: true, composed: true }))
    expect(downloads).toHaveLength(1)
    root(element)
      .querySelector('lintje-modal')!
      .dispatchEvent(new CustomEvent('lintje-download-csv', { bubbles: true, composed: true }))
    expect(downloads).toHaveLength(2)
    expect(files).toHaveLength(0)
  })

  it('still writes the CSV itself without paging', async () => {
    const element = await mount({ ...hostData(), paging: undefined, download: { filename: 'x' } })
    const files = savedFiles()
    const downloads: Event[] = []
    element.addEventListener('lintje-tile-download', (event) => downloads.push(event))
    root(element)
      .querySelector('lintje-tile')!
      .dispatchEvent(new CustomEvent('lintje-tile-download', { bubbles: true, composed: true }))
    expect(downloads).toHaveLength(0)
    expect(files).toHaveLength(1)
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
