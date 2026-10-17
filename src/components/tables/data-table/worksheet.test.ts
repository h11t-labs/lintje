/**
 * The worksheet's additions to `lintje-data-table`: labels, the host's totals, a row's detail and
 * groups. What is checked is what each one draws and that none of them sends anything.
 */
import { describe, expect, it } from 'vitest'
import './data-table'
import { rangeText } from '../pagination/pagination'
import type { DataTableData } from '../../../types'

type TableElement = HTMLElement & { data: DataTableData; updateComplete: Promise<unknown> }

const data: DataTableData = {
  caption: 'Loketten',
  rowKey: 'id',
  columns: [
    { key: 'name', header: 'Loket' },
    { key: 'region', header: 'Regio' },
    { key: 'requests', header: 'Aanvragen' },
    {
      key: 'state',
      header: 'Status',
      format: 'label',
      labels: {
        open: { label: 'Open', tone: 'info', icon: 'functioneel-klok' },
        done: { label: 'Afgehandeld', tone: 'success' },
      },
    },
  ],
  rows: [
    { id: 'u', name: 'Utrecht', region: 'Midden', requests: 12, state: 'done' },
    { id: 'r', name: 'Rotterdam', region: 'Zuidwest', requests: 30, state: 'open' },
    { id: 'd', name: 'Den Haag', region: 'Zuidwest', requests: 20, state: 'onbekend' },
  ],
}

async function mount(extra: Partial<DataTableData> = {}): Promise<TableElement> {
  const element = document.createElement('lintje-data-table') as TableElement
  element.data = { ...structuredClone(data), ...extra }
  document.body.append(element)
  await element.updateComplete
  return element
}

const shadow = (element: TableElement): ShadowRoot => element.shadowRoot as ShadowRoot

/** The desktop table's body rows, as the text of their name cell. */
function names(element: TableElement): string[] {
  return [
    ...shadow(element).querySelectorAll(
      '.lintje-data-table__full .lintje-data-table__row:not(.lintje-data-table__row--filler) .lintje-data-table__name',
    ),
  ].map((cell) => cell.textContent?.trim() ?? '')
}

describe('a label column', () => {
  it('draws the value as a badge with its word, tone and icon, and an unknown one as text', async () => {
    const element = await mount()
    const cells = [
      ...shadow(element).querySelectorAll('.lintje-data-table__full tbody tr td:last-child'),
    ]
    // The default sort is by name: Den Haag, Rotterdam, Utrecht.
    const badge = cells[1]?.querySelector('.lintje-badge')
    expect(badge?.textContent?.trim()).toBe('Open')
    expect(badge?.classList.contains('lintje-badge--info')).toBe(true)
    expect(badge?.querySelector('.lintje-badge__icon')).not.toBeNull()
    expect(cells[2]?.querySelector('.lintje-badge--success')?.textContent?.trim()).toBe(
      'Afgehandeld',
    )
    expect(cells[0]?.querySelector('.lintje-badge')).toBeNull()
    expect(cells[0]?.textContent?.trim()).toBe('onbekend')
  })

  it('sorts by the word a reader sees, not by the host’s code', async () => {
    const element = await mount({ sort: { key: 'state', direction: 'asc' } })
    // Afgehandeld, onbekend, Open: the words in Dutch order, not done/onbekend/open.
    expect(names(element)).toEqual(['Utrecht', 'Den Haag', 'Rotterdam'])
  })
})

