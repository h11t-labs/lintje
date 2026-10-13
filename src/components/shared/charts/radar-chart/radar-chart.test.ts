/**
 * The radar chart: 0 in the centre and `max` on the outer ring, a gap breaks a layer's line and
 * drops its area (rule 15), of more layers only the emphasised one fills while the others step
 * back, a layer switched off leaves the drawing and the tooltip but not the scale, and below
 * 768 px every axis is a row of bars (rule 9).
 */
import { render } from 'lit'
import { afterEach, describe, expect, it } from 'vitest'
import { ChartController, type ChartOptions } from '../shared/controller'
import { radarFills, radarRuns, radarTicks, renderRadarChart } from './radar-chart'
import type { ChartSpec } from '../shared/types'

type RadarSpec = Extract<ChartSpec, { kind: 'radar' }>

function draw(spec: RadarSpec, extra: Partial<ChartOptions> = {}) {
  const host = document.createElement('div')
  document.body.append(host)
  const options: ChartOptions = {
    controller: new ChartController(() => render(renderRadarChart(spec, options), host)),
    description: 'Een profiel.',
    ...extra,
  }
  render(renderRadarChart(spec, options), host)
  options.controller.requestUpdate()
  return { host, controller: options.controller }
}

const AXES = [
  'Bereikbaarheid',
  'Tijdigheid',
  'Duidelijkheid',
  'Juistheid',
  'Deskundigheid',
  'Bejegening',
]

const ONE: RadarSpec = {
  kind: 'radar',
  axes: AXES,
  max: 10,
  threshold: 7,
  series: [
    { label: 'Q3 2026', values: [7.8, 6.1, 7.4, 8.6, 8.2, 8.9] },
    { label: 'Q3 2025', values: [7.4, 6.6, 6.9, 8.4, 8.1, 8.8], comparison: true },
  ],
}

const THREE: RadarSpec = {
  kind: 'radar',
  axes: AXES,
  max: 10,
  series: [
    { label: 'Noord', values: [7.9, 6.4, 7.1, 8.5, 8.0, 8.7] },
    { label: 'Zuid', color: 'dark-yellow', values: [7.1, 7.4, 7.8, 8.1, 8.6, 8.2] },
    { label: 'Oost', values: [6.8, 7.0, 6.6, 7.9, 7.4, 8.0] },
  ],
}

const outer = (host: Element) =>
  [...host.querySelectorAll('.lintje-radar__ring')].at(-1)!.getAttribute('points')
const numbers = (points: string | null) => (points ?? '').split(/[ ,]/).map(Number)
const areas = (host: Element) => [...host.querySelectorAll('.lintje-radar__area.is-filled')]
const tooltip = (host: Element) =>
  [...host.querySelectorAll('.lintje-chart-tooltip__row')].map((row) =>
    row.textContent!.replace(/\s+/g, ' ').trim(),
  )

afterEach(() => {
  document.body.innerHTML = ''
})

describe('radarRuns', () => {
  it('closes a layer without a gap on itself', () => {
    expect(radarRuns([1, 2, 3])).toEqual({ closed: true, runs: [[0, 1, 2]] })
  })

  it('breaks the line at a gap and runs on around the circle', () => {
    expect(radarRuns([1, 2, null, 4, 5])).toEqual({ closed: false, runs: [[3, 4, 0, 1]] })
    expect(radarRuns([1, null, 3, 4, null])).toEqual({ closed: false, runs: [[2, 3], [0]] })
  })
})

describe('radarTicks', () => {
  it('rings every step up to the outer ring, five without a step', () => {
    expect(radarTicks(10)).toEqual([2, 4, 6, 8, 10])
    expect(radarTicks(10, 4)).toEqual([4, 8, 10])
  })
})

