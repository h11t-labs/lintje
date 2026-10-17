/**
 * The dumbbell chart: a ring for the earlier moment and a dot for the later one on one axis,
 * the signed difference beside each row, a missing end hatched and never 0 (rule 15), a moment
 * switched off out of the drawing and the tooltip while the axis stays, and a value beyond a
 * shortened axis on its edge with an off-axis mark, its real value everywhere it is read.
 */
import { render } from 'lit'
import { afterEach, describe, expect, it } from 'vitest'
import { ChartController, type ChartOptions } from '../shared/controller'
import {
  FROM_KEY,
  TO_KEY,
  dumbbellAxis,
  dumbbellDifference,
  dumbbellHeight,
  renderDumbbellChart,
} from './dumbbell-chart'
import type { ChartSpec } from '../shared/types'

type DumbbellSpec = Extract<ChartSpec, { kind: 'dumbbell' }>

function draw(spec: DumbbellSpec, extra: Partial<ChartOptions> = {}) {
  const host = document.createElement('div')
  document.body.append(host)
  const options: ChartOptions = {
    controller: new ChartController(() => render(renderDumbbellChart(spec, options), host)),
    description: 'Tevredenheid per loket.',
    ...extra,
  }
  render(renderDumbbellChart(spec, options), host)
  options.controller.requestUpdate()
  const drawing = host.querySelector('svg[tabindex="0"]')!
  const key = (name: string) =>
    drawing.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }))
  return { host, controller: options.controller, key }
}

const SPEC: DumbbellSpec = {
  kind: 'dumbbell',
  fromLabel: '2024',
  toLabel: '2026',
  min: 5,
  max: 9,
  threshold: 7,
  rows: [
    { label: 'Utrecht', from: 6.8, to: 7.3 },
    { label: 'Zwolle', from: 7.6, to: 7.1 },
    { label: 'Breda', from: 7.2, to: 7.2 },
  ],
}

const rowsOf = (host: Element) => [...host.querySelectorAll('.lintje-dumbbell__row')]
const cx = (element: Element | null | undefined) => Number(element?.getAttribute('cx'))
const tick = (host: Element, label: string) =>
  Number(
    [...host.querySelectorAll('.lintje-chart__axis-label')]
      .find((text) => text.textContent!.trim() === label)!
      .getAttribute('x'),
  )
const shown = (element: Element | null) =>
  element != null && !element.closest('.lintje-chart__series')?.classList.contains('is-off')
const tooltip = (host: Element) =>
  [...host.querySelectorAll('.lintje-chart-tooltip__row')].map((row) =>
    row.textContent!.replace(/\s+/g, ' ').trim(),
  )
const legend = (host: Element) =>
  [...host.querySelectorAll('.lintje-legend__label')].map((label) => label.textContent!.trim())
const difference = (row: Element) =>
  row.querySelector('.lintje-dumbbell__difference')!.textContent!.trim()

afterEach(() => {
  document.body.innerHTML = ''
})

describe('dumbbellAxis', () => {
  it('runs from 0 to a round value above the data and the norm without min and max', () => {
    expect(dumbbellAxis({ rows: [{ label: 'a', from: 6.8, to: 8.4 }] })).toEqual({
      min: 0,
      max: 10,
      ticks: [0, 2.5, 5, 7.5, 10],
    })
    expect(dumbbellAxis({ rows: [{ label: 'a', from: 6, to: 8 }], threshold: 11 }).max).toBe(15)
  })

  it('takes the host’s ends, the other side the default when one is left out', () => {
    expect(dumbbellAxis({ rows: SPEC.rows, min: 5, max: 9 })).toEqual({
      min: 5,
      max: 9,
      ticks: [5, 6, 7, 8, 9],
    })
    expect(dumbbellAxis({ rows: SPEC.rows, min: 5 })).toMatchObject({ min: 5, max: 8 })
    expect(dumbbellAxis({ rows: SPEC.rows, max: 8 })).toMatchObject({ min: 0, max: 8 })
  })
})

