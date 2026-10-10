/**
 * `<lintje-map>`: choosing a mark and undoing it.
 *
 * The map adopts a *new* `selectedId` once and owns the selection in between;
 * a clear emits
 * `lintje-mark-select` with `id: null` and the tile's `clearHref`, so the page removes
 * the parameter the same way it set it.
 *
 * happy-dom has no layout, so what is checked is the markup and the events.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import './map'
import { downloadCsv } from '../../shared/download'
import type { MapData, MapValue } from '../../../types'
import type { LintjeAnnouncement } from '../../feedback/announcement/announcement'

interface MapElement extends HTMLElement {
  renderRoot: DocumentFragment | HTMLElement
  data?: MapData | null
  updateComplete: Promise<unknown>
}

const POINTS = [
  {
    id: 'ams-e',
    label: 'Loket Utrecht',
    value: 12,
    lon: 4.76,
    lat: 52.31,
    series: 'sky-blue' as const,
  },
  {
    id: 'ein',
    label: 'Eindhoven',
    value: 21,
    lon: 5.39,
    lat: 51.45,
    series: 'dark-yellow' as const,
  },
  { id: 'rtm', label: 'Rotterdam', value: null, lon: 4.44, lat: 51.96 },
]

function tileData(extra: Partial<MapData> = {}): MapData {
  return {
    variant: 'points',
    geo: 'netherlands',
    values: POINTS,
    unit: 'min',
    description: 'Loketten in Nederland.',
    ...extra,
  } as MapData
}

/** The same map whose marks carry a URL the host minted, so the link is drawn. */
function withHref(extra: Partial<MapData> = {}): MapData {
  return tileData({
    values: POINTS.map((value) => ({ ...value, href: `/m?nav.post=${value.id}` })),
    ...extra,
  })
}

vi.mock('../../shared/download', async (actual) => ({
  ...(await actual<typeof import('../../shared/download')>()),
  downloadCsv: vi.fn(),
}))

async function mountMap(data: MapData): Promise<MapElement> {
  const element = document.createElement('lintje-map') as MapElement
  element.data = data
  document.body.append(element)
  await element.updateComplete
  return element
}

function point(element: MapElement, id: string): SVGElement {
  const found = element.renderRoot.querySelector<SVGElement>(`[data-mark-id="${id}"]`)
  if (!found) throw new Error(`no mark ${id}`)
  return found
}

function panel(element: MapElement): Element | null {
  return element.renderRoot.querySelector('.lintje-map-chart__selection')
}

async function click(element: MapElement, node: Element, init: MouseEventInit = {}): Promise<void> {
  node.dispatchEvent(new MouseEvent('click', { bubbles: true, ...init }))
  await element.updateComplete
}

describe('lintje-map selection', () => {
  let selects: CustomEvent[]

  beforeEach(() => {
    document.body.innerHTML = ''
    selects = []
    document.body.addEventListener('lintje-mark-select', (event) =>
      selects.push(event as CustomEvent),
    )
  })

  it('selects a point and shows the panel', async () => {
    const element = await mountMap(tileData())
    await click(element, point(element, 'ein'))
    expect(panel(element)?.textContent).toContain('Eindhoven')
    expect(point(element, 'ein').getAttribute('aria-pressed')).toBe('true')
    expect(selects.at(-1)?.detail).toMatchObject({ id: 'ein' })
  })

  it('clears when the chosen point is clicked again', async () => {
    const element = await mountMap(tileData())
    await click(element, point(element, 'ein'))
    await click(element, point(element, 'ein'))
    expect(panel(element)).toBeNull()
    expect(point(element, 'ein').getAttribute('aria-pressed')).toBe('false')
    expect(selects.at(-1)?.detail).toMatchObject({ id: null })
  })

  it('clears on a click on the empty map, and not on a click on a mark', async () => {
    const element = await mountMap(tileData())
    await click(element, point(element, 'ein'))
    const svg = element.renderRoot.querySelector('.lintje-map-chart__svg')!
    await click(element, svg)
    expect(panel(element)).toBeNull()
  })

  it('clears on Escape', async () => {
    const element = await mountMap(tileData())
    await click(element, point(element, 'ein'))
    element.renderRoot
      .querySelector('.lintje-map-chart')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await element.updateComplete
    expect(panel(element)).toBeNull()
  })

  it('clears from the panel button, which says what it does', async () => {
    const element = await mountMap(tileData())
    await click(element, point(element, 'ein'))
    const close = element.renderRoot.querySelector('.lintje-map-chart__selection-close')!
    expect(close.getAttribute('aria-label')).toBe('Selectie opheffen')
    await click(element, close)
    expect(panel(element)).toBeNull()
  })

  it('carries the host URL that undoes a selection kept in the URL', async () => {
    const element = await mountMap(tileData({ selectedId: 'ein', clearHref: '/m?p=1' }))
    expect(panel(element)?.textContent).toContain('Eindhoven')
    await click(element, point(element, 'ein'))
    expect(panel(element)).toBeNull()
    expect(selects.at(-1)?.detail).toMatchObject({ id: null, href: '/m?p=1' })
  })

  it('adopts a new host selection but does not undo a local clear', async () => {
    const element = await mountMap(tileData({ selectedId: 'ein' }))
    await click(element, point(element, 'ein'))
    expect(panel(element)).toBeNull()
    // The same data again (a refresh that changed nothing) must not bring it back.
    element.data = tileData({ selectedId: 'ein' })
    await element.updateComplete
    expect(panel(element)).toBeNull()
    // A selection the host actually moved is adopted.
    element.data = tileData({ selectedId: 'ams-e' })
    await element.updateComplete
    expect(panel(element)?.textContent).toContain('Loket Utrecht')
  })
})

