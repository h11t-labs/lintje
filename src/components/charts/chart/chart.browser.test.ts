/**
 * A chart mark in a browser: the scatter plot's one pointer target, and the keyboard's ring,
 * never the box the browser draws on a click. A pie's drawing takes the focus from Tab. The image
 * of a chart: what the screen shows, composed as one `<svg>`, and that as a PNG.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { server, userEvent } from 'vitest/browser'
import { chartImage } from '../../shared/download'
import { TAB } from '../../../core/test-keys'
import './chart'
import type { LintjeChart } from './chart'

async function mount(): Promise<LintjeChart> {
  const tile = document.createElement('lintje-chart')
  tile.data = {
    title: 'Aanvragen per regio',
    description: 'Noord 12, Zuid 8.',
    chart: {
      kind: 'pie',
      segments: [
        { label: 'Noord', value: 12, id: 'noord', href: '/p?r=noord' },
        { label: 'Zuid', value: 8, id: 'zuid', href: '/p?r=zuid' },
      ],
    },
  }
  // The host keeps the page: a mark with an `href` goes there unless its event is cancelled.
  tile.addEventListener('lintje-mark-select', (event) => event.preventDefault())
  document.body.append(tile)
  await tile.updateComplete
  await expect.poll(() => slice(tile)?.getClientRects().length ?? 0).toBeGreaterThan(0)
  return tile
}

const slice = (tile: LintjeChart): SVGElement | null =>
  tile.shadowRoot!.querySelector<SVGElement>('[data-mark-id="noord"]')

afterEach(() => {
  document.body.replaceChildren()
  delete document.documentElement.dataset.mode
  vi.restoreAllMocks()
})

// Two scatter points closer than half of --h-target: each is itself where it is drawn, and the
// space beside it is the nearest point's.
describe('a scatter point under the pointer', () => {
  async function scatter(): Promise<{ tile: LintjeChart; picked: string[] }> {
    const tile = document.createElement('lintje-chart')
    tile.style.display = 'block'
    tile.style.width = '600px'
    tile.data = {
      title: 'Wachttijd tegen drukte',
      description: 'Breda en Zwolle liggen dicht bij elkaar.',
      chart: {
        kind: 'scatter',
        axisTitle: 'wachttijd',
        xTitle: 'aanvragen',
        series: [
          {
            label: 'Loket',
            points: [
              { label: 'Breda', x: 100, y: 6, id: 'bda', href: '?loket=bda' },
              { label: 'Zwolle', x: 104, y: 6, id: 'zwo', href: '?loket=zwo' },
            ],
          },
        ],
      },
    }
    const picked: string[] = []
    tile.addEventListener('lintje-mark-select', (event) => {
      event.preventDefault()
      picked.push(String((event as CustomEvent<{ id: string | null }>).detail.id))
    })
    document.body.append(tile)
    await tile.updateComplete
    await expect.poll(() => point(tile, 'zwo')?.getClientRects().length ?? 0).toBeGreaterThan(0)
    return { tile, picked }
  }

  const point = (tile: LintjeChart, id: string): SVGElement | null =>
    tile.shadowRoot!.querySelector<SVGElement>(`[data-mark-id="${id}"]`)

  const centre = (element: Element) => {
    const box = element.getBoundingClientRect()
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
  }

  it('is itself where it is drawn, for the hit test, the tooltip and the click', async () => {
    const { tile, picked } = await scatter()
    const breda = point(tile, 'bda')!
    const zwolle = point(tile, 'zwo')!
    const gap = centre(zwolle).x - centre(breda).x
    expect(gap).toBeGreaterThan(9)
    expect(gap).toBeLessThan(24)
    for (const [mark, label] of [
      [breda, 'Breda'],
      [zwolle, 'Zwolle'],
    ] as const) {
      const { x, y } = centre(mark)
      expect(tile.shadowRoot!.elementFromPoint(x, y)).toBe(mark)
      await userEvent.hover(mark)
      await expect
        .poll(() => tile.shadowRoot!.querySelector('.lintje-chart-tooltip__title')?.textContent)
        .toBe(label)
      await userEvent.click(mark)
    }
    expect(picked).toEqual(['bda', 'zwo'])
  })

  it('gives the space beside a point to it, within half of --h-target', async () => {
    const { tile, picked } = await scatter()
    const target = tile.shadowRoot!.querySelector<SVGElement>('.lintje-chart__hit')!
    const box = target.getBoundingClientRect()
    const breda = centre(point(tile, 'bda')!)
    await userEvent.click(target, {
      position: { x: breda.x - box.left - 12, y: breda.y - box.top },
    })
    expect(picked).toEqual(['bda'])
  })
})

// Chromium's own box: a focused SVG element with a tabindex gets it even without
// `:focus-visible`. WebKit does not focus an SVG element on a click.
describe.runIf(server.browser === 'chromium')('a clickable mark', () => {
  it('draws no box when the pointer chooses it, and its ring when the keyboard reaches it', async () => {
    const tile = await mount()
    const mark = slice(tile)!
    await userEvent.click(mark)
    expect(mark.matches(':focus')).toBe(true)
    expect(getComputedStyle(mark).outlineStyle).toBe('none')
    mark.blur()
    await userEvent.keyboard('{Shift}')
    mark.focus()
    expect(mark.matches(':focus-visible')).toBe(true)
    expect(getComputedStyle(mark).outlineStyle).toBe('none')
    expect(getComputedStyle(mark).filter).not.toBe('none')
  })
})

describe('the image of a chart', () => {
  async function place(data: LintjeChart['data'], width: number): Promise<LintjeChart> {
    const tile = document.createElement('lintje-chart')
    tile.style.display = 'block'
    tile.style.width = `${width}px`
    tile.data = data
    document.body.append(tile)
    await tile.updateComplete
    await expect.poll(() => drawing(tile)?.getClientRects().length ?? 0).toBeGreaterThan(0)
    // The drawing settles on its measured width a frame later.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    await tile.updateComplete
    return tile
  }

  const drawing = (tile: LintjeChart) =>
    tile.shadowRoot!.querySelector<SVGSVGElement>('.lintje-chart__svg, .lintje-pie-chart__svg')

  /** What renderChart drew in the tile: the image's root. */
  const chartOf = (tile: LintjeChart): Element =>
    tile.shadowRoot!.querySelector(
      'lintje-tile > .lintje-chart-wrap, lintje-tile > .lintje-pie-chart',
    )!

  /** The image's own text, apart from the drawing's, with where it stands. */
  const texts = (image: SVGSVGElement) =>
    [...image.querySelectorAll('text')]
      .filter((text) => text.closest('svg') === image)
      .map((text) => ({ text, content: text.textContent ?? '', y: Number(text.getAttribute('y')) }))

  const at = (image: SVGSVGElement, content: string) => {
    const found = texts(image).find((text) => text.content.includes(content))
    expect(found, content).toBeDefined()
    return found!
  }

  /** The drawing in the image; a legend's marker is an `<svg>` too. */
  const nested = (image: SVGSVGElement) =>
    image.querySelector<SVGSVGElement>('.lintje-chart__svg, .lintje-pie-chart__svg')!

  const line = () =>
    place(
      {
        title: 'Aanvragen per week',
        description: 'Online stijgt, de balie blijft gelijk.',
        chart: {
          kind: 'line',
          labels: ['wk 1', 'wk 2', 'wk 3', 'wk 4'],
          axisTitle: 'Aanvragen',
          series: [
            { label: 'Online', values: [4, 6, 5, 7] },
            { label: 'Balie', values: [3, 2, 4, 3] },
          ],
          events: [
            { index: 1, label: 'Nieuw formulier' },
            { index: 3, label: 'Storing bij het loket' },
          ],
        },
      },
      600,
    )

  /** The chart's width with the tile's padding and its 1 px edge on both sides. */
  const framed = (root: Element) =>
    root.getBoundingClientRect().width +
    2 * parseFloat(getComputedStyle(root).getPropertyValue('--tile-pad-x')) +
    2

  it('has the tile around it: the title and subtitle above, the footnote under', async () => {
    const tile = await line()
    const image = chartImage(chartOf(tile), {
      title: 'Aanvragen per week',
      subtitle: 'Per kanaal',
      footnote: 'Bron: fictieve demogegevens',
    })
    const title = at(image, 'Aanvragen per week')
    const subtitle = at(image, 'Per kanaal')
    expect(title.y).toBeLessThan(subtitle.y)
    expect(subtitle.y).toBeLessThan(at(image, 'Online').y)
    expect(at(image, 'Bron: fictieve demogegevens').y).toBeGreaterThan(
      at(image, 'Storing bij het loket').y,
    )
    // The title stands in the tile's padding, not against the image's edge.
    const pad = parseFloat(getComputedStyle(chartOf(tile)).getPropertyValue('--tile-pad-x'))
    expect(Number(title.text.getAttribute('x'))).toBeGreaterThanOrEqual(pad)
    // The frame is laid out off screen and gone again.
    const scope = chartOf(tile).getRootNode() as ShadowRoot
    expect([...scope.children].filter((child) => child.localName === 'div')).toHaveLength(0)
  })

  it('has the legend above the drawing, the axis title and the events under it', async () => {
    const tile = await line()
    const root = chartOf(tile)
    const image = chartImage(root)
    // As wide as the chart, and the last x label that stands past it.
    const width = root.getBoundingClientRect().width
    expect(Number(image.getAttribute('width'))).toBeGreaterThanOrEqual(Math.floor(width))
    expect(Number(image.getAttribute('width'))).toBeLessThan(width + 24)
    const top = Number(nested(image).getAttribute('y'))
    const bottom = top + Number(nested(image).getAttribute('height'))
    for (const name of ['Online', 'Balie']) expect(at(image, name).y).toBeLessThan(top)
    expect(at(image, 'Aanvragen').y).toBeGreaterThan(at(image, 'Online').y)
    expect(at(image, 'Aanvragen').y).toBeLessThan(top)
    for (const event of ['Nieuw formulier', 'Storing bij het loket']) {
      expect(at(image, event).y).toBeGreaterThan(bottom)
    }
    // Each event has its numbered square, a box of its own.
    expect(at(image, '1').y).toBeGreaterThan(bottom)
    expect(at(image, '2').y).toBeGreaterThan(bottom)
    // Controls stay off: no tooltip, no status line, no box around a legend button.
    expect(image.querySelector('.lintje-chart-tooltip, [role="status"]')).toBeNull()
    expect(nested(image).querySelector('.lintje-chart__hover-point')).toBeNull()
  })

  it('shows a series switched off in the legend as the legend does, and not in the drawing', async () => {
    const tile = await line()
    const lines = (image: SVGSVGElement) =>
      nested(image).querySelectorAll('.lintje-chart__line:not(.lintje-chart__line--casing)').length
    expect(lines(chartImage(chartOf(tile)))).toBe(2)
    const balie = [...tile.shadowRoot!.querySelectorAll('.lintje-legend__button')].find((button) =>
      button.textContent?.includes('Balie'),
    ) as HTMLButtonElement
    balie.click()
    await tile.updateComplete
    const image = chartImage(chartOf(tile))
    expect(lines(image)).toBe(1)
    expect(at(image, 'Balie').text.getAttribute('text-decoration')).toBe('line-through')
    expect(at(image, 'Online').text.hasAttribute('text-decoration')).toBe(false)
  })

  it('has a pie’s legend table, with its columns, under the pie where the screen has it there', async () => {
    const tile = await place(
      {
        title: 'Aanvragen per regio',
        description: 'Noord 12, Zuid 8.',
        chart: {
          kind: 'pie',
          segments: [
            { label: 'Noord', value: 12 },
            { label: 'Zuid', value: 8 },
          ],
        },
      },
      360,
    )
    const image = chartImage(chartOf(tile))
    const bottom =
      Number(nested(image).getAttribute('y')) + Number(nested(image).getAttribute('height'))
    for (const content of ['AANTAL', '%', 'Noord', 'Zuid', 'Totaal', '20']) {
      expect(at(image, content).y).toBeGreaterThan(bottom)
    }
  })

  it('is drawn on the surface and in the text colours of the mode the reader looks in', async () => {
    document.documentElement.dataset.mode = 'dark'
    const tile = await line()
    const image = chartImage(chartOf(tile))
    const legend = tile.shadowRoot!.querySelector('.lintje-legend__label')!
    expect(image.querySelector(':scope > rect')?.getAttribute('fill')).toBe(
      getComputedStyle(chartOf(tile)).getPropertyValue('--color-bg-surface').trim(),
    )
    expect(at(image, 'Online').text.getAttribute('fill')).toBe(getComputedStyle(legend).color)
  })

  it.each(['light', 'dark'])(
    'becomes a PNG twice the size of the chart in the modal, in %s',
    { retry: 2, timeout: 30000 },
    async (mode) => {
      document.documentElement.dataset.mode = mode
      const tile = await line()
      tile
        .shadowRoot!.querySelector('lintje-tile')!
        .dispatchEvent(new CustomEvent('lintje-tile-expand'))
      const modal = tile.shadowRoot!.querySelector('lintje-modal')!
      await expect
        .poll(() => modal.querySelector('.lintje-chart__svg')?.getClientRects().length ?? 0)
        .toBeGreaterThan(0)
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const saved = vi.spyOn(URL, 'createObjectURL')
      const names: string[] = []
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        names.push(this.download)
      })
      modal.dispatchEvent(new CustomEvent('lintje-download-png'))
      // Encoding the PNG can lag far behind on a busy runner, beside other test frames.
      await expect.poll(() => names, { timeout: 15000 }).toEqual(['aanvragen-per-week.png'])
      const blob = saved.mock.calls[0][0] as Blob
      expect(blob.type).toBe('image/png')
      const picture = await createImageBitmap(blob)
      const width = framed(modal.querySelector('.lintje-chart-wrap')!)
      expect(picture.width).toBeGreaterThanOrEqual(2 * Math.floor(width))
      expect(picture.width).toBeLessThan(2 * (width + 24))
    },
  )
})