describe('dumbbellDifference', () => {
  it('rounds to the rows’ decimals, without float noise, and is missing with an end', () => {
    expect(dumbbellDifference({ from: 6.8, to: 7.3 }, 1)).toBe(0.5)
    expect(dumbbellDifference({ from: 7.25, to: 7.25 }, 1)).toBe(0)
    expect(Object.is(dumbbellDifference({ from: 7.01, to: 7 }, 1), 0)).toBe(true)
    expect(dumbbellDifference({ from: null, to: 7 }, 1)).toBeNull()
  })
})

describe('the dumbbell', () => {
  it('is 28 px a row, 44 below 768 px', () => {
    expect(dumbbellHeight(3, true) - dumbbellHeight(3)).toBe(3 * 16)
    expect(dumbbellHeight(4) - dumbbellHeight(3)).toBe(28)
  })

  it('puts a value on min at the left of the axis and one on max at the right', () => {
    const { host } = draw({ ...SPEC, rows: [{ label: 'Utrecht', from: 5, to: 9 }] })
    expect(cx(host.querySelector('.lintje-dumbbell__ring'))).toBe(tick(host, '5'))
    expect(cx(host.querySelector('.lintje-dumbbell__dot'))).toBe(tick(host, '9'))
    expect(host.querySelector('.lintje-chart__off-axis')).toBeNull()
  })

  it('draws the rows in the host’s order, each with its signed difference', () => {
    const { host } = draw(SPEC)
    const rows = rowsOf(host)
    expect(rows.map((row) => row.querySelector('.lintje-dumbbell__name')!.textContent)).toEqual([
      'Utrecht',
      'Zwolle',
      'Breda',
    ])
    // A minus of U+2212, and no sign on no change.
    expect(rows.map(difference)).toEqual(['+0,5', '−0,5', '0,0'])
    expect(host.textContent).toContain('Verschil')
  })

  it('draws a missing end as no link and no difference, hatched, never 0 (rule 15)', () => {
    const { host, key } = draw({
      ...SPEC,
      rows: [{ label: 'Utrecht', from: 6.8, to: null }, ...SPEC.rows.slice(1)],
    })
    const [row] = rowsOf(host)
    expect(row.querySelector('.lintje-dumbbell__link')).toBeNull()
    expect(row.querySelector('.lintje-dumbbell__dot')).toBeNull()
    expect(row.querySelector('.lintje-dumbbell__ring')).not.toBeNull()
    expect(row.querySelector('rect[fill^="url(#hatch-"]')).not.toBeNull()
    expect(difference(row)).toBe('geen gegevens')
    expect(legend(host)).toContain('Geen gegevens')
    key('ArrowDown')
    expect(tooltip(host)).toEqual(['2024 6,8', '2026 geen gegevens'])
  })

  it('draws the norm dashed with its label, a switch in the legend', () => {
    const { host, controller } = draw(SPEC)
    const norm = host.querySelector('.lintje-dumbbell__norm')!
    expect(Number(norm.getAttribute('x1'))).toBe(tick(host, '7'))
    expect(host.textContent).toContain('norm 7,0')
    expect(legend(host)).toEqual(['2024', '2026', 'Norm 7,0'])
    controller.toggleSeries('reference:threshold')
    expect(shown(norm)).toBe(false)
  })

  it('gives the tooltip both moments, the difference and the distance to the norm', () => {
    const { host, key } = draw(SPEC)
    key('ArrowDown')
    key('ArrowDown')
    expect(host.querySelector('.lintje-chart-tooltip__title')?.textContent).toBe('Zwolle')
    expect(tooltip(host)).toEqual(['2024 7,6', '2026 7,1', 'Verschil −0,5', 't.o.v. norm +0,1'])
    const rows = [...host.querySelectorAll('.lintje-chart-tooltip__row')]
    expect(rows[0].querySelector('.lintje-chart-tooltip__marker--symbol circle')).not.toBeNull()
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Zwolle: 2024 7,6')
  })

  it('stands the tooltip right of the row’s right point, left of its left one when it must', () => {
    const { host, controller, key } = draw(SPEC)
    key('ArrowDown')
    const [row] = rowsOf(host)
    const ring = cx(row.querySelector('.lintje-dumbbell__ring'))
    const dot = cx(row.querySelector('.lintje-dumbbell__dot'))
    expect(controller.tooltip!.x).toBeGreaterThan(Math.max(ring, dot) - 12)
    expect(controller.tooltip!.flip).toBeLessThan(Math.min(ring, dot) + 12)
  })

  it('walks the rows with the arrow keys and hides the tooltip on Escape', () => {
    const { host, key } = draw(SPEC)
    const title = () => host.querySelector('.lintje-chart-tooltip__title')?.textContent
    key('ArrowDown')
    expect(title()).toBe('Utrecht')
    expect(rowsOf(host)[0].classList).toContain('is-hovered')
    key('End')
    expect(title()).toBe('Breda')
    key('ArrowUp')
    expect(title()).toBe('Zwolle')
    key('Escape')
    expect(title()).toBeUndefined()
  })
})

