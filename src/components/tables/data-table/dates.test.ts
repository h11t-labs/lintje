/**
 * `date` and `datetime` columns: an ISO value shown as a Dutch reader reads it, sorted by its
 * moment, with the same words in every place the table writes it; and text with a number in it
 * sorted by that number.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import './data-table'
import { formatDateTime } from '../../shared/date-format'
import type { DataTableData, SortState } from '../../../types'

type TableElement = HTMLElement & { data: DataTableData; updateComplete: Promise<unknown> }

const data: DataTableData = {
  caption: 'Meldingen',
  rowKey: 'id',
  columns: [
    { key: 'name', header: 'Melding' },
    { key: 'day', header: 'Datum', format: 'date' },
    { key: 'at', header: 'Tijdstip', format: 'datetime' },
  ],
  rows: [
    { id: '1', name: 'Nieuwjaar', day: '2026-01-05', at: '2026-01-05T14:30' },
    { id: '2', name: 'Oudjaar', day: '2025-12-28', at: '2025-12-28T09:05' },
    { id: '3', name: 'Zonder', day: null, at: null },
    { id: '4', name: 'Fout', day: '5-1-2026', at: 'gisteren' },
    { id: '5', name: 'Zomer', day: '2025-06-30', at: '2025-06-30T23:59' },
  ],
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

async function mount(extra: Partial<DataTableData> = {}): Promise<TableElement> {
  const element = document.createElement('lintje-data-table') as TableElement
  element.data = { ...structuredClone(data), ...extra }
  document.body.append(element)
  await element.updateComplete
  return element
}

const shadow = (element: TableElement): ShadowRoot => element.shadowRoot as ShadowRoot

function rows(element: TableElement): HTMLElement[][] {
  return [
    ...shadow(element).querySelectorAll<HTMLElement>(
      '.lintje-data-table__full tbody .lintje-data-table__row:not(.lintje-data-table__row--filler)',
    ),
  ].map((row) => [...row.querySelectorAll<HTMLElement>('th, td')])
}

const row = (element: TableElement, name: string): HTMLElement[] =>
  rows(element).find(([cell]) => cell!.textContent!.trim() === name)!

const names = (element: TableElement): string[] =>
  rows(element).map(([name]) => name!.textContent!.trim())

const sorted = (key: string, direction: SortState['direction'] = 'asc') =>
  mount({ sort: { key, direction } })

describe('a date column', () => {
  it('shows dd-mm-jjjj in a <time> with the ISO value', async () => {
    const element = await mount()
    const cell = row(element, 'Nieuwjaar')[1]!
    const time = cell.querySelector('time')!
    expect(time.getAttribute('datetime')).toBe('2026-01-05')
    expect(time.textContent).toBe('05-01-2026')
  })

  it('sorts by day across the year boundary, missing and non-ISO lowest', async () => {
    const element = await sorted('day')
    expect(names(element).slice(2)).toEqual(['Zomer', 'Oudjaar', 'Nieuwjaar'])
    expect(names(element).slice(0, 2).sort()).toEqual(['Fout', 'Zonder'])
  })

  it('starts newest first on the first click', async () => {
    const element = await mount()
    const button = shadow(element).querySelectorAll<HTMLButtonElement>(
      '.lintje-data-table__full .lintje-data-table__sort-button',
    )[1]!
    button.click()
    await element.updateComplete
    expect(names(element).slice(0, 3)).toEqual(['Nieuwjaar', 'Oudjaar', 'Zomer'])
  })

  it('shows a non-ISO value as given, without <time>, and warns once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // A value no other test uses: the warning is said once per value, for the whole page.
    const odd = data.rows.map((entry) =>
      entry.id === '4' ? { ...entry, day: '31-12-2025' } : entry,
    )
    const element = await mount({ rows: odd, sort: { key: 'day', direction: 'asc' } })
    element.data = { ...element.data, rows: [...odd] }
    await element.updateComplete
    const cell = row(element, 'Fout')[1]!
    expect(cell.querySelector('time')).toBeNull()
    expect(cell.textContent!.trim()).toBe('31-12-2025')
    const said = warn.mock.calls.filter(([text]) => String(text).includes('"31-12-2025"'))
    expect(said).toHaveLength(1)
  })

  it('shows a missing value as every missing value', async () => {
    const element = await mount()
    const [, day] = row(element, 'Zonder')
    const [, number] = rows(
      await mount({
        columns: [data.columns[0]!, { key: 'n', header: 'Aantal' }],
        rows: [{ id: '1', name: 'Leeg', n: null }],
      }),
    )[0]!
    expect(day!.innerHTML).toBe(number!.innerHTML)
  })
})

describe('a datetime column', () => {
  it('shows dd-mm-jjjj uu:mm in the reader’s time zone, in a <time>', async () => {
    const element = await mount()
    const time = row(element, 'Nieuwjaar')[2]!.querySelector('time')!
    expect(time.getAttribute('datetime')).toBe('2026-01-05T14:30')
    expect(time.textContent).toBe('05-01-2026 14:30')
  })

  it('sorts by the moment, not by the text of its offset', async () => {
    // As text 02:00+01:00 comes first; as a moment 02:30+02:00 (00:30 UTC) is an hour earlier.
    const element = await mount({
      sort: { key: 'at', direction: 'asc' },
      rows: [
        { id: '1', name: 'Wintertijd', at: '2026-10-25T02:00:00+01:00' },
        { id: '2', name: 'Zomertijd', at: '2026-10-25T02:30:00+02:00' },
        { id: '3', name: 'UTC', at: '2026-10-25T00:45:00Z' },
        { id: '4', name: 'Zonder', at: null },
      ],
    })
    expect(names(element)).toEqual(['Zonder', 'Zomertijd', 'UTC', 'Wintertijd'])
    const shown = row(element, 'Zomertijd')[2]!.textContent!.trim()
    expect(shown).toBe(formatDateTime('2026-10-25T02:30:00+02:00'))
  })
})

describe('the same words everywhere', () => {
  it('in the title of a cut cell', async () => {
    const element = await mount({
      columns: [data.columns[0]!, { ...data.columns[2]!, truncate: true }],
    })
    const cut = row(element, 'Nieuwjaar')[1]!.querySelector('.lintje-data-table__cell-text')!
    expect(cut.getAttribute('title')).toBe('05-01-2026 14:30')
    expect(cut.querySelector('time')?.textContent).toBe('05-01-2026 14:30')
  })

  it('in a row’s detail and on the phone', async () => {
    const element = await mount({
      columns: [data.columns[0]!, { key: 'kind', header: 'Soort', mobileMeasure: true }],
      rows: data.rows.slice(0, 1).map((entry) => ({ ...entry, kind: 'Storing' })),
      detailFields: [
        { key: 'day', label: 'Datum', format: 'date' },
        { key: 'at', label: 'Tijdstip', format: 'datetime' },
      ],
    })
    const toggle = shadow(element).querySelector<HTMLButtonElement>(
      '.lintje-data-table__full .lintje-data-table__detail-toggle',
    )!
    toggle.click()
    await element.updateComplete
    // An open row is open on the phone too.
    type List = Element & { items: { label: string; value?: string }[] }
    for (const table of ['full', 'mobile']) {
      const list = shadow(element).querySelector<List>(
        `.lintje-data-table__${table} lintje-description-list`,
      )!
      expect(list.items.map((item) => item.value)).toEqual(['05-01-2026', '05-01-2026 14:30'])
    }
  })

  it('as the phone’s measure, in a <time>', async () => {
    const element = await mount({
      columns: [data.columns[0]!, { ...data.columns[1]!, mobileMeasure: true }],
    })
    const times = [
      ...shadow(element).querySelectorAll(
        '.lintje-data-table__mobile .lintje-data-table__mobile-measure time',
      ),
    ].map((time) => [time.getAttribute('datetime'), time.textContent])
    expect(times).toContainEqual(['2026-01-05', '05-01-2026'])
  })

  it('in the phone’s subline', async () => {
    const element = await mount({
      columns: [data.columns[0]!, { ...data.columns[1]!, mobileSubline: true }],
    })
    const subs = [
      ...shadow(element).querySelectorAll(
        '.lintje-data-table__mobile .lintje-data-table__mobile-sub',
      ),
    ].map((sub) => sub.textContent)
    expect(subs).toContain('05-01-2026')
  })
})

describe('the CSV', () => {
  it('keeps the ISO value', async () => {
    const element = await mount({ download: { filename: 'meldingen' } })
    let file: Blob | undefined
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      file = blob as Blob
      return 'blob:meldingen'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    ;(element as unknown as { csv(): void }).csv()
    const lines = (await file!.text()).replace(/^﻿/, '').split('\r\n')
    expect(lines[1]!.split(';')).toEqual(['Nieuwjaar', '2026-01-05', '2026-01-05T14:30'])
  })
})

describe('a text column', () => {
  it('sorts a number in the text by its value', async () => {
    const element = await mount({
      sort: { key: 'name', direction: 'asc' },
      rows: ['Item 10', 'Item 9', 'Item 1'].map((name, index) => ({ id: String(index), name })),
    })
    expect(names(element)).toEqual(['Item 1', 'Item 9', 'Item 10'])
  })
})
