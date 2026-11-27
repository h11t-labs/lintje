/**
 * The histogram: classes that touch, labels on their bounds and "30+" under an open class, a
 * missing count hatched and never 0 (rule 15), and the median and threshold with their labels.
 *
 * happy-dom lays nothing out and measures text at 6.5 px a character.
 */
import { render } from 'lit'
import { afterEach, describe, expect, it } from 'vitest'
import { ChartController, type ChartOptions } from '../shared/controller'
import { renderChart } from '../shared/render-chart'
import type { ChartSpec } from '../shared/types'
import { placeLineLabels, setForm } from './histogram-chart'

type HistogramSpec = Extract<ChartSpec, { kind: 'histogram' }>

const BINS = [40, 120, 260, 310, 280, 220, 170, 130, 95, 70, 52, 40, 30, 22, 16, 45].map(
  (count, i) => ({ from: i * 2, to: i === 15 ? null : i * 2 + 2, count }),
)

function draw(spec: Partial<HistogramSpec> = {}) {
  const host = document.createElement('div')
  document.body.append(host)
  const chart: HistogramSpec = { kind: 'histogram', bins: BINS, unit: 'dagen', ...spec }
  const options: ChartOptions = {
    controller: new ChartController(() => render(renderChart(chart, options), host)),
    description: 'Een figuur.',
    plotArea: { width: 592, height: 260, left: 32, right: 8, top: 16, bottom: 44 },
  }
  render(renderChart(chart, options), host)
  return { host, controller: options.controller }
}

const bars = (host: Element) => [...host.querySelectorAll('rect.lintje-chart__bar')]
const xLabels = (host: Element) =>
  [...host.querySelectorAll('text.lintje-chart__axis-label[text-anchor="middle"]')].map((text) =>
    text.textContent?.trim(),
  )

afterEach(() => {
  document.body.innerHTML = ''
})

