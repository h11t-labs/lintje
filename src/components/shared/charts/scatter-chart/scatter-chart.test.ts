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
  // Once more at the width the first render measured, as the ResizeObserver would.
  options.controller.requestUpdate()
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

const points = (host: Element) => [
  ...host.querySelectorAll('path.lintje-chart__mark:not(.is-hidden)'),
]

/** The centre of a circle mark, from its path (`M cx-r cy a …`); happy-dom lays nothing out. */
function centre(mark: Element): [number, number] {
  const [x, y] = (mark.getAttribute('d') ?? '').slice(2).split(' ').map(Number)
  return [x + 4.5, y]
}

/** A pointer event on the drawing's one target; its box is at 0, 0, so client is drawing. */
function hit(host: Element, type: string, clientX: number, clientY: number): void {
  host
    .querySelector('.lintje-chart__hit')!
    .dispatchEvent(new MouseEvent(type, { bubbles: true, clientX, clientY }))
}

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

  it('keeps every point its node under the pointer, the arrow keys and the legend', () => {
    const { host } = draw({ ...SPEC, threshold: 10 })
    const nodes = () => [...host.querySelectorAll('path.lintje-chart__point')]
    const before = nodes()
    expect(before).toHaveLength(3)
    // In the order of x, each with its place in the draw-in.
    expect(
      before.map((node) => (node as SVGElement).style.getPropertyValue('--lintje-stagger')),
    ).toEqual(['0', '0.5', '1'])
    const drawing = host.querySelector('svg[tabindex="0"]') as SVGSVGElement
    drawing.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    points(host)[1].dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))
    const legend = host.querySelectorAll<HTMLButtonElement>('.lintje-legend__button')
    legend[0].click()
    expect(nodes()).toEqual(before)
    expect(nodes().filter((node) => node.classList.contains('is-hidden'))).toHaveLength(2)
    legend[0].click()
    expect(nodes()).toEqual(before)
    expect(points(host)).toHaveLength(3)
  })

  it('brings the norm in with its label, as a reference', () => {
    const { host } = draw({ ...SPEC, threshold: 10 })
    const reference = host.querySelector('.lintje-chart__reference')
    expect(reference?.querySelector('line[stroke-dasharray="3 3"]')).not.toBeNull()
    expect(reference?.textContent).toContain('norm 10 min')
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
    // Beside it, within half of --h-target, the drawing's one target takes the click for it.
    const [cx, cy] = centre(button)
    hit(host, 'click', cx + 12, cy)
    expect(onSelect).toHaveBeenCalledTimes(2)
  })

  it('keeps a point its own where it is drawn, and gives the space between to the nearest', () => {
    const onSelect = vi.fn()
    const { host } = draw(
      {
        ...SPEC,
        series: [
          {
            label: 'Loket',
            points: [
              { label: 'Breda', x: 100, y: 5, href: '?loket=bda' },
              { label: 'Zwolle', x: 112, y: 5, href: '?loket=zwo' },
            ],
          },
        ],
      },
      { onSelect },
    )
    const [breda, zwolle] = points(host)
    const [bx, by] = centre(breda)
    const [zx] = centre(zwolle)
    expect(zx - bx).toBeGreaterThan(9)
    expect(zx - bx).toBeLessThan(24)
    const title = () => host.querySelector('.lintje-chart-tooltip__title')?.textContent

    // On the drawn mark, that mark; Zwolle's reach does not cover Breda.
    breda.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: bx, clientY: by }))
    expect(title()).toBe('Breda')
    breda.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ label: 'Breda' }))

    // Between and around them, the nearest.
    hit(host, 'mousemove', bx - 10, by)
    expect(title()).toBe('Breda')
    hit(host, 'mousemove', zx + 10, by)
    expect(title()).toBe('Zwolle')
    hit(host, 'click', zx + 10, by)
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ label: 'Zwolle' }))

    // Beyond half of --h-target, nothing.
    hit(host, 'mousemove', bx, by + 40)
    expect(title()).toBeUndefined()
  })

  it('tells a name in two series apart without an id', () => {
    const onSelect = vi.fn()
    const { host } = draw(
      {
        ...SPEC,
        series: [
          { label: 'Loket', points: [{ label: 'Utrecht', x: 1, y: 2, href: '?a' }] },
          { label: 'Servicepunt', points: [{ label: 'Utrecht', x: 5, y: 2, href: '?b' }] },
        ],
      },
      { onSelect },
    )
    const ids = points(host).map((point) => point.getAttribute('data-mark-id'))
    expect(ids).toEqual(['Loket · Utrecht', 'Servicepunt · Utrecht'])
  })

  it('shows no labels where two named labels, or a label and a point, would meet', () => {
    const close: ScatterSpec = {
      ...SPEC,
      series: [
        {
          label: 'Loket',
          points: [
            { label: 'Breda', x: 100, y: 5 },
            { label: 'Zwolle', x: 103, y: 5.2 },
            { label: 'Delft', x: 60, y: 9 },
          ],
        },
      ],
    }
    const labels = (host: Element) => host.querySelectorAll('.lintje-chart__data-label')
    expect(labels(draw({ ...close, dataLabels: ['Breda', 'Zwolle'] }).host)).toHaveLength(0)
    document.body.innerHTML = ''
    expect(labels(draw({ ...close, dataLabels: ['Delft'] }).host)).toHaveLength(1)
    document.body.innerHTML = ''
    // Gouda stands just above-left of Breda, where Breda's label would go; right is no room.
    const covered: ScatterSpec = {
      ...SPEC,
      series: [
        {
          label: 'Loket',
          points: [
            { label: 'Breda', x: 100, y: 5 },
            { label: 'Gouda', x: 90, y: 5.3 },
          ],
        },
      ],
    }
    expect(labels(draw({ ...covered, dataLabels: ['Breda'] }).host)).toHaveLength(0)
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