describe('lintje-map series', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('draws a legend above the map for every series a point uses', async () => {
    const element = await mountMap(
      tileData({
        seriesLabels: { 'sky-blue': 'Op norm', 'dark-yellow': 'Boven norm', red: 'Kritiek' },
      }),
    )
    const legend = element.renderRoot.querySelector('.lintje-map-chart__series-legend')!
    const labels = [...legend.querySelectorAll('.lintje-map-chart__series-item')].map((item) =>
      item.textContent?.trim(),
    )
    // "Kritiek" is declared but no point carries it, so it gets no line; the
    // hatched point that has no figure does get one.
    expect(labels).toEqual(['Op norm', 'Boven norm', 'geen meting'])
    expect(
      legend.compareDocumentPosition(element.renderRoot.querySelector('.lintje-map-chart__area')!),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('names the series in the accessible label of the point', async () => {
    const element = await mountMap(
      tileData({ seriesLabels: { 'sky-blue': 'Op norm', 'dark-yellow': 'Boven norm' } }),
    )
    expect(point(element, 'ein').getAttribute('aria-label')).toBe('Eindhoven: 21 min, Boven norm')
    // A point without a series says nothing extra.
    expect(point(element, 'rtm').getAttribute('aria-label')).toBe('Rotterdam: geen gegevens')
  })

  it('names the series in the selection panel', async () => {
    const element = await mountMap(tileData({ seriesLabels: { 'dark-yellow': 'Boven norm' } }))
    await click(element, point(element, 'ein'))
    expect(panel(element)?.textContent).toContain('Boven norm')
  })

  it('draws no legend without labels', async () => {
    const element = await mountMap(tileData())
    expect(element.renderRoot.querySelector('.lintje-map-chart__series-legend')).toBeNull()
  })

  it('takes the selection link label from the spec', async () => {
    const element = await mountMap(withHref({ selectLabel: 'Bekijk dit loket' }))
    await click(element, point(element, 'ein'))
    expect(element.renderRoot.querySelector('.lintje-map-chart__set-scope')?.textContent).toContain(
      'Bekijk dit loket',
    )
  })

  it('defaults that label to the fixed bar wording', async () => {
    const element = await mountMap(withHref())
    await click(element, point(element, 'ein'))
    expect(element.renderRoot.querySelector('.lintje-map-chart__set-scope')?.textContent).toContain(
      'Zet als bereik',
    )
  })

  it('draws no link when the chosen mark has nowhere to go', async () => {
    const element = await mountMap(tileData())
    await click(element, point(element, 'ein'))
    expect(panel(element)).not.toBeNull()
    expect(element.renderRoot.querySelector('.lintje-map-chart__set-scope')).toBeNull()
  })
})

describe('lintje-map error state', () => {
  it('is the compact warning, a live region: the load failed just now', async () => {
    const element = await mountMap(tileData({ state: 'error', message: 'De kaart laadt niet.' }))
    const notice = element.renderRoot.querySelector<LintjeAnnouncement>(
      '.lintje-chart-state--error lintje-announcement',
    )
    expect(notice?.hasAttribute('compact')).toBe(true)
    expect(notice?.data).toEqual({ kind: 'warning', text: 'De kaart laadt niet.', live: true })
  })
})

describe('lintje-map keyboard', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  const FLOWS = tileData({
    variant: 'flows',
    destination: { lon: 4.9, lat: 52.37, label: 'Amsterdam' },
    values: POINTS.filter((value) => value.value != null),
  })

  it('makes a flow a button with its route and figure, Enter choosing it', async () => {
    const element = await mountMap(FLOWS)
    const flow = point(element, 'ein')
    expect(flow.getAttribute('role')).toBe('button')
    expect(flow.getAttribute('tabindex')).toBe('0')
    expect(flow.getAttribute('aria-label')).toBe('Eindhoven → Amsterdam: 21 min')
    flow.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await element.updateComplete
    expect(point(element, 'ein').getAttribute('aria-pressed')).toBe('true')
    expect(panel(element)?.textContent).toContain('Eindhoven')
  })

  it('keeps a flow chosen by a click: the click on the map around it does not clear it', async () => {
    const element = await mountMap(FLOWS)
    await click(element, point(element, 'ein'))
    expect(point(element, 'ein').getAttribute('aria-pressed')).toBe('true')
  })

  it('names the map a group around its buttons, not an image', async () => {
    const element = await mountMap(tileData())
    const svg = element.renderRoot.querySelector('.lintje-map-chart__svg')
    expect(svg?.getAttribute('role')).toBe('group')
    expect(svg?.getAttribute('aria-labelledby')).toMatch(/-desc$/)
  })

  it('draws a focus ring behind every point, apart from its shape', async () => {
    const element = await mountMap(tileData())
    expect(point(element, 'ein').querySelector('.lintje-map-chart__point-ring')).not.toBeNull()
  })

  it('brings a focused mark outside the zoomed view into it, and home again', async () => {
    const element = await mountMap(tileData())
    const zoom = async (label: string) => {
      const buttons = element.renderRoot.querySelectorAll<HTMLButtonElement>(
        '.lintje-map-chart__zoom-button',
      )
      ;[...buttons].find((button) => button.getAttribute('aria-label') === label)?.click()
      await element.updateComplete
    }
    const svg = element.renderRoot.querySelector('.lintje-map-chart__svg')!
    const box = () => svg.getAttribute('viewBox')!.split(' ').map(Number)
    const whole = box()
    await zoom('Inzoomen')
    await zoom('Inzoomen')
    const [x, y, width, height] = box()
    // A mark in the top left corner of the map, outside the zoomed view.
    const mark = point(element, 'ein') as unknown as SVGGraphicsElement
    mark.getBBox = () => ({ x: whole[0] + 1, y: whole[1] + 1, width: 2, height: 2 }) as DOMRect
    // A pointer's focus leaves the view alone: the mark must stay under the press.
    mark.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    await element.updateComplete
    expect(box()).toEqual([x, y, width, height])
    // happy-dom answers `:focus-visible` from the document's active element, which is the tile.
    const matches = mark.matches.bind(mark)
    Object.defineProperty(mark, 'matches', {
      value: (selector: string) => selector === ':focus-visible' || matches(selector),
    })
    mark.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    await element.updateComplete
    const [nx, ny, nwidth, nheight] = box()
    expect([nwidth, nheight]).toEqual([width, height])
    expect(nx).toBeLessThan(x)
    expect(ny).toBeLessThan(y)
    expect(nx).toBeLessThanOrEqual(whole[0] + 1)
    expect(ny).toBeLessThanOrEqual(whole[1] + 1)
    await zoom('Terug naar het hele gebied')
    expect(box()).toEqual(whole)
  })
})

const ring = (west: number, south: number, east: number, north: number): [number, number][] => [
  [west, south],
  [east, south],
  [east, north],
  [west, north],
]

const ZONES: MapValue[] = [
  { id: 'oost', label: 'Zone oost', value: 12, polygon: ring(6.2, 52.2, 6.8, 52.8) },
  { id: 'west', label: 'Zone west', value: null, polygon: ring(4.2, 51.6, 4.6, 51.9) },
]

describe('lintje-map polygons', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  const POLYGONS = tileData({ variant: 'polygons', unit: 'meldingen', values: ZONES })

  it('draws an area per ring in the classes, and hatches one without a figure', async () => {
    const element = await mountMap(POLYGONS)
    const shape = (id: string) =>
      point(element, id).querySelector('.lintje-map-chart__polygon-shape')
    expect(shape('oost')?.getAttribute('fill')).toBe('var(--color-chart-seq-5)')
    expect(shape('oost')?.getAttribute('class')).toContain('lintje-map-chart__polygon-shape--data')
    // No figure is never zero (rule 15): the surface with the hatch over it.
    expect(shape('west')?.getAttribute('class')).toContain('lintje-map-chart__polygon-shape--empty')
    expect(
      point(element, 'west')
        .querySelector('.lintje-map-chart__polygon-hatch')
        ?.getAttribute('fill'),
    ).toMatch(/^url\(#map-hatch-/)
  })

  it('makes every area a button with its name and figure, and a ring behind it', async () => {
    const element = await mountMap(POLYGONS)
    const area = point(element, 'oost')
    expect(area.getAttribute('role')).toBe('button')
    expect(area.getAttribute('tabindex')).toBe('0')
    expect(area.getAttribute('aria-label')).toBe('Zone oost: 12 meldingen')
    expect(point(element, 'west').getAttribute('aria-label')).toBe('Zone west: geen gegevens')
    expect(area.querySelector('.lintje-map-chart__polygon-ring')).not.toBeNull()
    const svg = element.renderRoot.querySelector('.lintje-map-chart__svg')
    expect(svg?.getAttribute('role')).toBe('group')
  })

  it('selects an area and undoes it, by mouse and by Enter', async () => {
    const element = await mountMap(POLYGONS)
    await click(element, point(element, 'oost'))
    expect(panel(element)?.textContent).toContain('Zone oost')
    expect(panel(element)?.textContent).toContain('12 meldingen')
    expect(point(element, 'oost').getAttribute('aria-pressed')).toBe('true')
    point(element, 'oost').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    )
    await element.updateComplete
    expect(panel(element)).toBeNull()
  })

  it("shows the choropleth's scale in the legend", async () => {
    const element = await mountMap(POLYGONS)
    const legend = element.renderRoot.querySelector('.lintje-map-chart__legend')
    expect(legend?.querySelector('.lintje-map-chart__scale')).not.toBeNull()
    expect(legend?.textContent).toContain('0 – 12 meldingen')
    expect(legend?.textContent).toContain('geen gegevens')
  })
})

describe('lintje-map plots', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.mocked(downloadCsv).mockClear()
  })

  const plots = (): MapData =>
    tileData({
      variant: 'plots',
      values: [],
      unit: 'aanvragen',
      seriesLabels: undefined,
      plots: [
        { variant: 'polygons', label: 'Zones', unit: 'meldingen', values: structuredClone(ZONES) },
        {
          variant: 'points',
          label: 'Loketten',
          unit: 'min',
          seriesLabels: { 'sky-blue': 'Balie' },
          values: [
            {
              id: 'utr',
              label: 'Loket Utrecht',
              value: 40,
              lon: 5.12,
              lat: 52.09,
              series: 'sky-blue',
            },
            {
              id: 'ein',
              label: 'Eindhoven',
              value: 8,
              lon: 5.39,
              lat: 51.45,
              detail: 'Servicepunt',
            },
          ],
        },
      ],
    })

  it('draws every layer in order, the first at the bottom, and the keyboard follows it', async () => {
    const element = await mountMap(plots())
    const ids = [...element.renderRoot.querySelectorAll('[data-mark-id]')].map((mark) =>
      mark.getAttribute('data-mark-id'),
    )
    expect(ids).toEqual(['oost', 'west', 'utr', 'ein'])
    // Turned round, the points lie under the areas.
    const data = plots()
    data.plots!.reverse()
    const turned = await mountMap(data)
    expect(
      [...turned.renderRoot.querySelectorAll('[data-mark-id]')].map((mark) =>
        mark.getAttribute('data-mark-id'),
      ),
    ).toEqual(['utr', 'ein', 'oost', 'west'])
  })

  it('keeps one selection across the layers, each figure in the unit of its own layer', async () => {
    const element = await mountMap(plots())
    await click(element, point(element, 'oost'))
    expect(panel(element)?.textContent).toContain('12 meldingen')
    await click(element, point(element, 'utr'))
    expect(panel(element)?.textContent).toContain('40 min')
    expect(panel(element)?.textContent).toContain('Balie')
    expect(point(element, 'oost').getAttribute('aria-pressed')).toBe('false')
    expect(point(element, 'utr').getAttribute('aria-label')).toBe('Loket Utrecht: 40 min, Balie')
  })

  it('gives every layer a legend line with its glyph, and says "geen gegevens" once', async () => {
    const element = await mountMap(plots())
    const content = element.renderRoot.querySelector('.lintje-map-chart__legend-content')!
    expect(content.classList.contains('lintje-map-chart__legend-content--plots')).toBe(true)
    const rows = [...content.querySelectorAll('.lintje-map-chart__legend-row')].map((row) =>
      row.textContent?.replace(/\s+/g, ' ').trim(),
    )
    expect(rows).toEqual(['Zones · 0 – 12 meldingen', 'Loketten · grootte = min'])
    expect(content.querySelectorAll('.lintje-map-chart__no-data')).toHaveLength(1)
    // The legend above the map: one line per colour, with its name.
    const series = element.renderRoot.querySelector('.lintje-map-chart__series-legend')!
    expect(series.textContent).toContain('Balie')
  })

  it('names a layer without a label by its variant, and leaves no space where no unit is', async () => {
    const data = plots()
    delete data.unit
    for (const plot of data.plots!) {
      delete plot.unit
      delete plot.label
    }
    data.unit = ''
    const element = await mountMap(data)
    const rows = [...element.renderRoot.querySelectorAll('.lintje-map-chart__legend-row')].map(
      (row) => row.textContent?.replace(/\s+/g, ' ').trim(),
    )
    expect(rows).toEqual(['vlakken · 0 – 12', 'punten · grootte'])
  })

  it('keeps one legend line for a colour that serves two layers', async () => {
    const data = plots()
    data.plots!.push({
      variant: 'points',
      label: 'Servicepunten',
      seriesLabels: { 'sky-blue': 'Balie' },
      values: [
        { id: 'gro', label: 'Groningen', value: 3, lon: 6.57, lat: 53.21, series: 'sky-blue' },
      ],
    })
    const element = await mountMap(data)
    const lines = element.renderRoot.querySelectorAll(
      '.lintje-map-chart__series-item:not(.lintje-map-chart__no-data)',
    )
    expect([...lines].map((line) => line.textContent?.trim())).toEqual(['Balie'])
  })

  it('writes a column Laag in the CSV, each layer with its unit when they differ', async () => {
    const element = await mountMap({ ...plots(), download: { filename: 'kaart' } })
    element.renderRoot
      .querySelector('lintje-tile')!
      .dispatchEvent(new CustomEvent('lintje-tile-download', { bubbles: true }))
    const rows = vi.mocked(downloadCsv).mock.calls[0][1]
    expect(rows[0]).toEqual(['', '', 'Laag', 'Toelichting'])
    expect(rows[1]).toEqual(['Zone oost', 12, 'Zones (meldingen)', undefined])
    expect(rows[2]).toEqual(['Zone west', null, 'Zones (meldingen)', undefined])
    expect(rows[4]).toEqual(['Eindhoven', 8, 'Loketten (min)', 'Servicepunt'])
  })

  it('keeps the two columns of a one-variant map in its CSV', async () => {
    const element = await mountMap({ ...tileData(), download: { filename: 'kaart' } })
    element.renderRoot
      .querySelector('lintje-tile')!
      .dispatchEvent(new CustomEvent('lintje-tile-download', { bubbles: true }))
    const rows = vi.mocked(downloadCsv).mock.calls[0][1]
    expect(rows[0]).toEqual(['', 'min'])
    expect(rows[1]).toEqual(['Loket Utrecht', 12])
  })
})
