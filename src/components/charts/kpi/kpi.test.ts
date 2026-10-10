/**
 * `<lintje-kpi>`: the detail line.
 *
 * The detail explains the figure — "Norm 10 min", "3 van 29 posten" — and it is
 * drawn whenever it is given: under the trend sentence when there is one, under
 * the note when there is one, and straight under the figure when there is
 * neither.
 */
import { describe, expect, it } from 'vitest'
import './kpi'
import type { KpiGauge, KpiState, KpiTrend } from '../../../types'

interface Kpi extends HTMLElement {
  renderRoot: DocumentFragment | HTMLElement
  label: string
  value?: string | number
  suffix?: string
  detail?: string
  note?: string
  trend?: KpiTrend
  gauge?: KpiGauge
  state: KpiState
  emphasis: 'equal' | 'primary'
  items?: { value: string; period?: string }[]
  updateComplete: Promise<unknown>
}

async function kpi(props: Partial<Kpi>): Promise<Kpi> {
  const element = document.createElement('lintje-kpi') as Kpi
  element.label = 'Gemiddelde wachttijd'
  Object.assign(element, props)
  document.body.append(element)
  await element.updateComplete
  return element
}

function details(element: Kpi): string[] {
  return [...element.renderRoot.querySelectorAll('.lintje-kpi__detail, .lintje-trend__detail')].map(
    (node) => node.textContent?.trim() ?? '',
  )
}

describe('lintje-kpi detail', () => {
  it('draws the detail of a figure that has neither trend nor note', async () => {
    const element = await kpi({ value: '11 min', detail: 'Norm 10 min' })
    expect(details(element)).toEqual(['Norm 10 min'])
  })

  it('draws the detail under a note', async () => {
    const element = await kpi({ value: '11 min', note: 'Boven de norm', detail: 'Norm 10 min' })
    expect(details(element)).toEqual(['Norm 10 min'])
    expect(element.renderRoot.querySelector('.lintje-kpi__note')?.textContent).toContain(
      'Boven de norm',
    )
  })

  it('draws the detail once under a trend sentence', async () => {
    const element = await kpi({
      value: '11 min',
      trend: { direction: 'down', sentence: '2 min korter dan vorige week' },
      detail: 'Norm 10 min',
    })
    expect(details(element)).toEqual(['Norm 10 min'])
  })

  it('keeps the detail in the empty state and leaves it out while loading', async () => {
    expect(details(await kpi({ state: 'empty', detail: 'Geen gemeten uren' }))).toEqual([
      'Geen gemeten uren',
    ])
    expect(details(await kpi({ state: 'loading', detail: 'Geen gemeten uren' }))).toEqual([])
  })

  it('draws the detail below the comparison figures of a primary group', async () => {
    const element = await kpi({
      emphasis: 'primary',
      items: [{ value: '11 min' }, { value: '13 min', period: 'vorige week' }],
      detail: 'Norm 10 min',
    })
    expect(details(element)).toEqual(['Norm 10 min'])
  })
})

describe('lintje-kpi trend', () => {
  const judged = (element: Kpi): string[] =>
    [...element.renderRoot.querySelectorAll('.lintje-trend .visually-hidden')].map(
      (node) => node.textContent?.trim() ?? '',
    )

  it('says in words whether the direction is good, not only in colour', async () => {
    const up = await kpi({ value: '96 %', trend: { direction: 'up', sentence: '2 punten hoger' } })
    expect(judged(up)).toEqual(['gunstig:'])
    const worse = await kpi({
      value: '11 min',
      trend: { direction: 'up', sentence: '2 min langer', inverted: true },
    })
    expect(judged(worse)).toEqual(['ongunstig:'])
    const flat = await kpi({ value: '11 min', trend: { direction: 'flat', sentence: 'Gelijk' } })
    expect(judged(flat)).toEqual([])
  })
})

describe('lintje-kpi gauge', () => {
  const query = (element: Kpi, selector: string) => element.renderRoot.querySelector(selector)

  it('draws the arc with the value in its mouth and describes the scale', async () => {
    const element = await kpi({ value: '87%', gauge: { max: 100, target: 90 } })
    const arc = query(element, '.lintje-gauge--arc')
    expect(arc?.querySelector('.lintje-kpi__value')?.textContent).toContain('87%')
    expect(arc?.querySelector('.lintje-gauge__arc-fill')).not.toBeNull()
    expect(arc?.querySelector('.lintje-gauge__tick')).not.toBeNull()
    expect(arc?.querySelector('desc')?.textContent).toBe('87 op een schaal van 0 tot 100, doel 90')
  })

  it('draws the bar under the value with the target as a share of the scale', async () => {
    const element = await kpi({
      value: 11,
      suffix: 'min',
      gauge: { shape: 'linear', max: 30, value: 11, target: 15, targetLabel: 'norm' },
    })
    const bar = query(element, '.lintje-gauge--linear')
    expect(bar?.getAttribute('aria-label')).toBe('11 op een schaal van 0 tot 30, norm 15')
    expect((query(element, '.lintje-gauge__bar-fill') as HTMLElement).style.width).toMatch(/^36\.6/)
    expect((query(element, '.lintje-gauge__mark') as HTMLElement).style.left).toBe('50%')
    expect(query(element, '.lintje-gauge__scale-target')?.textContent).toBe('norm 15')
  })

  it('keeps the scale and the target but draws no fill without data', async () => {
    const empty = await kpi({ state: 'empty', gauge: { max: 100, target: 90 } })
    expect(query(empty, '.lintje-gauge__arc-fill')).toBeNull()
    expect(query(empty, '.lintje-gauge__tick')).not.toBeNull()
    expect(query(empty, '.lintje-kpi__note')?.textContent).toContain('Geen gegevens')
    const missing = await kpi({ value: '—', gauge: { max: 100, value: null } })
    expect(query(missing, '.lintje-gauge__arc-fill')).toBeNull()
  })

  it('draws the track alone while loading', async () => {
    const element = await kpi({ state: 'loading', gauge: { max: 100, target: 90 } })
    expect(query(element, '.lintje-gauge__track')).not.toBeNull()
    expect(query(element, '.lintje-gauge__tick')).toBeNull()
    expect(query(element, '.lintje-gauge__skeleton')).not.toBeNull()
  })

  it('clamps a figure past the end of the scale', async () => {
    const element = await kpi({ value: 140, gauge: { shape: 'linear', max: 120 } })
    expect((query(element, '.lintje-gauge__bar-fill') as HTMLElement).style.width).toBe('100%')
  })
})
