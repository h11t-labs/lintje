/**
 * The map's focus in a browser: a ring the map area would clip, and a mark the overlays would
 * hide (WCAG 2.4.7, 2.4.11). happy-dom lays nothing out, and Leaflet pans with an animation.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { commands, server, userEvent } from 'vitest/browser'
import './map'
import type { MapData } from '../../../types'

declare module 'vitest/browser' {
  interface BrowserCommands {
    emulateForcedColors: (on: boolean) => Promise<void>
  }
}

type MapElement = HTMLElement & { data: MapData; updateComplete: Promise<unknown> }

// Groningen, the north-east corner of the country, where the zoom buttons stand.
const CORNER = { id: 'gro', label: 'Groningen', value: 4, lon: 7.15, lat: 53.45 }
const MIDDLE = { id: 'utr', label: 'Utrecht', value: 12, lon: 5.12, lat: 52.09 }
const SOUTH = { id: 'maa', label: 'Maastricht', value: 8, lon: 5.69, lat: 50.85 }

const BASEMAP = { kind: 'wms' as const, url: 'https://wms.invalid/', layers: 'x', attribution: 'x' }

async function mount(extra: Partial<MapData> = {}, width = 320): Promise<MapElement> {
  // Narrow, so the country fills the width and its corner reaches the overlays.
  const frame = document.createElement('div')
  frame.style.width = `${width}px`
  const element = document.createElement('lintje-map') as MapElement
  element.data = {
    variant: 'points',
    geo: 'netherlands',
    values: [MIDDLE, CORNER, SOUTH],
    unit: 'aantal',
    description: 'Loketten in Nederland.',
    ...extra,
  } as MapData
  frame.append(element)
  document.body.append(frame)
  await element.updateComplete
  // The map builds once its box is measured, a frame later.
  await expect
    .poll(() => root(element).querySelectorAll('[data-mark-id]').length)
    .toBeGreaterThan(0)
  await settle()
  return element
}

const settle = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve)))

const root = (element: MapElement): ShadowRoot => element.shadowRoot!
const mark = (element: MapElement, id: string): Element =>
  root(element).querySelector(`[data-mark-id="${id}"]`)!
const zoomButtons = (element: MapElement): DOMRect =>
  root(element).querySelector('.lintje-map-chart__zoom')!.getBoundingClientRect()

/** The focus layer over the drawing, and the copy of the focused mark in it. */
const focusLayer = (element: MapElement): Element =>
  root(element).querySelector('.lintje-map-chart__focus')!
const copy = (element: MapElement): Element | null =>
  focusLayer(element).querySelector('.is-focused')

/** A colour token as the browser resolves it, through a probe in the map's own root. */
function resolved(element: MapElement, token: string): string {
  const probe = document.createElement('i')
  probe.style.color = `var(${token})`
  root(element).append(probe)
  const colour = getComputedStyle(probe).color
  probe.remove()
  return colour
}

/** Whether `later` comes after `earlier` in the document, so svg paints it over. */
const paintsOver = (later: Node, earlier: Node): boolean =>
  Boolean(earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING)

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

