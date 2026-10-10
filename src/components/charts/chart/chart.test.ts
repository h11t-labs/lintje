/**
 * `<lintje-chart>`: the chart/table switch of `tableSwitch`.
 *
 * What is checked is the markup: no control without the field, the control with
 * it, and the table it switches to — a caption and the CSV's own numbers, a
 * missing value as "—", never 0 (rule 15).
 */
import { describe, expect, it } from 'vitest'
import './chart'
import type { LintjeChart } from './chart'
import type { LintjeAnnouncement } from '../../feedback/announcement/announcement'
import type { LintjeDataTable } from '../../tables/data-table/data-table'
import type { LintjeSegmented } from '../../inputs/segmented/segmented'
import type { ChartData } from '../../../types'

const DATA: ChartData = {
  title: 'Aanvragen per dag',
  description: 'Aanvragen per dag deze week.',
  chart: {
    kind: 'line',
    labels: ['ma', 'di', 'wo'],
    series: [
      { label: 'Deze week', values: [120, 3.7, null] },
      { label: 'Vorige week', values: [110, 98, 101] },
    ],
  },
}

async function tile(data: ChartData): Promise<LintjeChart> {
  const element = document.createElement('lintje-chart')
  element.data = data
  document.body.append(element)
  await element.updateComplete
  return element
}

const control = (element: LintjeChart): LintjeSegmented | null =>
  element.renderRoot.querySelector('lintje-segmented')

async function switchTo(element: LintjeChart, view: 'chart' | 'table'): Promise<void> {
  const segmented = control(element)
  if (!segmented) throw new Error('no control')
  await segmented.updateComplete
  const option = [...segmented.renderRoot.querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === (view === 'table' ? 'Tabel' : 'Grafiek'),
  )
  option?.click()
  await element.updateComplete
}

async function table(element: LintjeChart): Promise<LintjeDataTable | null> {
  const found = element.renderRoot.querySelector<LintjeDataTable>('lintje-tile lintje-data-table')
  if (found) await found.updateComplete
  return found
}

/** The desktop table's body, cell by cell, as the reader reads it. */
function cells(found: LintjeDataTable): string[][] {
  return [...found.renderRoot.querySelectorAll('.lintje-data-table__full tbody tr')].map((row) =>
    [...row.children].map((cell) => cell.textContent?.replace(/\s+/g, ' ').trim() ?? ''),
  )
}

describe('lintje-chart table switch', () => {
  it('draws no control without the field', async () => {
    const element = await tile(DATA)
    expect(control(element)).toBeNull()
  })

  it('draws "Grafiek" and "Tabel" in the header with it, the chart chosen', async () => {
    const element = await tile({ ...DATA, tableSwitch: true })
    const segmented = control(element)
    expect(segmented?.getAttribute('slot')).toBe('actions')
    expect(segmented?.label).toBe('Weergave')
    expect(segmented?.hideLabel).toBe(true)
    expect(segmented?.options?.map((option) => option.label)).toEqual(['Grafiek', 'Tabel'])
    expect(segmented?.value).toBe('chart')
    expect(await table(element)).toBeNull()
  })

  it('draws no control while the tile is not ready', async () => {
    const element = await tile({ ...DATA, tableSwitch: true, state: 'loading' })
    expect(control(element)).toBeNull()
  })

  it('switches to a table with a caption and the CSV numbers, and back', async () => {
    const element = await tile({ ...DATA, tableSwitch: true })
    const heard: string[] = []
    document.addEventListener('lintje-change', () => heard.push('lintje-change'))
    element.addEventListener('lintje-change', () => heard.push('lintje-change'))

    await switchTo(element, 'table')
    const found = await table(element)
    expect(found?.bare).toBe(true)
    expect(found?.renderRoot.querySelector('caption')?.textContent).toContain('Aanvragen per dag')
    const head = [
      ...(found?.renderRoot.querySelectorAll('.lintje-data-table__full thead th') ?? []),
    ]
    expect(head.map((cell) => cell.textContent?.trim())).toEqual(['', 'Deze week', 'Vorige week'])
    expect(cells(found as LintjeDataTable).slice(0, 2)).toEqual([
      ['ma', '120,0', '110'],
      ['di', '3,7', '98'],
    ])
    expect(heard).toEqual([])

    await switchTo(element, 'chart')
    expect(await table(element)).toBeNull()
  })

  it('draws a missing value as "—", never 0', async () => {
    const element = await tile({ ...DATA, tableSwitch: true })
    await switchTo(element, 'table')
    const found = (await table(element)) as LintjeDataTable
    const wednesday = cells(found)[2]
    expect(wednesday[0]).toBe('wo')
    expect(wednesday[1]).toContain('—')
    expect(wednesday[1]).not.toContain('0')
    expect(wednesday[2]).toBe('101')
  })
})

