/**
 * The map's surface: Leaflet, with the design system's own drawing in its svg. Leaflet lays a
 * map out in any box that reports a size, so the container here reports one and the projection
 * runs as in a browser; what has no layout — where a mark stands — is stubbed per test.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LeafletSurface, type LeafletSyncOptions } from './leaflet'
import { ChartController } from '../shared/controller'

const BASEMAP = { kind: 'wms' as const, url: 'https://x/wms', layers: 'l', attribution: 'x' }

const DATA = {
  variant: 'points' as const,
  geo: 'netherlands' as const,
  description: 'Loketten.',
  seriesLabels: { 'dark-yellow': 'Boven norm' },
  values: [
    {
      id: 'ein',
      label: 'Eindhoven',
      value: 21,
      lon: 5.39,
      lat: 51.45,
      series: 'dark-yellow' as const,
    },
    { id: 'rtm', label: 'Rotterdam', value: 8, lon: 4.44, lat: 51.96 },
  ],
}

interface Surface {
  instance: LeafletSurface
  container: HTMLElement
  area: HTMLElement
  options: LeafletSyncOptions
}

function surface(options: Partial<LeafletSyncOptions> = {}, data: unknown = DATA): Surface {
  const instance = new LeafletSurface(new ChartController(() => {}))
  const container = document.createElement('div')
  Object.defineProperty(container, 'clientWidth', { value: 600 })
  Object.defineProperty(container, 'clientHeight', { value: 400 })
  // The map area: the container and, top right, the zoom buttons over it.
  const area = document.createElement('div')
  const zoom = document.createElement('div')
  zoom.className = 'lintje-map-chart__zoom'
  zoom.getBoundingClientRect = () =>
    ({ left: 552, right: 600, top: 8, bottom: 152, width: 48, height: 144 }) as DOMRect
  area.append(container, zoom)
  document.body.append(area)
  const full: LeafletSyncOptions = {
    unit: 'min',
    active: null,
    hidden: [],
    hiddenLayers: [],
    area: null,
    chosen: [],
    tool: null,
    drawn: () => {},
    stopTool: () => {},
    drag: true,
    zoom: true,
    scale: false,
    select: () => {},
    clear: () => {},
    mobile: false,
    ...options,
  }
  instance.attach(container)
  instance.sync(data as never, full)
  return { instance, container, area, options: full }
}

const mark = (container: HTMLElement, id: string): SVGElement =>
  container.querySelector<SVGElement>(`[data-mark-id="${id}"]`)!

/** A mark at a place in the map's pixels, which happy-dom cannot measure. */
function standAt(element: Element, box: { left: number; top: number; size: number }): void {
  element.getBoundingClientRect = () =>
    ({
      left: box.left,
      top: box.top,
      right: box.left + box.size,
      bottom: box.top + box.size,
      width: box.size,
      height: box.size,
    }) as DOMRect
}

/** The focus as the keyboard gives it: happy-dom answers `:focus-visible` from the document only. */
function keyboardFocus(element: Element): void {
  Object.defineProperty(element, 'matches', {
    value: (selector: string) => selector === ':focus-visible',
  })
  element.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
}

