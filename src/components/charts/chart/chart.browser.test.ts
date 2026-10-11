/**
 * A chart mark in a browser: the scatter plot's one pointer target, and the keyboard's ring,
 * never the box the browser draws on a click.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { server, userEvent } from 'vitest/browser'
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
  document.body.append(tile)
  await tile.updateComplete
  await expect.poll(() => slice(tile)?.getClientRects().length ?? 0).toBeGreaterThan(0)
  return tile
}

const slice = (tile: LintjeChart): SVGElement | null =>
  tile.shadowRoot!.querySelector<SVGElement>('[data-mark-id="noord"]')

afterEach(() => document.body.replaceChildren())

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
