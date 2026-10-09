/**
 * The heatmap's grid: an empty cell says "geen meting" in words, a cell carries its class colour
 * as a custom property so a dimmed cell fades its fill and not its figure, and on a phone a wide
 * grid without a phone grid of the host's turns on its side (rule 9).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render } from 'lit'
import { afterEach, describe, expect, it } from 'vitest'
import { ChartController, type ChartOptions } from '../shared/controller'
import { phoneGrid, renderHeatmap } from './heatmap-chart'
import type { ChartSpec } from '../shared/types'

type HeatmapSpec = Extract<ChartSpec, { kind: 'heatmap' }>

const SPEC: HeatmapSpec = {
  kind: 'heatmap',
  columnLabels: ['0', '1', '2', '3'],
  rowLabels: ['ma', 'di'],
  values: [
    [1, 2, null, 4],
    [5, 6, 7, 8],
  ],
}

function draw(
  spec: HeatmapSpec,
  mobile = false,
): { host: HTMLElement; controller: ChartController } {
  const host = document.createElement('div')
  document.body.append(host)
  const options: ChartOptions = {
    controller: new ChartController(() => render(renderHeatmap(spec, options), host)),
    description: 'Een rooster.',
    mobile,
  }
  render(renderHeatmap(spec, options), host)
  return { host, controller: options.controller }
}

const CSS = readFileSync(
  resolve('src/components/shared/charts/heatmap-chart/heatmap-chart.css'),
  'utf8',
)
/** The declarations of the rule whose selector list is exactly `selector`. */
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(
    CSS,
  )?.[2] ?? ''

afterEach(() => {
  document.body.innerHTML = ''
})

describe('the heatmap', () => {
  it('says "geen meting" in an empty cell in words, not only in a title', () => {
    const { host } = draw(SPEC)
    const empty = host.querySelector('.lintje-heatmap__cell.is-empty')
    expect(empty?.querySelector('.visually-hidden')?.textContent).toBe('geen meting')
  })

  it('hands a cell its class colour as a custom property', () => {
    const { host } = draw(SPEC)
    const cell = host.querySelector<HTMLElement>('button.lintje-heatmap__cell')
    expect(cell?.style.getPropertyValue('--lintje-cell')).toMatch(/^var\(--color-chart-seq-\d\)$/)
  })

  it('fades a dimmed or muted cell by its fill, never its figure', () => {
    for (const state of ['is-dimmed', 'is-muted']) {
      const declarations = rule(`.lintje-heatmap__cell.${state}`)
      expect(declarations).toContain('color-mix(in srgb, var(--lintje-cell)')
      expect(declarations).not.toContain('opacity')
    }
    expect(rule('.lintje-heatmap__legend-item.is-dimmed')).toBe('')
  })

  it('writes white only on the darkest class: ink reaches 4.5:1 on the fourth rung, white does not', () => {
    expect(rule('.lintje-heatmap__cell--class-4')).toContain('--color-text-on-fill')
    expect(CSS).not.toMatch(/\.lintje-heatmap__cell--class-3[^{]*\{[^}]*on-fill/)
  })

  it('turns a wide grid on its side on a phone, its drilldowns with it', () => {
    const links = SPEC.values.map((row, r) =>
      row.map((_, c) => ({ id: `${r}-${c}`, href: `/h?c=${r}-${c}` })),
    )
    const grid = phoneGrid({ ...SPEC, links })
    expect(grid?.columnLabels).toEqual(['ma', 'di'])
    expect(grid?.rowLabels).toEqual(['0', '1', '2', '3'])
    expect(grid?.values[2]).toEqual([null, 7])
    expect(grid?.links?.[3][1]).toEqual({ id: '1-3', href: '/h?c=1-3' })

    const { host } = draw(SPEC, true)
    expect(host.querySelectorAll('tbody tr')).toHaveLength(4)
  })

  it('keeps the host’s own phone grid, and a grid that is already tall', () => {
    const own = { columnLabels: ['x'], rowLabels: ['y'], values: [[1]] }
    expect(phoneGrid({ ...SPEC, mobile: own })).toBe(own)
    expect(
      phoneGrid({ ...SPEC, columnLabels: ['a'], rowLabels: ['b', 'c'], values: [[1], [2]] }),
    ).toBeUndefined()
  })
})
