/**
 * The keyboard's way to a chart's values: the drawing takes the focus, the arrow keys walk the
 * categories with the tooltip on the one reached, a status region says it, and Escape hides
 * the tooltip — on the chart, and wherever the focus is while a pointer's tooltip shows.
 *
 * happy-dom lays nothing out, so what is checked is the markup, the state and the events.
 */
import { render } from 'lit'
import { afterEach, describe, expect, it } from 'vitest'
import { ChartController, type ChartOptions } from './controller'
import { renderChart } from './render-chart'
import type { ChartSpec } from './types'

function draw(spec: ChartSpec) {
  const host = document.createElement('div')
  document.body.append(host)
  const options: ChartOptions = {
    controller: new ChartController(() => render(renderChart(spec, options), host)),
    description: 'Een figuur.',
  }
  render(renderChart(spec, options), host)
  const drawing = host.querySelector('svg[tabindex="0"]') as SVGSVGElement
  const key = (name: string, target: Element = drawing) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }))
  return { host, controller: options.controller, drawing, key }
}

const title = (host: Element) => host.querySelector('.lintje-chart-tooltip__title')?.textContent
const status = (host: Element) => host.querySelector('[role="status"]')?.textContent?.trim()

const KINDS: { name: string; spec: ChartSpec; first: string; second: string }[] = [
  {
    name: 'line',
    first: 'ma',
    second: 'di',
    spec: {
      kind: 'line',
      labels: ['ma', 'di', 'wo'],
      series: [{ label: 'Aanvragen', values: [3, null, 5] }],
    },
  },
  {
    name: 'bar',
    first: 'ma',
    second: 'di',
    spec: { kind: 'bar', labels: ['ma', 'di'], values: [3, 4], dataLabels: false },
  },
  {
    name: 'grouped-bar',
    first: 'ma',
    second: 'di',
    spec: {
      kind: 'grouped-bar',
      labels: ['ma', 'di'],
      series: [
        { label: 'Nu', values: [3, 4] },
        { label: 'Toen', values: [2, 5] },
      ],
    },
  },
  {
    name: 'stacked-bar',
    first: 'ma',
    second: 'di',
    spec: {
      kind: 'stacked-bar',
      labels: ['ma', 'di'],
      series: [
        { label: 'Open', values: [3, 4] },
        { label: 'Dicht', values: [2, 5] },
      ],
    },
  },
  {
    name: 'dual-axis',
    first: 'ma',
    second: 'di',
    spec: {
      kind: 'dual-axis',
      labels: ['ma', 'di'],
      left: { label: 'Aantal', values: [3, 4] },
      right: { label: 'Duur', values: [20, null] },
    },
  },
  {
    name: 'scatter',
    first: 'Noord',
    second: 'Zuid',
    spec: {
      kind: 'scatter',
      axisTitle: 'wachttijd',
      xTitle: 'aanvragen',
      series: [
        {
          label: 'Loket',
          points: [
            { label: 'Zuid', x: 20, y: 4 },
            { label: 'Noord', x: 10, y: 6 },
            { label: 'Oost', x: 15, y: null },
          ],
        },
      ],
    },
  },
  {
    name: 'horizontal-bar',
    first: 'Noord',
    second: 'Zuid',
    spec: {
      kind: 'horizontal-bar',
      rows: [
        { label: 'Noord', value: 3 },
        { label: 'Zuid', value: 4 },
      ],
    },
  },
  {
    name: 'target-progress',
    first: 'Noord',
    second: 'Zuid',
    spec: {
      kind: 'target-progress',
      rows: [
        { label: 'Noord', value: 80 },
        { label: 'Zuid', value: 104 },
      ],
    },
  },
]

afterEach(() => {
  document.body.innerHTML = ''
})

describe.each(KINDS)('the keyboard on a $name chart', ({ spec, first, second }) => {
  it('puts the drawing in the tab order, an image while no mark is a button', () => {
    const { drawing } = draw(spec)
    expect(drawing).not.toBeNull()
    expect(drawing.getAttribute('role')).toBe('img')
  })

  it('walks the categories with the arrow keys, Home and End, the tooltip and status along', () => {
    const { host, key } = draw(spec)
    key('ArrowRight')
    expect(title(host)).toBe(first)
    expect(status(host)).toContain(first)
    key('ArrowRight')
    expect(title(host)).toBe(second)
    key('Home')
    expect(title(host)).toBe(first)
    key('End')
    const last = title(host)
    key('ArrowRight')
    expect(title(host)).toBe(last)
    key('Home')
    key('ArrowLeft')
    expect(title(host)).toBe(first)
  })

  it('hides the tooltip on Escape and keeps that Escape from going on', () => {
    const { host, key } = draw(spec)
    key('ArrowRight')
    let outside = 0
    const count = () => (outside += 1)
    document.addEventListener('keydown', count)
    key('Escape')
    document.removeEventListener('keydown', count)
    expect(title(host)).toBeUndefined()
    expect(outside).toBe(0)
  })

  it('lets the tooltip and the status go when the drawing loses the focus', () => {
    const { host, key, drawing } = draw(spec)
    key('ArrowRight')
    drawing.dispatchEvent(new FocusEvent('blur'))
    expect(title(host)).toBeUndefined()
    expect(status(host)).toBe('')
  })
})

describe('a tooltip under the pointer', () => {
  it('goes on Escape wherever the focus is', () => {
    const { host, controller } = draw(KINDS[1].spec)
    controller.showTooltipAt(10, 10, { title: 'ma', rows: [] })
    expect(title(host)).toBe('ma')
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(title(host)).toBeUndefined()
  })

  it('says a missing value in words in the line chart, never as 0', () => {
    const { host, key } = draw(KINDS[0].spec)
    key('ArrowRight')
    key('ArrowRight')
    expect(status(host)).toBe('di: Aanvragen geen gegevens')
  })
})
