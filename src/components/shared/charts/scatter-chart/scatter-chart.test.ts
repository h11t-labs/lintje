/**
 * The scatter plot: a series is a colour and its shape (rule 13), a point has an edge in the
 * surface (dark yellow its text colour), a point without both values is not drawn (rule 15), the
 * named points' labels show all or none, the norm is dashed, and a point with a href is a button.
 */
import { render } from 'lit'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChartController, type ChartOptions } from '../shared/controller'
import { renderScatterChart } from './scatter-chart'
import type { ChartSpec } from '../shared/types'

type ScatterSpec = Extract<ChartSpec, { kind: 'scatter' }>

function draw(spec: ScatterSpec, extra: Partial<ChartOptions> = {}) {
  const host = document.createElement('div')
  document.body.append(host)
  const options: ChartOptions = {
    controller: new ChartController(() => render(renderScatterChart(spec, options), host)),
    description: 'Een spreiding.',
    ...extra,
  }
  render(renderScatterChart(spec, options), host)
  return { host, controller: options.controller }
}

const SPEC: ScatterSpec = {
  kind: 'scatter',
  axisTitle: 'wachttijd',
  unit: 'min',
  xTitle: 'aanvragen',
  series: [
    {
      label: 'Loket',
      points: [
        { label: 'Utrecht', x: 150, y: 12 },
        { label: 'Arnhem', x: 90, y: 8 },
        { label: 'Zwolle', x: 60, y: null },
      ],
    },
    { label: 'Servicepunt', points: [{ label: 'Breda', x: 60, y: 6 }] },
  ],
}

const points = (host: Element) => [...host.querySelectorAll('path.lintje-chart__mark')]

afterEach(() => {
  document.body.innerHTML = ''
})

describe('the scatter plot', () => {
  it('gives each series the next data colour and that colour’s shape', () => {
    const { host } = draw(SPEC)
    const fills = points(host).map((point) => point.getAttribute('fill'))
    expect(fills).toEqual([
      'var(--color-chart-dark-yellow)',
      'var(--color-chart-sky-blue)',
      'var(--color-chart-sky-blue)',
    ])
    // Sky blue is a circle (an arc), dark yellow a square (four corners).
    expect(points(host)[1].getAttribute('d')).toContain(' a ')
    expect(points(host)[0].getAttribute('d')?.match(/L/g)).toHaveLength(3)
    const symbols = [...host.querySelectorAll('.lintje-legend__marker--symbol path')]
    expect(symbols.map((symbol) => symbol.getAttribute('d'))).toHaveLength(2)
  })

  it('edges a point in the surface, and a dark-yellow one in its text colour', () => {
    const { host } = draw(SPEC)
    const [yellow, blue] = points(host)
    expect(blue.classList.contains('lintje-chart__segment')).toBe(true)
    expect(yellow.classList.contains('lintje-chart__segment')).toBe(false)
    expect(yellow.getAttribute('stroke')).toBe('var(--color-chart-dark-yellow-text)')
  })

  it('draws no point without both values, never at 0', () => {
    const { host } = draw(SPEC)
    expect(points(host)).toHaveLength(3)
  })

  it('switches a series off from the legend, and keeps the norm out of the toggles', () => {
    const { host } = draw({ ...SPEC, threshold: 10 })
    const buttons = [...host.querySelectorAll('.lintje-legend__button')]
    expect(buttons.map((button) => button.textContent?.trim())).toEqual(['Loket', 'Servicepunt'])
    expect(host.querySelector('.lintje-legend__marker--dashed')).not.toBeNull()
    ;(buttons[0] as HTMLButtonElement).click()
    expect(points(host)).toHaveLength(1)
  })

  it('draws the norm dashed, with its value and unit', () => {
    const { host } = draw({ ...SPEC, threshold: 10 })
    expect(host.querySelector('line[stroke-dasharray="3 3"]')).not.toBeNull()
    expect(host.textContent).toContain('norm 10 min')
  })

  it('shows the named points’ labels, and none when one does not fit', () => {
    const shown = draw({ ...SPEC, dataLabels: ['Arnhem', 'Breda'] }).host
    const labels = [...shown.querySelectorAll('.lintje-chart__data-label')]
    expect(labels.map((label) => label.textContent?.trim())).toEqual(['Breda', 'Arnhem'])
    document.body.innerHTML = ''
    // Utrecht on the top line of the axis: its label would stand above the drawing.
    const top: ScatterSpec = {
      ...SPEC,
      series: [
        {
          label: 'Loket',
          points: [
            { label: 'Utrecht', x: 150, y: 20 },
            { label: 'Arnhem', x: 90, y: 8 },
          ],
        },
      ],
    }
    const none = draw({ ...top, dataLabels: ['Arnhem', 'Utrecht'] }).host
    expect(none.querySelectorAll('.lintje-chart__data-label')).toHaveLength(0)
  })

  it('names the point, its series and both values with their units in the tooltip', () => {
    const { host } = draw(SPEC)
    const drawing = host.querySelector('svg[tabindex="0"]') as SVGSVGElement
    drawing.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    expect(host.querySelector('.lintje-chart-tooltip__title')?.textContent).toBe('Utrecht')
    expect(host.querySelector('.lintje-chart-tooltip__marker--symbol')).not.toBeNull()
    expect(host.querySelector('[role="status"]')?.textContent).toBe(
      'Utrecht: Loket, Aanvragen 150, Wachttijd 12 min',
    )
    expect(host.querySelector('.lintje-chart__hover-point')).not.toBeNull()
  })

  it('makes a point with a href a button that selects it', () => {
    const onSelect = vi.fn()
    const { host } = draw(
      {
        ...SPEC,
        series: [
          {
            label: 'Loket',
            points: [{ label: 'Utrecht', x: 1, y: 2, id: 'utr', href: '?loket=utr' }],
          },
        ],
      },
      { onSelect },
    )
    expect(host.querySelector('svg.lintje-chart__svg')?.getAttribute('role')).toBe('group')
    const button = host.querySelector('[role="button"]') as SVGElement
    expect(button.getAttribute('aria-label')).toBe('Utrecht: Loket, Aanvragen 1, Wachttijd 2 min')
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onSelect).toHaveBeenCalledWith({ id: 'utr', label: 'Utrecht', href: '?loket=utr' })
    // The transparent target around it, of --h-target, takes the click as well.
    const target = host.querySelector('.lintje-chart__hit') as SVGElement
    expect(target.classList.contains('is-clickable')).toBe(true)
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onSelect).toHaveBeenCalledTimes(2)
  })

  it('edges a dark-yellow hover point with a class, so forced colours keep it', () => {
    const { host } = draw({
      ...SPEC,
      series: [
        { label: 'Servicepunt', color: 'dark-yellow', points: [{ label: 'Breda', x: 6, y: 6 }] },
      ],
    })
    const drawing = host.querySelector('svg[tabindex="0"]') as SVGSVGElement
    drawing.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    const casing = host.querySelector('.lintje-chart__hover-casing')
    expect(casing?.getAttribute('stroke')).toBe('var(--color-chart-dark-yellow-text)')
  })
})