describe('lintje-chart table of a histogram', () => {
  it('names each class, writes its bounds as numbers, and never reads an open bound as missing', async () => {
    const element = await tile({
      title: 'Doorlooptijd',
      description: 'Doorlooptijd in klassen.',
      tableSwitch: true,
      chart: {
        kind: 'histogram',
        unit: 'dagen',
        bins: [
          { from: 0, to: 2.5, count: 4 },
          { from: 2.5, to: 5, count: null },
          { from: 5, to: null, count: 7 },
        ],
      },
    })
    await switchTo(element, 'table')
    const found = (await table(element)) as LintjeDataTable
    const head = [...found.renderRoot.querySelectorAll('.lintje-data-table__full thead th')]
    expect(head.map((cell) => cell.textContent?.trim())).toEqual([
      'Klasse',
      'Van (dagen)',
      'Tot (dagen)',
      'Aantal',
    ])
    const rows = cells(found)
    expect(rows[0]).toEqual(['0 tot 2,5 dagen', '0,0', '2,5', '4'])
    // A missing count is missing; the open bound is an empty cell, not "geen gegevens".
    expect(rows[1][3]).toContain('geen gegevens')
    expect(rows[2]).toEqual(['5 dagen of meer', '5,0', '', '7'])
    const open = found.renderRoot.querySelectorAll('.lintje-data-table__full tbody tr')[2]
    expect(open.children[2].textContent).not.toContain('geen gegevens')
  })
})

describe('lintje-chart error state', () => {
  it('is the compact warning, a live region: the load failed just now', async () => {
    const element = await tile({ ...DATA, state: 'error', message: 'De bron reageerde niet.' })
    const notice = element.renderRoot.querySelector<LintjeAnnouncement>(
      '.lintje-chart-state--error lintje-announcement',
    )
    expect(notice?.hasAttribute('compact')).toBe(true)
    expect(notice?.data).toEqual({ kind: 'warning', text: 'De bron reageerde niet.', live: true })
  })

  it('leaves a notice the host sets as the host says: live only with `live`', async () => {
    const element = await tile({ ...DATA, notice: { kind: 'info', text: 'Cijfers tot 08:00.' } })
    const notice = element.renderRoot.querySelector<LintjeAnnouncement>(
      'lintje-announcement[slot="notice"]',
    )
    expect(notice?.data?.live).toBeUndefined()
  })
})

describe('lintje-chart focus after a clear', () => {
  it('lands on the drawing, focusable from a script only, when the cleared mark is gone', async () => {
    const segments = [
      { label: 'Noord', value: 12, id: 'noord', href: '/p?r=noord' },
      { label: 'Zuid', value: 8 },
    ]
    const data: ChartData = {
      description: 'Een taart.',
      chart: { kind: 'pie', segments },
      selectedId: 'noord',
    }
    const element = await tile(data)
    // The host answers the clear with a chart in which the slice no longer drills.
    element.addEventListener('lintje-mark-select', () => {
      element.data = { ...data, chart: { kind: 'pie', segments: [{ label: 'Noord', value: 12 }] } }
    })
    const mark = element.renderRoot.querySelector('[data-mark-id="noord"]')
    mark?.dispatchEvent(new MouseEvent('click'))
    await element.updateComplete
    await element.updateComplete
    const drawing = element.renderRoot.querySelector('.lintje-pie-chart__svg')
    expect(drawing?.getAttribute('tabindex')).toBe('-1')
    expect((element.renderRoot as ShadowRoot).activeElement).toBe(drawing)
  })
})