describe('a moment switched off', () => {
  it('leaves the drawing and the tooltip with its link and difference; the axis stays', () => {
    const { host, controller, key } = draw(SPEC)
    const grid = [...host.querySelectorAll('.lintje-dumbbell__grid')].map((line) =>
      line.getAttribute('x1'),
    )
    expect(grid).toHaveLength(5)
    controller.toggleSeries(FROM_KEY)
    const button = host.querySelector('.lintje-legend__button')!
    expect(button.getAttribute('aria-pressed')).toBe('false')
    const [row] = rowsOf(host)
    expect(shown(row.querySelector('.lintje-dumbbell__ring'))).toBe(false)
    expect(shown(row.querySelector('.lintje-dumbbell__link'))).toBe(false)
    expect(shown(row.querySelector('.lintje-dumbbell__difference'))).toBe(false)
    expect(shown(row.querySelector('.lintje-dumbbell__dot'))).toBe(true)
    expect(
      [...host.querySelectorAll('.lintje-dumbbell__grid')].map((line) => line.getAttribute('x1')),
    ).toEqual(grid)
    key('ArrowDown')
    expect(tooltip(host)).toEqual(['2026 7,3', 't.o.v. norm +0,3'])
  })

  it('keeps the axis, the norm and the names with both off', () => {
    const { host, controller } = draw(SPEC)
    controller.toggleSeries(FROM_KEY)
    controller.toggleSeries(TO_KEY)
    expect(shown(host.querySelector('.lintje-dumbbell__dot'))).toBe(false)
    expect(shown(host.querySelector('.lintje-dumbbell__norm'))).toBe(true)
    expect(host.querySelectorAll('.lintje-dumbbell__name')).toHaveLength(3)
    expect(host.querySelectorAll('.lintje-dumbbell__grid')).toHaveLength(5)
  })
})