describe('a pie without a legend table', () => {
  it('takes the focus from Tab, with the ring of every drawing', async () => {
    const tile = document.createElement('lintje-chart')
    tile.data = {
      title: 'Aanvragen per kanaal',
      description: 'Online 12, balie 8.',
      chart: {
        kind: 'pie',
        legendTable: false,
        segments: [
          { label: 'Online', value: 12 },
          { label: 'Balie', value: 8 },
        ],
      },
    }
    document.body.append(tile)
    await tile.updateComplete
    const drawing = tile.shadowRoot!.querySelector<SVGSVGElement>('.lintje-pie-chart__svg')!
    await expect.poll(() => drawing.getClientRects().length).toBeGreaterThan(0)
    // Past the tile's own controls, if any, to the drawing.
    for (let i = 0; i < 6 && tile.shadowRoot!.activeElement !== drawing; i++) {
      await userEvent.keyboard(TAB)
    }
    expect(tile.shadowRoot!.activeElement).toBe(drawing)
    expect(drawing.matches(':focus-visible')).toBe(true)
    const probe = document.createElement('span')
    probe.style.color = 'var(--color-focus)'
    tile.shadowRoot!.append(probe)
    const focus = getComputedStyle(probe).color
    probe.remove()
    const ring = getComputedStyle(drawing)
    await expect.poll(() => ring.outlineColor).toBe(focus)
    expect(ring.outlineStyle).toBe('solid')
    expect(ring.outlineWidth).toBe('2px')
    await expect
      .poll(() => tile.shadowRoot!.querySelector('.lintje-chart-tooltip__title')?.textContent)
      .toBe('Online')
  })
})
