/**
 * The stacked area: the parts in the ladder of one variable, darkest at the bottom; a missing
 * value breaks its part and every part above it while the parts below stay, and the rest of the
 * column is hatched (rule 15); a part switched off shrinks out on a fixed axis; the tooltip reads
 * the drawing from top to bottom and ends with the total.
 */
import { render } from 'lit'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChartController, type ChartOptions } from '../shared/controller'
import { renderStackedAreaChart } from './stacked-area-chart'
import type { ChartSpec } from '../shared/types'

type StackedAreaSpec = Extract<ChartSpec, { kind: 'stacked-area' }>

function draw(
  spec: StackedAreaSpec,
  style = '',
): { host: HTMLElement; controller: ChartController } {
  const host = document.createElement('div')
  document.body.append(host)
  const options: ChartOptions = {
    controller: new ChartController(() => render(renderStackedAreaChart(spec, options), host)),
    description: 'Een gestapeld vlak.',
  }
  render(renderStackedAreaChart(spec, options), host)
  // The motion tokens are read on the drawing's group; happy-dom does not inherit them there.
  host.querySelector('.lintje-chart__reveal')?.setAttribute('style', style)
  return { host, controller: options.controller }
}

// Online missing in the third week: nothing lies under the stack there.
const SPEC: StackedAreaSpec = {
  kind: 'stacked-area',
  labels: ['1', '2', '3', '4', '5'],
  series: [
    { label: 'Online', values: [60, 62, null, 70, 72] },
    { label: 'Balie', values: [30, 31, 29, 28, 27] },
    { label: 'Post', values: [10, 9, 9, 8, 8] },
  ],
}

// Only Post missing in the third week: Online and Balie are known under it.
const MIDDLE: StackedAreaSpec = {
  kind: 'stacked-area',
  labels: ['1', '2', '3', '4', '5'],
  series: [
    { label: 'Online', values: [60, 62, 65, 70, 72] },
    { label: 'Balie', values: [30, 31, 29, 28, 27] },
    { label: 'Post', values: [10, 9, null, 8, 8] },
    { label: 'Telefoon', values: [5, 6, 5, 4, 4] },
  ],
}

/** The polygons of each part, bottom first. */
const parts = (host: Element) =>
  [...host.querySelectorAll('.lintje-chart__reveal > g')].map((group) => [
    ...group.querySelectorAll('polygon'),
  ])
const points = (polygon: Element) =>
  polygon
    .getAttribute('points')!
    .split(' ')
    .map((point) => point.split(',').map(Number))
const hatches = (host: Element) => [...host.querySelectorAll('polygon[fill^="url(#hatch-"]')]
const ticks = (host: Element) =>
  [...host.querySelectorAll('.lintje-chart__axis-label')].map((label) => label.textContent?.trim())
const tooltipRows = (host: Element) =>
  [...host.querySelectorAll('.lintje-chart-tooltip__row')].map((row) => ({
    text: row.textContent?.replace(/\s+/g, ' ').trim(),
    divider: row.classList.contains('lintje-chart-tooltip__row--divider'),
    marker: row.querySelector('.lintje-chart-tooltip__marker') != null,
  }))
