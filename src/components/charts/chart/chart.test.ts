/**
 * `<lintje-chart>`: the CSV rows of each kind, a missing value as an empty cell and never 0
 * (rule 15), the states it hands its tile, focus after a clear and a mark with an `href`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import './chart'
import type { LintjeChart } from './chart'
import { downloadCsv } from '../../shared/download'
import type { ChartData } from '../../../types'

vi.mock('../../shared/download', async (actual) => ({
  ...(await actual<typeof import('../../shared/download')>()),
  downloadCsv: vi.fn(),
}))

beforeEach(() => vi.mocked(downloadCsv).mockClear())

const DATA: ChartData = {
  title: 'Aanvragen per dag',
  description: 'Aanvragen per dag deze week.',
  chart: {
    kind: 'line',
    labels: ['ma', 'di', 'wo'],
    series: [
      { label: 'Deze week', values: [120, 3.7, null], color: 'sky-blue' },
      { label: 'Vorige week', values: [110, 98, 101], color: 'dark-yellow' },
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

/** The rows the download writes, header first. */
function csv(element: LintjeChart): unknown[][] {
  element.renderRoot
    .querySelector('lintje-tile')!
    .dispatchEvent(new CustomEvent('lintje-tile-download', { bubbles: true }))
  return vi.mocked(downloadCsv).mock.calls.at(-1)![1]
}

