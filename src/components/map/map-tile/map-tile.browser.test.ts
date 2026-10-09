/**
 * The map's focus in a browser: a ring the map area would clip, and a mark the overlays or the
 * basemap's own clipping would hide (WCAG 2.4.7, 2.4.11). happy-dom lays nothing out.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { server, userEvent } from 'vitest/browser'
import './map-tile'
import type { MapTileViewData } from '../../../types'

type MapTile = HTMLElement & { data: MapTileViewData; updateComplete: Promise<unknown> }

// Groningen, the north-east corner of the country, where the zoom buttons stand.
const CORNER = { id: 'gro', label: 'Groningen', value: 4, lon: 7.15, lat: 53.45 }
const MIDDLE = { id: 'utr', label: 'Utrecht', value: 12, lon: 5.12, lat: 52.09 }
const SOUTH = { id: 'maa', label: 'Maastricht', value: 8, lon: 5.69, lat: 50.85 }

const BASEMAP = { kind: 'wms' as const, url: 'https://wms.invalid/', layers: 'x', attribution: 'x' }

async function mount(extra: Partial<MapTileViewData> = {}): Promise<MapTile> {
  // Narrow, so the country fills the width and its corner reaches the overlays.
  const frame = document.createElement('div')
  frame.style.width = '320px'
  const element = document.createElement('lintje-map-tile') as MapTile
  element.data = {
    variant: 'points',
    geo: 'netherlands',
    values: [MIDDLE, CORNER, SOUTH],
    unit: 'aantal',
    description: 'Loketten in Nederland.',
    ...extra,
  } as MapTileViewData
  frame.append(element)
  document.body.append(frame)
  await element.updateComplete
  await settle()
  return element
}

const settle = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve)))

const root = (element: MapTile): ShadowRoot => element.shadowRoot!
const mark = (element: MapTile, id: string): Element =>
  root(element).querySelector(`[data-mark-id="${id}"]`)!
const zoomButtons = (element: MapTile): DOMRect =>
  root(element).querySelector('.lintje-map-chart__zoom')!.getBoundingClientRect()

function overlaps(a: DOMRect, b: DOMRect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}

function inside(a: DOMRect, b: DOMRect): boolean {
  return a.left >= b.left && a.right <= b.right && a.top >= b.top && a.bottom <= b.bottom
}

/** Focus as the keyboard gives it: a key first, so the browser draws the ring. */
async function keyboardFocus(element: Element): Promise<void> {
  await userEvent.keyboard('{Shift}')
  ;(element as HTMLElement).focus()
}

afterEach(() => document.body.replaceChildren())

describe('the svg map', () => {
  it('moves a mark the keyboard reaches out from under the zoom buttons', async () => {
    const element = await mount()
    expect(overlaps(mark(element, 'gro').getBoundingClientRect(), zoomButtons(element))).toBe(true)
    await keyboardFocus(mark(element, 'gro'))
    await element.updateComplete
    await settle()
    const area = root(element).querySelector('.lintje-map-chart__area')!.getBoundingClientRect()
    const moved = mark(element, 'gro').getBoundingClientRect()
    expect(overlaps(moved, zoomButtons(element))).toBe(false)
    expect(inside(moved, area)).toBe(true)
  })

  it('leaves the view where it was once the focus leaves the map', async () => {
    const element = await mount()
    const svg = root(element).querySelector('.lintje-map-chart__svg')!
    const before = svg.getAttribute('viewBox')
    await keyboardFocus(mark(element, 'gro'))
    await element.updateComplete
    expect(svg.getAttribute('viewBox')).not.toBe(before)
    await keyboardFocus(root(element).querySelector('.lintje-map-chart__zoom-button')!)
    await element.updateComplete
    expect(svg.getAttribute('viewBox')).toBe(before)
  })

  it('draws the ring of the map itself inside it, where the area does not clip it', async () => {
    const element = await mount()
    const svg = root(element).querySelector<SVGSVGElement>('.lintje-map-chart__svg')!
    svg.setAttribute('tabindex', '-1')
    await keyboardFocus(svg)
    await expect.poll(() => getComputedStyle(svg).outlineOffset).toBe('-3px')
    expect(getComputedStyle(svg).outlineStyle).toBe('solid')
  })
})

// Chromium's own box: a focused SVG element with a tabindex gets it even without
// `:focus-visible`. WebKit does not focus an SVG element on a click.
describe.runIf(server.browser === 'chromium')('a mark the pointer chose', () => {
  it('draws no box around a clicked point', async () => {
    const element = await mount()
    await userEvent.click(mark(element, 'utr'))
    expect(mark(element, 'utr').matches(':focus')).toBe(true)
    expect(getComputedStyle(mark(element, 'utr')).outlineStyle).toBe('none')
  })

  it('draws no box around a clicked area, and the outline when the keyboard reaches it', async () => {
    const element = await mount({
      variant: 'choropleth',
      values: [{ id: 'NL', label: 'Nederland', value: 5 }],
    })
    const area = mark(element, 'NL') as SVGElement
    await userEvent.click(area)
    expect(area.matches(':focus')).toBe(true)
    expect(getComputedStyle(area).outlineStyle).toBe('none')
    area.blur()
    await keyboardFocus(area)
    await expect.poll(() => getComputedStyle(area).outlineStyle).toBe('solid')
  })
})

