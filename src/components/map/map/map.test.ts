/**
 * `<lintje-map>`: choosing a mark and undoing it.
 *
 * The map adopts a *new* `selectedId` once and owns the selection in between;
 * a clear emits
 * `lintje-mark-select` with `id: null` and the tile's `clearHref`, so the page removes
 * the parameter the same way it set it.
 *
 * happy-dom has no layout, so what is checked is the markup and the events. Leaflet builds the
 * map only in a box with a size, so every element here reports one; the projection is pure
 * arithmetic and the marks are drawn as in a browser.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import './map'
import { downloadCsv } from '../../shared/download'
import type { MapData, MapValue } from '../../../types'
import type { LintjeAnnouncement } from '../../feedback/announcement/announcement'

interface MapTile extends HTMLElement {
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

const SIZE = { clientWidth: 800, clientHeight: 400 }
beforeAll(() => {
  for (const [name, value] of Object.entries(SIZE))
    Object.defineProperty(HTMLElement.prototype, name, { configurable: true, get: () => value })
})
afterAll(() => {
  for (const name of Object.keys(SIZE)) delete (HTMLElement.prototype as never)[name]
})

async function mapTile(data: MapData): Promise<MapTile> {
  const element = document.createElement('lintje-map') as MapTile
  element.data = data
  document.body.append(element)
  await element.updateComplete
  return element
}

function point(element: MapTile, id: string): SVGElement {
  const found = element.renderRoot.querySelector<SVGElement>(`[data-mark-id="${id}"]`)
  if (!found) throw new Error(`no mark ${id}`)
  return found
}

function panel(element: MapTile): Element | null {
  return element.renderRoot.querySelector('.lintje-map-chart__selection')
}

const text = (node: Element | null | undefined): string =>
  node?.textContent?.replace(/\s+/g, ' ').trim() ?? ''

/** The series lines of the legend above the map, as a reader reads them. */
function legendLines(element: MapTile): string[] {
  return [...element.renderRoot.querySelectorAll('.lintje-legend__item')].map(text)
}

/** The legend's lines per layer: the layer's name, then what its key says. */
function legendRows(element: MapTile): { layer: string; key: string }[] {
  return [...element.renderRoot.querySelectorAll('.lintje-map-legend__keys')].map((keys) => ({
    layer: text(
      keys.previousElementSibling?.matches('.lintje-map-legend__layer')
        ? keys.previousElementSibling
        : null,
    ),
    key: text(keys.querySelector('.lintje-map-legend__key')),
  }))
}

