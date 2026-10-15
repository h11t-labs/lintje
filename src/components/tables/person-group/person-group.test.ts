/** The row of people: `max` circles with "+n", one button that names them, and the list it opens. */
import { afterEach, describe, expect, it } from 'vitest'
import { spoken } from './person-group'
import type { LintjePersonGroup } from './person-group'
import type { Person } from '../../../types'

afterEach(() => {
  document.body.innerHTML = ''
})

const PEOPLE: Person[] = [
  { name: 'A. Bakker', initials: 'AB', role: 'Behandelaar' },
  { name: 'S. Yılmaz', initials: 'SY', role: 'Jurist' },
  { name: 'M. Jansen', initials: 'MJ' },
  { name: 'R. Visser', initials: 'RV', href: '/mensen/rv' },
  { name: 'L. de Boer', initials: 'LB' },
  { name: 'T. Smit', initials: 'TS' },
]

async function mount(props: Partial<LintjePersonGroup> = {}): Promise<LintjePersonGroup> {
  const element = Object.assign(document.createElement('lintje-person-group'), {
    people: PEOPLE,
    label: 'Meelezers',
    ...props,
  })
  document.body.append(element)
  await element.updateComplete
  return element
}

const button = (element: LintjePersonGroup): HTMLButtonElement =>
  element.shadowRoot!.querySelector('.lintje-person-group__button')!
const circles = (element: LintjePersonGroup): string[] =>
  [...button(element).querySelectorAll('.lintje-avatar')].map((avatar) =>
    avatar.textContent!.trim(),
  )

describe('lintje-person-group', () => {
  it('shows max − 1 circles and "+n" when there are more people', async () => {
    const element = await mount()
    expect(circles(element)).toEqual(['AB', 'SY', 'MJ', '+3'])
    expect(button(element).getAttribute('aria-label')).toBe(
      'Meelezers: A. Bakker, S. Yılmaz, M. Jansen en 3 anderen',
    )
  })

  it('shows everyone when they fit, and counts a max under 2 as 2', async () => {
    const two = await mount({ people: PEOPLE.slice(0, 2) })
    expect(circles(two)).toEqual(['AB', 'SY'])
    expect(button(two).getAttribute('aria-label')).toBe('Meelezers: A. Bakker en S. Yılmaz')
    const small = await mount({ max: 1 })
    expect(circles(small)).toEqual(['AB', '+5'])
  })

  it('says "en 1 ander", and the list "1 persoon"', async () => {
    const element = await mount({ people: PEOPLE.slice(0, 5), max: 4, open: true })
    expect(circles(element)).toEqual(['AB', 'SY', 'MJ', '+2'])
    expect(spoken(['A. Bakker', 'S. Yılmaz'], 1)).toBe('A. Bakker, S. Yılmaz en 1 ander')
    const alone = await mount({ people: PEOPLE.slice(0, 1), open: true })
    expect(alone.shadowRoot!.querySelector('.lintje-person-group__count')!.textContent).toBe(
      '1 persoon',
    )
  })

  it('opens the list on a click, sets aria-expanded, reflects open and sends lintje-toggle', async () => {
    const element = await mount()
    const said: unknown[] = []
    element.addEventListener('lintje-toggle', (event) => said.push((event as CustomEvent).detail))
    const trigger = button(element)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(trigger.hasAttribute('aria-haspopup')).toBe(false)
    trigger.click()
    await element.updateComplete
    expect(element.open).toBe(true)
    expect(element.hasAttribute('open')).toBe(true)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    const popover = element.shadowRoot!.querySelector('lintje-popover')!
    expect(trigger.getAttribute('aria-controls')).toBe(popover.id)
    expect(popover.getAttribute('placement')).toBe('bottom-end')
    trigger.click()
    await element.updateComplete
    expect(said).toEqual([{ open: true }, { open: false }])
  })

  it('lists everyone in the host’s order under the label, named by its heading', async () => {
    const element = await mount({ open: true })
    const root = element.shadowRoot!
    const list = root.querySelector('ul')!
    const heading = root.getElementById(list.getAttribute('aria-labelledby')!)!
    expect(heading.textContent!.replace(/\s+/g, ' ').trim()).toBe('Meelezers 6 personen')
    const people = [...list.querySelectorAll('lintje-person')]
    expect(people.map((person) => person.person?.name)).toEqual(PEOPLE.map((p) => p.name))
    expect(people.every((person) => person.getAttribute('size') === 'medium')).toBe(true)
  })

  it('closes on the popover’s Escape and gives the focus back to the button', async () => {
    const element = await mount({ open: true })
    const popover = element.shadowRoot!.querySelector('lintje-popover')!
    popover.dispatchEvent(new CustomEvent('lintje-close', { detail: { reason: 'escape' } }))
    await element.updateComplete
    expect(element.open).toBe(false)
    expect(element.shadowRoot!.activeElement).toBe(button(element))
  })

  it('is the empty circle with its word, and no button, without people', async () => {
    const element = await mount({ people: [] })
    const root = element.shadowRoot!
    expect(root.querySelector('button')).toBeNull()
    expect(root.querySelector('.lintje-avatar.is-empty')).not.toBeNull()
    expect(root.querySelector('.lintje-person-group__empty')!.textContent).toBe('Niemand')
  })
})