describe('a value beyond the axis', () => {
  const OUT: DumbbellSpec = {
    ...SPEC,
    color: 'dark-yellow',
    rows: [{ label: 'Utrecht', from: 3.8, to: 6.1 }, ...SPEC.rows.slice(1)],
  }

  it('stands on the edge with a mark in its colour, the link stopping there', () => {
    const { host } = draw(OUT)
    const [row] = rowsOf(host)
    const ring = row.querySelector('.lintje-dumbbell__ring')!
    expect(cx(ring)).toBe(tick(host, '5'))
    expect(Number(row.querySelector('.lintje-dumbbell__link')!.getAttribute('x1'))).toBe(cx(ring))
    const marks = [...row.querySelectorAll('.lintje-chart__off-axis')]
    expect(marks).toHaveLength(1)
    expect(marks[0].getAttribute('fill')).toBe('var(--color-chart-secondary)')
    // The triangle points out: its apex lies left of its base.
    const [base, , apex] = marks[0]
      .getAttribute('d')!
      .match(/-?[\d.]+/g)!
      .map(Number)
    expect(apex).toBeLessThan(base)
    expect(base).toBeLessThan(cx(ring))
  })

  it('reads its real value in the difference, the tooltip and the status, "buiten de as"', () => {
    const { host, key } = draw(OUT)
    expect(difference(rowsOf(host)[0])).toBe('+2,3')
    key('ArrowDown')
    expect(tooltip(host)[0]).toBe('2024 3,8 · buiten de as')
    expect(host.querySelector('.lintje-chart-tooltip__note')?.textContent).toContain('buiten de as')
    expect(host.querySelector('[role="status"]')?.textContent).toBe(
      'Utrecht: 2024 3,8, buiten de as, 2026 6,1, Verschil +2,3, t.o.v. norm −0,9',
    )
  })

  it('puts "Buiten de as" in the legend only when a value is beyond it', () => {
    expect(legend(draw(OUT).host)).toContain('Buiten de as')
    document.body.innerHTML = ''
    expect(legend(draw(SPEC).host)).not.toContain('Buiten de as')
  })

  it('stands below 0 on the edge of the default axis, which starts at 0', () => {
    const { host } = draw({
      ...SPEC,
      min: undefined,
      max: undefined,
      rows: [{ label: 'Utrecht', from: -2, to: 4 }],
    })
    expect(cx(host.querySelector('.lintje-dumbbell__ring'))).toBe(tick(host, '0'))
    expect(host.querySelectorAll('.lintje-chart__off-axis')).toHaveLength(1)
  })

  it('lays both ends beyond one edge on each other, without a link, under one mark', () => {
    const { host } = draw({ ...OUT, rows: [{ label: 'Utrecht', from: 9.4, to: 9.8 }] })
    const [row] = rowsOf(host)
    expect(row.querySelector('.lintje-dumbbell__link')).toBeNull()
    expect(cx(row.querySelector('.lintje-dumbbell__ring'))).toBe(
      cx(row.querySelector('.lintje-dumbbell__dot')),
    )
    const marks = [...row.querySelectorAll('.lintje-chart__off-axis')]
    expect(marks).toHaveLength(1)
    // The dot's colour, with dark yellow's edge.
    expect(marks[0].getAttribute('fill')).toBe('var(--color-chart-dark-yellow)')
    expect(marks[0].getAttribute('stroke')).toBe('var(--color-chart-dark-yellow-text)')
    expect(difference(row)).toBe('+0,4')
  })
})

describe('the dumbbell below 768 px', () => {
  it('puts the name on a line of its own above its row and keeps the difference', () => {
    const { host } = draw(SPEC, { mobile: true })
    expect(host.querySelector('svg.lintje-dumbbell--rows')).not.toBeNull()
    const names = [...host.querySelectorAll('.lintje-dumbbell__name--above')]
    expect(names).toHaveLength(3)
    expect(names[0].getAttribute('x')).toBe('0')
    expect(rowsOf(host).map(difference)).toEqual(['+0,5', '−0,5', '0,0'])
    expect(host.querySelector('svg.lintje-dumbbell')!.getAttribute('height')).toBe(
      String(dumbbellHeight(3, true)),
    )
  })
})

describe('a dumbbell row that drills', () => {
  it('is a button with the row as its target, the others muted when one is chosen', () => {
    const { host } = draw(
      { ...SPEC, rows: SPEC.rows.map((row) => ({ ...row, href: `?loket=${row.label}` })) },
      { selectedId: 'Zwolle', onSelect: () => {} },
    )
    const rows = rowsOf(host)
    expect(rows[1].getAttribute('role')).toBe('button')
    expect(rows[1].getAttribute('aria-pressed')).toBe('true')
    expect(rows[0].classList).toContain('is-muted')
    expect(rows[1].classList).toContain('is-selected')
  })
})