describe('radarFills', () => {
  const layers = [
    { label: 'Noord', comparison: false, complete: true },
    { label: 'Zuid', comparison: false, complete: true },
  ]

  it('fills one variable always, of more only the emphasised one', () => {
    expect([...radarFills({}, layers.slice(0, 1), null)]).toEqual(['Noord'])
    expect([...radarFills({}, layers, null)]).toEqual([])
    expect([...radarFills({}, layers, 'Zuid')]).toEqual(['Zuid'])
  })

  it('fills every or no layer on request, and never one with a gap', () => {
    expect([...radarFills({ area: 'always' }, layers, null)]).toEqual(['Noord', 'Zuid'])
    expect([...radarFills({ area: 'never' }, layers.slice(0, 1), null)]).toEqual([])
    expect([...radarFills({}, [{ ...layers[0], complete: false }], null)]).toEqual([])
  })
})

describe('the radar', () => {
  it('puts 0 in the centre and max on the outer ring', () => {
    const { host } = draw({ ...ONE, series: [{ label: 'Vol', values: [10, 10, 10, 10, 10, 0] }] })
    const rings = [...host.querySelectorAll('.lintje-radar__ring')]
    expect(rings).toHaveLength(5)
    const ring = numbers(rings[4].getAttribute('points'))
    const area = numbers(areas(host)[0].getAttribute('points'))
    // The first five vertices lie on the outer ring, the sixth in the centre.
    expect(area.slice(0, 10)).toEqual(ring.slice(0, 10))
    const spoke = host.querySelector('.lintje-radar__spoke')!
    expect(area.slice(10)).toEqual([
      Number(spoke.getAttribute('x1')),
      Number(spoke.getAttribute('y1')),
    ])
  })

  it('carries the scale on one axis only', () => {
    const { host } = draw(ONE)
    const scale = [...host.querySelectorAll('.lintje-chart__axis-label')].map((t) =>
      t.textContent!.trim(),
    )
    expect(scale).toEqual(['2', '4', '6', '8', '10'])
  })

  it('writes each value under its axis name, with one variable', () => {
    const { host } = draw(ONE)
    const values = [...host.querySelectorAll('.lintje-chart__data-label')].map((t) =>
      t.textContent!.trim(),
    )
    expect(values).toEqual(['7,8', '6,1', '7,4', '8,6', '8,2', '8,9'])
  })

  it('writes no values with more variables: they would not fit (all or nothing)', () => {
    const { host } = draw(THREE)
    expect(host.querySelectorAll('.lintje-chart__data-label')).toHaveLength(0)
  })

  it('draws the norm and names it, dashed and fixed, in the legend', () => {
    const { host } = draw(ONE)
    expect(host.querySelector('.lintje-radar__norm')).not.toBeNull()
    const norm = [...host.querySelectorAll('.lintje-legend__item')].at(-1)!
    expect(norm.textContent).toContain('Norm 7')
    expect(norm.querySelector('button')).toBeNull()
  })

  it('breaks a line at a missing value, drops its area and hatches the spoke (rule 15)', () => {
    const spec: RadarSpec = {
      ...ONE,
      series: [{ label: 'Q3 2026', values: [7.8, null, 7.4, 8.6, 8.2, 8.9] }, ONE.series[1]],
    }
    const { host, controller } = draw(spec)
    expect(areas(host)).toHaveLength(0)
    expect(host.querySelectorAll('.lintje-radar__gap')).toHaveLength(1)
    expect(host.textContent).toContain('Geen gegevens')
    expect(host.textContent).toContain('geen gegevens')
    controller.hoverAt(1, new MouseEvent('mousemove'), undefined)
    // No hover point is drawn where the value is missing.
    expect(host.querySelectorAll('.lintje-chart__hover-point')).toHaveLength(1)
  })
})

