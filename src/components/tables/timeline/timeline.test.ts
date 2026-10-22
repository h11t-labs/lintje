/** The timeline: moments along a rail, today between what happened and what is planned. */
import { describe, expect, it } from 'vitest'
import './timeline'
import {
  latestIndex,
  rowLayout,
  shownMoments,
  stagger,
  timelineRows,
  todayIndex,
  type LintjeTimeline,
  type TimelineMoment,
} from './timeline'

const APPLICATION: TimelineMoment[] = [
  { when: '3 augustus 2026', at: '2026-08-03', title: 'Aanvraag ingediend', side: 'start' },
  { when: '20 augustus 2026', at: '2026-08-20', title: 'Aanvulling gevraagd', side: 'end' },
  { when: '9 september 2026', at: '2026-09-09', title: 'Aanvulling gestuurd', side: 'start' },
  { when: 'Verwacht vóór 1 december 2026', title: 'Besluit', planned: true, side: 'end' },
  { when: 'Nog niet bekend', title: 'Uitbetaling', planned: true, side: 'end' },
]

const BILL: TimelineMoment[] = [
  { when: '14 januari', title: 'Internetconsultatie geopend', group: '2025' },
  { when: '2 april', title: 'Reacties verwerkt', group: '2025' },
  { when: '10 februari', title: 'Aangenomen door de Tweede Kamer', group: '2026' },
  { when: 'Verwacht 1 januari', title: 'Inwerkingtreding', group: '2027', planned: true },
]

async function mount(props: Partial<LintjeTimeline>): Promise<LintjeTimeline> {
  const element = Object.assign(document.createElement('lintje-timeline'), props)
  document.body.append(element)
  await element.updateComplete
  return element
}

const rows = (element: LintjeTimeline): HTMLElement[] => [
  ...element.shadowRoot!.querySelectorAll<HTMLElement>('ol > li'),
]
const text = (node: Element): string => node.textContent!.replace(/\s+/g, ' ').trim()

describe('timeline layout', () => {
  it('puts today before the first planned moment, or after the last', () => {
    expect(todayIndex(APPLICATION)).toBe(3)
    expect(todayIndex(APPLICATION.slice(0, 3))).toBe(3)
    expect(latestIndex(APPLICATION)).toBe(2)
    expect(latestIndex([{ when: 'Later', title: 'Later', planned: true }])).toBe(-1)
  })

  it('starts a group where it changes and puts today among the rows', () => {
    const kinds = timelineRows(BILL, 0, 'Vandaag', true).map((row) =>
      row.kind === 'moment' ? row.moment.title : `${row.kind}:${row.label}`,
    )
    expect(kinds).toEqual([
      'group:2025',
      'Internetconsultatie geopend',
      'Reacties verwerkt',
      'group:2026',
      'Aangenomen door de Tweede Kamer',
      'today:Vandaag',
      'group:2027',
      'Inwerkingtreding',
    ])
    expect(timelineRows(BILL, 0, undefined, false).every((row) => row.kind === 'moment')).toBe(true)
  })

  it('shows the latest moments under a limit, and all of them once expanded', () => {
    expect(shownMoments(BILL, 2, false)).toEqual({ first: 2, hidden: 2 })
    expect(shownMoments(BILL, 2, true)).toEqual({ first: 0, hidden: 0 })
    expect(shownMoments(BILL, undefined, false)).toEqual({ first: 0, hidden: 0 })
  })

  it('staggers two sides: never before the one above, clear of its own side', () => {
    const tops = stagger([
      { side: 'end', height: 71 },
      { side: 'start', height: 123 },
      { side: 'end', height: 71 },
      { side: 'start', height: 95 },
    ])
    expect(tops).toEqual([0, 64, 128, 219])
  })
})

const PROJECT: TimelineMoment[] = ['2019', '2021', '2023', '2025'].map((year) => ({
  when: year,
  at: year,
  title: `In ${year}`,
}))

describe('lying layout', () => {
  it('places each moment in proportion to its time, half a mark in, with a year under the rail', () => {
    const layout = rowLayout(PROJECT, 'start', 758)
    expect(layout.fits).toBe(true)
    expect(layout.places[0]!.x).toBe(5)
    expect(layout.places.map((place) => place.x)).toEqual(
      [...layout.places.map((place) => place.x)].sort((a, b) => a - b),
    )
    expect(layout.places.every((place) => place.up)).toBe(true)
    expect(layout.years.map((year) => year.label)).toEqual([
      '2020',
      '2021',
      '2022',
      '2023',
      '2024',
      '2025',
    ])
  })

  it('does not fit when a label would have less than its minimum', () => {
    expect(rowLayout(PROJECT, 'start', 500).fits).toBe(false)
    expect(rowLayout(PROJECT, 'alternate', 500).fits).toBe(true)
  })

  it('puts a moment without a time apart, after the end of the rail', () => {
    const layout = rowLayout(APPLICATION, 'sides', 1200, '2026-10-21')
    const apart = layout.places.filter((place) => place.apart)
    expect(apart).toHaveLength(2)
    expect(apart.every((place) => place.x > layout.end)).toBe(true)
    expect(layout.boundary).toBe(layout.today)
  })

  it("ends a label above the rail before today's label", () => {
    const layout = rowLayout(APPLICATION.slice(0, 3), 'sides', 1000, '2026-10-21')
    const above = layout.places[2]!
    expect(above.up).toBe(true)
    expect(above.x + above.width).toBeLessThanOrEqual(layout.today! - 40)
  })
})

