/**
 * The line chart: a missing value breaks the line (rule 15), two lines in colour carry a shape
 * besides it (rule 13), a dark-yellow line has an edge that reaches 3:1, a switched-off
 * series keeps its name at full contrast, and an event never hangs on the drawing alone.
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

  it('edges a mint-green line in its dark edge', () => {
    const { host } = draw({
      kind: 'line',
      labels: ['1', '2'],
      series: [{ label: 'A', values: [1, 2], color: 'mint-green' }],
    })
    expect(host.querySelector('.lintje-chart__line--casing')?.getAttribute('stroke')).toBe(
      'var(--color-chart-mint-green-edge)',
    )
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

  describe('events', () => {
    const spec: LineSpec = {
      kind: 'line',
      labels: ['wk 1', 'wk 2', 'wk 3', 'wk 4'],
      series: [{ label: 'A', values: [1, 2, 3, 4], area: true }],
      events: [
        { index: 1, label: 'Open voor iedereen' },
        { index: 3, label: 'Storing' },
        { index: 9, label: 'Buiten de labels' },
      ],
    }

    it('draws a numbered square per event with a line to the zero line, under the series', () => {
      const { host } = draw(spec)
      const numbers = [...host.querySelectorAll('.lintje-chart__event-number')]
      expect(numbers.map((number) => number.textContent?.trim())).toEqual(['1', '2'])
      expect(host.querySelector('.lintje-chart__reveal .lintje-chart__event-chip')).toBeNull()

      const line = host.querySelector('.lintje-chart__event-line')!
      const chip = host.querySelector('.lintje-chart__event-chip')!
      const chipBottom = Number(chip.getAttribute('y')) + Number(chip.getAttribute('height'))
      expect(Number(line.getAttribute('y1'))).toBe(chipBottom)
      const zero = host.querySelector('line[stroke="var(--color-chart-zero)"]')!
      expect(line.getAttribute('y2')).toBe(zero.getAttribute('y1'))

      // The event lines lie under the area and the lines.
      const order = [...host.querySelectorAll('.lintje-chart__event-line, polygon')]
      expect(order[0].classList.contains('lintje-chart__event-line')).toBe(true)
    })

    it('moves the plot down only when there are events', () => {
      const top = (host: Element) =>
        Math.min(
          ...[...host.querySelectorAll('line[stroke="var(--color-chart-grid)"]')].map((line) =>
            Number(line.getAttribute('y1')),
          ),
        )
      const without = draw({ ...spec, events: undefined }).host
      expect(without.querySelector('.lintje-chart__event-chip')).toBeNull()
      expect(without.querySelector('.lintje-chart-events')).toBeNull()
      expect(top(draw(spec).host)).toBeGreaterThan(top(without))
    })

    it('lists every event under the chart and names them in the description', () => {
      const { host } = draw(spec)
      const items = [...host.querySelectorAll('.lintje-chart-events__item')]
      expect(items.map((item) => item.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
        '1 wk 2 · Open voor iedereen',
        '2 wk 4 · Storing',
      ])
      expect(host.querySelector('desc')?.textContent).toBe(
        'Een lijn. Gebeurtenis 1, wk 2: Open voor iedereen. Gebeurtenis 2, wk 4: Storing.',
      )
    })

    it('shows the event in the tooltip of its category, and nowhere else', () => {
      const { host, controller } = draw(spec)
      const svg = host.querySelector('svg.lintje-chart__svg') as SVGElement
      svg.dispatchEvent(new FocusEvent('focus'))
      svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
      svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
      expect(controller.tooltip?.content.events).toEqual([
        { index: 1, label: 'Open voor iedereen', number: 1 },
      ])
      expect(controller.status).toBe('wk 2: A 2. Gebeurtenis 1: Open voor iedereen')
      expect(host.querySelector('.lintje-chart-tooltip__event')?.textContent).toContain(
        'Open voor iedereen',
      )
      svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
      expect(controller.tooltip?.content.events).toBeUndefined()
      expect(host.querySelector('.lintje-chart-tooltip__event')).toBeNull()
    })

    const weeks = Array.from({ length: 26 }, (_, i) => `wk ${14 + i}`)
    const flat = [{ label: 'A', values: weeks.map(() => 1) }]
    const chips = (host: Element) =>
      [...host.querySelectorAll('.lintje-chart__event-chip')].map((chip) => ({
        x: Number(chip.getAttribute('x')),
        y: Number(chip.getAttribute('y')),
        size: Number(chip.getAttribute('width')),
      }))
    const plotTop = (host: Element) =>
      Math.min(
        ...[...host.querySelectorAll('line[stroke="var(--color-chart-grid)"]')].map((line) =>
          Number(line.getAttribute('y1')),
        ),
      )
    /** Drawn at a width of its own: happy-dom measures every element as 0 wide. */
    function drawAt(width: number, events: LineSpec['events']) {
      const drawn = draw({ kind: 'line', labels: weeks, series: flat, events })
      drawn.controller.width = width
      drawn.controller.requestUpdate()
      return drawn
    }

    it('puts a second event at one category a row down, and moves the plot down with it', () => {
      const one = drawAt(600, [{ index: 8, label: 'Eerste' }]).host
      const { host } = drawAt(600, [
        { index: 8, label: 'Eerste' },
        { index: 8, label: 'Tweede' },
      ])
      const [first, second] = chips(host)
      expect(second.x).toBe(first.x)
      expect(second.y).toBeGreaterThanOrEqual(first.y + first.size)
      expect(plotTop(host)).toBeGreaterThan(plotTop(one))
      expect(
        [...host.querySelectorAll('.lintje-chart__event-number')].map((n) => n.textContent),
      ).toEqual(['1', '2'])
    })

    it('puts neighbours a row down on a narrow drawing, and keeps one row on a wide one', () => {
      const events = [
        { index: 8, label: 'Eerste' },
        { index: 9, label: 'Tweede' },
      ]
      const [a, b] = chips(drawAt(320, events).host)
      expect(Math.abs(b.x - a.x)).toBeLessThan(a.size)
      expect(b.y).toBeGreaterThanOrEqual(a.y + a.size)
      const [c, d] = chips(drawAt(1400, events).host)
      expect(d.y).toBe(c.y)
    })

    it('keeps the squares of the first and last category inside the drawing', () => {
      const { host } = drawAt(600, [
        { index: 0, label: 'Begin' },
        { index: 25, label: 'Eind' },
      ])
      for (const chip of chips(host)) {
        expect(chip.x).toBeGreaterThanOrEqual(0)
        expect(chip.x + chip.size).toBeLessThanOrEqual(600)
      }
    })

    it('numbers the events from left to right, without the ones outside the labels', () => {
      const { host } = draw({
        ...spec,
        events: [
          { index: 3, label: 'Later' },
          { index: 99, label: 'Buiten de labels' },
          { index: 1, label: 'Eerder' },
        ],
      })
      const items = [...host.querySelectorAll('.lintje-chart-events__item')]
      expect(items.map((item) => item.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
        '1 wk 2 · Eerder',
        '2 wk 4 · Later',
      ])
    })

    it('keeps the square at the as-of time, and the note over an event line after it', () => {
      const { host } = draw({
        kind: 'line',
        labels: weeks,
        series: [{ label: 'A', values: weeks.map((_, i) => (i > 10 ? null : 1)) }],
        asOfIndex: 10,
        asOfLabel: 'wk 24',
        pendingHours: 20,
        events: [
          { index: 10, label: 'Op het peilmoment' },
          { index: 20, label: 'Erna' },
        ],
      })
      expect(chips(host)).toHaveLength(2)
      const note = host.querySelector('.lintje-chart__as-of-note')!
      const lines = [...host.querySelectorAll('.lintje-chart__event-line')]
      for (const line of lines) {
        expect(line.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      }
      const css = readFileSync(resolve('src/components/shared/charts/shared/chart.css'), 'utf8')
      expect(css).toMatch(
        /\.lintje-chart__as-of-note \{[^}]*stroke: var\(--color-bg-surface\);[^}]*paint-order: stroke fill;/,
      )
    })
  })
})

