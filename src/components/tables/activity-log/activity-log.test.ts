/** The activity log: an ordered list, the newest marked, ten at a time, the moment in a time. */
import { describe, expect, it } from 'vitest'
import './activity-log'
import type { ActivityEntry, LintjeActivityLog } from './activity-log'

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