describe('lintje-timeline', () => {
  it('is an ordered list named by its heading, the latest moment marked', async () => {
    const element = await mount({ heading: 'Uw aanvraag', moments: APPLICATION })
    const root = element.shadowRoot!
    expect(root.querySelector('ol')!.getAttribute('aria-labelledby')).toBe(
      root.querySelector('h3')!.id,
    )
    const moments = rows(element)
    expect(moments.map((row) => row.classList.contains('is-latest'))).toEqual([
      false,
      false,
      true,
      false,
      false,
    ])
    expect(moments.map((row) => row.classList.contains('is-planned'))).toEqual([
      false,
      false,
      false,
      true,
      true,
    ])
    expect(moments[0]!.querySelector('time')!.getAttribute('datetime')).toBe('2026-08-03')
    expect(moments[3]!.querySelector('time')).toBeNull()
  })

  it('draws today as an item of its own between what happened and what is planned', async () => {
    const element = await mount({ moments: APPLICATION, today: 'Vandaag, 21 oktober' })
    const today = rows(element)[3]!
    expect(today.classList.contains('lintje-timeline__row--today')).toBe(true)
    expect(text(today)).toBe('Vandaag, 21 oktober')
  })

  it('draws the groups on one side, and none on two', async () => {
    const element = await mount({ moments: BILL })
    expect(
      rows(element)
        .filter((row) => row.matches('.lintje-timeline__row--group'))
        .map(text),
    ).toEqual(['2025', '2026', '2027'])
    element.placement = 'alternate'
    await element.updateComplete
    expect(element.shadowRoot!.querySelector('.lintje-timeline__row--group')).toBeNull()
  })

  it('alternates the sides from the end, or follows each moment with the names', async () => {
    const element = await mount({ moments: APPLICATION, placement: 'alternate' })
    const side = (row: HTMLElement): string =>
      row.classList.contains('lintje-timeline__row--start') ? 'start' : 'end'
    expect(rows(element).map(side)).toEqual(['end', 'start', 'end', 'start', 'end'])
    element.placement = 'sides'
    element.sides = ['U', 'Wij']
    await element.updateComplete
    expect(rows(element).map(side)).toEqual(['start', 'end', 'start', 'end', 'end'])
    expect(text(element.shadowRoot!.querySelector('.lintje-timeline__heads')!)).toBe('U Wij')
    expect(text(rows(element)[1]!.querySelector('.visually-hidden')!)).toBe('Wij:')
  })

  it('shows the latest moments first; "Toon eerdere" shows the rest and focuses the first', async () => {
    const element = await mount({ moments: BILL, limit: 2 })
    const root = element.shadowRoot!
    const more = root.querySelector<HTMLElement>('.lintje-timeline__more')!
    expect(text(more)).toBe('Toon 2 eerdere momenten')
    expect(
      rows(element).filter((row) => row.matches('.lintje-timeline__row--moment')),
    ).toHaveLength(2)
    more.click()
    await element.updateComplete
    await element.updateComplete
    expect(root.querySelector('.lintje-timeline__more')).toBeNull()
    const first = root.querySelector<HTMLElement>('.lintje-timeline__row--moment')!
    expect(text(first)).toContain('Internetconsultatie geopend')
    expect(root.activeElement).toBe(first)
  })

  it('says the empty sentence without moments, and draws no rail', async () => {
    const element = await mount({ empty: 'Er is nog niets gebeurd met deze aanvraag.' })
    const root = element.shadowRoot!
    expect(root.querySelector('ol')).toBeNull()
    expect(text(root.querySelector('.lintje-timeline__empty')!)).toBe(
      'Er is nog niets gebeurd met deze aanvraag.',
    )
  })

  it('lies along a rail when it fits, with labels above and under it and today across it', async () => {
    const element = await mount({
      moments: APPLICATION.slice(0, 3),
      orientation: 'horizontal',
      placement: 'sides',
      sides: ['U', 'Wij'],
      today: 'Vandaag',
      todayAt: '2026-10-21',
    })
    ;(element as unknown as { width: number }).width = 1000
    await element.updateComplete
    const root = element.shadowRoot!
    expect(root.querySelector('.lintje-timeline__axis')).not.toBeNull()
    const sides = rows(element)
      .filter((row) => row.matches('.lintje-timeline__row--moment'))
      .map((row) => (row.classList.contains('lintje-timeline__row--up') ? 'up' : 'down'))
    expect(sides).toEqual(['up', 'down', 'up'])
    expect(text(root.querySelector('.lintje-timeline__row--today')!)).toBe('Vandaag')
    ;(element as unknown as { width: number }).width = 300
    await element.updateComplete
    expect(root.querySelector('.lintje-timeline__axis')).toBeNull()
  })

  it('sends a plain click on a link as lintje-navigate', async () => {
    const element = await mount({
      moments: [
        { when: '2021', title: 'Besluit', link: { label: 'Lees het besluit', href: '/besluit' } },
      ],
    })
    const seen: unknown[] = []
    element.addEventListener('lintje-navigate', (event) => {
      seen.push((event as CustomEvent).detail)
      event.preventDefault()
    })
    element.shadowRoot!.querySelector<HTMLAnchorElement>('.lintje-timeline__link')!.click()
    expect(seen).toEqual([{ href: '/besluit' }])
  })
})