describe('the map', () => {
  it('moves a mark the keyboard reaches out from under the zoom buttons', async () => {
    const element = await mount()
    expect(overlaps(mark(element, 'gro').getBoundingClientRect(), zoomButtons(element))).toBe(true)
    await keyboardFocus(mark(element, 'gro'))
    await expect
      .poll(() => overlaps(mark(element, 'gro').getBoundingClientRect(), zoomButtons(element)))
      .toBe(false)
    const area = root(element).querySelector('.lintje-map-chart__area')!.getBoundingClientRect()
    expect(inside(mark(element, 'gro').getBoundingClientRect(), area)).toBe(true)
  })

  it('draws the ring of the map itself inside it, where the area does not clip it', async () => {
    const element = await mount()
    const container = root(element).querySelector<HTMLElement>('.leaflet-container')!
    await keyboardFocus(container)
    // A layer over the panes, inside the map: an outline would lie under them.
    await expect.poll(() => getComputedStyle(container, '::after').borderTopStyle).toBe('solid')
    expect(getComputedStyle(container, '::after').borderTopWidth).toBe('3px')
    expect(getComputedStyle(container, '::after').zIndex).toBe('1000')
  })

  it('lays a focused point over a later point that covers it, and keeps the focus on it', async () => {
    // Two points on one spot: the first is drawn first, the second over it.
    const element = await mount({
      values: [MIDDLE, { ...MIDDLE, id: 'utr-2', label: 'Utrecht 2', value: 10 }],
    })
    const first = mark(element, 'utr') as SVGElement
    await keyboardFocus(first)
    await expect.poll(() => copy(element)).not.toBeNull()
    const ring = copy(element)!.querySelector('.lintje-map-chart__point-ring')!
    expect(paintsOver(ring, mark(element, 'utr-2'))).toBe(true)
    expect(getComputedStyle(ring).stroke).toBe(resolved(element, '--color-focus'))
    expect(getComputedStyle(ring).strokeWidth).toBe('8px')
    // The copy is only drawn: no button, no stop, nothing a reader hears.
    expect(copy(element)!.hasAttribute('tabindex')).toBe(false)
    expect(copy(element)!.hasAttribute('data-mark-id')).toBe(false)
    expect(focusLayer(element).getAttribute('aria-hidden')).toBe('true')
    expect(root(element).activeElement).toBe(first)
    first.blur()
    await expect.poll(() => copy(element)).toBeNull()
  })

  it('leaves the page in the middle of a zoom without an error', async () => {
    const element = await mount()
    // Vitest only fails the run on an uncaught error; the test hears it itself.
    const errors: unknown[] = []
    const record = (event: ErrorEvent): void => {
      errors.push(event.error)
      event.preventDefault()
    }
    window.addEventListener('error', record)
    try {
      root(element).querySelector<HTMLButtonElement>('.lintje-map-chart__zoom-button')!.click()
      // Leaflet starts the animation a frame later and ends it on a 250 ms timer.
      await new Promise((resolve) => requestAnimationFrame(resolve))
      element.remove()
      await new Promise((resolve) => setTimeout(resolve, 400))
    } finally {
      window.removeEventListener('error', record)
    }
    expect(errors).toEqual([])
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
    expect(copy(element)).toBeNull()
  })

  it('draws no box around a clicked area of the geometry, and its ring when the keyboard reaches it', async () => {
    const element = await mount({
      variant: 'choropleth',
      values: [{ id: 'NL', label: 'Nederland', value: 5 }],
    })
    const area = mark(element, 'NL') as SVGElement
    await userEvent.click(area)
    expect(area.matches(':focus')).toBe(true)
    expect(getComputedStyle(area).outlineStyle).toBe('none')
    const ring = area.querySelector('.lintje-map-chart__polygon-ring')!
    expect(getComputedStyle(ring).stroke).toBe('none')
    area.blur()
    await keyboardFocus(area)
    await expect.poll(() => getComputedStyle(area).outlineStyle).toBe('none')
    expect(getComputedStyle(ring).stroke).not.toBe('none')
  })
})

