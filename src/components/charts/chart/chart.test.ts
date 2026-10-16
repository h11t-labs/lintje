/**
 * `<lintje-chart>`: the chart/table switch of `tableSwitch`.
 *
 * What is checked is the markup: no control without the field, the control with
 * it, and the table it switches to — a caption and the CSV's own numbers, a
 * missing value as "—", never 0 (rule 15).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import './chart'
import type { LintjeChart } from './chart'
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
  return [
    ...found.renderRoot.querySelectorAll(
      '.lintje-data-table__full tbody:not(.lintje-data-table__sizer) tr',
    ),
  ].map((row) =>
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

  it('adds a column "Gebeurtenis" with the text on its category\'s row', async () => {
    const chart = { ...DATA.chart, events: [{ index: 1, label: 'Storing inlogdienst' }] }
    const element = await tile({ ...DATA, chart, tableSwitch: true })
    await switchTo(element, 'table')
    const found = (await table(element)) as LintjeDataTable
    const head = [...found.renderRoot.querySelectorAll('.lintje-data-table__full thead th')]
    expect(head.map((cell) => cell.textContent?.trim())).toEqual([
      '',
      'Deze week',
      'Vorige week',
      'Gebeurtenis',
    ])
    expect(cells(found).map((row) => row[3])).toEqual(['', 'Storing inlogdienst', ''])
  })

  it('joins two events at one category in one cell of the CSV and the table', async () => {
    const chart = {
      ...DATA.chart,
      events: [
        { index: 2, label: 'Storing' },
        { index: 2, label: 'Herstel' },
      ],
    }
    const element = await tile({ ...DATA, chart, tableSwitch: true })
    await switchTo(element, 'table')
    const found = (await table(element)) as LintjeDataTable
    expect(cells(found).map((row) => row[3])).toEqual(['', '', 'Storing; Herstel'])
  })

  it('gives a scatter plot a row per point: series and name as text, the two values as numbers', async () => {
    const element = await tile({
      ...DATA,
      tableSwitch: true,
      chart: {
        kind: 'scatter',
        axisTitle: 'wachttijd',
        unit: 'min',
        xTitle: 'aanvragen',
        series: [
          { label: 'Loket', points: [{ label: 'Utrecht', x: 15120, y: 12 }] },
          { label: 'Servicepunt', points: [{ label: 'Breda', x: 6210, y: null }] },
        ],
      },
    })
    await switchTo(element, 'table')
    const found = (await table(element)) as LintjeDataTable
    const head = [...found.renderRoot.querySelectorAll('.lintje-data-table__full thead th')]
    expect(head.map((cell) => cell.textContent?.trim())).toEqual([
      'Reeks',
      'Naam',
      'Aanvragen',
      'Wachttijd (min)',
    ])
    const [utrecht, breda] = cells(found)
    expect(utrecht).toEqual(['Loket', 'Utrecht', '15.120', '12'])
    expect(breda.slice(0, 3)).toEqual(['Servicepunt', 'Breda', '6.210'])
    expect(breda[3]).toContain('—')
  })

  it('gives a stacked area a column per part and a total, missing where a part is', async () => {
    const element = await tile({
      ...DATA,
      tableSwitch: true,
      chart: {
        kind: 'stacked-area',
        labels: ['wk 1', 'wk 2'],
        series: [
          { label: 'Online', values: [610, null] },
          { label: 'Balie', values: [330, 320] },
        ],
      },
    })
    await switchTo(element, 'table')
    const found = (await table(element)) as LintjeDataTable
    const head = [...found.renderRoot.querySelectorAll('.lintje-data-table__full thead th')]
    expect(head.map((cell) => cell.textContent?.trim())).toEqual(['', 'Online', 'Balie', 'Totaal'])
    const [first, second] = cells(found)
    expect(first).toEqual(['wk 1', '610', '330', '940'])
    expect(second[1]).toContain('—')
    expect(second[2]).toBe('320')
    expect(second[3]).toContain('—')
  })

  it('rounds the total of decimal parts to their decimals, without float noise', async () => {
    const element = await tile({
      ...DATA,
      tableSwitch: true,
      chart: {
        kind: 'stacked-area',
        labels: ['wk 1'],
        series: [
          { label: 'A', values: [2.1] },
          { label: 'B', values: [1.3] },
          { label: 'C', values: [0.4] },
        ],
      },
    })
    await switchTo(element, 'table')
    const found = (await table(element)) as LintjeDataTable
    expect(cells(found)[0]).toEqual(['wk 1', '2,1', '1,3', '0,4', '3,8'])
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
    const open = found.renderRoot.querySelectorAll(
      '.lintje-data-table__full tbody:not(.lintje-data-table__sizer) tr',
    )[2]
    expect(open.children[2].textContent).not.toContain('geen gegevens')
  })
})

describe('lintje-chart error state', () => {
  it('hands the error to the tile, which draws the live error and keeps its box', async () => {
    const element = await tile({ ...DATA, state: 'error', message: 'De bron reageerde niet.' })
    const frame = element.renderRoot.querySelector('lintje-tile')!
    expect(frame.state).toBe('error')
    expect(frame.message).toBe('De bron reageerde niet.')
    expect(
      frame.shadowRoot!.querySelector('.lintje-announcement--error[role="status"]'),
    ).not.toBeNull()
  })

  it('leaves a notice the host sets as the host says: live only with `live`', async () => {
    const element = await tile({ ...DATA, notice: { kind: 'info', text: 'Cijfers tot 08:00.' } })
    const notice = element.renderRoot.querySelector<HTMLElement & { data?: { live?: boolean } }>(
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

describe('lintje-chart, a mark with an href', () => {
  afterEach(() => vi.restoreAllMocks())

  const PIE: ChartData = {
    description: 'Een taart.',
    chart: {
      kind: 'pie',
      segments: [
        { label: 'Noord', value: 12, id: 'noord', href: '?regio=noord' },
        { label: 'Zuid', value: 8, id: 'zuid', href: '?regio=zuid' },
      ],
    },
  }
  const stub = () => vi.spyOn(window.location, 'assign').mockImplementation(() => {})
  const mark = (element: LintjeChart, id: string) =>
    element.renderRoot.querySelector(`[data-mark-id="${id}"]`)!
  const heard = (element: LintjeChart) => {
    const details: unknown[] = []
    element.addEventListener('lintje-mark-select', (event) =>
      details.push((event as CustomEvent).detail),
    )
    return details
  }

  it('goes there after lintje-mark-select when nobody cancels it, by click and by Enter', async () => {
    const assign = stub()
    const element = await tile(PIE)
    const selects = heard(element)
    mark(element, 'noord').dispatchEvent(new MouseEvent('click'))
    expect(selects).toEqual([{ id: 'noord', label: 'Noord', href: '?regio=noord' }])
    expect(assign).toHaveBeenCalledWith('?regio=noord')
    mark(element, 'zuid').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(assign).toHaveBeenLastCalledWith('?regio=zuid')
  })

  it('stays when the host cancels the event', async () => {
    const assign = stub()
    const element = await tile(PIE)
    element.addEventListener('lintje-mark-select', (event) => event.preventDefault())
    mark(element, 'noord').dispatchEvent(new MouseEvent('click'))
    expect(assign).not.toHaveBeenCalled()
  })

  it('opens it in a new tab on a modifier or middle click, without lintje-mark-select', async () => {
    const assign = stub()
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const element = await tile(PIE)
    const selects = heard(element)
    mark(element, 'noord').dispatchEvent(new MouseEvent('click', { ctrlKey: true }))
    mark(element, 'zuid').dispatchEvent(new MouseEvent('auxclick', { button: 1 }))
    mark(element, 'zuid').dispatchEvent(new MouseEvent('auxclick', { button: 2 }))
    expect(selects).toEqual([])
    expect(open.mock.calls).toEqual([
      ['?regio=noord', '_blank', 'noopener'],
      ['?regio=zuid', '_blank', 'noopener'],
    ])
    expect(assign).not.toHaveBeenCalled()
  })

  it('opens no tab when the host cancels lintje-navigate', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const element = await tile(PIE)
    element.addEventListener('lintje-navigate', (event) => event.preventDefault())
    mark(element, 'noord').dispatchEvent(new MouseEvent('auxclick', { button: 1 }))
    expect(open).not.toHaveBeenCalled()
  })

  it('goes to clearHref when the chosen mark is undone, unless cancelled', async () => {
    const assign = stub()
    const element = await tile({ ...PIE, selectedId: 'noord', clearHref: '?' })
    const selects = heard(element)
    mark(element, 'noord').dispatchEvent(new MouseEvent('click'))
    expect(selects).toEqual([{ id: null, label: null, href: '?' }])
    expect(assign).toHaveBeenCalledWith('?')
    element.addEventListener('lintje-mark-select', (event) => event.preventDefault())
    mark(element, 'noord').dispatchEvent(new MouseEvent('click'))
    expect(assign).toHaveBeenCalledTimes(1)
  })

  it('only sends the event when undone without a clearHref', async () => {
    const assign = stub()
    const element = await tile({ ...PIE, selectedId: 'noord' })
    const selects = heard(element)
    mark(element, 'noord').dispatchEvent(new MouseEvent('click'))
    expect(selects).toEqual([{ id: null, label: null, href: undefined }])
    expect(assign).not.toHaveBeenCalled()
  })
})

describe('lintje-chart table of a radar', () => {
  it('writes a row per axis, a column per layer and the norm, and keeps a gap missing', async () => {
    const element = await tile({
      title: 'Kwaliteit',
      description: 'Kwaliteit per aspect.',
      tableSwitch: true,
      chart: {
        kind: 'radar',
        axes: ['Bereikbaarheid', 'Tijdigheid', 'Duidelijkheid', 'Juistheid', 'Bejegening'],
        max: 10,
        threshold: 7,
        series: [
          { label: 'Q3 2026', values: [7.8, null, 7.4, 8.6, 8.9] },
          { label: 'Q3 2025', values: [7.4, 6.6, 6.9, 8.4, 8.8], comparison: true },
        ],
      },
    })
    await switchTo(element, 'table')
    const found = (await table(element)) as LintjeDataTable
    const head = [...found.renderRoot.querySelectorAll('.lintje-data-table__full thead th')]
    expect(head.map((cell) => cell.textContent?.trim())).toEqual(['', 'Q3 2026', 'Q3 2025', 'Norm'])
    const rows = cells(found)
    expect(rows[0]).toEqual(['Bereikbaarheid', '7,8', '7,4', '7'])
    expect(rows[1][1]).toContain('geen gegevens')
  })
})
