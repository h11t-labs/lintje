/**
 * The Leaflet surface's half of the selection.
 *
 * Leaflet is imperative and needs a real box to lay a map out, which happy-dom
 * has not got — so the library is stubbed here and what is checked is the wiring
 * this file owns: which Leaflet event undoes a selection (the map's own `click`,
 * which Leaflet does not fire after a drag — so a pan leaves the selection
 * alone), that a click on a mark selects instead of clearing, and that a point
 * with a series is drawn as a marker carrying that series' shape.
 */
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

interface Handlers {
  [name: string]: (() => void)[]
}

const handlers: Handlers = {}
const added: { kind: string; options: Record<string, unknown>; element: HTMLElement }[] = []
const panned: unknown[][] = []

function on(this: unknown, names: string, fn: () => void): unknown {
  for (const name of names.split(' ')) (handlers[name] ??= []).push(fn)
  return this
}

function layer(kind: string, options: Record<string, unknown> = {}) {
  const element = document.createElement('div')
  const self = {
    kind,
    options,
    on,
    addTo: () => self,
    bindTooltip: () => self,
    getElement: () => element,
    remove: () => {},
    getLayers: () => [self],
    // A circle stands at (580, 20) in the map's pixels: under the zoom buttons.
    ...(kind === 'circle'
      ? { getLatLng: () => ({ lat: 0, lng: 0 }), getRadius: () => options.radius as number }
      : {}),
  }
  added.push({ kind, options, element })
  return self
}

vi.mock('leaflet', () => {
  class Path {}
  class GeoJSON {}
  const map = {
    on,
    dragging: { enable: () => {}, disable: () => {} },
    attributionControl: { setPrefix: () => {} },
    getPane: () => null,
    fitBounds: () => {},
    setView: () => {},
    getCenter: () => ({ lat: 0, lng: 0 }),
    invalidateSize: () => {},
    getZoom: () => 1,
    getSize: () => ({ x: 600, y: 400 }),
    latLngToContainerPoint: () => ({ x: 580, y: 20 }),
    panBy: (...args: unknown[]) => panned.push(args),
    panTo: () => {},
    removeLayer: () => {},
    remove: () => {},
  }
  return {
    Path,
    GeoJSON,
    svg: () => ({}),
    map: () => map,
    layerGroup: () => ({ ...layer('group'), addTo: () => layer('group') }),
    tileLayer: { wms: () => layer('tiles') },
    circleMarker: (_at: unknown, options: Record<string, unknown>) => layer('circle', options),
    marker: (_at: unknown, options: Record<string, unknown>) => layer('marker', options),
    polyline: (_at: unknown, options: Record<string, unknown>) => layer('line', options),
    polygon: (ring: unknown, options: Record<string, unknown>) =>
      layer('polygon', { ...options, ring }),
    geoJSON: () => layer('geojson'),
    divIcon: (options: Record<string, unknown>) => ({ options }),
  }
})

const BASEMAP = { kind: 'wms' as const, url: 'https://x/wms', layers: 'l', attribution: 'x' }