describe('the map surface', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it("undoes the selection on the map's own click, not on one on a mark", () => {
    const clear = vi.fn()
    const select = vi.fn()
    const { container } = surface({ clear, select })
    mark(container, 'ein').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(select).toHaveBeenCalledWith(expect.objectContaining({ id: 'ein' }))
    expect(clear).not.toHaveBeenCalled()
    container.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(clear).toHaveBeenCalled()
  })

  it('draws every mark once, as a symbol with the shape of its series, placed by the surface', () => {
    const { container } = surface()
    const points = container.querySelectorAll('.lintje-map-chart__point')
    expect(points).toHaveLength(2)
    const ein = mark(container, 'ein')
    expect(ein.classList.contains('lintje-map-chart__symbol')).toBe(true)
    expect(ein.style.transform).toMatch(/^translate\([\d.-]+px, [\d.-]+px\) scale\(1\)$/)
    expect(ein.getAttribute('aria-label')).toBe('Eindhoven: 21 min, Boven norm')
    // A square, never a circle's arcs.
    const shape = ein.querySelector('.lintje-map-chart__point-shape')!
    expect(shape.getAttribute('d')).not.toContain(' a ')
    // The land of the geometry, under the marks.
    expect(container.querySelector('.lintje-map-chart__land')).not.toBeNull()
  })

  it('draws a point without a figure at the fixed size, hatched, never as a dot of zero', () => {
    const { container } = surface(
      {},
      {
        ...DATA,
        values: [...DATA.values, { id: 'gap', label: 'Gat', value: null, lon: 5, lat: 52 }],
      },
    )
    const gap = mark(container, 'gap')
    expect(gap.querySelector('.lintje-map-chart__point-hatch')?.getAttribute('fill')).toMatch(
      /^url\(#map-hatch-/,
    )
    // Radius 6: the shape spans 12.
    expect(gap.querySelector('.lintje-map-chart__point-shape')?.getAttribute('d')).toContain('6')
  })

  it('scales the drawing to the zoom and the symbols back, so a point keeps its size', () => {
    const { instance, container } = surface()
    const group = container.querySelector('.lintje-map-chart__data')!
    expect(group.getAttribute('transform')).toMatch(/ scale\(1\)$/)
    instance.zoomIn()
    expect(group.getAttribute('transform')).toMatch(/ scale\(2\)$/)
    expect(mark(container, 'ein').style.transform).toMatch(/ scale\(0\.5\)$/)
    expect(
      container.querySelector('.lintje-map-chart__hatch')?.getAttribute('patternTransform'),
    ).toBe('rotate(45) scale(0.5)')
  })

  it('draws the credit with a basemap only, and leaves the land to its tiles', () => {
    const plain = surface()
    expect(plain.container.querySelector('.leaflet-control-attribution')).toBeNull()
    expect(plain.container.querySelectorAll('.lintje-map-chart__land')).toHaveLength(1)
    const tiled = surface({}, { ...DATA, basemap: BASEMAP })
    expect(tiled.container.querySelector('.leaflet-control-attribution')?.textContent).toContain(
      'x',
    )
    expect(tiled.container.querySelectorAll('.lintje-map-chart__land')).toHaveLength(0)
    const classes = surface(
      {},
      {
        ...DATA,
        basemap: BASEMAP,
        variant: 'choropleth',
        values: [{ id: 'NL', label: 'Nederland', value: 3 }],
      },
    )
    // A choropleth's area is drawn as an area with a row, over the tiles; the land is not.
    expect(classes.container.querySelectorAll('.lintje-map-chart__land')).toHaveLength(0)
    expect(classes.container.querySelectorAll('.lintje-map-chart__polygon')).toHaveLength(1)
  })

  it('pans a mark the keyboard reaches under an overlay clear of it, by the shortest way', () => {
    const { instance, container } = surface({}, { ...DATA, values: [DATA.values[1]] })
    const rtm = mark(container, 'rtm')
    // Radius 18 around x 580: under the buttons, which start at 552.
    standAt(rtm, { left: 562, top: 2, size: 36 })
    const spy = vi.spyOn(instance.map!, 'panBy').mockReturnValue(instance.map!)
    keyboardFocus(rtm)
    expect(spy).toHaveBeenCalledTimes(1)
    const [x, y] = spy.mock.calls[0]![0] as [number, number]
    // The mark ends 8 px before the buttons.
    expect(x).toBe(54)
    expect(y).toBe(-0)
  })

  it('leaves the view alone on a focus from the pointer', () => {
    const { instance, container } = surface({}, { ...DATA, values: [DATA.values[1]] })
    const rtm = mark(container, 'rtm')
    standAt(rtm, { left: 562, top: 2, size: 36 })
    const spy = vi.spyOn(instance.map!, 'panBy')
    rtm.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(spy).not.toHaveBeenCalled()
  })
})
