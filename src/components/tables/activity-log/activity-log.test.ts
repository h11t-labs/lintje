/** The activity log: an ordered list, the newest marked, ten at a time, the moment in a time. */
import { describe, expect, it } from 'vitest'
import './activity-log'
import type { ActivityEntry, LintjeActivityLog } from './activity-log'
import type { LintjePerson } from '../person/person'

function entries(count: number): ActivityEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    who: index % 2 ? 'M. Jansen' : 'J. de Vries',
    what: `deed stap ${count - index}`,
    when: `${index + 1} oktober 2026, 10:00`,
    at: `2026-10-${String(index + 1).padStart(2, '0')}T10:00:00+02:00`,
  }))
}

async function mount(props: Partial<LintjeActivityLog>): Promise<LintjeActivityLog> {
  const element = Object.assign(document.createElement('lintje-activity-log'), props)
  document.body.append(element)
  await element.updateComplete
  return element
}

const items = (element: LintjeActivityLog): HTMLElement[] => [
  ...element.shadowRoot!.querySelectorAll<HTMLElement>('ol > li'),
]

describe('lintje-activity-log', () => {
  it('is an ordered list named by its heading, with the newest entry marked', async () => {
    const element = await mount({ heading: 'Geschiedenis', entries: entries(3) })
    const root = element.shadowRoot!
    const list = root.querySelector('ol')!
    expect(root.querySelector('h3')!.textContent).toBe('Geschiedenis')
    expect(list.getAttribute('aria-labelledby')).toBe(root.querySelector('h3')!.id)
    expect(items(element).map((item) => item.classList.contains('is-newest'))).toEqual([
      true,
      false,
      false,
    ])
  })

  it('says who and what in one sentence, and the moment in a <time datetime>', async () => {
    const element = await mount({
      entries: [
        {
          who: 'Systeem',
          what: 'rondde het transcriberen af',
          when: 'vandaag om 09:31',
          at: '2026-10-04T09:31:00+02:00',
        },
        { who: 'M. Jansen', what: 'maakte de melding aan', when: 'gisteren om 15:48' },
      ],
    })
    const [first, second] = items(element)
    expect(first!.querySelector('p')!.textContent!.replace(/\s+/g, ' ').trim()).toBe(
      'Systeem rondde het transcriberen af',
    )
    expect(first!.querySelector('time')!.getAttribute('datetime')).toBe('2026-10-04T09:31:00+02:00')
    expect(second!.querySelector('time')).toBeNull()
    expect(second!.textContent).toContain('gisteren om 15:48')
  })

  it('shows ten, and ten more on "Toon eerdere"', async () => {
    const element = await mount({ entries: entries(23) })
    expect(items(element)).toHaveLength(10)
    const more = element.shadowRoot!.querySelector<HTMLElement>('lintje-button')!
    expect(more.textContent).toBe('Toon eerdere')
    more.click()
    await element.updateComplete
    expect(items(element)).toHaveLength(20)
    element.shadowRoot!.querySelector<HTMLElement>('lintje-button')!.click()
    await element.updateComplete
    expect(items(element)).toHaveLength(23)
    expect(element.shadowRoot!.querySelector('lintje-button')).toBeNull()
  })

  it('puts the focus on the first new entry when the last press takes the button away', async () => {
    const element = await mount({ entries: entries(13) })
    element.shadowRoot!.querySelector<HTMLElement>('lintje-button')!.click()
    await element.updateComplete
    await new Promise((resolve) => setTimeout(resolve))
    expect(element.shadowRoot!.activeElement).toBe(items(element)[10])
  })
})

describe('a person in lintje-activity-log', () => {
  const JV = { name: 'J. de Vries', initials: 'JV' }

  it('puts the circle before the bold name and keeps the sentence', async () => {
    const element = await mount({
      entries: [{ who: JV, what: 'wees de aanvraag toe', when: 'vandaag, 10:12' }],
    })
    const what = element.shadowRoot!.querySelector('.lintje-activity-log__what')!
    const person = what.querySelector<LintjePerson>(
      'strong.lintje-activity-log__who lintje-person',
    )!
    expect(person.getAttribute('size')).toBe('small')
    expect(person.person).toEqual(JV)
    await person.updateComplete
    expect(person.shadowRoot!.querySelector('.lintje-avatar')).not.toBeNull()
    const said = `${person.person?.name}${what.textContent!.replace(/\s+/g, ' ')}`.trim()
    expect(said).toBe('J. de Vries wees de aanvraag toe')
  })

  it('makes a person with `href` a link: an entry opens nothing itself', async () => {
    const element = await mount({
      entries: [{ who: { ...JV, href: '/mensen/jv' }, what: 'keurde goed', when: 'gisteren' }],
    })
    const person = element.shadowRoot!.querySelector('lintje-person')!
    await person.updateComplete
    expect(person.shadowRoot!.querySelector('a')!.getAttribute('href')).toBe('/mensen/jv')
  })

  it('draws no circle and no icon for a text, but keeps its room where a person stands', async () => {
    const element = await mount({
      entries: [
        { who: JV, what: 'wees de aanvraag toe', when: 'vandaag' },
        { who: 'Systeem', what: 'maakte de aanvraag aan', when: 'gisteren' },
      ],
    })
    const [person, system] = items(element)
    expect(element.shadowRoot!.querySelector('ol')!.classList.contains('has-people')).toBe(true)
    expect(system!.querySelector('lintje-person, svg')).toBeNull()
    expect(system!.querySelector('.lintje-activity-log__space')).not.toBeNull()
    expect(system!.querySelector('.lintje-activity-log__who')!.textContent).toBe('Systeem')
    expect(person!.querySelector('.lintje-activity-log__space')).toBeNull()
  })

  it('stays as it was with only texts', async () => {
    const element = await mount({ entries: entries(2) })
    expect(element.shadowRoot!.querySelector('ol')!.classList.contains('has-people')).toBe(false)
    expect(
      element.shadowRoot!.querySelector('.lintje-activity-log__space, lintje-person'),
    ).toBeNull()
  })
})
