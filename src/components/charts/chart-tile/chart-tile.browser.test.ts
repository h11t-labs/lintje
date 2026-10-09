/** A chart mark in a browser: the keyboard's ring, never the box the browser draws on a click. */
import { afterEach, describe, expect, it } from 'vitest'
import { server, userEvent } from 'vitest/browser'
import './chart-tile'
import type { LintjeChartTile } from './chart-tile'

async function mount(): Promise<LintjeChartTile> {
  const tile = document.createElement('lintje-chart-tile')
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

const slice = (tile: LintjeChartTile): SVGElement | null =>
  tile.shadowRoot!.querySelector<SVGElement>('[data-mark-id="noord"]')

afterEach(() => document.body.replaceChildren())

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
