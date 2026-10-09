/**
 * The line chart: a missing value breaks the line (rule 15), two lines in colour carry a shape
 * besides it (rule 13), a dark-yellow line has an edge that reaches 3:1, and a switched-off
 * series keeps its name at full contrast.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render } from 'lit'
import { afterEach, describe, expect, it } from 'vitest'
import { ChartController, type ChartOptions } from '../shared/controller'
import { renderLineChart } from './line-chart'
import type { ChartSpec } from '../shared/types'

type LineSpec = Extract<ChartSpec, { kind: 'line' }>

function draw(spec: LineSpec): { host: HTMLElement; controller: ChartController } {
  const host = document.createElement('div')
  document.body.append(host)
  const options: ChartOptions = {
    controller: new ChartController(() => render(renderLineChart(spec, options), host)),
    description: 'Een lijn.',
  }
  render(renderLineChart(spec, options), host)
  return { host, controller: options.controller }
}

const lines = (host: Element) => [
  ...host.querySelectorAll('.lintje-chart__line:not(.lintje-chart__line--casing)'),
]

afterEach(() => {
  document.body.innerHTML = ''
})

describe('the line chart', () => {
  it('breaks the line at a missing value instead of bridging it', () => {
    const { host } = draw({
      kind: 'line',
      labels: ['1', '2', '3', '4', '5'],
      series: [{ label: 'A', values: [1, 2, null, 4, 5], area: true }],
    })
    expect(lines(host)).toHaveLength(2)
    for (const line of lines(host)) {
      expect(line.getAttribute('points')?.split(' ')).toHaveLength(2)
    }
    // The area under it breaks with it.
    expect(host.querySelectorAll('polygon')).toHaveLength(2)
  })

  it('draws a lone value between two gaps as a point', () => {
    const { host } = draw({
      kind: 'line',
      labels: ['1', '2', '3'],
      series: [{ label: 'A', values: [null, 2, null] }],
    })
    expect(lines(host)).toHaveLength(0)
    expect(host.querySelectorAll('.lintje-chart__reveal circle')).toHaveLength(1)
  })

  it('gives two lines in colour the shape of their colour, at the end and in the legend', () => {
    const { host } = draw({
      kind: 'line',
      labels: ['1', '2'],
      series: [
        { label: 'A', values: [1, 2], color: 'sky-blue' },
        { label: 'B', values: [2, 1], color: 'dark-yellow' },
        { label: 'Vorig jaar', values: [1, 1], comparison: true },
      ],
    })
    expect(host.querySelectorAll('.lintje-chart__line-end')).toHaveLength(2)
    expect(host.querySelectorAll('.lintje-legend__marker--symbol')).toHaveLength(2)
    expect(host.querySelectorAll('.lintje-legend__marker--dashed')).toHaveLength(1)
  })

  it('draws one line in colour without a shape', () => {
    const { host } = draw({
      kind: 'line',
      labels: ['1', '2'],
      series: [
        { label: 'A', values: [1, 2] },
        { label: 'Vorig jaar', values: [1, 1], comparison: true },
      ],
    })
    expect(host.querySelector('.lintje-chart__line-end')).toBeNull()
    expect(host.querySelector('.lintje-legend__marker--symbol')).toBeNull()
  })

  it('edges a dark-yellow line in its text colour, and no other', () => {
    const { host } = draw({
      kind: 'line',
      labels: ['1', '2'],
      series: [
        { label: 'A', values: [1, 2], color: 'sky-blue' },
        { label: 'B', values: [2, 1], color: 'dark-yellow' },
      ],
    })
    const casings = [...host.querySelectorAll('.lintje-chart__line--casing')]
    expect(casings.map((casing) => casing.getAttribute('stroke'))).toEqual([
      'var(--color-chart-dark-yellow-text)',
    ])
  })

  it('hatches the incomplete period at full strength', () => {
    const { host } = draw({
      kind: 'line',
      labels: ['1', '2', '3'],
      series: [{ label: 'A', values: [1, 2, null] }],
      asOfIndex: 1,
      pendingHours: 2,
    })
    const hatch = host.querySelector('rect[fill^="url(#hatch-"]')
    expect(hatch).not.toBeNull()
    expect(hatch?.hasAttribute('opacity')).toBe(false)
  })

  it('strikes a switched-off series through and fades only its marker', () => {
    const { host, controller } = draw({
      kind: 'line',
      labels: ['1', '2'],
      series: [
        { label: 'A', values: [1, 2] },
        { label: 'B', values: [2, 1] },
      ],
    })
    controller.toggleSeries('B')
    const item = host.querySelectorAll('.lintje-legend__item')[1]
    expect(item.className).toContain('is-hidden')
    expect(item.querySelector('button')?.getAttribute('aria-pressed')).toBe('false')
    expect(item.querySelector('.lintje-legend__label')?.textContent).toBe('B')
    // The opacity is the marker's, never the item's: the word keeps 4.5:1.
    const css = readFileSync(resolve('src/components/shared/charts/shared/chart.css'), 'utf8')
    expect(css).not.toMatch(/\.lintje-legend__item\.is-hidden\s*\{/)
    expect(css).toMatch(
      /\.lintje-legend__item\.is-hidden \.lintje-legend__label \{ text-decoration/,
    )
  })
})