describe('the legend of a radar', () => {
  it('switches a layer off: out of the drawing and the tooltip, the scale kept', () => {
    const { host, controller } = draw(ONE)
    const before = outer(host)
    controller.toggleSeries('Q3 2025')
    const button = [...host.querySelectorAll('.lintje-legend__button')][1]
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(host.querySelectorAll('polyline[stroke-dasharray]')).toHaveLength(0)
    expect(outer(host)).toBe(before)
    const svg = host.querySelector('svg[tabindex="0"]')!
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(tooltip(host).some((row) => row.includes('Q3 2025'))).toBe(false)
  })

  it('fills the layer pointed at and steps the others back', () => {
    const { host } = draw(THREE)
    expect(areas(host)).toHaveLength(0)
    // The areas stand already: a new one would grow in a second time.
    const standing = [...host.querySelectorAll('.lintje-radar__area')]
    expect(standing).toHaveLength(3)
    const zuid = [...host.querySelectorAll('.lintje-legend__button')][1]
    zuid.dispatchEvent(new MouseEvent('mouseenter'))
    expect(areas(host)).toHaveLength(1)
    expect(areas(host)[0].getAttribute('fill')).toBe('var(--color-chart-dark-yellow)')
    expect(standing.includes(areas(host)[0])).toBe(true)
    expect(host.querySelectorAll('.lintje-radar__layer.is-muted')).toHaveLength(2)
    // The emphasised layer lies on top.
    const lines = [
      ...host.querySelectorAll(
        '.lintje-radar__layer:not(.is-muted) .lintje-chart__line:not(.lintje-chart__line--casing)',
      ),
    ]
    expect(lines.at(-1)!.getAttribute('stroke')).toBe('var(--color-chart-dark-yellow)')
    zuid.dispatchEvent(new MouseEvent('mouseleave'))
    expect(areas(host)).toHaveLength(0)
    expect(host.querySelectorAll('.lintje-radar__layer.is-muted')).toHaveLength(0)
  })

  it('gives every variable its shape and dark yellow its edge (rule 13)', () => {
    const { host } = draw(THREE)
    const markers = [...host.querySelectorAll('.lintje-legend__marker--symbol path')].map((p) =>
      p.getAttribute('d'),
    )
    expect(new Set(markers).size).toBe(3)
    expect(host.querySelector('.lintje-chart__line--casing')?.getAttribute('stroke')).toBe(
      'var(--color-chart-dark-yellow-text)',
    )
  })
})

describe('the keyboard on a radar', () => {
  it('walks the axes clockwise, the tooltip with the comparison and the norm', () => {
    const { host } = draw(ONE)
    const svg = host.querySelector('svg[tabindex="0"]')!
    const key = (name: string) =>
      svg.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }))
    key('ArrowRight')
    key('ArrowRight')
    expect(host.querySelector('.lintje-chart-tooltip__title')?.textContent).toBe('Tijdigheid')
    expect(tooltip(host)).toEqual([
      'Q3 2026 6,1',
      'Q3 2025 6,6',
      'Norm 7,0',
      't.o.v. Q3 2025 −0,5',
      't.o.v. norm −0,9',
    ])
    expect(host.querySelector('.lintje-radar__spoke.is-active')).not.toBeNull()
  })
})

describe('the radar below 768 px', () => {
  it('becomes a row of bars per axis, with the norm through every row', () => {
    const { host } = draw(ONE, { mobile: true })
    expect(host.querySelectorAll('.lintje-radar__ring')).toHaveLength(0)
    const rows = [...host.querySelectorAll('.lintje-radar__row')]
    expect(rows).toHaveLength(6)
    expect(rows[0].querySelectorAll('.lintje-chart__bar')).toHaveLength(2)
    expect(host.querySelectorAll('.lintje-radar__norm')).toHaveLength(6)
    // Below the norm is said in words, not only by the bar's length (rule 13).
    expect(rows[1].textContent).toContain('onder norm')
    expect(rows[0].textContent).not.toContain('onder norm')
  })

  it('hatches the bar of a missing value instead of drawing 0 (rule 15)', () => {
    const { host } = draw(
      { ...ONE, series: [{ label: 'Q3 2026', values: [7.8, null, 7.4, 8.6, 8.2, 8.9] }] },
      { mobile: true },
    )
    const row = host.querySelectorAll('.lintje-radar__row')[1]
    expect(row.querySelector('.lintje-chart__bar')).toBeNull()
    expect(row.querySelector('rect[fill^="url(#hatch-"]')).not.toBeNull()
    expect(row.textContent).toContain('geen gegevens')
  })
})
