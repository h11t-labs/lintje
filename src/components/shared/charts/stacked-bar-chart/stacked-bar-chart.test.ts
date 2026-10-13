/**
 * The bars' marks: a label on a segment takes the text its fill carries, neighbouring
 * segments and slices part with a line in the surface, a missing bar is a hatched slot (rule
 * 15), and the dual-axis chart draws its bars opaque and its dark-yellow line with an edge. A
 * series switched off in the legend keeps its nodes, and the axes stand.
 */
import { render } from 'lit'
import { afterEach, describe, expect, it } from 'vitest'
import { ChartController, type ChartOptions } from '../shared/controller'
import { renderChart } from '../shared/render-chart'
import type { ChartSpec } from '../shared/types'

function draw(spec: ChartSpec, extra: Partial<ChartOptions> = {}): HTMLElement {
  const host = document.createElement('div')
  document.body.append(host)
  const options: ChartOptions = {
    controller: new ChartController(() => render(renderChart(spec, options), host)),
    description: 'Een figuur.',
    // Tall enough for a label inside every segment.
    height: 600,
    ...extra,
  }
  render(renderChart(spec, options), host)
  return host
}

const labelClasses = (host: Element) =>
  [...host.querySelectorAll('.lintje-chart__data-label')].map((label) =>
    (label.getAttribute('class') ?? '').replace('lintje-chart__data-label', '').trim(),
  )

const TINT = (n: number) => `var(--color-chart-tint-${n})`

const fills = (host: Element) =>
  [...host.querySelectorAll('rect.lintje-chart__segment')].map((rect) => rect.getAttribute('fill'))

afterEach(() => {
  document.body.innerHTML = ''
})

describe('the stacked bars', () => {
  it('writes white only on the darkest rung of the ladder, ink on the lighter ones', () => {
    const host = draw({
      kind: 'stacked-bar',
      normalized: true,
      labels: ['ma'],
      series: [1, 2, 3, 4].map((n) => ({ label: `S${n}`, values: [25] })),
    })
    expect(labelClasses(host)).toEqual([
      'lintje-chart__data-label--inside',
      'lintje-chart__data-label--inside-light',
      'lintje-chart__data-label--inside-light',
      'lintje-chart__data-label--inside-light',
    ])
  })

  it('writes on a named colour what that colour carries', () => {
    const host = draw({
      kind: 'stacked-bar',
      normalized: true,
      labels: ['ma'],
      series: [
        { label: 'Rood', values: [50], color: 'red' },
        { label: 'Geel', values: [50], color: 'dark-yellow' },
      ],
    })
    expect(labelClasses(host)).toEqual([
      'lintje-chart__data-label--inside',
      'lintje-chart__data-label--inside-light',
    ])
  })

  it('writes white on every dark data colour, the newer ones too', () => {
    const host = draw({
      kind: 'stacked-bar',
      normalized: true,
      labels: ['ma'],
      series: [
        { label: 'Paars', values: [25], color: 'purple' },
        { label: 'Bruin', values: [25], color: 'brown' },
        { label: 'Geel', values: [25], color: 'yellow' },
        { label: 'Lichtblauw', values: [25], color: 'light-blue' },
      ],
    })
    expect(labelClasses(host)).toEqual([
      'lintje-chart__data-label--inside',
      'lintje-chart__data-label--inside',
      'lintje-chart__data-label--inside-light',
      'lintje-chart__data-label--inside-light',
    ])
  })

  it('spreads two series over the ladder, as the pie spreads two parts', () => {
    const host = draw({
      kind: 'stacked-bar',
      labels: ['ma', 'di'],
      series: [
        { label: 'Eerste', values: [3, 4] },
        { label: 'Tweede', values: [1, 2] },
      ],
    })
    // Column by column, bottom first.
    expect(fills(host)).toEqual([TINT(1), TINT(4), TINT(1), TINT(4)])
  })

  it('keeps more than five series and gives the ones past five the lightest tint', () => {
    const host = draw({
      kind: 'stacked-bar',
      labels: ['ma'],
      series: Array.from({ length: 7 }, (_, i) => ({ label: `Reeks ${i + 1}`, values: [i + 1] })),
    })
    expect(fills(host)).toEqual([TINT(1), TINT(2), TINT(3), TINT(4), TINT(5), TINT(5), TINT(5)])
  })

  it('parts the segments with a line in the surface', () => {
    const host = draw({
      kind: 'stacked-bar',
      labels: ['ma'],
      series: [
        { label: 'A', values: [3] },
        { label: 'B', values: [2] },
      ],
    })
    expect(host.querySelectorAll('rect.lintje-chart__segment')).toHaveLength(2)
  })
})

