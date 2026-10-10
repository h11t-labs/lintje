/**
 * The histogram: classes that touch, labels on their bounds and "30+" under an open class, a
 * missing count hatched and never 0 (rule 15), and the median and threshold with their labels.
 *
 * happy-dom lays nothing out and measures text at 6.5 px a character.
 */
import { render } from 'lit'
import { afterEach, describe, expect, it } from 'vitest'
import { ChartController, type ChartOptions } from '../shared/controller'
import { renderChart } from '../shared/render-chart'
import type { ChartSpec } from '../shared/types'
import { placeLineLabels } from './histogram-chart'

type HistogramSpec = Extract<ChartSpec, { kind: 'histogram' }>

const BINS = [40, 120, 260, 310, 280, 220, 170, 130, 95, 70, 52, 40, 30, 22, 16, 45].map(
  (count, i) => ({ from: i * 2, to: i === 15 ? null : i * 2 + 2, count }),
)

function draw(spec: Partial<HistogramSpec> = {}) {
  const host = document.createElement('div')
  document.body.append(host)
  const chart: HistogramSpec = { kind: 'histogram', bins: BINS, unit: 'dagen', ...spec }
  const options: ChartOptions = {
    controller: new ChartController(() => render(renderChart(chart, options), host)),
    description: 'Een figuur.',
    plotArea: { width: 592, height: 260, left: 32, right: 8, top: 16, bottom: 44 },
  }
  render(renderChart(chart, options), host)
  return { host, controller: options.controller }
}

const bars = (host: Element) => [...host.querySelectorAll('rect.lintje-chart__bar')]
const xLabels = (host: Element) =>
  [...host.querySelectorAll('text.lintje-chart__axis-label[text-anchor="middle"]')].map((text) =>
    text.textContent?.trim(),
  )

afterEach(() => {
  document.body.innerHTML = ''
})

describe('the histogram', () => {
  it('draws classes that touch, parted by the line in the surface', () => {
    const { host } = draw()
    const rects = bars(host)
    expect(rects).toHaveLength(16)
    for (const [i, rect] of rects.slice(1).entries()) {
      const before = rects[i]
      const end = Number(before.getAttribute('x')) + Number(before.getAttribute('width'))
      expect(Number(rect.getAttribute('x'))).toBeCloseTo(end)
      expect(rect.classList.contains('lintje-chart__segment')).toBe(true)
    }
    // The open last class is as wide as the one before it.
    expect(Number(rects[15].getAttribute('width'))).toBeCloseTo(
      Number(rects[14].getAttribute('width')),
    )
  })

  it('labels the bounds, thinned, and names an open class under its middle', () => {
    const { host } = draw()
    expect(xLabels(host)).toEqual(['0', '4', '8', '12', '16', '20', '24', '28', '30+'])
    // A tick under every labelled bound, none under "30+".
    const ticks = [...host.querySelectorAll('line')].filter(
      (line) => Number(line.getAttribute('y2')) - Number(line.getAttribute('y1')) === 4,
    )
    expect(ticks).toHaveLength(8)
  })

  it('hatches a missing count and never draws it as a bar of 0', () => {
    const { host } = draw({
      bins: BINS.map((bin, i) => (i === 3 ? { ...bin, count: null } : bin)),
    })
    expect(bars(host)).toHaveLength(15)
    const missing = host.querySelector('.lintje-chart__missing')
    expect(missing?.getAttribute('fill')).toMatch(/^url\(#hatch-/)
    expect(Number(missing?.getAttribute('height'))).toBeGreaterThan(0)
  })

  it('draws the median solid with a bold label and the threshold dashed', () => {
    const { host } = draw({ median: 9.6, threshold: 21, thresholdLabel: 'termijn 21 dagen' })
    const median = host.querySelector(
      'line[stroke-width="1.5"][stroke="var(--color-chart-emphasis)"]',
    )
    expect(median?.hasAttribute('stroke-dasharray')).toBe(false)
    const dashed = host.querySelector('line[stroke-dasharray="3 3"]')
    expect(dashed).not.toBeNull()
    const labels = [...host.querySelectorAll('[class*="-label--halo"]')].map((text) =>
      text.textContent?.trim(),
    )
    expect(labels).toEqual(['mediaan 9,6 dagen', 'termijn 21 dagen'])
    expect(host.querySelector('.lintje-chart__data-label--halo')?.textContent?.trim()).toBe(
      'mediaan 9,6 dagen',
    )
    const legend = [...host.querySelectorAll('.lintje-legend__label')].map(
      (label) => label.textContent,
    )
    expect(legend).toEqual(['Aantal', 'Mediaan', 'Termijn 21 dagen'])
  })

  it('names the class, the count and its share in the tooltip', () => {
    const { host, controller } = draw({ label: 'Aanvragen' })
    const drawing = host.querySelector('svg[tabindex="0"]')!
    for (let i = 0; i < 5; i += 1) {
      drawing.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    }
    expect(controller.status).toBe('8 tot 10 dagen: Aanvragen 280, Aandeel 14,7%')
    drawing.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    expect(controller.status).toBe('30 of meer dagen: Aanvragen 45, Aandeel 2,4%')
  })

  it('draws the class under the keyboard last, so its neighbours do not cover its lift', () => {
    const { host } = draw()
    const drawing = host.querySelector('svg[tabindex="0"]')!
    drawing.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    drawing.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    const groups = [...host.querySelectorAll('.lintje-chart__bar-group')]
    expect(groups.at(-1)?.classList.contains('is-hovered')).toBe(true)
    expect(Number(groups.at(-1)?.querySelector('rect')?.getAttribute('height'))).toBe(60)
  })
})

describe('the labels of the median and the threshold', () => {
  const area = { width: 310, height: 260, left: 32, right: 8, top: 16, bottom: 44 }

  it('stand on one line while they keep apart', () => {
    const places = placeLineLabels(
      [
        { x: 60, text: 'mediaan', bold: true },
        { x: 200, text: 'norm' },
      ],
      area,
    )
    expect(places.map((place) => place.y)).toEqual([28, 28])
  })

  it('drop the right one a line where they would touch', () => {
    const places = placeLineLabels(
      [
        { x: 112.8, text: 'mediaan 9,6 dagen', bold: true },
        { x: 209.2, text: 'termijn 21 dagen' },
      ],
      area,
    )
    expect(places.map((place) => place.y)).toEqual([28, 46])
  })

  it('go left of a line near the right edge', () => {
    const [place] = placeLineLabels([{ x: 290, text: 'norm 40 dagen' }], area)
    expect(place.anchor).toBe('end')
    expect(place.x).toBe(284)
  })
})