describe('the histogram', () => {
  it('draws classes that touch, parted by the line in the surface', () => {
    const { host } = draw()
    const rects = bars(host)
    expect(rects).toHaveLength(16)
    for (const [i, rect] of rects.slice(1).entries()) {
      const before = rects[i]
      const end = Number(before.getAttribute('x')) + Number(before.getAttribute('width'))
      expect(Number(rect.getAttribute('x'))).toBeCloseTo(end)
      expect(rect.classList.contains('lintje-chart__segment')).toBe(true)
    }
    // The open last class is as wide as the one before it.
    expect(Number(rects[15].getAttribute('width'))).toBeCloseTo(
      Number(rects[14].getAttribute('width')),
    )
  })

  it('labels the bounds, thinned, and names an open class under its middle', () => {
    const { host } = draw()
    expect(xLabels(host)).toEqual(['0', '4', '8', '12', '16', '20', '24', '28', '30+'])
    // A tick under every labelled bound, none under "30+".
    const ticks = [...host.querySelectorAll('line')].filter(
      (line) => Number(line.getAttribute('y2')) - Number(line.getAttribute('y1')) === 4,
    )
    expect(ticks).toHaveLength(8)
  })

  it('hatches a missing count and never draws it as a bar of 0', () => {
    const { host } = draw({
      bins: BINS.map((bin, i) => (i === 3 ? { ...bin, count: null } : bin)),
    })
    expect(bars(host)).toHaveLength(15)
    const missing = host.querySelector('.lintje-chart__missing')
    expect(missing?.getAttribute('fill')).toMatch(/^url\(#hatch-/)
    expect(Number(missing?.getAttribute('height'))).toBeGreaterThan(0)
  })

  it('draws the median solid with a bold label and the threshold dashed', () => {
    const { host } = draw({ median: 9.6, threshold: 21, thresholdLabel: 'termijn 21 dagen' })
    const median = host.querySelector(
      'line[stroke-width="1.5"][stroke="var(--color-chart-emphasis)"]',
    )
    expect(median?.hasAttribute('stroke-dasharray')).toBe(false)
    const dashed = host.querySelector('line[stroke-dasharray="3 3"]')
    expect(dashed).not.toBeNull()
    const labels = [...host.querySelectorAll('[class*="-label--halo"]')].map((text) =>
      text.textContent?.trim(),
    )
    expect(labels).toEqual(['mediaan 9,6 dagen', 'termijn 21 dagen'])
    expect(host.querySelector('.lintje-chart__data-label--halo')?.textContent?.trim()).toBe(
      'mediaan 9,6 dagen',
    )
    const legend = [...host.querySelectorAll('.lintje-legend__label')].map(
      (label) => label.textContent,
    )
    expect(legend).toEqual(['Aantal', 'Mediaan', 'Termijn 21 dagen'])
  })

  it('switches the counts, the median and the threshold from the legend', () => {
    const { host } = draw({ median: 9.6, threshold: 21 })
    const buttons = [...host.querySelectorAll<HTMLButtonElement>('.lintje-legend__button')]
    expect(buttons.map((button) => button.textContent?.trim())).toEqual([
      'Aantal',
      'Mediaan',
      'Norm',
    ])
    const references = () =>
      [...host.querySelectorAll('.lintje-chart__reference')].map((reference) =>
        reference.parentElement?.classList.contains('is-off'),
      )
    buttons[1].click()
    expect(references()).toEqual([true, false])
    buttons[0].click()
    // The bars keep their nodes and fade, so switched back on they do not draw in again.
    expect(bars(host)).toHaveLength(BINS.length)
    expect(bars(host)[0].closest('.lintje-chart__series')?.classList).toContain('is-off')
  })

  it('keeps the counts fixed with no line beside them', () => {
    const { host } = draw()
    expect(host.querySelector('.lintje-legend__item')).not.toBeNull()
    expect(host.querySelector('.lintje-legend__button')).toBeNull()
  })

  it('names the class, the count and its share in the tooltip', () => {
    const { host, controller } = draw({ label: 'Aanvragen' })
    const drawing = host.querySelector('svg[tabindex="0"]')!
    for (let i = 0; i < 5; i += 1) {
      drawing.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    }
    expect(controller.status).toBe('8 tot 10 dagen: Aanvragen 280, Aandeel 14,7%')
    drawing.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    expect(controller.status).toBe('30 dagen of meer: Aanvragen 45, Aandeel 2,4%')
  })

  it('leaves the share out once a class is missing: the total is unknown', () => {
    const { host, controller } = draw({
      bins: BINS.map((bin, i) => (i === 3 ? { ...bin, count: null } : bin)),
    })
    const drawing = host.querySelector('svg[tabindex="0"]')!
    for (let i = 0; i < 5; i += 1) {
      drawing.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    }
    expect(controller.status).toBe('8 tot 10 dagen: Aantal 280')
    drawing.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    expect(controller.status).toBe('6 tot 8 dagen: Aantal geen gegevens')
  })

  it('lifts a copy over the classes and keeps every class on its own node', () => {
    const { host } = draw({
      bins: BINS.map((bin, i) => (i === 3 ? { ...bin, count: null } : bin)),
    })
    const marks = () => [
      ...host.querySelectorAll('.lintje-chart__bar-group, .lintje-chart__missing'),
    ]
    const before = marks()
    const drawing = host.querySelector('svg[tabindex="0"]')!
    drawing.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    drawing.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(marks()).toEqual(before)
    const lifted = host.querySelector('.lintje-chart__bar--lifted')
    // 120 on a scale to 300: the missing 310 is no part of it.
    expect(Number(lifted?.getAttribute('height'))).toBe(80)
    expect(lifted?.getAttribute('x')).toBe(before[1].querySelector('rect')?.getAttribute('x'))
    // Over the classes: after the last of them.
    expect(
      before.at(-1)!.compareDocumentPosition(lifted!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    // The missing class lifts nothing.
    drawing.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    drawing.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(host.querySelector('.lintje-chart__bar--lifted')).toBeNull()
    expect(marks()).toEqual(before)
  })

  it('draws a line only on the closed part of the scale, and no legend line without one', () => {
    for (const value of [-1, 40, 31]) {
      const { host } = draw({ median: value, threshold: value })
      expect(host.querySelector('line[stroke="var(--color-chart-emphasis)"]')).toBeNull()
      const legend = [...host.querySelectorAll('.lintje-legend__label')].map(
        (label) => label.textContent,
      )
      expect(legend).toEqual(['Aantal'])
      document.body.innerHTML = ''
    }
    const { host } = draw({ median: 30, threshold: 0 })
    expect(host.querySelectorAll('line[stroke="var(--color-chart-emphasis)"]')).toHaveLength(2)
  })

  it('draws each line with its label in one reference group, kept under the keyboard', () => {
    const { host } = draw({ median: 9.6, threshold: 21 })
    const groups = [...host.querySelectorAll('g.lintje-chart__reference')]
    expect(groups).toHaveLength(2)
    for (const group of groups) {
      expect(group.querySelector('line[stroke="var(--color-chart-emphasis)"]')).not.toBeNull()
      expect(group.querySelector('text')?.textContent).toMatch(/mediaan|norm/)
    }
    const drawing = host.querySelector('svg[tabindex="0"]')!
    drawing.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    drawing.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect([...host.querySelectorAll('g.lintje-chart__reference')]).toEqual(groups)
  })

  it('names the median in the legend by its own label', () => {
    const { host } = draw({ median: 9.6, medianLabel: 'middelste aanvraag' })
    const legend = [...host.querySelectorAll('.lintje-legend__label')].map(
      (label) => label.textContent,
    )
    expect(legend).toEqual(['Aantal', 'Middelste aanvraag'])
  })

  it('always names the last bound of a closed histogram', () => {
    const { host } = draw({ bins: BINS.slice(0, 15) })
    expect(xLabels(host)).toEqual(['0', '4', '8', '12', '16', '20', '24', '28', '30'])
  })
})

describe('the histogram with a comparison', () => {
  const LAST = [30, 100, 200, 260, 300, 250, 190, 140, 100, 80, 60, 45, 35, 25, 18, 50]
  const comparison = (counts: (number | null)[] = LAST) => ({ label: 'Vorig jaar', counts })
  const steps = (host: Element) => [
    ...host.querySelectorAll('polyline.lintje-chart__line:not(.lintje-chart__line--casing)'),
  ]
  const points = (line: Element) =>
    line
      .getAttribute('points')!
      .split(' ')
      .map((pair) => pair.split(',').map(Number))

  it('draws one grey dashed step along the top of each class, over the bars', () => {
    const { host } = draw({ comparison: comparison() })
    const [step, ...rest] = steps(host)
    expect(rest).toHaveLength(0)
    expect(step.getAttribute('stroke')).toBe('var(--color-chart-secondary)')
    expect(step.getAttribute('stroke-dasharray')).toBe('5 4')
    // Two points per class: its left and right end, at its count.
    const corners = points(step)
    expect(corners).toHaveLength(LAST.length * 2)
    const rects = bars(host)
    expect(corners[0][0]).toBeCloseTo(Number(rects[0].getAttribute('x')))
    expect(corners[1][0]).toBeCloseTo(
      Number(rects[0].getAttribute('x')) + Number(rects[0].getAttribute('width')),
    )
    // The bars still touch, and the step lies after them, so over them.
    expect(rects).toHaveLength(BINS.length)
    expect(
      rects.at(-1)!.compareDocumentPosition(step) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    // A casing in the surface lies under it, so it reads on a bar.
    expect(host.querySelector('.lintje-chart__line--casing')?.getAttribute('stroke')).toBe(
      'var(--color-bg-surface)',
    )
  })

  it('scales the axis to the higher of the two sets', () => {
    const height = (host: Element) => Number(bars(host)[3].getAttribute('height'))
    const alone = height(draw().host)
    document.body.innerHTML = ''
    const both = height(
      draw({ comparison: comparison(LAST.map((n, i) => (i === 4 ? 620 : n))) }).host,
    )
    expect(both).toBeLessThan(alone)
  })

  it('breaks the step at a missing class and never draws it at 0', () => {
    const { host } = draw({
      comparison: comparison(LAST.map((n, i) => (i === 3 ? null : n))),
    })
    const runs = steps(host).map((step) => points(step).length)
    expect(runs).toEqual([6, (LAST.length - 4) * 2])
    const baseline = 260 - 44
    for (const step of steps(host)) {
      expect(points(step).every(([, y]) => y < baseline)).toBe(true)
    }
  })

  it('makes both sets, the median and the threshold a switch; off fades, the axis stays', () => {
    const { host } = draw({
      label: 'Dit jaar',
      comparison: comparison(),
      median: 9.6,
      threshold: 21,
    })
    const buttons = [...host.querySelectorAll<HTMLButtonElement>('.lintje-legend__button')]
    expect(buttons.map((button) => button.textContent?.trim())).toEqual([
      'Dit jaar',
      'Vorig jaar',
      'Mediaan',
      'Norm',
    ])
    const before = bars(host)[3].getAttribute('height')
    const step = steps(host)[0]
    buttons[1].click()
    expect(step.closest('.lintje-chart__series')?.classList).toContain('is-off')
    // The step keeps its node, and the bars their height.
    expect(steps(host)[0]).toBe(step)
    expect(bars(host)[3].getAttribute('height')).toBe(before)
    buttons[1].click()
    expect(step.closest('.lintje-chart__series')?.classList).not.toContain('is-off')
  })

  it('makes the counts a switch beside a comparison alone', () => {
    const { host } = draw({ comparison: comparison() })
    expect(host.querySelectorAll('.lintje-legend__button')).toHaveLength(2)
  })

  it('names both counts and their shares in the tooltip, a missing one as no data', () => {
    const { host, controller } = draw({
      label: 'Dit jaar',
      comparison: comparison(LAST.map((n, i) => (i === 3 ? null : n))),
    })
    const drawing = host.querySelector('svg[tabindex="0"]')!
    for (let i = 0; i < 5; i += 1) {
      drawing.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    }
    // With a class missing, the comparison's total and so its shares are unknown.
    expect(controller.status).toBe('8 tot 10 dagen: Dit jaar 280, Aandeel 14,7%, Vorig jaar 300')
    drawing.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    expect(controller.status).toBe(
      '6 tot 8 dagen: Dit jaar 310, Aandeel 16,3%, Vorig jaar geen gegevens',
    )
    document.body.innerHTML = ''
    const full = draw({ label: 'Dit jaar', comparison: comparison() })
    const svg = full.host.querySelector('svg[tabindex="0"]')!
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    expect(full.controller.status).toBe(
      '0 tot 2 dagen: Dit jaar 40, Aandeel 2,1%, Vorig jaar 30, Aandeel 1,6%',
    )
    // A set switched off leaves the tooltip.
    full.host.querySelectorAll<HTMLButtonElement>('.lintje-legend__button')[0].click()
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(full.controller.status).toBe('2 tot 4 dagen: Vorig jaar 100, Aandeel 5,3%')
  })

  it('names the comparison in its description', () => {
    const { host } = draw({ comparison: comparison() })
    expect(host.querySelector('desc')?.textContent).toBe(
      'Een figuur. De gestreepte traplijn is de vergelijking: Vorig jaar.',
    )
  })
})

describe('the histogram with a second variable', () => {
  const second = { label: 'Zuid', counts: [12, 40, 95, 120], color: 'dark-yellow' }
  const bins = BINS.slice(0, 4)
  const line = (host: Element) =>
    host.querySelector('polyline.lintje-chart__line:not(.lintje-chart__line--casing)')

  it('draws a solid step in its colour, on the dark edge of a light colour', () => {
    const { host } = draw({ bins, label: 'Noord', comparison: second })
    expect(line(host)?.getAttribute('stroke')).toBe('var(--color-chart-dark-yellow)')
    expect(line(host)?.hasAttribute('stroke-dasharray')).toBe(false)
    expect(host.querySelector('.lintje-chart__line--casing')?.getAttribute('stroke')).toBe(
      'var(--color-chart-dark-yellow-edge)',
    )
  })

  it('keeps the surface as the casing of a colour that needs no edge', () => {
    const { host } = draw({ bins, comparison: { ...second, color: 'red' } })
    expect(host.querySelector('.lintje-chart__line--casing')?.getAttribute('stroke')).toBe(
      'var(--color-bg-surface)',
    )
  })

  it('keys it as a line in the legend and the tooltip, and names it in the description', () => {
    const { host, controller } = draw({ bins, label: 'Noord', comparison: second })
    const marker = host.querySelectorAll('.lintje-legend__marker')[1]
    expect(marker?.classList).toContain('lintje-legend__marker--line')
    expect(marker?.classList).not.toContain('lintje-legend__marker--dashed')
    const drawing = host.querySelector('svg[tabindex="0"]')!
    drawing.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    expect(controller.status).toBe('0 tot 2 dagen: Noord 40, Aandeel 5,5%, Zuid 12, Aandeel 4,5%')
    expect(host.querySelector('.lintje-chart-tooltip__marker--line')).not.toBeNull()
    expect(host.querySelector('.lintje-chart-tooltip__marker--dashed')).toBeNull()
    expect(host.querySelector('desc')?.textContent).toBe(
      'Een figuur. De doorgetrokken traplijn is Zuid.',
    )
  })
})

describe('the labels of the median and the threshold', () => {
  const area = { width: 310, height: 260, left: 32, right: 8, top: 16, bottom: 44 }

  it('stand on one line while they keep apart', () => {
    const places = placeLineLabels(
      [
        { x: 60, text: 'mediaan', bold: true },
        { x: 200, text: 'norm' },
      ],
      area,
    )
    expect(places.map((place) => place.y)).toEqual([28, 28])
  })

  it('drop the right one a line where they would touch', () => {
    const places = placeLineLabels(
      [
        { x: 112.8, text: 'mediaan 9,6 dagen', bold: true },
        { x: 209.2, text: 'termijn 21 dagen' },
      ],
      area,
    )
    expect(places.map((place) => place.y)).toEqual([28, 46])
  })

  it('go left of a line near the right edge', () => {
    const [place] = placeLineLabels([{ x: 290, text: 'norm 40 dagen' }], area)
    expect(place.anchor).toBe('end')
    expect(place.x).toBe(284)
  })
})

describe('the form of a set', () => {
  it('keeps its line, or else its default', () => {
    expect(setForm('solid', undefined, 'none', 'solid')).toEqual({ fill: 'solid', line: 'none' })
    expect(setForm('solid', 'dashed', 'none', 'solid')).toEqual({ fill: 'solid', line: 'dashed' })
    expect(setForm('none', undefined, 'dashed', 'dashed')).toEqual({ fill: 'none', line: 'dashed' })
  })

  it('gives a translucent fill a solid line, and a set without either its default line', () => {
    expect(setForm('translucent', 'none', 'none', 'solid')).toEqual({
      fill: 'translucent',
      line: 'solid',
    })
    expect(setForm('translucent', undefined, 'none', 'solid').line).toBe('solid')
    expect(setForm('none', 'none', 'none', 'solid').line).toBe('solid')
    expect(setForm('none', 'none', 'dashed', 'dashed').line).toBe('dashed')
  })
})

describe('the histogram with a fill and a line per set', () => {
  const north = BINS.slice(0, 4)
  const lines = (host: Element) => [
    ...host.querySelectorAll('polyline.lintje-chart__line:not(.lintje-chart__line--casing)'),
  ]
  const markers = (host: Element) =>
    [...host.querySelectorAll('.lintje-legend__marker')].map((marker) =>
      [...marker.classList].find((name) => name.startsWith('lintje-legend__marker--')),
    )
  const corners = (line: Element) =>
    line
      .getAttribute('points')!
      .split(' ')
      .map((pair) => pair.split(',').map(Number))
  const baseline = 260 - 44

  it('draws solid bars and no step of its own by default', () => {
    const { host } = draw({ bins: north })
    expect(bars(host)).toHaveLength(4)
    expect(host.querySelector('.lintje-chart__bar--translucent')).toBeNull()
    expect(lines(host)).toHaveLength(0)
    expect(markers(host)).toEqual(['lintje-legend__marker--square'])
  })

  it('outlines the bars without fill: a step that drops to the axis at both ends', () => {
    const { host } = draw({ bins: north, fill: 'none', line: 'solid', median: 3 })
    expect(bars(host)).toHaveLength(0)
    const [line] = lines(host)
    expect(line.getAttribute('stroke')).toBe('var(--color-chart-default)')
    expect(line.hasAttribute('stroke-dasharray')).toBe(false)
    const points = corners(line)
    expect(points[0][1]).toBe(baseline)
    expect(points.at(-1)![1]).toBe(baseline)
    expect(points).toHaveLength(north.length * 2 + 2)
    expect(markers(host)[0]).toBe('lintje-legend__marker--line')
  })

  it('dashes the bars’ line when asked, and breaks it at a missing class', () => {
    const { host } = draw({
      bins: north.map((bin, i) => (i === 2 ? { ...bin, count: null } : bin)),
      fill: 'none',
      line: 'dashed',
    })
    const runs = lines(host)
    expect(runs.map((line) => corners(line).length)).toEqual([6, 4])
    expect(runs[0].getAttribute('stroke-dasharray')).toBe('5 4')
    // The missing class stays hatched.
    expect(host.querySelector('.lintje-chart__missing')).not.toBeNull()
  })

  it('outlines the bars without fill nor line too, as they would draw nothing', () => {
    const { host } = draw({ bins: north, fill: 'none', line: 'none' })
    expect(lines(host)).toHaveLength(1)
  })

  it('gives translucent bars a line, also when the host chose none', () => {
    const { host, controller } = draw({
      bins: north,
      label: 'Noord',
      fill: 'translucent',
      line: 'none',
    })
    expect(
      bars(host).every((bar) => bar.classList.contains('lintje-chart__bar--translucent')),
    ).toBe(true)
    expect(bars(host)[0].classList).not.toContain('lintje-chart__segment')
    expect(lines(host)).toHaveLength(1)
    expect(markers(host)[0]).toBe('lintje-legend__marker--translucent')
    const drawing = host.querySelector('svg[tabindex="0"]')!
    drawing.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    expect(host.querySelector('.lintje-chart-tooltip__marker--translucent')).not.toBeNull()
    expect(controller.status).toMatch(/^0 tot 2 dagen: Noord 40/)
  })

  it('fills the second set over the bars, solid in its colour or translucent', () => {
    const solid = draw({
      bins: north,
      comparison: { label: 'Zuid', counts: [12, 40, 95, 120], color: 'dark-yellow', fill: 'solid' },
    }).host
    const fills = [...solid.querySelectorAll('rect.lintje-chart__bar')].filter(
      (rect) => rect.getAttribute('fill') === 'var(--color-chart-dark-yellow)',
    )
    expect(fills).toHaveLength(4)
    expect(fills[0].classList).toContain('lintje-chart__segment')
    // Over the bars: after the last of them.
    expect(
      bars(solid)[3].compareDocumentPosition(fills[0]) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(markers(solid)).toEqual([
      'lintje-legend__marker--square',
      'lintje-legend__marker--square',
    ])
    // Its line is still its default: solid with a colour.
    expect(lines(solid)[0].hasAttribute('stroke-dasharray')).toBe(false)
    document.body.innerHTML = ''

    const translucent = draw({
      bins: north,
      comparison: {
        label: 'Vorig jaar',
        counts: [30, null, 200, 260],
        fill: 'translucent',
        line: 'none',
      },
    }).host
    const faint = [...translucent.querySelectorAll('.lintje-chart__bar--translucent')]
    expect(faint).toHaveLength(3)
    expect(faint[0].getAttribute('fill')).toBe('var(--color-chart-secondary)')
    // Translucent always has a line: solid, as the host chose none.
    expect(lines(translucent).map((line) => line.hasAttribute('stroke-dasharray'))).toEqual([
      false,
      false,
    ])
    expect(markers(translucent)[1]).toBe('lintje-legend__marker--translucent')
  })

  it('falls back on the comparison’s dashes without fill nor line', () => {
    const { host } = draw({
      bins: north,
      comparison: { label: 'Vorig jaar', counts: [30, 100, 200, 260], fill: 'none', line: 'none' },
    })
    expect(lines(host)[0].getAttribute('stroke-dasharray')).toBe('5 4')
    expect(markers(host)[1]).toBe('lintje-legend__marker--dashed')
  })

  it('dashes the casing of a dashed line, so a dark edge leaves the gaps open', () => {
    const { host } = draw({
      bins: north,
      comparison: {
        label: 'Zuid',
        counts: [12, 40, 95, 120],
        color: 'dark-yellow',
        line: 'dashed',
      },
    })
    const casing = host.querySelector('.lintje-chart__line--casing')
    expect(casing?.getAttribute('stroke')).toBe('var(--color-chart-dark-yellow-edge)')
    expect(casing?.getAttribute('stroke-dasharray')).toBe('5 4')
  })

  it('switches each set’s fill and line together', () => {
    const { host } = draw({
      bins: north,
      fill: 'translucent',
      comparison: { label: 'Zuid', counts: [12, 40, 95, 120], color: 'red', fill: 'translucent' },
    })
    const series = () =>
      [...host.querySelectorAll('.lintje-chart__series')].map((group) =>
        group.classList.contains('is-off'),
      )
    expect(series()).toEqual([false, false, false, false])
    host.querySelectorAll<HTMLButtonElement>('.lintje-legend__button')[1].click()
    // The bars' fill, the second set's fill, the bars' line, the second set's line.
    expect(series()).toEqual([false, true, false, true])
  })

  it('lifts the outline of a class without fill', () => {
    const { host } = draw({ bins: north, fill: 'none', line: 'solid' })
    const drawing = host.querySelector('svg[tabindex="0"]')!
    drawing.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    const lifted = host.querySelector('.lintje-chart__bar--lifted')
    expect(lifted?.classList).toContain('lintje-chart__line')
    expect(lifted?.getAttribute('stroke')).toBe('var(--color-chart-default)')
  })

  it('names the form of each set in its description', () => {
    const { host } = draw({
      bins: north,
      label: 'Noord',
      fill: 'translucent',
      comparison: { label: 'Zuid', counts: [12, 40, 95, 120], color: 'red', fill: 'translucent' },
    })
    expect(host.querySelector('desc')?.textContent).toBe(
      'Een figuur. Noord staat als doorzichtig vlak. Het doorzichtige vlak is Zuid.',
    )
  })
})