async function click(element: MapTile, node: Element, init: MouseEventInit = {}): Promise<void> {
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
    const element = await mapTile(tileData())
    await click(element, point(element, 'ein'))
    expect(panel(element)?.textContent).toContain('Eindhoven')
    expect(point(element, 'ein').getAttribute('aria-pressed')).toBe('true')
    expect(selects.at(-1)?.detail).toMatchObject({ id: 'ein' })
  })

  it('clears when the chosen point is clicked again', async () => {
    const element = await mapTile(tileData())
    await click(element, point(element, 'ein'))
    await click(element, point(element, 'ein'))
    expect(panel(element)).toBeNull()
    expect(point(element, 'ein').getAttribute('aria-pressed')).toBe('false')
    expect(selects.at(-1)?.detail).toMatchObject({ id: null })
  })

  it('clears on a click on the empty map, and not on a click on a mark', async () => {
    const element = await mapTile(tileData())
    await click(element, point(element, 'ein'))
    const map = element.renderRoot.querySelector('.leaflet-container')!
    await click(element, map)
    expect(panel(element)).toBeNull()
  })

  it('clears on Escape', async () => {
    const element = await mapTile(tileData())
    await click(element, point(element, 'ein'))
    element.renderRoot
      .querySelector('.lintje-map-chart')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await element.updateComplete
    expect(panel(element)).toBeNull()
  })

  it('clears from the panel button, which says what it does', async () => {
    const element = await mapTile(tileData())
    await click(element, point(element, 'ein'))
    const close = element.renderRoot.querySelector('.lintje-map-chart__selection-close')!
    expect(close.getAttribute('aria-label')).toBe('Selectie opheffen')
    await click(element, close)
    expect(panel(element)).toBeNull()
  })

  it('carries the host URL that undoes a selection kept in the URL', async () => {
    const element = await mapTile(tileData({ selectedId: 'ein', clearHref: '/m?p=1' }))
    expect(panel(element)?.textContent).toContain('Eindhoven')
    await click(element, point(element, 'ein'))
    expect(panel(element)).toBeNull()
    expect(selects.at(-1)?.detail).toMatchObject({ id: null, href: '/m?p=1' })
  })

  it('adopts a new host selection but does not undo a local clear', async () => {
    const element = await mapTile(tileData({ selectedId: 'ein' }))
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
    const element = await mapTile(
      tileData({
        seriesLabels: { 'sky-blue': 'Op norm', 'dark-yellow': 'Boven norm', red: 'Kritiek' },
      }),
    )
    const legend = element.renderRoot.querySelector('.lintje-map-legend')!
    // First what size means, then the series: "Kritiek" is declared but no point carries it, so it
    // gets no line; the hatched point that has no figure does get one. Only the series switch.
    // One layer too has its name, named by its variant, and the switch that goes with it.
    expect(legendRows(element)).toEqual([{ layer: 'Punten', key: '12 – 21 min' }])
    expect(legendLines(element)).toEqual(['Op norm', 'Boven norm', 'geen gegevens'])
    expect(legend.querySelectorAll('.lintje-legend__button')).toHaveLength(2)
    expect(legend.querySelector('.lintje-map-legend__layer')?.getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(legend.querySelector('.lintje-legend__marker--hatch')).not.toBeNull()
    expect(
      legend.compareDocumentPosition(element.renderRoot.querySelector('.lintje-map-chart__area')!),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('switches a series off and on from the legend, as every chart does', async () => {
    const element = await mapTile(
      tileData({ seriesLabels: { 'sky-blue': 'Op norm', 'dark-yellow': 'Boven norm' } }),
    )
    const button = [
      ...element.renderRoot.querySelectorAll<HTMLButtonElement>('.lintje-legend__button'),
    ].find((item) => item.textContent?.includes('Boven norm'))!
    expect(button.getAttribute('aria-pressed')).toBe('true')
    button.click()
    await element.updateComplete
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(button.closest('.lintje-legend__item')?.classList.contains('is-hidden')).toBe(true)
    // The point keeps its element, so it can go with a motion; gone, it is no stop for the
    // keyboard and no mark for the reader.
    expect(point(element, 'ein').classList).toContain('is-off')
    expect(point(element, 'ein').getAttribute('tabindex')).toBe('-1')
    expect(point(element, 'ein').getAttribute('aria-hidden')).toBe('true')
    expect(point(element, 'ams-e').classList).not.toContain('is-off')
    button.click()
    await element.updateComplete
    expect(point(element, 'ein').classList).not.toContain('is-off')
    expect(point(element, 'ein').getAttribute('tabindex')).toBe('0')
  })

  it('undoes a selection whose series is switched off, and tells the host', async () => {
    const element = await mapTile(tileData({ seriesLabels: { 'dark-yellow': 'Boven norm' } }))
    const selects: CustomEvent[] = []
    element.addEventListener('lintje-mark-select', (event) => selects.push(event as CustomEvent))
    await click(element, point(element, 'ein'))
    expect(panel(element)?.textContent).toContain('Eindhoven')
    element.renderRoot.querySelector<HTMLButtonElement>('.lintje-legend__button')!.click()
    await element.updateComplete
    expect(panel(element)).toBeNull()
    expect(selects.at(-1)?.detail).toMatchObject({ id: null })
  })

  it('names the series in the accessible label of the point', async () => {
    const element = await mapTile(
      tileData({ seriesLabels: { 'sky-blue': 'Op norm', 'dark-yellow': 'Boven norm' } }),
    )
    expect(point(element, 'ein').getAttribute('aria-label')).toBe('Eindhoven: 21 min, Boven norm')
    // A point without a series says nothing extra.
    expect(point(element, 'rtm').getAttribute('aria-label')).toBe('Rotterdam: geen gegevens')
  })

  it('names the series in the selection panel', async () => {
    const element = await mapTile(tileData({ seriesLabels: { 'dark-yellow': 'Boven norm' } }))
    await click(element, point(element, 'ein'))
    expect(panel(element)?.textContent).toContain('Boven norm')
  })

  it('draws only what size means and the hatch without series labels', async () => {
    const element = await mapTile(tileData())
    expect(legendRows(element)).toEqual([{ layer: 'Punten', key: '12 – 21 min' }])
    expect(legendLines(element)).toEqual(['geen gegevens'])
    expect(element.renderRoot.querySelector('.lintje-legend__button')).toBeNull()
  })

  it('takes the selection link label from the spec', async () => {
    const element = await mapTile(withHref({ selectLabel: 'Bekijk dit loket' }))
    await click(element, point(element, 'ein'))
    expect(element.renderRoot.querySelector('.lintje-map-chart__set-scope')?.textContent).toContain(
      'Bekijk dit loket',
    )
  })

  it('defaults that label to the fixed bar wording', async () => {
    const element = await mapTile(withHref())
    await click(element, point(element, 'ein'))
    expect(element.renderRoot.querySelector('.lintje-map-chart__set-scope')?.textContent).toContain(
      'Zet als bereik',
    )
  })

  it('draws no link when the chosen mark has nowhere to go', async () => {
    const element = await mapTile(tileData())
    await click(element, point(element, 'ein'))
    expect(panel(element)).not.toBeNull()
    expect(element.renderRoot.querySelector('.lintje-map-chart__set-scope')).toBeNull()
  })
})

describe('lintje-map error state', () => {
  it('is the compact warning, a live region: the load failed just now', async () => {
    const element = await mapTile(tileData({ state: 'error', message: 'De kaart laadt niet.' }))
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
    const element = await mapTile(FLOWS)
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
    const element = await mapTile(FLOWS)
    await click(element, point(element, 'ein'))
    expect(point(element, 'ein').getAttribute('aria-pressed')).toBe('true')
  })

  it('describes the map in words a screen reader hears before its buttons', async () => {
    const element = await mapTile(tileData())
    const area = element.renderRoot.querySelector('.lintje-map-chart__area')!
    expect(area.querySelector('.visually-hidden')?.textContent?.trim()).toBe(
      'Loketten in Nederland.',
    )
    expect(
      area.querySelector('.visually-hidden')!.compareDocumentPosition(point(element, 'ein')),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('draws a focus ring behind every point, apart from its shape', async () => {
    const element = await mapTile(tileData())
    expect(point(element, 'ein').querySelector('.lintje-map-chart__point-ring')).not.toBeNull()
  })
})

describe('lintje-map wheel', () => {
  const placed = (element: MapTile) =>
    element.renderRoot.querySelector('.lintje-map-chart__data')!.getAttribute('transform')

  it('zooms on the wheel with its key, and without it only says how', async () => {
    vi.useFakeTimers()
    try {
      const element = await mapTile(tileData())
      const home = placed(element)
      expect(home).toMatch(/^translate\(/)
      const area = element.renderRoot.querySelector('.lintje-map-chart__area')!
      // happy-dom's WheelEvent is a UIEvent: the keys and the pointer's place are set by hand.
      const wheel = (init: WheelEventInit) => {
        const event = new WheelEvent('wheel', {
          bubbles: true,
          composed: true,
          cancelable: true,
          deltaY: -200,
          ...init,
        })
        Object.defineProperties(event, {
          ctrlKey: { value: init.ctrlKey ?? false },
          metaKey: { value: init.metaKey ?? false },
          clientX: { value: 10 },
          clientY: { value: 10 },
        })
        area.dispatchEvent(event)
        return event
      }
      const plain = wheel({})
      await element.updateComplete
      expect(plain.defaultPrevented).toBe(false)
      expect(placed(element)).toBe(home)
      const hint = element.renderRoot.querySelector('.lintje-map-chart__hint')
      expect(hint?.getAttribute('role')).toBe('status')
      expect(hint?.textContent).toMatch(/Gebruik (Ctrl|⌘) \+ scrollen om te zoomen/)
      vi.advanceTimersByTime(2000)
      await element.updateComplete
      expect(element.renderRoot.querySelector('.lintje-map-chart__hint')).toBeNull()

      const keyed = wheel({ ctrlKey: true })
      await element.updateComplete
      expect(keyed.defaultPrevented).toBe(true)
      expect(placed(element)).not.toBe(home)
      const keyedOut = wheel({ metaKey: true, deltaY: 200 })
      expect(keyedOut.defaultPrevented).toBe(true)
      // Back at the home zoom; the origin Leaflet rounds may differ by a pixel.
      expect(placed(element)).toMatch(/ scale\(1\)$/)
    } finally {
      vi.useRealTimers()
    }
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

describe('lintje-map area', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  const tools = (element: MapTile) => [
    ...element.renderRoot.querySelectorAll<HTMLButtonElement>('.lintje-map-chart__tool'),
  ]
  const CIRCLE = {
    kind: 'circle' as const,
    centre: [5.39, 51.45] as [number, number],
    radiusKm: 10,
  }

  /** The rows of the open menu of tools. */
  const rows = (element: MapTile) => [
    ...element.renderRoot.querySelectorAll<HTMLButtonElement>('.lintje-menu__row'),
  ]
  /** Opens the menu, with no tool in hand, and chooses the tool named `label`. */
  async function pickTool(element: MapTile, label: string): Promise<void> {
    tools(element)[0].click()
    await element.updateComplete
    rows(element)
      .find((row) => row.textContent?.includes(label))!
      .click()
    await element.updateComplete
  }

  it('offers one tool as a button, and two or more as one button that opens their menu', async () => {
    expect(tools(await mapTile(tileData()))).toHaveLength(0)
    const one = await mapTile(tileData({ controls: { circle: true } }))
    expect(tools(one).map((tool) => tool.getAttribute('aria-label'))).toEqual([
      'Selecteer met een cirkel',
    ])
    expect(tools(one)[0].classList).not.toContain('lintje-map-chart__tool--menu')
    expect(tools(one)[0].hasAttribute('aria-haspopup')).toBe(false)
    expect(one.renderRoot.querySelector('lintje-popover')).toBeNull()

    const element = await mapTile(tileData({ controls: { lasso: true, circle: true, rect: true } }))
    const [button] = tools(element)
    // No tool in hand: a select button, which opens the menu.
    expect(button.getAttribute('aria-label')).toBe('Selecteren')
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(button.classList).toContain('lintje-map-chart__tool--menu')
    expect(button.getAttribute('aria-haspopup')).toBe('menu')
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(rows(element)).toHaveLength(0)
    button.click()
    await element.updateComplete
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(rows(element).map((row) => row.textContent?.trim())).toEqual([
      'Lasso',
      'Cirkel',
      'Rechthoek',
    ])
    expect(rows(element).map((row) => row.getAttribute('role'))).toEqual(
      Array(3).fill('menuitemradio'),
    )
    expect(rows(element).map((row) => row.getAttribute('aria-checked'))).toEqual([
      'true',
      'false',
      'false',
    ])
    rows(element)[1].click()
    await element.updateComplete
    // The menu closes; the circle is in hand: the button shows it, stops it, and the map draws.
    expect(rows(element)).toHaveLength(0)
    expect(tools(element)[0].getAttribute('aria-label')).toBe('Stop met selecteren')
    expect(tools(element)[0].getAttribute('aria-pressed')).toBe('true')
    expect(tools(element)[0].hasAttribute('aria-haspopup')).toBe(false)
    expect(tools(element)[0].classList).toContain('is-active')
    // The circle's own path, from `functioneel-cirkelselectie`.
    expect(tools(element)[0].innerHTML).toContain('M12 2.5a9.5')
    expect(element.renderRoot.querySelector('.leaflet-container')?.classList).toContain(
      'is-drawing',
    )
    expect(element.renderRoot.querySelector('.lintje-map-chart__hint')?.textContent).toContain(
      'Escape',
    )
    // A click puts it down: no menu, and the button is the select button again.
    tools(element)[0].click()
    await element.updateComplete
    expect(rows(element)).toHaveLength(0)
    expect(tools(element)[0].classList).not.toContain('is-active')
    expect(tools(element)[0].getAttribute('aria-label')).toBe('Selecteren')
    expect(tools(element)[0].innerHTML).not.toContain('M12 2.5a9.5')
    // Drawing leaves the focus where it was: Escape is heard from anywhere on the page.
    await pickTool(element, 'Lasso')
    expect(tools(element)[0].classList).toContain('is-active')
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await element.updateComplete
    expect(tools(element)[0].classList).not.toContain('is-active')
    // The menu opens on the shape used last, so Enter goes straight on.
    tools(element)[0].click()
    await element.updateComplete
    expect(rows(element).map((row) => row.getAttribute('aria-checked'))).toEqual([
      'true',
      'false',
      'false',
    ])
    rows(element)[2].click()
    await element.updateComplete
    tools(element)[0].click()
    await element.updateComplete
    tools(element)[0].click()
    await element.updateComplete
    expect(rows(element).map((row) => row.getAttribute('aria-checked'))).toEqual([
      'false',
      'false',
      'true',
    ])
  })

  it('walks the menu with the arrow keys and leaves it with Escape, back on the button', async () => {
    const element = await mapTile(tileData({ controls: { lasso: true, circle: true } }))
    const [button] = tools(element)
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await element.updateComplete
    await element.renderRoot.querySelector('lintje-popover')!.updateComplete
    await Promise.resolve()
    const menu = element.renderRoot.querySelector<HTMLElement>('.lintje-map-chart__menu')!
    const [lasso, circle] = rows(element)
    expect(element.shadowRoot?.activeElement).toBe(lasso)
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(element.shadowRoot?.activeElement).toBe(circle)
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(element.shadowRoot?.activeElement).toBe(lasso)
    lasso.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
    )
    await element.updateComplete
    expect(rows(element)).toHaveLength(0)
    expect(element.shadowRoot?.activeElement).toBe(button)
  })

  it("adopts the host's area: its marks are chosen, the area drawn and counted", async () => {
    const element = await mapTile(
      tileData({ controls: { lasso: true, circle: true }, selectedArea: CIRCLE }),
    )
    expect(point(element, 'ein').getAttribute('aria-pressed')).toBe('true')
    expect(point(element, 'rtm').getAttribute('aria-pressed')).toBe('false')
    // What it did not choose steps back.
    expect(element.renderRoot.querySelector('.lintje-map-chart__data')?.classList).toContain(
      'has-area',
    )
    expect(element.renderRoot.querySelector('path.lintje-map-chart__region')).not.toBeNull()
    expect(panel(element)?.textContent).toContain('1 op de kaart')
    expect(panel(element)?.textContent).toContain('binnen 10 km')
  })

  it('keeps the area until it is dismissed: a mark chosen beside it leaves it standing', async () => {
    const element = await mapTile(
      tileData({ controls: { lasso: true, circle: true }, selectedArea: CIRCLE }),
    )
    const areas: CustomEvent[] = []
    element.addEventListener('lintje-area-select', (event) => areas.push(event as CustomEvent))
    await click(element, point(element, 'rtm'))
    expect(areas).toHaveLength(0)
    expect(element.renderRoot.querySelector('.lintje-map-chart__region')).not.toBeNull()
    expect(panel(element)?.textContent).toContain('Rotterdam')
    // Undoing the mark brings the area's panel back; its close dismisses the area.
    await click(element, point(element, 'rtm'))
    element.renderRoot
      .querySelector<HTMLButtonElement>('.lintje-map-chart__selection-close')!
      .click()
    await element.updateComplete
    expect(areas.at(-1)?.detail).toEqual({ area: null, ids: [] })
    expect(element.renderRoot.querySelector('.lintje-map-chart__region')).toBeNull()
  })

  it('resets view, mark and area at once from the reset button', async () => {
    const element = await mapTile(
      tileData({ controls: { lasso: true, circle: true }, selectedArea: CIRCLE }),
    )
    const areas: CustomEvent[] = []
    const marks: CustomEvent[] = []
    element.addEventListener('lintje-area-select', (event) => areas.push(event as CustomEvent))
    element.addEventListener('lintje-mark-select', (event) => marks.push(event as CustomEvent))
    await click(element, point(element, 'rtm'))
    ;[...element.renderRoot.querySelectorAll<HTMLButtonElement>('.lintje-map-chart__zoom-button')]
      .find((button) => button.getAttribute('aria-label') === 'Kaart terugzetten')!
      .click()
    await element.updateComplete
    expect(marks.at(-1)?.detail).toMatchObject({ id: null })
    expect(areas.at(-1)?.detail).toEqual({ area: null, ids: [] })
    expect(panel(element)).toBeNull()
  })

  /** A pointer on the map's surface. */
  const presser = (element: MapTile) => {
    const map = element.renderRoot.querySelector<HTMLElement>('.leaflet-container')!
    return (type: string, clientX: number, clientY: number) =>
      map.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          composed: true,
          cancelable: true,
          button: 0,
          pointerId: 1,
          clientX,
          clientY,
        }),
      )
  }

  it('draws a circle with two clicks, for a pointer that does not drag, and sends what it holds', async () => {
    const element = await mapTile(tileData({ controls: { circle: true } }))
    const areas: CustomEvent[] = []
    element.addEventListener('lintje-area-select', (event) => areas.push(event as CustomEvent))
    tools(element)[0].click()
    await element.updateComplete
    const press = presser(element)
    press('pointerdown', 400, 200)
    press('pointerup', 400, 200)
    press('pointermove', 600, 200)
    expect(element.renderRoot.querySelector('.lintje-map-chart__region--draft')).not.toBeNull()
    // Escape stops the area being drawn and leaves the tool on; a new one starts over.
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(element.renderRoot.querySelector('.lintje-map-chart__region--draft')).toBeNull()
    expect(tools(element)[0].getAttribute('aria-pressed')).toBe('true')
    press('pointerdown', 400, 200)
    press('pointerup', 400, 200)
    press('pointermove', 600, 200)
    press('pointerdown', 600, 200)
    press('pointerup', 600, 200)
    await element.updateComplete
    const detail = areas.at(-1)?.detail
    expect(detail.area.kind).toBe('circle')
    expect(detail.area.radiusKm).toBeGreaterThan(0)
    expect(Array.isArray(detail.ids)).toBe(true)
    // The tool stays in hand after drawing; only the draft is gone.
    expect(tools(element)[0].getAttribute('aria-pressed')).toBe('true')
    expect(element.renderRoot.querySelector('.lintje-map-chart__region--draft')).toBeNull()
  })

  it('draws a rectangle from corner to corner, as a lasso of four, and names it in the panel', async () => {
    const element = await mapTile(tileData({ controls: { lasso: true, rect: true } }))
    const areas: CustomEvent[] = []
    element.addEventListener('lintje-area-select', (event) => areas.push(event as CustomEvent))
    await pickTool(element, 'Rechthoek')
    expect(element.renderRoot.querySelector('.lintje-map-chart__hint')?.textContent).toContain(
      'hoek naar hoek',
    )
    const press = presser(element)
    // A drag: the box follows the pointer and is done when it lets go.
    press('pointerdown', 300, 100)
    press('pointermove', 500, 300)
    expect(element.renderRoot.querySelector('.lintje-map-chart__region--draft')).not.toBeNull()
    press('pointerup', 500, 300)
    await element.updateComplete
    const { area, ids } = areas.at(-1)!.detail
    expect(area.kind).toBe('lasso')
    expect(area.ring).toHaveLength(4)
    expect(area.ring[0][1]).toBe(area.ring[1][1])
    expect(area.ring[1][0]).toBe(area.ring[2][0])
    expect(Array.isArray(ids)).toBe(true)
    expect(panel(element)?.textContent).toContain('binnen de rechthoek')
    // The tool is still in hand. Two clicks do the same, for a pointer that does not drag, and a
    // new area replaces the last; a click on the spot is nothing.
    press('pointerdown', 300, 100)
    press('pointerup', 300, 100)
    press('pointerdown', 300, 100)
    press('pointerup', 300, 100)
    expect(areas).toHaveLength(1)
    press('pointerdown', 450, 250)
    press('pointerup', 450, 250)
    await element.updateComplete
    expect(areas).toHaveLength(2)
    expect(areas.at(-1)!.detail.area.ring).toHaveLength(4)
  })
})

describe('lintje-map controls', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  const labels = (element: MapTile) =>
    [...element.renderRoot.querySelectorAll('.lintje-map-chart__zoom-button')].map((button) =>
      button.getAttribute('aria-label'),
    )

  it('shows zoom, reset, scale and the legend by default, and no drawing tools', async () => {
    const element = await mapTile(
      tileData({ seriesLabels: { 'sky-blue': 'Op norm', 'dark-yellow': 'Boven norm' } }),
    )
    expect(labels(element)).toEqual(['Inzoomen', 'Uitzoomen', 'Kaart terugzetten'])
    expect(
      element.renderRoot.querySelector('.lintje-map-chart__scale-bar')?.textContent?.trim(),
    ).toMatch(/\d (km|m)$/)
    expect(element.renderRoot.querySelector('.lintje-legend')).not.toBeNull()
  })

  it('leaves out every part the host switches off', async () => {
    const element = await mapTile(
      tileData({
        seriesLabels: { 'sky-blue': 'Op norm', 'dark-yellow': 'Boven norm' },
        controls: { zoom: false, reset: false, scale: false, legend: false },
      }),
    )
    expect(element.renderRoot.querySelector('.lintje-map-chart__zoom')).toBeNull()
    expect(element.renderRoot.querySelector('.lintje-map-chart__scale-bar')).toBeNull()
    expect(element.renderRoot.querySelector('.lintje-legend')).toBeNull()
  })

  it('offers one drawing tool alone, and leaves the wheel to the page when it is off', async () => {
    const element = await mapTile(tileData({ controls: { circle: true, zoom: false } }))
    expect(labels(element)).toEqual(['Kaart terugzetten', 'Selecteer met een cirkel'])
    const off = await mapTile(tileData({ controls: { wheel: false } }))
    const wheel = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -200 })
    Object.defineProperty(wheel, 'ctrlKey', { value: true })
    off.renderRoot.querySelector('.lintje-map-chart__area')!.dispatchEvent(wheel)
    await off.updateComplete
    expect(wheel.defaultPrevented).toBe(false)
    expect(off.renderRoot.querySelector('.lintje-map-chart__hint')).toBeNull()
  })
})

describe('lintje-map polygons', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  const POLYGONS = tileData({ variant: 'polygons', unit: 'meldingen', values: ZONES })

  it('draws an area per ring in the classes, and hatches one without a figure', async () => {
    const element = await mapTile(POLYGONS)
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
    const element = await mapTile(POLYGONS)
    const area = point(element, 'oost')
    expect(area.getAttribute('role')).toBe('button')
    expect(area.getAttribute('tabindex')).toBe('0')
    expect(area.getAttribute('aria-label')).toBe('Zone oost: 12 meldingen')
    expect(point(element, 'west').getAttribute('aria-label')).toBe('Zone west: geen gegevens')
    expect(area.querySelector('.lintje-map-chart__polygon-ring')).not.toBeNull()
  })

  it('selects an area and undoes it, by mouse and by Enter', async () => {
    const element = await mapTile(POLYGONS)
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

  it('shows the classes in the legend: the ramp on the tile, each class with its range in the modal', async () => {
    const element = await mapTile(POLYGONS)
    const legend = element.renderRoot.querySelector('.lintje-map-legend')!
    expect(legend.querySelectorAll('.lintje-map-legend__ramp i')).toHaveLength(5)
    expect(legendRows(element)).toEqual([{ layer: 'Vlakken', key: '0 12 meldingen' }])
    expect(legendLines(element)).toEqual(['geen gegevens'])
    const modal = await mapTile({ ...POLYGONS, expandable: true })
    modal.renderRoot
      .querySelector('lintje-tile')!
      .dispatchEvent(new CustomEvent('lintje-tile-expand', { bubbles: true }))
    await modal.updateComplete
    await modal.updateComplete
    const classes = modal.renderRoot.querySelector('lintje-modal .lintje-map-legend__classes')!
    expect([...classes.querySelectorAll('.lintje-legend__item')].map(text)).toEqual([
      '0 – 2,4',
      '2,4 – 4,8',
      '4,8 – 7,2',
      '7,2 – 9,6',
      '9,6 – 12 meldingen',
    ])
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
    const element = await mapTile(plots())
    const ids = [...element.renderRoot.querySelectorAll('[data-mark-id]')].map((mark) =>
      mark.getAttribute('data-mark-id'),
    )
    expect(ids).toEqual(['oost', 'west', 'utr', 'ein'])
    // Turned round, the points lie under the areas.
    const data = plots()
    data.plots!.reverse()
    const turned = await mapTile(data)
    expect(
      [...turned.renderRoot.querySelectorAll('[data-mark-id]')].map((mark) =>
        mark.getAttribute('data-mark-id'),
      ),
    ).toEqual(['utr', 'ein', 'oost', 'west'])
  })

  it('keeps one selection across the layers, each figure in the unit of its own layer', async () => {
    const element = await mapTile(plots())
    await click(element, point(element, 'oost'))
    expect(panel(element)?.textContent).toContain('12 meldingen')
    await click(element, point(element, 'utr'))
    expect(panel(element)?.textContent).toContain('40 min')
    expect(panel(element)?.textContent).toContain('Balie')
    expect(point(element, 'oost').getAttribute('aria-pressed')).toBe('false')
    expect(point(element, 'utr').getAttribute('aria-label')).toBe('Loket Utrecht: 40 min, Balie')
  })

  it('gives every layer a legend line: its name, its key, its series, and "geen gegevens" where it has gaps', async () => {
    const element = await mapTile(plots())
    expect(legendRows(element)).toEqual([
      { layer: 'Zones', key: '0 12 meldingen' },
      { layer: 'Loketten', key: '8 – 40 min' },
    ])
    // The zones have a gap, the desks have a series.
    expect(legendLines(element)).toEqual(['geen gegevens', 'Balie'])
    expect(element.renderRoot.querySelectorAll('.lintje-map-legend__layer')).toHaveLength(2)
  })

  it('switches a layer off and on from its name, and undoes a selection in it', async () => {
    const element = await mapTile(plots())
    const zones = element.renderRoot.querySelector<HTMLButtonElement>('.lintje-map-legend__layer')!
    expect(zones.getAttribute('aria-pressed')).toBe('true')
    await click(element, point(element, 'oost'))
    expect(panel(element)).not.toBeNull()
    zones.click()
    await element.updateComplete
    expect(zones.getAttribute('aria-pressed')).toBe('false')
    expect(zones.classList.contains('is-off')).toBe(true)
    expect(zones.nextElementSibling?.classList.contains('is-off')).toBe(true)
    expect(point(element, 'oost').classList).toContain('is-off')
    expect(point(element, 'oost').getAttribute('tabindex')).toBe('-1')
    expect(point(element, 'utr').classList).not.toContain('is-off')
    expect(panel(element)).toBeNull()
    zones.click()
    await element.updateComplete
    expect(point(element, 'oost').classList).not.toContain('is-off')
  })

  it('folds a legend of more than three layers under "Nog n lagen", and the modal shows all', async () => {
    const data = plots()
    data.plots!.push(
      {
        variant: 'flows',
        label: 'Routes',
        values: [{ id: 'r1', label: 'Route', value: 5, lon: 6, lat: 52 }],
        destination: { lon: 5, lat: 52, label: 'Hub' },
      },
      {
        variant: 'points',
        label: 'Meldpunten',
        values: [{ id: 'm1', label: 'Meldpunt', value: 2, lon: 5.5, lat: 52.2 }],
      },
    )
    const element = await mapTile({ ...data, expandable: true })
    expect(legendRows(element).map((row) => row.layer)).toEqual(['Zones', 'Loketten', 'Routes'])
    const more = element.renderRoot.querySelector<HTMLButtonElement>('.lintje-map-legend__more')!
    expect(more.textContent).toContain('Nog 1 laag')
    expect(more.getAttribute('aria-expanded')).toBe('false')
    more.click()
    await element.updateComplete
    expect(legendRows(element).map((row) => row.layer)).toEqual([
      'Zones',
      'Loketten',
      'Routes',
      'Meldpunten',
    ])
    expect(more.textContent).toContain('Minder lagen')
    element.renderRoot
      .querySelector('lintje-tile')!
      .dispatchEvent(new CustomEvent('lintje-tile-expand', { bubbles: true }))
    await element.updateComplete
    await element.updateComplete
    const modal = element.renderRoot.querySelector('lintje-modal')!
    expect(modal.querySelectorAll('.lintje-map-legend__layer')).toHaveLength(4)
    expect(modal.querySelector('.lintje-map-legend__more')).toBeNull()
  })

  it('names a layer without a label by its variant, and leaves no space where no unit is', async () => {
    const data = plots()
    delete data.unit
    for (const plot of data.plots!) {
      delete plot.unit
      delete plot.label
    }
    data.unit = ''
    const element = await mapTile(data)
    expect(legendRows(element)).toEqual([
      { layer: 'Vlakken', key: '0 12' },
      { layer: 'Punten', key: '8 – 40' },
    ])
  })

  it('gives a colour that serves two layers a line in each, and switches each on its own', async () => {
    const data = plots()
    data.plots!.push({
      variant: 'points',
      label: 'Servicepunten',
      seriesLabels: { 'sky-blue': 'Balie' },
      values: [
        { id: 'gro', label: 'Groningen', value: 3, lon: 6.57, lat: 53.21, series: 'sky-blue' },
      ],
    })
    const element = await mapTile(data)
    const balies = [
      ...element.renderRoot.querySelectorAll<HTMLButtonElement>('.lintje-legend__button'),
    ].filter((line) => line.textContent?.trim() === 'Balie')
    expect(balies).toHaveLength(2)
    balies[1].click()
    await element.updateComplete
    expect(point(element, 'gro').classList).toContain('is-off')
    expect(point(element, 'utr').classList).not.toContain('is-off')
  })

  it('writes a column Laag in the CSV, each layer with its unit when they differ', async () => {
    const element = await mapTile({ ...plots(), download: { filename: 'kaart' } })
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
    const element = await mapTile({ ...tileData(), download: { filename: 'kaart' } })
    element.renderRoot
      .querySelector('lintje-tile')!
      .dispatchEvent(new CustomEvent('lintje-tile-download', { bubbles: true }))
    const rows = vi.mocked(downloadCsv).mock.calls[0][1]
    expect(rows[0]).toEqual(['', 'min'])
    expect(rows[1]).toEqual(['Loket Utrecht', 12])
  })
})