describe('a stacked map', () => {
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
  const stacked = (): Promise<MapElement> =>
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
    await expect
      .poll(() => overlaps(mark(element, 'zone').getBoundingClientRect(), zoomButtons(element)))
      .toBe(false)
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

  it('lays the ring of a focused area over the area that shares its edge', async () => {
    const WEST = {
      id: 'west',
      label: 'Zone west',
      value: 3,
      polygon: [
        [5.0, 52.0],
        [5.6, 52.0],
        [5.6, 52.5],
        [5.0, 52.5],
      ] as [number, number][],
    }
    const EAST = {
      ...WEST,
      id: 'east',
      label: 'Zone oost',
      value: 9,
      polygon: [
        [5.6, 52.0],
        [6.2, 52.0],
        [6.2, 52.5],
        [5.6, 52.5],
      ] as [number, number][],
    }
    const element = await mount({ variant: 'polygons', values: [WEST, EAST] })
    const west = mark(element, 'west')
    await keyboardFocus(west)
    await expect.poll(() => copy(element)).not.toBeNull()
    const ring = copy(element)!.querySelector('.lintje-map-chart__polygon-ring')!
    expect(ring.getAttribute('d')).toBe(
      west.querySelector('.lintje-map-chart__polygon-ring')!.getAttribute('d'),
    )
    // Nothing drawn after the copy: the east zone and every other mark lie under it.
    expect(paintsOver(ring, mark(element, 'east'))).toBe(true)
    expect(getComputedStyle(ring).stroke).toBe(resolved(element, '--color-focus'))
    expect(getComputedStyle(ring).strokeWidth).toBe('8px')
    expect(root(element).activeElement).toBe(west)
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
  const ready = async (element: MapElement): Promise<void> => {
    await expect.poll(() => root(element).querySelectorAll('[data-mark-id]').length).toBe(3)
  }

  it('draws the ring of the focused map inside it', async () => {
    const element = await mount({ basemap: BASEMAP })
    await ready(element)
    const container = root(element).querySelector<HTMLElement>('.leaflet-container')!
    await keyboardFocus(container)
    // A layer over the panes, inside the map: an outline would lie under them.
    await expect.poll(() => getComputedStyle(container, '::after').borderTopStyle).toBe('solid')
    expect(getComputedStyle(container, '::after').borderTopWidth).toBe('3px')
    expect(getComputedStyle(container, '::after').zIndex).toBe('1000')
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
    await expect.poll(() => getComputedStyle(flow).opacity).toBe('0.22')
    await keyboardFocus(flow)
    await expect.poll(() => getComputedStyle(flow).opacity).toBe('1')
  })

  it('rings a focused flow of the smallest width 3 px outside a 1 px gap, in its own colour', async () => {
    const element = await mount({
      basemap: BASEMAP,
      variant: 'flows',
      destination: { lon: 4.9, lat: 52.37, label: 'Amsterdam' },
      values: [MIDDLE, CORNER, { ...SOUTH, value: 0 }],
    })
    await ready(element)
    const flow = mark(element, 'maa')
    await keyboardFocus(flow)
    const line = flow.querySelector('.lintje-map-chart__flow-line')!
    const ring = flow.querySelector('.lintje-map-chart__flow-ring')!
    const gap = flow.querySelector('.lintje-map-chart__flow-gap')!
    await expect.poll(() => getComputedStyle(ring).strokeWidth).toBe('9px')
    // A line of 1 px, a gap of 1 px either side, and 3 px of ring outside that.
    expect(getComputedStyle(line).strokeWidth).toBe('1px')
    expect(getComputedStyle(gap).strokeWidth).toBe('3px')
    expect(getComputedStyle(ring).stroke).toBe(resolved(element, '--color-focus'))
    expect(getComputedStyle(gap).stroke).toBe(resolved(element, '--color-bg-surface'))
    expect(getComputedStyle(line).stroke).toBe(resolved(element, '--color-chart-default'))
    // Its opacity fades in over the hover duration, also under reduced motion.
    await expect.poll(() => getComputedStyle(flow).opacity).toBe('1')
    // Its copy lies over every other flow.
    await expect.poll(() => copy(element)).not.toBeNull()
    expect(paintsOver(copy(element)!, mark(element, 'gro'))).toBe(true)
    expect(getComputedStyle(copy(element)!).opacity).toBe('1')
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

describe('an emphasised area of the geometry', () => {
  // Gelderland and Utrecht first: their neighbours are drawn after them, over their edge.
  const PROVINCES: MapData['values'] = [
    { id: 'NL-GE', label: 'Gelderland', value: 9 },
    { id: 'NL-UT', label: 'Utrecht', value: 4 },
    { id: 'NL-NB', label: 'Noord-Brabant', value: 6 },
    { id: 'NL-ZH', label: 'Zuid-Holland', value: 7 },
    { id: 'NL-NH', label: 'Noord-Holland', value: 8 },
    { id: 'NL-FL', label: 'Flevoland', value: 2 },
    { id: 'NL-OV', label: 'Overijssel', value: 5 },
    { id: 'NL-LI', label: 'Limburg', value: 3 },
  ]
  const provinces = (extra: Partial<MapData> = {}): Promise<MapElement> =>
    mount({ variant: 'choropleth', geo: 'provinces', values: PROVINCES, ...extra }, 640)
  const shape = (element: MapElement, id: string): SVGPathElement =>
    mark(element, id).querySelector('.lintje-map-chart__polygon-shape')!

  /** The lifted outline of an area: a copy of its shape over every mark of the drawing. */
  function outlineOver(element: MapElement, id: string, state: string): SVGPathElement {
    const lifted = focusLayer(element).querySelector(`.lintje-map-chart__polygon.${state}`)!
    const outline = lifted.querySelector<SVGPathElement>('.lintje-map-chart__polygon-shape')!
    expect(outline.getAttribute('d')).toBe(shape(element, id).getAttribute('d'))
    for (const other of root(element).querySelectorAll('.lintje-map-chart__data [data-mark-id]'))
      expect(paintsOver(outline, other), other.getAttribute('data-mark-id')!).toBe(true)
    // The outline alone: the fill stays the drawing's, and no ring or hatch is drawn again.
    expect(getComputedStyle(outline).fill).toBe('none')
    expect(getComputedStyle(lifted.querySelector('.lintje-map-chart__polygon-ring')!).display).toBe(
      'none',
    )
    expect(lifted.hasAttribute('data-mark-id')).toBe(false)
    return outline
  }

  /** A point inside an area where the pointer reaches it, not a neighbour or a gap. */
  function pointIn(element: MapElement, id: string): { x: number; y: number } {
    const target = shape(element, id)
    const box = target.getBoundingClientRect()
    for (let step = 0; step < 400; step++) {
      // Out from the middle of the box, in a widening square.
      const ring = Math.floor(Math.sqrt(step))
      const x = box.left + box.width / 2 + ((step % 7) - 3) * ring * 3
      const y = box.top + box.height / 2 + ((Math.floor(step / 7) % 7) - 3) * ring * 3
      if (root(element).elementFromPoint(x, y) === target)
        return { x: x - box.left, y: y - box.top }
    }
    throw new Error(`no point inside ${id}`)
  }

  afterEach(async () => {
    delete document.documentElement.dataset.mode
    await userEvent.unhover(document.body)
  })

  it.each(['light', 'dark'])(
    'lays the outline of the area under the pointer over its neighbours, in %s',
    async (mode) => {
      document.documentElement.dataset.mode = mode
      const element = await provinces()
      // Without the lift, Utrecht and Brabant would cover half of Gelderland's edge.
      expect(paintsOver(mark(element, 'NL-UT'), mark(element, 'NL-GE'))).toBe(true)
      expect(paintsOver(mark(element, 'NL-NB'), mark(element, 'NL-GE'))).toBe(true)
      await userEvent.hover(shape(element, 'NL-GE'), { position: pointIn(element, 'NL-GE') })
      await expect
        .poll(() => focusLayer(element).querySelector('.lintje-map-chart__polygon.is-hovered'))
        .not.toBeNull()
      const outline = outlineOver(element, 'NL-GE', 'is-hovered')
      expect(getComputedStyle(outline).stroke).toBe(resolved(element, '--color-text-primary'))
      expect(getComputedStyle(outline).strokeWidth).toBe('1.5px')
      // The pointer moves on: the outline goes with it.
      await userEvent.hover(shape(element, 'NL-OV'), { position: pointIn(element, 'NL-OV') })
      await expect
        .poll(() =>
          focusLayer(element)
            .querySelector('.is-hovered .lintje-map-chart__polygon-shape')
            ?.getAttribute('d'),
        )
        .toBe(shape(element, 'NL-OV').getAttribute('d'))
      expect(focusLayer(element).querySelectorAll('.is-hovered')).toHaveLength(1)
    },
  )

  it.each(['light', 'dark'])(
    'lays the outline of a chosen area over its neighbours, in %s',
    async (mode) => {
      document.documentElement.dataset.mode = mode
      const element = await provinces({ selectedId: 'NL-UT' })
      await expect.poll(() => mark(element, 'NL-UT').classList.contains('is-selected')).toBe(true)
      const outline = outlineOver(element, 'NL-UT', 'is-selected')
      expect(getComputedStyle(outline).stroke).toBe(resolved(element, '--color-text-primary'))
      expect(getComputedStyle(outline).strokeWidth).toBe('2px')
      // Only what stands out is lifted: the neighbours stay in the drawing alone.
      expect(focusLayer(element).children).toHaveLength(1)
    },
  )

  it('lays the ring of a focused chosen area on top, once', async () => {
    const element = await provinces({ selectedId: 'NL-UT' })
    await keyboardFocus(mark(element, 'NL-UT'))
    await expect.poll(() => copy(element)).not.toBeNull()
    // Its focus copy is the whole mark and stands in for the chosen one.
    expect(focusLayer(element).children).toHaveLength(1)
    const ring = copy(element)!.querySelector('.lintje-map-chart__polygon-ring')!
    expect(getComputedStyle(ring).stroke).toBe(resolved(element, '--color-focus'))
    ;(mark(element, 'NL-UT') as SVGElement).blur()
    await expect.poll(() => copy(element)).toBeNull()
    outlineOver(element, 'NL-UT', 'is-selected')
  })

  // Playwright emulates forced colours in Chromium.
  it.runIf(server.browser === 'chromium')(
    'outlines a chosen area in CanvasText over its neighbours with forced colours',
    async () => {
      await commands.emulateForcedColors(true)
      try {
        const element = await provinces({ selectedId: 'NL-UT' })
        await expect.poll(() => focusLayer(element).children.length).toBe(1)
        const outline = outlineOver(element, 'NL-UT', 'is-selected')
        const probe = document.createElement('i')
        probe.style.color = 'CanvasText'
        document.body.append(probe)
        expect(getComputedStyle(outline).stroke).toBe(getComputedStyle(probe).color)
      } finally {
        await commands.emulateForcedColors(false)
      }
    },
  )
})