const DATA = {
  variant: 'points' as const,
  geo: 'netherlands' as const,
  description: 'Loketten.',
  basemap: BASEMAP,
  seriesLabels: { a: 'Op norm', b: 'Boven norm' },
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

async function surface(options: Record<string, unknown>, data: unknown = DATA) {
  const { LeafletSurface } = await import('./leaflet')
  const { ChartController } = await import('../shared/controller')
  const instance = new LeafletSurface(new ChartController(() => {}))
  // happy-dom lays nothing out, and the surface only builds on a box that has a
  // size — the very guard that keeps a real map off a 0 × 0 container.
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
  instance.attach(container)
  instance.sync(
    data as never,
    {
      unit: 'min',
      active: null,
      select: () => {},
      clear: () => {},
      mobile: false,
      ...options,
    } as never,
  )
  return instance
}

describe('the leaflet surface', () => {
  beforeEach(() => {
    for (const name of Object.keys(handlers)) delete handlers[name]
    added.length = 0
    panned.length = 0
  })

  it("undoes the selection on the map's own click", async () => {
    const clear = vi.fn()
    await surface({ clear })
    for (const fn of handlers.click ?? []) fn()
    expect(clear).toHaveBeenCalled()
  })

  it('does not undo it on a pan or a zoom', async () => {
    const clear = vi.fn()
    await surface({ clear })
    for (const name of ['moveend', 'zoomend', 'dragend', 'mouseup', 'movestart']) {
      for (const fn of handlers[name] ?? []) fn()
    }
    expect(clear).not.toHaveBeenCalled()
  })

  it('keeps every drawn path from bubbling its click to the map', async () => {
    // A Leaflet path bubbles `click` to the map by default, and the map's click
    // is what clears — so a plain point, a flow or an area would select and
    // deselect in one gesture. Only `L.Marker` is silent by default.
    await surface({})
    for (const entry of added.filter((e) => ['circle', 'line', 'geojson'].includes(e.kind))) {
      expect(entry.options.bubblingMouseEvents).toBe(false)
    }
    expect(added.some((e) => e.kind === 'circle')).toBe(true)
  })

  it('draws a point with a series as a marker with that shape, and one without as a circle', async () => {
    await surface({})
    const marker = added.find((entry) => entry.kind === 'marker')
    const circle = added.find((entry) => entry.kind === 'circle')
    expect(marker).toBeDefined()
    expect(circle).toBeDefined()
    const icon = marker!.options.icon as { options: { html: string } }
    expect(icon.options.html).toContain('lintje-map-leaflet__mark-shape')
    // A square (series b), never a circle's arcs — and no `style=`, which the
    // host's CSP would throw away.
    expect(icon.options.html).not.toContain(' a ')
    expect(icon.options.html).not.toContain('style=')
  })

  it('draws a point without a figure at the fixed size, hatched, never as a dot of zero', async () => {
    await surface(
      {},
      {
        ...DATA,
        values: [...DATA.values, { id: 'gap', label: 'Gat', value: null, lon: 5, lat: 52 }],
      },
    )
    const circles = added.filter((entry) => entry.kind === 'circle')
    const missing = circles.find((entry) => String(entry.options.className).includes('no-data'))
    expect(missing?.options.radius).toBe(6)
    expect(String(missing?.options.fillColor)).toMatch(/^url\(#map-hatch-/)
  })

  it('pans a mark the keyboard reaches under an overlay clear of it, by the shortest way', async () => {
    await surface({}, { ...DATA, seriesLabels: undefined, values: [DATA.values[1]] })
    const circle = added.find((entry) => entry.kind === 'circle')!
    // happy-dom answers `:focus-visible` from the document's active element only.
    Object.defineProperty(circle.element, 'matches', {
      value: (selector: string) => selector === ':focus-visible',
    })
    circle.element.dispatchEvent(new FocusEvent('focus'))
    // Radius 18 around x 580; the buttons start at 552, and the mark ends 8 px before them.
    expect(panned).toHaveLength(1)
    const [x, y] = panned[0]![0] as [number, number]
    expect(x).toBe(54)
    expect(y).toBeCloseTo(0)
  })

  it('leaves the view alone on a focus from the pointer', async () => {
    await surface({}, { ...DATA, seriesLabels: undefined, values: [DATA.values[1]] })
    const circle = added.find((entry) => entry.kind === 'circle')!
    circle.element.dispatchEvent(new FocusEvent('focus'))
    expect(panned).toHaveLength(0)
  })

  it('draws the ring of the focused map and of a focused flow where it shows', () => {
    const css = readFileSync(
      resolvePath('src/components/shared/charts/map-chart/leaflet.css'),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, '')
    // The map area clips what stands outside the map, so the ring stands inside it.
    expect(css).toMatch(
      /\.leaflet-container:focus-visible \{[^}]*outline-offset: calc\(var\(--focus-width\) \* -1\);/,
    )
    // At full strength, after the dimmed state of a flow beside the chosen one.
    const muted = css.indexOf('.lintje-map-leaflet__flow.is-muted')
    const focused = css.search(/\.lintje-map-leaflet__flow:focus-visible \{ opacity: 1; \}/)
    expect(focused).toBeGreaterThan(muted)
  })

  it('underlines the links in the credit, which differ from the text around it by colour alone', () => {
    const css = readFileSync(
      resolvePath('src/components/shared/charts/map-chart/leaflet.css'),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css).toMatch(/\.leaflet-control-attribution a\s*\{[^}]*text-decoration: underline;/)
  })

  describe('a stacked map', () => {
    const STACK = {
      variant: 'plots' as const,
      geo: 'netherlands' as const,
      description: 'Zones, stromen en loketten.',
      basemap: BASEMAP,
      values: [],
      unit: 'aanvragen',
      plots: [
        {
          variant: 'polygons' as const,
          unit: 'meldingen',
          values: [
            {
              id: 'oost',
              label: 'Zone oost',
              value: 12,
              polygon: [
                [6.2, 52.2],
                [6.8, 52.2],
                [6.8, 52.8],
              ] as [number, number][],
            },
            {
              id: 'west',
              label: 'Zone west',
              value: null,
              polygon: [
                [4.2, 51.6],
                [4.6, 51.6],
                [4.6, 51.9],
              ] as [number, number][],
            },
            { id: 'leeg', label: 'Zonder ring', value: 3, polygon: [] as [number, number][] },
          ],
        },
        {
          variant: 'flows' as const,
          destination: { lon: 4.3, lat: 52.08, label: 'Den Haag' },
          values: [{ id: 'ein-dh', label: 'Eindhoven', value: 40, lon: 5.39, lat: 51.45 }],
        },
        { variant: 'points' as const, unit: 'min', values: [DATA.values[1]] },
        // Last in the list, and still the bottom: a choropleth is the land.
        { variant: 'choropleth' as const, values: [{ id: 'NL', label: 'Nederland', value: 4 }] },
      ],
    }

    it('draws the layers in order, an area per ring turned to [lat, lon]', async () => {
      await surface({}, STACK)
      const drawn = added.filter((entry) =>
        ['geojson', 'polygon', 'line', 'circle'].includes(entry.kind),
      )
      // The flows' destination is a circle too; the ring of fewer than three points draws nothing.
      expect(drawn.map((entry) => entry.kind)).toEqual([
        'geojson',
        'polygon',
        'polygon',
        'line',
        'circle',
        'circle',
      ])
      const [, oost, west] = drawn
      expect((oost!.options.ring as number[][])[0]).toEqual([52.2, 6.2])
      expect(String(oost!.options.className)).toContain('lintje-map-leaflet__area--class-5')
      expect(oost!.options.bubblingMouseEvents).toBe(false)
      // No figure is never zero (rule 15).
      expect(String(west!.options.fillColor)).toMatch(/^url\(#map-hatch-/)
    })

    it("names every mark with the unit of its own layer, or the map's", async () => {
      // The map's unit travels in the options, as `renderMap` hands it over.
      await surface({ unit: 'aanvragen' }, STACK)
      const label = (kind: string, n = 0) =>
        added.filter((entry) => entry.kind === kind)[n]!.element.getAttribute('aria-label')
      expect(label('polygon')).toBe('Zone oost: 12 meldingen')
      expect(label('polygon', 1)).toBe('Zone west: geen gegevens')
      expect(label('line')).toBe('Eindhoven: 40 aanvragen')
      // The first circle is the flows' destination, which is no mark.
      expect(label('circle', 1)).toBe('Rotterdam: 8 min')
    })

    it('keeps one selection, and only the flows step back beside it', async () => {
      await surface({ active: 'oost' }, STACK)
      const element = (kind: string) => added.find((entry) => entry.kind === kind)!.element
      expect(element('polygon').classList.contains('is-selected')).toBe(true)
      expect(element('polygon').getAttribute('aria-pressed')).toBe('true')
      expect(element('line').classList.contains('is-muted')).toBe(true)
      expect(
        added.filter((entry) => entry.kind === 'circle')[1]!.element.classList.contains('is-muted'),
      ).toBe(false)
    })
  })
})