describe('the totals row', () => {
  it('draws the host’s values with the word that says how, and leaves a column without one empty', async () => {
    const element = await mount({
      totals: { requests: 62, region: { value: 3, how: 'aantal' } },
      totalsLabel: 'Alle loketten',
    })
    const row = shadow(element).querySelector('.lintje-data-table__full tfoot tr')
    const cells = [...(row?.children ?? [])].map((cell) => cell.textContent?.trim())
    expect(cells).toEqual(['Alle loketten', 'aantal 3', '62', ''])
    expect(row?.querySelector('th')?.getAttribute('scope')).toBe('row')
    // The phone's totals row carries the measure.
    const phone = shadow(element).querySelector('.lintje-data-table__mobile tfoot tr')
    expect(phone?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Alle loketten aantal 3')
  })

  it('is not there without totals', async () => {
    const element = await mount()
    expect(shadow(element).querySelector('tfoot')).toBeNull()
  })
})

describe('a row’s detail', () => {
  it('lists the hidden columns and the detail fields, and opens without an event', async () => {
    const element = await mount({
      hiddenColumns: ['region'],
      detailFields: [{ key: 'note', label: 'Toelichting' }],
      rows: data.rows.map((row) => ({ ...row, note: `Over ${row.name}` })),
    })
    const sent: string[] = []
    for (const name of ['lintje-row-click', 'lintje-checked-change', 'lintje-columns-change']) {
      element.addEventListener(name, () => sent.push(name))
    }
    const toggle = shadow(element).querySelector<HTMLButtonElement>(
      '.lintje-data-table__detail-toggle',
    )
    expect(toggle?.getAttribute('aria-label')).toBe('Alle gegevens van Den Haag')
    expect(toggle?.getAttribute('aria-expanded')).toBe('false')
    toggle?.click()
    await element.updateComplete
    expect(toggle?.getAttribute('aria-expanded')).toBe('true')
    const detail = shadow(element).getElementById(toggle?.getAttribute('aria-controls') ?? '')
    expect(detail?.hidden).toBe(false)
    const list = detail?.querySelector('lintje-description-list') as HTMLElement & {
      items: { label: string; value: unknown }[]
    }
    expect(list.items).toEqual([
      { label: 'Regio', value: 'Zuidwest' },
      { label: 'Toelichting', value: 'Over Den Haag' },
    ])
    expect(sent).toEqual([])
    // The phone's row is open too: one list of open rows.
    const phone = shadow(element).querySelector('.lintje-data-table__mobile-toggle')
    expect(phone?.getAttribute('aria-expanded')).toBe('true')
  })

  it('has no toggle when nothing is hidden and there are no detail fields', async () => {
    const element = await mount()
    expect(shadow(element).querySelector('.lintje-data-table__detail-toggle')).toBeNull()
  })
})

describe('groups', () => {
  const totals = {
    Midden: { requests: 12 },
    Zuidwest: { requests: { value: 25, how: 'gem.' } },
  }

  it('heads each group, sorts within it and closes it with the host’s subtotals', async () => {
    const element = await mount({
      groupBy: 'region',
      groupTotals: totals,
      sort: { key: 'requests', direction: 'asc' },
    })
    const heads = [
      ...shadow(element).querySelectorAll(
        '.lintje-data-table__full .lintje-data-table__group-name',
      ),
    ]
    expect(heads.map((head) => head.textContent?.trim())).toEqual(['Midden', 'Zuidwest'])
    // Within Zuidwest, ascending by requests: Den Haag before Rotterdam.
    expect(names(element)).toEqual(['Utrecht', 'Den Haag', 'Rotterdam'])
    // The group's column is its heading, not a column of its own.
    const header = [...shadow(element).querySelectorAll('.lintje-data-table__full thead th')]
    expect(header.map((cell) => cell.textContent?.trim())).not.toContain('Regio')
    const subtotal = shadow(element).querySelectorAll(
      '.lintje-data-table__full .lintje-data-table__subtotal',
    )[1]
    expect(subtotal?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Subtotaal Zuidwest gem. 25')
  })

  it('collapses a group to its heading, which then carries the subtotals', async () => {
    const element = await mount({ groupBy: 'region', groupTotals: totals })
    const toggle = shadow(element).querySelectorAll<HTMLButtonElement>(
      '.lintje-data-table__full .lintje-data-table__group-toggle',
    )[1]
    expect(toggle?.getAttribute('aria-expanded')).toBe('true')
    toggle?.click()
    await element.updateComplete
    expect(toggle?.getAttribute('aria-expanded')).toBe('false')
    expect(names(element)).toEqual(['Utrecht'])
    const heading = toggle?.closest('tr')
    expect(heading?.textContent?.replace(/\s+/g, ' ')).toContain('gem. 25')
    // "Alles uitklappen" only once every group is collapsed.
    const all = () =>
      shadow(element).querySelector<HTMLButtonElement>('.lintje-data-table__group-all')
    expect(all()?.textContent?.trim()).toBe('Alles inklappen')
    all()?.click()
    await element.updateComplete
    expect(names(element)).toEqual([])
    expect(all()?.textContent?.trim()).toBe('Alles uitklappen')
  })

  it('gives a heading and a total a cell per control column, with that column’s class', async () => {
    const element = await mount({
      groupBy: 'region',
      groupTotals: totals,
      totals: { requests: 62 },
      selectable: true,
      detailFields: [{ key: 'note', label: 'Toelichting' }],
      rowActions: [{ value: 'openen', label: 'Openen' }],
    })
    const rows = [
      ...shadow(element).querySelectorAll(
        '.lintje-data-table__full :is(.lintje-data-table__group-row, .lintje-data-table__subtotal, .lintje-data-table__total)',
      ),
    ]
    // Two headings, two subtotals and the total.
    expect(rows).toHaveLength(5)
    for (const row of rows) {
      const cells = [...row.children]
      expect(cells[0]?.classList.contains('lintje-data-table__check-cell')).toBe(true)
      expect(cells[1]?.classList.contains('lintje-data-table__detail-cell')).toBe(true)
      expect(cells.at(-1)?.classList.contains('lintje-data-table__action-cell')).toBe(true)
      expect(row.querySelector('[colspan]')).toBeNull()
    }
  })

  it('puts whole groups on a page and counts groups', async () => {
    const element = await mount({ groupBy: 'region', groupsPerPage: 1 })
    expect(names(element)).toEqual(['Utrecht'])
    const pager = shadow(element).querySelector(
      '.lintje-data-table__pagination--full',
    ) as HTMLElement & {
      pageCount: number
      unit: string
    }
    expect(pager.pageCount).toBe(2)
    expect(pager.unit).toBe('groepen')
  })
})

describe('the pager’s count', () => {
  it('says a filter narrowed the total', () => {
    expect(rangeText(1, 25, 40, { many: 'rijen', one: 'rij' }, 131)).toBe(
      '1–25 van 40 rijen · gefilterd uit 131',
    )
    expect(rangeText(1, 25, 12, { many: 'rijen', one: 'rij' }, 131)).toBe(
      '12 rijen · gefilterd uit 131',
    )
    expect(rangeText(1, 25, 40, { many: 'rijen', one: 'rij' })).toBe('1–25 van 40 rijen')
  })
})

describe('the column widths', () => {
  it('measure each column by its widest value over every row, not only the page', async () => {
    const element = await mount({ pageSize: 1, sort: { key: 'requests', direction: 'asc' } })
    const sizer = shadow(element).querySelector(
      '.lintje-data-table__full .lintje-data-table__sizer',
    )
    expect(sizer?.getAttribute('aria-hidden')).toBe('true')
    const cells = [...(sizer?.querySelectorAll('td') ?? [])].map((cell) => cell.textContent?.trim())
    // Only Utrecht is on the page; the sizer holds the longest name and status of all three (of
    // equally long figures, the first).
    expect(names(element)).toEqual(['Utrecht'])
    expect(cells).toEqual(['Rotterdam', 'Zuidwest', '12', 'Afgehandeld'])
  })
})