function walk(host: Element, ...keys: string[]): void {
  const drawing = host.querySelector('svg[tabindex="0"]') as SVGSVGElement
  for (const key of keys) {
    drawing.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  }
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('the stacked area', () => {
  it('draws the first part at the bottom in the darkest tint, the rest up the ladder', () => {
    const { host } = draw({ ...SPEC, color: 'dark-blue' })
    expect(parts(host).map((polygons) => polygons[0].getAttribute('fill'))).toEqual([
      'var(--color-chart-dark-blue)',
      'var(--color-chart-dark-blue-tint-2)',
      'var(--color-chart-dark-blue-tint-4)',
    ])
    expect(host.querySelectorAll('.lintje-legend__marker--square')).toHaveLength(3)
    expect(host.querySelector('.lintje-legend__label')?.textContent).toBe('Online')
  })

  it('breaks every part above a missing bottom part and hatches the column from the floor', () => {
    const { host } = draw(SPEC)
    // Two runs per part: no area bridges the gap.
    expect(parts(host).map((polygons) => polygons.length)).toEqual([2, 2, 2])
    // A 1 px line in the surface between neighbours, not along the floor.
    expect(host.querySelectorAll('polyline.lintje-chart__segment')).toHaveLength(4)
    // The two segments either side of the gap, down to the floor at the missing point.
    const hatch = hatches(host)
    expect(hatch).toHaveLength(2)
    const floor = points(parts(host)[0][0]).at(-1)![1]
    expect(points(hatch[0])[2][1]).toBe(floor)
    expect(hatch[0].hasAttribute('opacity')).toBe(false)
  })

  it('keeps the parts under a missing one, and hatches from their top', () => {
    const { host } = draw(MIDDLE)
    const [online, balie, post, telefoon] = parts(host)
    expect([online.length, balie.length, post.length, telefoon.length]).toEqual([1, 1, 2, 2])
    // Online and Balie run through the third point: five points along each top.
    expect(points(balie[0])).toHaveLength(10)
    const balieTop = points(balie[0])[2]
    const hatch = hatches(host)
    expect(hatch).toHaveLength(2)
    // The first segment's lower right corner, and the second's lower left, are Balie's top.
    expect(points(hatch[0])[2]).toEqual(balieTop)
    expect(points(hatch[1])[3]).toEqual(balieTop)
  })

  it('names every part at a missing one, the missing and the total as "geen gegevens"', () => {
    const { host } = draw(MIDDLE)
    walk(host, 'Home', 'ArrowRight', 'ArrowRight')
    expect(tooltipRows(host)).toEqual([
      { text: 'Telefoon 5', divider: false, marker: true },
      { text: 'Post geen gegevens', divider: false, marker: true },
      { text: 'Balie 29', divider: false, marker: true },
      { text: 'Online 65', divider: false, marker: true },
      { text: 'Totaal geen gegevens', divider: true, marker: false },
    ])
    // Points only on the tops that are drawn.
    expect(host.querySelectorAll('.lintje-chart__hover-point')).toHaveLength(2)
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Totaal geen gegevens')
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
    expect(parts(host).flat()).toHaveLength(0)
    expect(host.querySelectorAll('.lintje-chart__reveal circle')).toHaveLength(2)
    expect(hatches(host)).toHaveLength(2)
  })

  it('takes a part switched off out of the stack, on the same axis', () => {
    const { host, controller } = draw(SPEC)
    const before = ticks(host)
    controller.toggleSeries('Online')
    expect(parts(host).map((polygons) => polygons.length)).toEqual([0, 1, 1])
    // The gap was Online's, so it goes with it.
    expect(hatches(host)).toHaveLength(0)
    expect(ticks(host)).toEqual(before)
    const item = host.querySelectorAll('.lintje-legend__item')[0]
    expect(item.querySelector('button')?.getAttribute('aria-pressed')).toBe('false')
  })

  it('reads the tooltip from top to bottom, then the total under a line', () => {
    const { host } = draw(SPEC)
    walk(host, 'Home', 'ArrowRight')
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
    walk(host, 'Home')
    expect(tooltipRows(host).map((row) => row.text)).toEqual([
      'Balie 30',
      'Online 60',
      'Totaal getoond 90',
    ])
    controller.toggleSeries('Post')
    walk(host, 'End')
    expect(tooltipRows(host).at(-1)?.text).toBe('Totaal 107')
  })
})

describe('a part switched on or off', () => {
  const PAIR: StackedAreaSpec = {
    kind: 'stacked-area',
    labels: ['1', '2'],
    series: [
      { label: 'A', values: [10, 10] },
      { label: 'B', values: [10, 10] },
    ],
  }
  // 320 ms is twenty frames of the fake clock's 16 ms, so halfway falls on a frame.
  const MOTION = '--dur-layer: 320ms; --ease-in-motion: linear'
  const tops = (polygon: Element) => points(polygon).map((point) => point[1])

  it('shrinks out over its duration while the part above settles, on the same nodes', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'performance'] })
    const { host, controller } = draw(PAIR, MOTION)
    const reveal = host.querySelector('.lintje-chart__reveal')
    const [[a], [b]] = parts(host)
    // The axis runs to 20 here, the top of B before the switch.
    const floorY = points(a).at(-1)![1]
    const twenty = tops(b)[0]
    const top = (value: number) => floorY - ((floorY - twenty) * value) / 20

    controller.toggleSeries('A')
    vi.advanceTimersByTime(160)
    // Halfway: A is half as thick and B rests on it.
    expect(tops(parts(host)[0][0])[0]).toBeCloseTo(top(5))
    expect(tops(parts(host)[1][0])[0]).toBeCloseTo(top(15))
    expect(parts(host)[1][0]).toBe(b)
    expect(host.querySelector('.lintje-chart__reveal')).toBe(reveal)

    vi.advanceTimersByTime(400)
    expect(parts(host)[0]).toHaveLength(0)
    expect(tops(parts(host)[1][0])[0]).toBeCloseTo(top(10))
    expect(parts(host)[1][0]).toBe(b)
    expect(host.querySelector('.lintje-chart__reveal')).toBe(reveal)
  })

  it('goes back from where a running switch stands', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'performance'] })
    const { host, controller } = draw(PAIR, MOTION)
    const full = tops(parts(host)[1][0])[0]
    controller.toggleSeries('A')
    vi.advanceTimersByTime(80)
    const quarter = tops(parts(host)[1][0])[0]
    controller.toggleSeries('A')
    // No jump back to the end state: the new switch starts at the quarter.
    expect(tops(parts(host)[1][0])[0]).toBeCloseTo(quarter)
    vi.advanceTimersByTime(500)
    expect(tops(parts(host)[1][0])[0]).toBeCloseTo(full)
  })

  it('goes straight to the end state under reduced motion', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'performance'] })
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) => ({ matches: query.includes('reduce'), media: query }) as MediaQueryList,
    )
    const { host, controller } = draw(PAIR, MOTION)
    const [, [b]] = parts(host)
    controller.toggleSeries('A')
    expect(parts(host)[0]).toHaveLength(0)
    expect(parts(host)[1][0]).toBe(b)
  })
})
