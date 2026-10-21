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
function draw(spec: BarSpec, more: Partial<ChartOptions> = {}): HTMLElement {
  const host = document.createElement('div')
  document.body.append(host)
  const options: ChartOptions = {
    controller: new ChartController(() => render(renderBarChart(spec, options), host)),
    description: 'Staven.',
    ...more,
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

describe('a forecast on the bar chart', () => {
  const YEARS = ['2021', '2022', '2023', '2024', '2025', '2026']
  const spec: BarSpec = {
    kind: 'bar',
    labels: YEARS,
    values: [10, 12, 14, 16, 18, 20],
    color: 'dark-yellow',
    axisTitle: 'Aanvragen',
    forecastFrom: 4,
    forecast: { low: [null, null, null, null, 15, null], high: [null, null, null, null, 21, 26] },
    intervalLabel: 'Marge 80 %',
  }

  it('draws a forecast bar open, with its margin from low to high with caps', () => {
    const host = draw(spec)
    const bars = [...host.querySelectorAll('.lintje-chart__bar')]
    expect(bars.map((bar) => bar.classList.contains('lintje-chart__bar--forecast'))).toEqual([
      false,
      false,
      false,
      false,
      true,
      true,
    ])
    // The edge of a light colour is its dark edge, so the open bar reaches 3:1.
    expect(bars[4].getAttribute('stroke')).toBe('var(--color-chart-dark-yellow-edge)')
    expect(bars[3].hasAttribute('stroke')).toBe(false)
    // Only 2025 has both bounds; 2026 has none.
    const intervals = [...host.querySelectorAll('.lintje-chart__interval')]
    expect(intervals).toHaveLength(1)
    const d = intervals[0].getAttribute('d')!
    expect(d).toMatch(/h8M.*h8$/)
    expect(intervals[0].closest('.lintje-chart__bar-group')).toBe(bars[4].parentElement)
  })

  it('puts the boundary between the last measured bar and the first forecast one', () => {
    const host = draw(spec)
    const bars = [...host.querySelectorAll('.lintje-chart__bar')]
    const end = Number(bars[3].getAttribute('x')) + Number(bars[3].getAttribute('width'))
    const start = Number(bars[4].getAttribute('x'))
    const x = Number(host.querySelector('.lintje-chart__boundary line')!.getAttribute('x1'))
    expect(x).toBeGreaterThan(end)
    expect(x).toBeLessThan(start)
    expect(Number(host.querySelector('.lintje-chart__forecast-ground')!.getAttribute('x'))).toBe(x)
  })

  it('has a legend of keys: the series, "Raming" and the margin, none of them a switch', () => {
    const host = draw(spec)
    const items = [...host.querySelectorAll('.lintje-legend__item')]
    expect(items.map((item) => item.textContent?.trim())).toEqual([
      'Aanvragen',
      'Raming',
      'Marge 80 %',
    ])
    expect(host.querySelector('.lintje-legend button')).toBeNull()
    expect(host.querySelector('.lintje-legend__marker--open')).not.toBeNull()
    expect(host.querySelector('.lintje-legend__marker--interval')).not.toBeNull()
    // Without a forecast there is no legend, as before.
    expect(draw({ ...spec, forecastFrom: undefined }).querySelector('.lintje-legend')).toBeNull()
  })

  it('says "raming" in the tooltip with the margin, and names a forecast bar so', () => {
    const controller = new ChartController(() => {})
    const host = draw(
      { ...spec, links: YEARS.map((year) => ({ id: year, href: `?jaar=${year}` })) },
      { controller, onSelect: () => {} },
    )
    const svg = host.querySelector('svg.lintje-chart__svg') as SVGElement
    svg.dispatchEvent(new FocusEvent('focus'))
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }))
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    expect(controller.tooltip?.content).toEqual({
      title: '2025',
      note: 'raming',
      rows: [
        {
          label: 'Aanvragen',
          value: '18',
          color: 'var(--color-chart-dark-yellow)',
          marker: 'open',
        },
        { label: 'laag – hoog', value: '15 – 21', note: true },
      ],
    })
    // A forecast bar with a link is clickable like any bar.
    const bar = host.querySelectorAll('.lintje-chart__bar')[5]
    expect(bar.getAttribute('role')).toBe('button')
    expect(bar.getAttribute('aria-label')).toBe('2026 raming: 20')
  })

  it('keeps data labels on a forecast bar, above its margin', () => {
    const host = draw(spec)
    const labels = [...host.querySelectorAll('.lintje-chart__data-label')]
    expect(labels).toHaveLength(6)
    const interval = host.querySelector('.lintje-chart__interval')!.getAttribute('d')!
    const top = Number(interval.split('V')[0].split(',')[1])
    expect(Number(labels[4].getAttribute('y'))).toBeLessThan(top)
  })

  it('scales to the highest bound', () => {
    const host = draw(spec)
    const ticks = [...host.querySelectorAll('text.lintje-chart__axis-label[text-anchor="end"]')]
      .map((text) => Number(text.textContent?.trim()))
      .filter(Number.isFinite)
    expect(Math.max(...ticks)).toBeGreaterThanOrEqual(26)
  })
})