describe('the other marks', () => {
  it('parts the slices of a pie with a line in the surface', () => {
    const host = draw({
      kind: 'pie',
      segments: [
        { label: 'A', value: 3 },
        { label: 'B', value: 2 },
      ],
    })
    expect(host.querySelectorAll('path.lintje-chart__segment')).toHaveLength(2)
  })

  it('hatches the slot of a missing bar over the plot instead of drawing nothing', () => {
    const host = draw({ kind: 'bar', labels: ['ma', 'di'], values: [3, null] })
    expect(host.querySelectorAll('.lintje-chart__bar')).toHaveLength(1)
    const slot = host.querySelector('.lintje-chart__missing')
    expect(slot?.getAttribute('fill')).toMatch(/^url\(#hatch-/)
    expect(Number(slot?.getAttribute('height'))).toBeGreaterThan(0)
  })

  it('draws the dual-axis bars opaque, edges its dark-yellow line and breaks it at a gap', () => {
    const host = draw({
      kind: 'dual-axis',
      labels: ['ma', 'di', 'wo', 'do'],
      left: { label: 'Aantal', values: [3, null, 4, 5] },
      right: { label: 'Duur', values: [20, 30, null, 25] },
      pendingHours: 1,
    })
    for (const bar of host.querySelectorAll('.lintje-chart__bar')) {
      expect(bar.hasAttribute('opacity')).toBe(false)
    }
    expect(host.querySelector('.lintje-chart__missing')).not.toBeNull()
    for (const hatch of host.querySelectorAll('rect[fill^="url(#hatch-"]')) {
      expect(hatch.hasAttribute('opacity')).toBe(false)
    }
    const lines = host.querySelectorAll('.lintje-chart__line:not(.lintje-chart__line--casing)')
    expect(lines).toHaveLength(1)
    expect(host.querySelectorAll('.lintje-chart__line--casing')).toHaveLength(1)
    // The lone value after the gap is a point.
    expect(host.querySelectorAll('.lintje-chart__reveal circle')).toHaveLength(1)
  })

  it('writes the percentage inside an attention bar in ink, inside a green one in white', () => {
    const host = draw({
      kind: 'target-progress',
      rows: [
        { label: 'Noord', value: 125 },
        { label: 'Zuid', value: 125 },
      ],
      target: 130,
    })
    // A bar past the axis's 110 leaves no room right of it: the label goes inside.
    expect(labelClasses(host)).toEqual([
      'lintje-chart__data-label--inside-light',
      'lintje-chart__data-label--inside-light',
    ])
    const green = draw({ kind: 'target-progress', rows: [{ label: 'Noord', value: 125 }] })
    expect(labelClasses(green)).toEqual(['lintje-chart__data-label--inside'])
  })
})

const axisLabels = (host: Element) =>
  [...host.querySelectorAll('.lintje-chart__axis-label')].map((label) => label.textContent?.trim())

const legendButtons = (host: Element) => [
  ...host.querySelectorAll<HTMLButtonElement>('.lintje-legend__button'),
]

describe('the legend', () => {
  it('shrinks a stacked part switched off out of the stack, on the same axis', () => {
    const host = draw({
      kind: 'stacked-bar',
      labels: ['ma', 'di'],
      series: [
        { label: 'Online', values: [30, 40] },
        { label: 'Balie', values: [10, 20] },
      ],
    })
    const before = axisLabels(host)
    const segments = () => [...host.querySelectorAll('rect.lintje-chart__segment')]
    const nodes = segments()
    legendButtons(host)[0].click()
    // The part keeps its nodes, flat and out of reach, so switched back it does not draw in again.
    expect(segments()).toEqual(nodes)
    const online = segments().filter((_, n) => n % 2 === 0)
    expect(online.map((rect) => rect.getAttribute('height'))).toEqual(['0', '0'])
    expect(online.every((rect) => rect.getAttribute('aria-hidden') === 'true')).toBe(true)
    expect(axisLabels(host)).toEqual(before)
    expect(legendButtons(host)[0].getAttribute('aria-pressed')).toBe('false')
  })

  it('switches either side of a dual-axis chart and its norm off, both axes standing', () => {
    const host = draw({
      kind: 'dual-axis',
      labels: ['ma', 'di'],
      left: { label: 'Aanvragen', values: [10, 20] },
      right: { label: 'Doorlooptijd', values: [3, 4] },
      threshold: 5,
    })
    const before = axisLabels(host)
    const off = (selector: string) =>
      host.querySelector(selector)?.closest('.lintje-chart__series')?.classList.contains('is-off')
    const buttons = legendButtons(host)
    expect(buttons.map((button) => button.textContent?.trim())).toEqual([
      'Aanvragen (linkeras)',
      'Doorlooptijd (rechteras)',
      'Norm 5',
    ])
    buttons[0].click()
    expect(off('rect.lintje-chart__bar')).toBe(true)
    expect(off('.lintje-chart__line')).toBe(false)
    legendButtons(host)[1].click()
    expect(off('.lintje-chart__line')).toBe(true)
    legendButtons(host)[2].click()
    expect(host.querySelector('line[stroke-dasharray="4 3"]')?.classList).toContain('is-off')
    expect(axisLabels(host)).toEqual(before)
  })

  it('narrows a grouped bar switched off, its neighbour closing up, on the same axis', () => {
    const host = draw(
      {
        kind: 'grouped-bar',
        labels: ['ma'],
        series: [
          { label: 'Deze week', values: [30] },
          { label: 'Vorige week', values: [60] },
        ],
      },
      { plotArea: { width: 400, height: 300, left: 40, right: 8, top: 16, bottom: 32 } },
    )
    const before = axisLabels(host)
    const widths = () =>
      [...host.querySelectorAll('rect.lintje-chart__bar')].map((rect) =>
        Number(rect.getAttribute('width')),
      )
    const [first, second] = widths()
    expect(first).toBe(second)
    legendButtons(host)[1].click()
    const [shown, gone] = widths()
    expect(gone).toBe(0)
    expect(shown).toBeGreaterThan(first)
    expect(axisLabels(host)).toEqual(before)
  })

  it('switches nothing in a legend of one series', () => {
    const host = draw({
      kind: 'stacked-bar',
      labels: ['ma'],
      series: [{ label: 'Online', values: [30] }],
    })
    expect(host.querySelector('.lintje-legend__item')).not.toBeNull()
    expect(legendButtons(host)).toHaveLength(0)
  })
})
