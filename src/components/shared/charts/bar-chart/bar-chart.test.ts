/**
 * The bar chart: a missing value in its trend breaks the trend line (rule 15), as it breaks a
 * line in the line chart.
 */
import { render } from 'lit'
import { afterEach, describe, expect, it } from 'vitest'
import { ChartController, type ChartOptions } from '../shared/controller'
import { renderBarChart } from './bar-chart'
import type { ChartSpec } from '../shared/types'

type BarSpec = Extract<ChartSpec, { kind: 'bar' }>

/** Drawn at a width of its own: happy-dom measures every element as 0 wide. */
function draw(spec: BarSpec): HTMLElement {
  const host = document.createElement('div')
  document.body.append(host)
  const options: ChartOptions = {
    controller: new ChartController(() => render(renderBarChart(spec, options), host)),
    description: 'Staven.',
  }
  options.controller.width = 600
  render(renderBarChart(spec, options), host)
  return host
}

const DAYS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']
const VALUES = [41, 43, 44, 46, 48, 30, 52]

/** The x of each bar's centre, from left to right. */
const centres = (host: Element) =>
  [...host.querySelectorAll('.lintje-chart__bar')].map(
    (bar) => Number(bar.getAttribute('x')) + Number(bar.getAttribute('width')) / 2,
  )
const xs = (line: Element) =>
  line
    .getAttribute('points')!
    .split(' ')
    .map((point) => Number(point.split(',')[0]))

afterEach(() => {
  document.body.innerHTML = ''
})

describe('the bar chart', () => {
  it('breaks the trend at a missing value and draws a lone value as a point', () => {
    const host = draw({
      kind: 'bar',
      labels: DAYS,
      values: VALUES,
      trend: [40, 42, null, 45, 47, null, 50],
    })
    const x = centres(host)
    expect(new Set(x).size).toBe(DAYS.length)
    const segments = [...host.querySelectorAll('.lintje-chart__trend polyline')]
    expect(segments.map(xs)).toEqual([
      [x[0], x[1]],
      [x[3], x[4]],
    ])
    // No segment runs over a day without a value.
    for (const segment of segments) {
      const [from, to] = xs(segment)
      expect([x[2], x[5]].some((gap) => gap > from && gap < to)).toBe(false)
    }
    const points = [...host.querySelectorAll('.lintje-chart__trend circle')]
    expect(points).toHaveLength(1)
    expect(Number(points[0].getAttribute('cx'))).toBe(x[6])
    expect(points[0].getAttribute('r')).toBe('2.5')
    expect(points[0].getAttribute('fill')).toBe('var(--color-chart-emphasis)')
  })

  it('keeps the trend dashed, 1.5 px, in the emphasis colour', () => {
    const host = draw({ kind: 'bar', labels: DAYS, values: VALUES, trend: VALUES })
    const segments = [...host.querySelectorAll('.lintje-chart__trend polyline')]
    expect(segments).toHaveLength(1)
    expect(segments[0].getAttribute('stroke')).toBe('var(--color-chart-emphasis)')
    expect(segments[0].getAttribute('stroke-width')).toBe('1.5')
    expect(segments[0].getAttribute('stroke-dasharray')).toBe('5 4')
  })

  it('draws nothing for a trend without a single value', () => {
    const host = draw({ kind: 'bar', labels: DAYS, values: VALUES, trend: DAYS.map(() => null) })
    expect(host.querySelector('.lintje-chart__trend')).toBeNull()
  })

  it('keeps hatching a missing bar', () => {
    const host = draw({
      kind: 'bar',
      labels: DAYS,
      values: [41, 43, null, 46, 48, 30, 52],
      trend: [40, 42, null, 45, 47, null, 50],
    })
    expect(host.querySelectorAll('.lintje-chart__bar')).toHaveLength(6)
    expect(host.querySelectorAll('.lintje-chart__missing')).toHaveLength(1)
  })
})