describe('a stacked svg map', () => {
  // A small area in the north-east corner, under the zoom buttons, with the points over it.
  const CORNER_ZONE = {
    id: 'zone',
    label: 'Zone noordoost',
    value: 6,
    polygon: [
      [6.9, 53.3],
      [7.2, 53.3],
      [7.2, 53.5],
      [6.9, 53.5],
    ] as [number, number][],
  }
  const stacked = (): Promise<MapTile> =>
    mount({
      variant: 'plots',
      values: [],
      plots: [
        { variant: 'polygons', unit: 'meldingen', values: [CORNER_ZONE] },
        { variant: 'points', values: [MIDDLE, SOUTH] },
      ],
    })

  it('moves an area the keyboard reaches out from under the zoom buttons', async () => {
    const element = await stacked()
    expect(overlaps(mark(element, 'zone').getBoundingClientRect(), zoomButtons(element))).toBe(true)
    await keyboardFocus(mark(element, 'zone'))
    await element.updateComplete
    await settle()
    expect(overlaps(mark(element, 'zone').getBoundingClientRect(), zoomButtons(element))).toBe(
      false,
    )
  })

  it('rings a focused area around its shape, in the focus colour', async () => {
    const element = await stacked()
    await keyboardFocus(mark(element, 'zone'))
    const ring = mark(element, 'zone').querySelector('.lintje-map-chart__polygon-ring')!
    // 3 px outside the 1 px gap the shape's edge leaves in the surface: 2 × 3 + 2.
    await expect.poll(() => getComputedStyle(ring).strokeWidth).toBe('8px')
    expect(getComputedStyle(ring).stroke).not.toBe('none')
    expect(getComputedStyle(mark(element, 'zone')).outlineStyle).toBe('none')
  })

  it('takes Tab through the layers in the order they are stacked', async () => {
    const element = await stacked()
    const ids = [...root(element).querySelectorAll('[tabindex="0"][data-mark-id]')].map((node) =>
      node.getAttribute('data-mark-id'),
    )
    expect(ids).toEqual(['zone', 'utr', 'maa'])
  })
})

describe('the map on a basemap', () => {
  const ready = async (element: MapTile): Promise<void> => {
    await expect.poll(() => root(element).querySelectorAll('[data-mark-id]').length).toBe(3)
  }

  it('draws the ring of the focused map inside it', async () => {
    const element = await mount({ basemap: BASEMAP })
    await ready(element)
    const container = root(element).querySelector<HTMLElement>('.leaflet-container')!
    await keyboardFocus(container)
    await expect.poll(() => getComputedStyle(container).outlineOffset).toBe('-3px')
    expect(getComputedStyle(container).outlineStyle).toBe('solid')
  })

  it('draws a focused flow at full strength, also beside the chosen one', async () => {
    const element = await mount({
      basemap: BASEMAP,
      variant: 'flows',
      destination: { lon: 4.9, lat: 52.37, label: 'Amsterdam' },
      selectedId: 'utr',
    })
    await ready(element)
    const flow = mark(element, 'maa')
    await expect.poll(() => flow.classList.contains('is-muted')).toBe(true)
    await keyboardFocus(flow)
    await expect.poll(() => getComputedStyle(flow).opacity).toBe('1')
  })

  it('keeps the focused mark across a render: the map is built once', async () => {
    const element = await mount({ basemap: BASEMAP })
    await ready(element)
    const before = mark(element, 'gro')
    await keyboardFocus(before)
    ;(element as unknown as { requestUpdate(): void }).requestUpdate()
    await element.updateComplete
    await settle()
    expect(mark(element, 'gro')).toBe(before)
    expect(root(element).activeElement).toBe(before)
  })

  it('pans a mark the keyboard reaches out from under the zoom buttons', async () => {
    const element = await mount({ basemap: BASEMAP })
    await ready(element)
    await expect
      .poll(() => overlaps(mark(element, 'gro').getBoundingClientRect(), zoomButtons(element)))
      .toBe(true)
    await keyboardFocus(mark(element, 'gro'))
    await expect
      .poll(() => overlaps(mark(element, 'gro').getBoundingClientRect(), zoomButtons(element)))
      .toBe(false)
  })

  it('pans a mark the zoomed view has clipped off into the view', async () => {
    const element = await mount({ basemap: BASEMAP })
    await ready(element)
    const zoomIn = root(element).querySelector<HTMLButtonElement>('.lintje-map-chart__zoom-button')!
    zoomIn.click()
    zoomIn.click()
    zoomIn.click()
    const container = root(element).querySelector('.leaflet-container')!
    const maastricht = mark(element, 'maa')
    await expect
      .poll(() => inside(maastricht.getBoundingClientRect(), container.getBoundingClientRect()))
      .toBe(false)
    await keyboardFocus(maastricht)
    await expect
      .poll(() => inside(maastricht.getBoundingClientRect(), container.getBoundingClientRect()))
      .toBe(true)
  })
})
