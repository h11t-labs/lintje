/**
 * The stacked area: the parts in the ladder of one variable, darkest at the bottom; a missing
 * value in any part breaks the whole stack and hatches the period (rule 15); a part switched off
 * leaves the stack; the tooltip reads the drawing from top to bottom and ends with the total.
 */
import { render } from 'lit'
import { afterEach, describe, expect, it } from 'vitest'
import { ChartController, type ChartOptions } from '../shared/controller'
import { renderStackedAreaChart } from './stacked-area-chart'
import type { ChartSpec } from '../shared/types'

type StackedAreaSpec = Extract<ChartSpec, { kind: 'stacked-area' }>

function draw(spec: StackedAreaSpec): { host: HTMLElement; controller: ChartController } {
  const host = document.createElement('div')
  document.body.append(host)
  const options: ChartOptions = {
    controller: new ChartController(() => render(renderStackedAreaChart(spec, options), host)),
    description: 'Een gestapeld vlak.',
  }
  render(renderStackedAreaChart(spec, options), host)
  return { host, controller: options.controller }
}

const SPEC: StackedAreaSpec = {
  kind: 'stacked-area',
  labels: ['1', '2', '3', '4', '5'],
  series: [
    { label: 'Online', values: [60, 62, null, 70, 72] },
    { label: 'Balie', values: [30, 31, 29, 28, 27] },
    { label: 'Post', values: [10, 9, 9, 8, 8] },
  ],
}

const polygons = (host: Element) => [...host.querySelectorAll('.lintje-chart__reveal polygon')]
const tops = (host: Element) =>
  polygons(host).map((polygon) => polygon.getAttribute('points')!.split(' ')[0])
const tooltipRows = (host: Element) =>
  [...host.querySelectorAll('.lintje-chart-tooltip__row')].map((row) => ({
    text: row.textContent?.replace(/\s+/g, ' ').trim(),
    divider: row.classList.contains('lintje-chart-tooltip__row--divider'),
    marker: row.querySelector('.lintje-chart-tooltip__marker') != null,
  }))

afterEach(() => {
  document.body.innerHTML = ''
})

describe('the stacked area', () => {
  it('draws the first part at the bottom in the darkest tint, the rest up the ladder', () => {
    const { host } = draw({ ...SPEC, color: 'dark-blue' })
    const fills = polygons(host)
      .slice(0, 3)
      .map((polygon) => polygon.getAttribute('fill'))
    expect(fills).toEqual([
      'var(--color-chart-dark-blue)',
      'var(--color-chart-dark-blue-tint-2)',
      'var(--color-chart-dark-blue-tint-4)',
    ])
    const markers = [...host.querySelectorAll('.lintje-legend__marker--square')]
    expect(markers).toHaveLength(3)
    expect(host.querySelector('.lintje-legend__label')?.textContent).toBe('Online')
  })

  it('breaks the whole stack at a missing value and hatches the period around it', () => {
    const { host } = draw(SPEC)
    // Two runs of three parts each: no area bridges the gap.
    expect(polygons(host)).toHaveLength(6)
    // A 1 px line in the surface between neighbours, not above the top part.
    expect(host.querySelectorAll('polyline.lintje-chart__segment')).toHaveLength(4)
    const hatch = host.querySelectorAll('rect[fill^="url(#hatch-"]')
    expect(hatch).toHaveLength(1)
    expect(hatch[0].hasAttribute('opacity')).toBe(false)
  })

  it('draws a lone point between two gaps as a point per part', () => {
    const { host } = draw({
      kind: 'stacked-area',
      labels: ['1', '2', '3'],
      series: [
        { label: 'A', values: [null, 2, null] },
        { label: 'B', values: [1, 2, 3] },
      ],
    })
    expect(polygons(host)).toHaveLength(0)
    expect(host.querySelectorAll('.lintje-chart__reveal circle')).toHaveLength(2)
    expect(host.querySelectorAll('rect[fill^="url(#hatch-"]')).toHaveLength(2)
  })

  it('takes a part switched off out of the stack, and the rest settles', () => {
    const { host, controller } = draw(SPEC)
    const before = tops(host)
    controller.toggleSeries('Online')
    // One run of the two parts left: the gap was Online's, so it goes with it.
    expect(polygons(host)).toHaveLength(2)
    expect(host.querySelector('rect[fill^="url(#hatch-"]')).toBeNull()
    expect(tops(host)[0]).not.toBe(before[1])
    const item = host.querySelectorAll('.lintje-legend__item')[0]
    expect(item.querySelector('button')?.getAttribute('aria-pressed')).toBe('false')
  })

  it('reads the tooltip from top to bottom, then the total under a line', () => {
    const { host } = draw(SPEC)
    const drawing = host.querySelector('svg[tabindex="0"]') as SVGSVGElement
    drawing.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    drawing.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(tooltipRows(host)).toEqual([
      { text: 'Post 9', divider: false, marker: true },
      { text: 'Balie 31', divider: false, marker: true },
      { text: 'Online 62', divider: false, marker: true },
      { text: 'Totaal 102', divider: true, marker: false },
    ])
    expect(host.querySelectorAll('.lintje-chart__hover-point')).toHaveLength(3)
  })

  it('names the total "Totaal getoond" while a part is switched off', () => {
    const { host, controller } = draw(SPEC)
    controller.toggleSeries('Post')
    const drawing = host.querySelector('svg[tabindex="0"]') as SVGSVGElement
    drawing.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    expect(tooltipRows(host).map((row) => row.text)).toEqual([
      'Balie 30',
      'Online 60',
      'Totaal getoond 90',
    ])
    controller.toggleSeries('Post')
    drawing.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    expect(tooltipRows(host).at(-1)?.text).toBe('Totaal 107')
  })

  it('says "geen gegevens" at a gap, for the total too, and puts no hover point there', () => {
    const { host } = draw(SPEC)
    const drawing = host.querySelector('svg[tabindex="0"]') as SVGSVGElement
    drawing.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    drawing.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    drawing.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    const rows = tooltipRows(host)
    expect(rows[2].text).toBe('Online geen gegevens')
    expect(rows[3].text).toBe('Totaal geen gegevens')
    expect(host.querySelector('.lintje-chart__hover-point')).toBeNull()
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Totaal geen gegevens')
  })
})