describe('a forecast on the line chart', () => {
  const years = ['2021', '2022', '2023', '2024', '2025', '2026']
  const spec: LineSpec = {
    kind: 'line',
    labels: years,
    forecastFrom: 3,
    intervalLabel: 'Marge 80 %',
    series: [
      {
        label: 'A',
        values: [10, 12, 14, 16, 18, 20],
        forecast: { low: [null, null, null, 15, 16, 17], high: [null, null, null, 17, 20, 23] },
      },
    ],
  }
  const two: LineSpec = {
    ...spec,
    series: [
      { ...spec.series[0], color: 'sky-blue' },
      {
        label: 'B',
        color: 'dark-yellow',
        values: [5, 6, 7, 8, 9, 10],
        forecast: { low: [null, null, null, 7, 8, 9], high: [null, null, null, 9, 10, 11] },
      },
    ],
  }
  const points = (element: Element) =>
    element
      .getAttribute('points')!
      .split(' ')
      .map((point) => point.split(',').map(Number))
  const measured = (host: Element) => [
    ...host.querySelectorAll(
      '.lintje-chart__line:not(.lintje-chart__line--casing):not(.lintje-chart__line--forecast)',
    ),
  ]
  /** The numbers of the value axis. */
  const ticks = (host: Element) =>
    [...host.querySelectorAll('text.lintje-chart__axis-label[text-anchor="end"]')]
      .map((text) => Number(text.textContent?.trim()))
      .filter(Number.isFinite)
  const dotted = (host: Element) => [
    ...host.querySelectorAll('.lintje-chart__line--forecast:not(.lintje-chart__line--casing)'),
  ]

  it('goes on dotted from the last measured point, in the same colour', () => {
    const { host } = draw(spec)
    const [line] = measured(host)
    const [forecast] = dotted(host)
    expect(points(line)).toHaveLength(3)
    expect(points(forecast)).toHaveLength(4)
    expect(points(forecast)[0]).toEqual(points(line)[2])
    expect(forecast.getAttribute('stroke')).toBe(line.getAttribute('stroke'))
    // The dots are the stylesheet's, and mean only a forecast.
    const css = readFileSync(resolve('src/components/shared/charts/shared/chart.css'), 'utf8')
    expect(css).toMatch(
      /\.lintje-chart__line--forecast \{ stroke-dasharray: 0 5; stroke-linecap: round; \}/,
    )
  })

  it('opens the margin from width zero at the last measured point', () => {
    const { host } = draw(spec)
    const band = host.querySelector('.lintje-chart__band')!
    const corners = points(band)
    // Upper edge left to right, lower edge back: the first and last corner are one point.
    expect(corners).toHaveLength(8)
    expect(corners[0]).toEqual(corners[corners.length - 1])
    expect(corners[0]).toEqual(points(measured(host)[0])[2])
    // One series fills its margin.
    expect(band.classList.contains('is-filled')).toBe(true)
  })

  it('lays the forecast on its own ground, under the grid, with one boundary and two words', () => {
    const { host } = draw(spec)
    const ground = host.querySelector('.lintje-chart__forecast-ground')!
    const grid = host.querySelector('line[stroke="var(--color-chart-grid)"]')!
    expect(ground.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const boundary = host.querySelectorAll('.lintje-chart__boundary')
    expect(boundary).toHaveLength(1)
    const words = [...boundary[0].querySelectorAll('text')].map((text) => text.textContent)
    expect(words).toEqual(['Gemeten', 'Raming'])
    expect(boundary[0].querySelector('line')?.getAttribute('x1')).toBe(ground.getAttribute('x'))
  })

  it('fills only the margin of the series with emphasis, and steps the others back', () => {
    const { host, controller } = draw(two)
    const bands = () => [...host.querySelectorAll('.lintje-chart__band')]
    expect(bands()).toHaveLength(2)
    expect(bands().some((band) => band.classList.contains('is-filled'))).toBe(false)

    const button = [...host.querySelectorAll('.lintje-legend__button')].find(
      (b) => b.textContent?.trim() === 'B',
    )!
    button.dispatchEvent(new MouseEvent('mouseenter'))
    expect(controller.emphasis).toBe('B')
    expect(bands().map((band) => band.classList.contains('is-filled'))).toEqual([false, true])
    const groups = [...host.querySelectorAll('.lintje-chart__series')]
    expect(groups.map((group) => group.classList.contains('is-muted'))).toEqual([true, false])

    button.dispatchEvent(new MouseEvent('mouseleave'))
    expect(bands().some((band) => band.classList.contains('is-filled'))).toBe(false)
    // The same nodes: the emphasis draws nothing in again.
    expect(bands()).toHaveLength(2)
  })

  it('keeps the dark-yellow edge under the dots', () => {
    const { host } = draw(two)
    const casing = host.querySelector('.lintje-chart__line--casing.lintje-chart__line--forecast')
    expect(casing?.getAttribute('stroke')).toBe('var(--color-chart-dark-yellow-text)')
  })

  it('draws an open hover point in the forecast and a full one on measured points', () => {
    const { host, controller } = draw(spec)
    controller.hoverIndex = 4
    controller.requestUpdate()
    const open = host.querySelector('.lintje-chart__hover-point')!
    expect(open.classList.contains('lintje-chart__hover-point--forecast')).toBe(true)
    expect(open.hasAttribute('fill')).toBe(false)
    expect(open.getAttribute('color')).toBe('var(--color-chart-default)')
    controller.hoverIndex = 2
    controller.requestUpdate()
    const full = host.querySelector('.lintje-chart__hover-point')!
    expect(full.classList.contains('lintje-chart__hover-point--forecast')).toBe(false)
    expect(full.getAttribute('fill')).toBe('var(--color-chart-default)')
  })

  it('says "raming" in the tooltip and gives the margin as low – high', () => {
    const { host, controller } = draw(spec)
    const svg = host.querySelector('svg.lintje-chart__svg') as SVGElement
    svg.dispatchEvent(new FocusEvent('focus'))
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }))
    expect(controller.tooltip?.content.note).toBe('raming')
    expect(controller.tooltip?.content.rows).toEqual([
      { label: 'A', value: '20', color: 'var(--color-chart-default)', marker: 'dotted' },
      { label: 'laag – hoog', value: '17 – 23', note: true },
    ])
    expect(controller.status).toBe('2026 raming: A 20, laag – hoog 17 – 23')
    expect(host.querySelector('.lintje-chart-tooltip__title-note')?.textContent).toBe('raming')
    // The point the keyboard stands on has the focus ring.
    expect(host.querySelector('.lintje-chart__focus-point')).not.toBeNull()

    svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }))
    expect(controller.tooltip?.content.note).toBeUndefined()
    expect(controller.tooltip?.content.rows).toEqual([
      { label: 'A', value: '10', color: 'var(--color-chart-default)', marker: 'line' },
    ])
  })

  it('names the one bound there is, or says there is no margin', () => {
    const { host, controller } = draw({
      ...spec,
      series: [
        {
          ...spec.series[0],
          forecast: {
            low: [null, null, null, 15, null, 17],
            high: [null, null, null, 18, null, null],
          },
        },
      ],
    })
    const svg = host.querySelector('svg.lintje-chart__svg') as SVGElement
    svg.dispatchEvent(new FocusEvent('focus'))
    const rowAt = (key: string) => {
      svg.dispatchEvent(new KeyboardEvent('keydown', { key }))
      return controller.tooltip?.content.rows[1]
    }
    rowAt('Home')
    rowAt('ArrowRight')
    rowAt('ArrowRight')
    expect(rowAt('ArrowRight')).toEqual({ label: 'laag – hoog', value: '15 – 18', note: true })
    expect(rowAt('ArrowRight')).toEqual({ label: 'laag – hoog', value: 'geen marge', note: true })
    expect(rowAt('ArrowRight')).toEqual({ label: 'ondergrens', value: '17', note: true })
    // The margin stops where a bound is missing.
    expect(host.querySelectorAll('.lintje-chart__band')).toHaveLength(1)
    expect(points(host.querySelector('.lintje-chart__band')!)).toHaveLength(4)
  })

  it('draws a forecast without a margin with only its key', () => {
    const { host } = draw({ ...spec, series: [{ ...spec.series[0], forecast: undefined }] })
    expect(dotted(host)).toHaveLength(1)
    expect(host.querySelector('.lintje-chart__band')).toBeNull()
    const keys = [...host.querySelectorAll('.lintje-legend__label')].map((l) => l.textContent)
    expect(keys).toEqual(['A', 'Raming'])
  })

  it('switches the forecast and its margin off with their series', () => {
    const { host, controller } = draw(two)
    controller.toggleSeries('A')
    const group = host.querySelectorAll('.lintje-chart__series')[0]
    expect(group.classList.contains('is-off')).toBe(true)
    expect(group.querySelector('.lintje-chart__line--forecast')).not.toBeNull()
    expect(group.querySelector('.lintje-chart__band')).not.toBeNull()
    // The other series alone now: its margin fills.
    const other = host.querySelectorAll('.lintje-chart__series')[1]
    expect(other.querySelector('.lintje-chart__band.is-filled')).not.toBeNull()
  })

  it('makes "Raming" and "Marge" keys: no button, no aria-pressed, nothing switches', () => {
    const { host, controller } = draw(two)
    const items = [...host.querySelectorAll('.lintje-legend__item')]
    expect(items.map((item) => item.textContent?.trim())).toEqual([
      'A',
      'B',
      'Raming',
      'Marge 80 %',
    ])
    for (const item of items.slice(2)) {
      expect(item.querySelector('button')).toBeNull()
      expect(item.querySelector('[aria-pressed]')).toBeNull()
      ;(item as HTMLElement).click()
    }
    expect(controller.hiddenSeries).toEqual([])
    // With more series the keys are neutral; with one they take its colour.
    const marker = items[2].querySelector('.lintje-legend__marker--dotted') as HTMLElement
    expect(marker.style.color).toBe('var(--color-text-muted)')
    const one = draw(spec).host.querySelector('.lintje-legend__marker--dotted') as HTMLElement
    expect(one.style.color).toBe('var(--color-chart-default)')
  })

  it('draws no hatching, no cut and no second boundary for an as-of time', () => {
    const { host } = draw({ ...spec, asOfIndex: 2, asOfLabel: '12:00', pendingHours: 20 })
    expect(host.querySelector('rect[fill^="url(#hatch-"]')).toBeNull()
    expect(host.querySelector('.lintje-chart__as-of-note')).toBeNull()
    expect(host.querySelectorAll('line[stroke-dasharray="4 3"]')).toHaveLength(1)
    // Not cut at the as-of time: the forecast runs to the last label.
    expect(points(dotted(host)[0])).toHaveLength(4)
  })

  it('draws as without a forecast when forecastFrom names no point after the first', () => {
    for (const forecastFrom of [0, -1, 6, 9]) {
      const { host } = draw({ ...spec, forecastFrom })
      expect(dotted(host)).toHaveLength(0)
      expect(host.querySelector('.lintje-chart__band')).toBeNull()
      expect(host.querySelector('.lintje-chart__boundary')).toBeNull()
      expect(points(measured(host)[0])).toHaveLength(6)
    }
  })

  it('starts the dots loose on forecastFrom when the last measured point is missing', () => {
    const { host } = draw({
      ...spec,
      series: [{ ...spec.series[0], values: [10, 12, null, 16, null, 20] }],
    })
    // The measured line, a lone forecast point and a lone point at the end.
    expect(points(measured(host)[0])).toHaveLength(2)
    expect(dotted(host)).toHaveLength(0)
    const band = points(host.querySelector('.lintje-chart__band')!)
    // The margin starts at 2024 with its own width.
    expect(band[0][1]).not.toEqual(band[band.length - 1][1])
  })

  it('gives a comparison no forecast: it stays grey and dashed to the end', () => {
    const { host } = draw({
      ...spec,
      series: [
        spec.series[0],
        {
          label: 'Vorig jaar',
          values: [9, 11, 13, 15, 17, 19],
          comparison: true,
          forecast: { low: [null, null, null, 1, 1, 1], high: [null, null, null, 99, 99, 99] },
        },
      ],
    })
    const comparison = host.querySelector('polyline[stroke-dasharray="5 4"]')!
    expect(points(comparison)).toHaveLength(6)
    expect(host.querySelectorAll('.lintje-chart__band')).toHaveLength(1)
    // Its margin sets no scale either.
    expect(Math.max(...ticks(host))).toBeLessThan(99)
  })

  it('scales to the highest bound and stops a negative bound on the zero line', () => {
    const { host } = draw({
      ...spec,
      series: [
        {
          ...spec.series[0],
          forecast: { low: [null, null, null, -5, -5, -5], high: [null, null, null, 30, 40, 50] },
        },
      ],
    })
    expect(Math.max(...ticks(host))).toBeGreaterThanOrEqual(50)
    const zero = Number(
      host.querySelector('line[stroke="var(--color-chart-zero)"]')!.getAttribute('y1'),
    )
    const band = points(host.querySelector('.lintje-chart__band')!)
    expect(Math.max(...band.map(([, y]) => y))).toBeLessThanOrEqual(zero)
  })

  it('stops the margin at the top of the plot under a fixed maximum', () => {
    const { host } = draw({ ...spec, fixedMax: 20 })
    const top = Math.min(
      ...[...host.querySelectorAll('line[stroke="var(--color-chart-grid)"]')].map((line) =>
        Number(line.getAttribute('y1')),
      ),
    )
    const band = points(host.querySelector('.lintje-chart__band')!)
    expect(Math.min(...band.map(([, y]) => y))).toBeGreaterThanOrEqual(top)
  })
})