describe('lintje-chart CSV', () => {
  it('writes a row per category with the real values, a missing one empty, never 0', async () => {
    const element = await tile(DATA)
    expect(csv(element)).toEqual([
      ['', 'Deze week', 'Vorige week'],
      ['ma', 120, 110],
      ['di', 3.7, 98],
      ['wo', null, 101],
    ])
  })

  it('adds a column "Gebeurtenis" with the text on its category\'s row', async () => {
    const chart = { ...DATA.chart, events: [{ index: 1, label: 'Storing inlogdienst' }] }
    const rows = csv(await tile({ ...DATA, chart }))
    expect(rows[0]).toEqual(['', 'Deze week', 'Vorige week', 'Gebeurtenis'])
    expect(rows.slice(1).map((row) => row[3])).toEqual(['', 'Storing inlogdienst', ''])
  })

  it('joins two events at one category in one cell', async () => {
    const chart = {
      ...DATA.chart,
      events: [
        { index: 2, label: 'Storing' },
        { index: 2, label: 'Herstel' },
      ],
    }
    const rows = csv(await tile({ ...DATA, chart }))
    expect(rows.slice(1).map((row) => row[3])).toEqual(['', '', 'Storing; Herstel'])
  })

  it('gives a scatter plot a row per point: series, name and the two values', async () => {
    const element = await tile({
      ...DATA,
      chart: {
        kind: 'scatter',
        axisTitle: 'wachttijd',
        unit: 'min',
        xTitle: 'aanvragen',
        series: [
          { label: 'Loket', color: 'sky-blue', points: [{ label: 'Utrecht', x: 15120, y: 12 }] },
          {
            label: 'Servicepunt',
            color: 'dark-yellow',
            points: [{ label: 'Breda', x: 6210, y: null }],
          },
        ],
      },
    })
    expect(csv(element)).toEqual([
      ['Reeks', 'Naam', 'Aanvragen', 'Wachttijd (min)'],
      ['Loket', 'Utrecht', 15120, 12],
      ['Servicepunt', 'Breda', 6210, null],
    ])
  })

  it('gives a stacked area a column per part and a total, missing where a part is', async () => {
    const element = await tile({
      ...DATA,
      chart: {
        kind: 'stacked-area',
        labels: ['wk 1', 'wk 2'],
        series: [
          { label: 'Online', values: [610, null] },
          { label: 'Balie', values: [330, 320] },
        ],
      },
    })
    expect(csv(element)).toEqual([
      ['', 'Online', 'Balie', 'Totaal'],
      ['wk 1', 610, 330, 940],
      ['wk 2', null, 320, null],
    ])
  })

  it('rounds the total of decimal parts to their decimals, without float noise', async () => {
    const element = await tile({
      ...DATA,
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
    expect(csv(element)[1]).toEqual(['wk 1', 2.1, 1.3, 0.4, 3.8])
  })
})

describe('lintje-chart CSV of a histogram', () => {
  it('names each class and writes its bounds, an open bound empty and never missing', async () => {
    const element = await tile({
      title: 'Doorlooptijd',
      description: 'Doorlooptijd in klassen.',
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
    expect(csv(element)).toEqual([
      ['Klasse', 'Van (dagen)', 'Tot (dagen)', 'Aantal'],
      ['0 tot 2,5 dagen', 0, 2.5, 4],
      ['2,5 tot 5 dagen', 2.5, 5, null],
      ['5 dagen of meer', 5, '', 7],
    ])
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
    const values = [[3, 5]]
    const data: ChartData = {
      description: 'Een rooster.',
      chart: {
        kind: 'heatmap',
        columnLabels: ['ma', 'di'],
        rowLabels: ['Noord'],
        values,
        links: [[{ id: 'noord-ma', href: '/p?r=noord&d=ma' }, null]],
      },
      selectedId: 'noord-ma',
    }
    const element = await tile(data)
    // The host answers the clear with a chart in which the cell no longer drills.
    element.addEventListener('lintje-mark-select', () => {
      element.data = {
        ...data,
        chart: { kind: 'heatmap', columnLabels: ['ma', 'di'], rowLabels: ['Noord'], values },
      }
    })
    const mark = element.renderRoot.querySelector('[data-mark-id="noord-ma"]')
    mark?.dispatchEvent(new MouseEvent('click'))
    await element.updateComplete
    await element.updateComplete
    const drawing = element.renderRoot.querySelector('.lintje-heatmap')
    expect(drawing?.getAttribute('tabindex')).toBe('-1')
    expect((element.renderRoot as ShadowRoot).activeElement).toBe(drawing)
  })

  it('lands on a pie’s drawing, which keeps its place in the tab order', async () => {
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
    element.addEventListener('lintje-mark-select', () => {
      element.data = { ...data, chart: { kind: 'pie', segments: [{ label: 'Noord', value: 12 }] } }
    })
    const mark = element.renderRoot.querySelector('[data-mark-id="noord"]')
    mark?.dispatchEvent(new MouseEvent('click'))
    await element.updateComplete
    await element.updateComplete
    const drawing = element.renderRoot.querySelector('.lintje-pie-chart__svg')
    expect(drawing?.getAttribute('tabindex')).toBe('0')
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

describe('lintje-chart CSV of a radar', () => {
  it('writes a row per axis, a column per layer and the norm, and keeps a gap missing', async () => {
    const element = await tile({
      title: 'Kwaliteit',
      description: 'Kwaliteit per aspect.',
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
    const rows = csv(element)
    expect(rows[0]).toEqual(['', 'Q3 2026', 'Q3 2025', 'Norm'])
    expect(rows[1]).toEqual(['Bereikbaarheid', 7.8, 7.4, 7])
    expect(rows[2]).toEqual(['Tijdigheid', null, 6.6, 7])
  })
})

describe('lintje-chart CSV of a dumbbell', () => {
  it('writes both moments, the difference and the norm, real values beyond the axis', async () => {
    const element = await tile({
      title: 'Tevredenheid',
      description: 'Tevredenheid per loket.',
      chart: {
        kind: 'dumbbell',
        fromLabel: '2024',
        toLabel: '2026',
        min: 5,
        max: 9,
        threshold: 7,
        rows: [
          { label: 'Utrecht', from: 3.8, to: 6.1 },
          { label: 'Zwolle', from: 7.6, to: 7.1 },
          { label: 'Breda', from: 7.2, to: null },
        ],
      },
    })
    expect(csv(element)).toEqual([
      ['', '2024', '2026', 'Verschil', 'Norm'],
      ['Utrecht', 3.8, 6.1, 2.3, 7],
      ['Zwolle', 7.6, 7.1, -0.5, 7],
      ['Breda', 7.2, null, null, 7],
    ])
  })
})

describe('lintje-chart of a sankey', () => {
  const SANKEY: ChartData = {
    title: 'Aanvragen van indiening tot uitkomst',
    description: 'Aanvragen per stap.',
    chart: {
      kind: 'sankey',
      steps: [
        { label: 'Ingediend', nodes: [{ id: 'in', label: 'Aanvragen', value: 1000 }] },
        {
          label: 'Uitkomst',
          nodes: [
            { id: 'toegekend', label: 'Toegekend' },
            { id: 'ingetrokken', label: 'Ingetrokken' },
          ],
        },
      ],
      flows: [
        { from: 'in', to: 'toegekend', value: 740 },
        { from: 'in', to: 'ingetrokken', value: null },
        { from: 'in', to: 'nergens', value: 5 },
      ],
    },
  }

  it('writes a row per flow it draws: from, to, the count and its share of the source', async () => {
    expect(csv(await tile(SANKEY))).toEqual([
      ['Van', 'Naar', 'Aantal', 'Aandeel van de bron (%)'],
      ['Aanvragen', 'Toegekend', 740, 74],
      ['Aanvragen', 'Ingetrokken', null, null],
    ])
  })

  it('keeps the loading tile as tall as the busiest step, never lower than the token', async () => {
    const element = await tile({ ...SANKEY, state: 'loading' })
    const box = element.renderRoot.querySelector('lintje-tile')
    expect(box?.getAttribute('content-height')).toMatch(/^max\(\d+px, var\(--chart-h-main\)\)$/)
  })
})

describe('lintje-chart CSV of a forecast', () => {
  it('gives a forecast series its bounds after its value, and every row its kind', async () => {
    const chart: ChartData['chart'] = {
      kind: 'line',
      labels: ['2024', '2025', '2026'],
      forecastFrom: 1,
      series: [
        {
          label: 'Aanvragen',
          values: [100, 110, 120],
          forecast: { low: [null, 105, null], high: [null, 115, 130] },
        },
        { label: 'Vorig jaar', values: [90, 95, 99], comparison: true },
      ],
    }
    // Before the forecast a bound is empty, not missing; a missing bound after it is missing.
    expect(csv(await tile({ ...DATA, chart }))).toEqual([
      ['', 'Aanvragen', 'Aanvragen ondergrens', 'Aanvragen bovengrens', 'Vorig jaar', 'Soort'],
      ['2024', 100, '', '', 90, 'gemeten'],
      ['2025', 110, 105, 115, 95, 'raming'],
      ['2026', 120, null, 130, 99, 'raming'],
    ])
  })

  it('names the bounds of a bar chart "Ondergrens" and "Bovengrens", before the trend', async () => {
    const chart: ChartData['chart'] = {
      kind: 'bar',
      labels: ['2024', '2025', '2026'],
      values: [100, 110, 120],
      trend: [100, 105, 110],
      forecastFrom: 2,
      forecastLabel: 'Prognose',
      forecast: { low: [null, null, 112], high: [null, null, 128] },
    }
    const rows = csv(await tile({ ...DATA, chart }))
    expect(rows[0]).toEqual(['', 'Waarde', 'Ondergrens', 'Bovengrens', 'Trend', 'Soort'])
    expect(rows.slice(1).map((row) => row.at(-1))).toEqual(['gemeten', 'gemeten', 'prognose'])
    expect(rows[3]).toEqual(['2026', 120, 112, 128, 110, 'prognose'])
  })

  it('adds no column without a forecast', async () => {
    const element = await tile({
      ...DATA,
      chart: { ...DATA.chart, forecastFrom: 0 } as ChartData['chart'],
    })
    expect(csv(element)[0]).toEqual(['', 'Deze week', 'Vorige week'])
  })
})

describe('lintje-chart series without a colour', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  const MESSAGE =
    '<lintje-chart>: 2 reeksen zonder kleur ("Afgehandeld", "Bezwaren"). Geef elke reeks de kleur van haar variabele.'
  const LABELS = ['ma', 'di', 'wo']
  const uncoloured = (spec: ChartData['chart']): ChartData => ({ ...DATA, chart: spec })
  const line = (series: Extract<ChartData['chart'], { kind: 'line' }>['series']): ChartData =>
    uncoloured({ kind: 'line', labels: LABELS, series })

  it('warns once with both names, also after a second drawing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const data = line([
      { label: 'Afgehandeld', values: [1, 2, 3] },
      { label: 'Bezwaren', values: [3, 2, 1] },
    ])
    const element = await tile(data)
    element.data = { ...data }
    await element.updateComplete
    expect(warn).toHaveBeenCalledOnce()
    expect(warn).toHaveBeenCalledWith(MESSAGE)
  })

  it('warns again for a spec with other series without a colour', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const element = await tile(
      line([
        { label: 'Afgehandeld', values: [1, 2, 3] },
        { label: 'Bezwaren', values: [3, 2, 1] },
      ]),
    )
    element.data = line([
      { label: 'Afgehandeld', values: [1, 2, 3], color: 'sky-blue' },
      { label: 'Bezwaren', values: [3, 2, 1] },
    ])
    await element.updateComplete
    expect(warn).toHaveBeenCalledTimes(2)
    expect(warn).toHaveBeenLastCalledWith(
      '<lintje-chart>: 1 reeks zonder kleur ("Bezwaren"). Geef elke reeks de kleur van haar variabele.',
    )
  })

  it('does not count a comparison', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await tile(
      line([
        { label: 'Deze week', values: [1, 2, 3] },
        { label: 'Vorige week', values: [3, 2, 1], comparison: true },
      ]),
    )
    expect(warn).not.toHaveBeenCalled()
  })

  it('does not warn for one series, nor when every series has a colour', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await tile(line([{ label: 'Afgehandeld', values: [1, 2, 3] }]))
    await tile(
      line([
        { label: 'Afgehandeld', values: [1, 2, 3], color: 'sky-blue' },
        { label: 'Bezwaren', values: [3, 2, 1], color: 'dark-yellow' },
      ]),
    )
    expect(warn).not.toHaveBeenCalled()
  })

  const KINDS: [string, ChartData['chart']][] = [
    [
      'line',
      {
        kind: 'line',
        labels: LABELS,
        series: [
          { label: 'Afgehandeld', values: [1, 2, 3] },
          { label: 'Bezwaren', values: [3, 2, 1] },
        ],
      },
    ],
    [
      'grouped-bar',
      {
        kind: 'grouped-bar',
        labels: LABELS,
        series: [
          { label: 'Afgehandeld', values: [1, 2, 3] },
          { label: 'Bezwaren', values: [3, 2, 1] },
        ],
      },
    ],
    [
      'dual-axis',
      {
        kind: 'dual-axis',
        labels: LABELS,
        left: { label: 'Afgehandeld', values: [1, 2, 3] },
        right: { label: 'Bezwaren', values: [3, 2, 1] },
      },
    ],
    [
      'scatter',
      {
        kind: 'scatter',
        axisTitle: 'wachttijd',
        xTitle: 'aanvragen',
        series: [
          { label: 'Afgehandeld', points: [{ label: 'Utrecht', x: 1, y: 2 }] },
          { label: 'Bezwaren', points: [{ label: 'Breda', x: 2, y: 1 }] },
        ],
      },
    ],
    [
      'radar',
      {
        kind: 'radar',
        axes: ['A', 'B', 'C', 'D', 'E'],
        max: 10,
        series: [
          { label: 'Afgehandeld', values: [1, 2, 3, 4, 5] },
          { label: 'Bezwaren', values: [5, 4, 3, 2, 1] },
        ],
      },
    ],
  ]

  it.each(KINDS)('warns for a %s chart', async (_, spec) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await tile(uncoloured(spec))
    expect(warn).toHaveBeenCalledWith(MESSAGE)
  })

  it('does not warn for a stacked bar: its series divide one variable', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await tile(
      uncoloured({
        kind: 'stacked-bar',
        labels: LABELS,
        series: [
          { label: 'Afgehandeld', values: [1, 2, 3] },
          { label: 'Bezwaren', values: [3, 2, 1] },
        ],
      }),
    )
    expect(warn).not.toHaveBeenCalled()
  })
})
