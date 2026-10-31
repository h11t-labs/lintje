/** The timeline: moments along a rail, today between what happened and what is planned. */
import { describe, expect, it } from 'vitest'
import './timeline'
import {
  dashedBetween,
  latestIndex,
  newestFirst,
  rowLayout,
  shownMoments,
  stagger,
  timelineRows,
  todayIndex,
  type LintjeTimeline,
  type TimelineMoment,
} from './timeline'
import type { LintjePerson } from '../person/person'

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

const PROJECT: TimelineMoment[] = ['2019', '2021', '2023', '2025'].map((year) => ({
  when: year,
  at: year,
  title: `In ${year}`,
}))

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
  it('reads which end is now from what is planned, else from the times, else the oldest first', () => {
    expect(newestFirst(APPLICATION)).toBe(false)
    expect(newestFirst([...APPLICATION].reverse())).toBe(true)
    expect(newestFirst(PROJECT)).toBe(false)
    expect(newestFirst([...PROJECT].reverse())).toBe(true)
    expect(newestFirst(BILL.slice(0, 3))).toBe(false)
  })

  it('puts today between what happened and what is planned, in either order', () => {
    expect(todayIndex(APPLICATION, false)).toBe(3)
    expect(todayIndex(APPLICATION.slice(0, 3), false)).toBe(3)
    expect(todayIndex([...APPLICATION].reverse(), true)).toBe(2)
    expect(todayIndex([...PROJECT].reverse(), true)).toBe(0)
    expect(latestIndex(APPLICATION, false)).toBe(2)
    expect(latestIndex([...APPLICATION].reverse(), true)).toBe(2)
    expect(latestIndex([{ when: 'Later', title: 'Later', planned: true }], false)).toBe(-1)
  })

  it('dashes the rail next to what is still to come, in either order', () => {
    const forward = timelineRows(APPLICATION, 0, 5, 'Vandaag', false, false)
    expect(forward.slice(0, -1).map((_, at) => dashedBetween(forward, at))).toEqual([
      false,
      false,
      false,
      true,
      true,
    ])
    const back = [...APPLICATION].reverse()
    const backward = timelineRows(back, 0, 5, 'Vandaag', false, true)
    expect(backward.slice(0, -1).map((_, at) => dashedBetween(backward, at))).toEqual([
      true,
      true,
      false,
      false,
      false,
    ])
  })

  it('starts a group where it changes and puts today among the rows', () => {
    const kinds = timelineRows(BILL, 0, 4, 'Vandaag', true, false).map((row) =>
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
    expect(
      timelineRows(BILL, 0, 4, undefined, false, false).every((row) => row.kind === 'moment'),
    ).toBe(true)
  })

  it('keeps the oldest back under a limit, at whichever end they are', () => {
    expect(shownMoments(BILL, 2, 0, false)).toEqual({ from: 2, to: 4, hidden: 2 })
    expect(shownMoments(BILL, 2, 1, false)).toEqual({ from: 1, to: 4, hidden: 1 })
    expect(shownMoments(BILL, 2, 0, true)).toEqual({ from: 0, to: 2, hidden: 2 })
    expect(shownMoments(BILL, undefined, 0, false)).toEqual({ from: 0, to: 4, hidden: 0 })
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

describe('lying layout', () => {
  it('places each moment in proportion to its time, half a mark in, with a year under the rail', () => {
    const layout = rowLayout(PROJECT, 'start', 758)
    expect(layout.fits).toBe(true)
    expect(layout.places[0]!.x).toBe(5)
    const xs = layout.places.map((place) => place.x)
    expect(xs).toEqual([...xs].sort((a, b) => a - b))
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

  it('puts the date and a label above the title, and a slot per moment under it', async () => {
    const element = await mount({
      placement: 'alternate',
      moments: [
        {
          when: '9 september 2026',
          label: 'Uw actie',
          title: 'Aanvulling gestuurd',
          text: 'Uw aanvraag is compleet.',
          value: 'compleet',
        },
      ],
    })
    const body = element.shadowRoot!.querySelector('.lintje-timeline__body')!
    const over = body.querySelector('.lintje-timeline__over')!
    expect(text(over)).toBe('9 september 2026 · Uw actie')
    expect(over.nextElementSibling!.matches('.lintje-timeline__title')).toBe(true)
    const slot = body.querySelector<HTMLSlotElement>('.lintje-timeline__content slot')!
    expect(slot.name).toBe('compleet')
    expect(body.lastElementChild!.matches('.lintje-timeline__content')).toBe(true)
  })

  it('keeps only the label above the title when the date stands in a column', async () => {
    const moment = { when: '9 september 2026', label: 'Uw actie', title: 'Aanvulling gestuurd' }
    const element = await mount({ moments: [moment] })
    expect(text(element.shadowRoot!.querySelector('.lintje-timeline__over')!)).toBe('Uw actie')
    expect(text(element.shadowRoot!.querySelector('.lintje-timeline__when')!)).toBe(
      '9 september 2026',
    )
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

/** A history as the activity log had it: who did what, the newest first. */
function history(count: number): TimelineMoment[] {
  return Array.from({ length: count }, (_, index) => ({
    who: index % 2 ? 'M. Jansen' : 'J. de Vries',
    title: `deed stap ${count - index}`,
    when: `${30 - index} oktober 2026, 10:00`,
    at: `2026-10-${String(30 - index).padStart(2, '0')}T10:00:00+02:00`,
  }))
}

const moments = (element: LintjeTimeline): HTMLElement[] =>
  rows(element).filter((row) => row.matches('.lintje-timeline__row--moment'))

describe('lintje-timeline as a history', () => {
  it('marks the newest when it comes first, and keeps the oldest back below', async () => {
    const element = await mount({ moments: history(23), limit: 10, step: 10 })
    const root = element.shadowRoot!
    expect(moments(element)).toHaveLength(10)
    expect(moments(element)[0]!.classList.contains('is-latest')).toBe(true)
    const more = root.querySelector<HTMLElement>('.lintje-timeline__more')!
    expect(more.previousElementSibling!.matches('ol')).toBe(true)
    expect(text(more)).toBe('Toon 10 eerdere momenten')
    more.click()
    await element.updateComplete
    expect(moments(element)).toHaveLength(20)
    expect(text(root.querySelector('.lintje-timeline__more')!)).toBe('Toon 3 eerdere momenten')
    root.querySelector<HTMLElement>('.lintje-timeline__more')!.click()
    await element.updateComplete
    expect(moments(element)).toHaveLength(23)
    expect(root.querySelector('.lintje-timeline__more')).toBeNull()
  })

  it('puts the focus on the first new moment when the last press takes the button away', async () => {
    const element = await mount({ moments: history(13), limit: 10, step: 10 })
    element.shadowRoot!.querySelector<HTMLElement>('.lintje-timeline__more')!.click()
    await element.updateComplete
    await new Promise((resolve) => setTimeout(resolve))
    expect(element.shadowRoot!.activeElement).toBe(moments(element)[10])
  })

  it('says who and what in one sentence, the name bold and the rest not', async () => {
    const element = await mount({ moments: history(1) })
    const title = element.shadowRoot!.querySelector('.lintje-timeline__title')!
    expect(title.classList.contains('lintje-timeline__title--said')).toBe(true)
    expect(text(title)).toBe('J. de Vries deed stap 1')
    expect(text(title.querySelector('strong.lintje-timeline__who')!)).toBe('J. de Vries')
  })

  const JV = { name: 'J. de Vries', initials: 'JV' }

  it('puts the circle of a person before the bold name', async () => {
    const element = await mount({
      moments: [{ who: JV, title: 'wees de aanvraag toe', when: 'vandaag, 10:12' }],
    })
    const title = element.shadowRoot!.querySelector('.lintje-timeline__title')!
    const person = title.querySelector<LintjePerson>('strong.lintje-timeline__who lintje-person')!
    expect(person.getAttribute('size')).toBe('small')
    expect(person.person).toEqual(JV)
    await person.updateComplete
    expect(person.shadowRoot!.querySelector('.lintje-avatar')).not.toBeNull()
  })

  it('makes a person with `href` a link', async () => {
    const element = await mount({
      moments: [{ who: { ...JV, href: '/mensen/jv' }, title: 'keurde goed', when: 'gisteren' }],
    })
    const person = element.shadowRoot!.querySelector('lintje-person')!
    await person.updateComplete
    expect(person.shadowRoot!.querySelector('a')!.getAttribute('href')).toBe('/mensen/jv')
  })

  it('gives what is no person a circle with the cogs, or with the icon the host names', async () => {
    const element = await mount({
      moments: [
        { who: JV, title: 'wees de aanvraag toe', when: 'vandaag' },
        { who: 'Systeem', title: 'maakte de aanvraag aan', when: 'gisteren' },
        {
          who: { name: 'Afdeling Vergunningen', icon: 'gebouwen-basis-kantoorgebouw' },
          title: 'nam het over',
          when: 'eergisteren',
        },
      ],
    })
    const [person, system, team] = moments(element)
    expect(element.shadowRoot!.querySelector('ol')!.classList.contains('has-people')).toBe(true)
    expect(person!.querySelector('.lintje-timeline__actor')).toBeNull()
    expect(system!.querySelector('lintje-person')).toBeNull()
    expect(system!.querySelector('.lintje-timeline__actor')).not.toBeNull()
    expect(text(system!.querySelector('.lintje-timeline__who')!)).toBe('Systeem')
    expect(team!.querySelector('.lintje-timeline__actor')).not.toBeNull()
    expect(text(team!.querySelector('.lintje-timeline__who')!)).toBe('Afdeling Vergunningen')
  })

  it('keeps no room without anyone who did something', async () => {
    const element = await mount({ moments: PROJECT })
    expect(element.shadowRoot!.querySelector('ol')!.classList.contains('has-people')).toBe(false)
    expect(element.shadowRoot!.querySelector('.lintje-timeline__actor, lintje-person')).toBeNull()
  })
})
