/** The stepper: the list's structure and ARIA, the three states, and the layout arithmetic. */
import { describe, expect, it } from 'vitest'
import './stepper'
import { chooseLayout, errorText, position, type LintjeStepper, type Step } from './stepper'

const STEPS: Step[] = [
  { label: 'Melding', href: '?stap=1', state: 'done' },
  { label: 'Opvolging', state: 'current' },
  { label: 'Controleren en versturen', state: 'next' },
]

async function mount(
  steps: Step[],
  props: Partial<Pick<LintjeStepper, 'orientation'>> = {},
): Promise<LintjeStepper> {
  const element = Object.assign(document.createElement('lintje-stepper'), { steps, ...props })
  document.body.append(element)
  await element.updateComplete
  return element
}

describe('lintje-stepper', () => {
  it('is a named navigation with an ordered list and the current step marked', async () => {
    const element = await mount(STEPS)
    const root = element.shadowRoot!
    expect(root.querySelector('nav')!.getAttribute('aria-label')).toBe('Stappen')
    const items = [...root.querySelectorAll('ol > li')]
    expect(items).toHaveLength(3)
    expect(items.map((item) => item.getAttribute('aria-current'))).toEqual([null, 'step', null])
    expect(items[1]!.querySelector('.lintje-stepper__marker')!.textContent).toBe('2')
    expect(items.map((item) => item.querySelector('.visually-hidden')!.textContent)).toEqual([
      ', gedaan',
      ', huidige stap',
      ', nog niet aan de beurt',
    ])
  })

  it('links back from a done step only', async () => {
    const element = await mount(STEPS)
    const links = element.shadowRoot!.querySelectorAll('a')
    expect(links).toHaveLength(1)
    expect(links[0]!.getAttribute('href')).toBe('?stap=1')

    const hrefs: string[] = []
    element.addEventListener('lintje-navigate', (event) =>
      hrefs.push((event as CustomEvent<{ href: string }>).detail.href),
    )
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    links[0]!.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(false)
    expect(hrefs).toEqual(['?stap=1'])
  })

  it('marks a done step with errors and counts them', async () => {
    const element = await mount([{ ...STEPS[0]!, errors: 2 }, STEPS[1]!, STEPS[2]!])
    const first = element.shadowRoot!.querySelector('li')!
    expect(first.querySelector('.lintje-stepper__marker')!.classList.contains('is-error')).toBe(
      true,
    )
    expect(first.querySelector('.lintje-stepper__errors')!.textContent).toBe('2 fouten')
  })

  it('stands in a column when vertical, with the description and the meta line', async () => {
    const element = await mount(
      [
        { ...STEPS[0]!, meta: 'juli 2023' },
        { ...STEPS[1]!, meta: 'aug – sept 2023', description: 'We schetsen de plannen.' },
        STEPS[2]!,
      ],
      { orientation: 'vertical' },
    )
    const root = element.shadowRoot!
    expect(root.querySelector('ol')!.classList.contains('lintje-stepper__list--column')).toBe(true)
    const items = [...root.querySelectorAll('li')]
    expect(items.map((item) => item.querySelector('.lintje-stepper__meta')?.textContent)).toEqual([
      'juli 2023',
      'aug – sept 2023',
      undefined,
    ])
    expect(items[1]!.querySelector('.lintje-stepper__description')!.textContent).toBe(
      'We schetsen de plannen.',
    )
  })

  it('keeps the description out of a row', async () => {
    const element = await mount([{ ...STEPS[0]!, description: 'Niet in de rij.' }, STEPS[1]!])
    expect(element.shadowRoot!.querySelector('.lintje-stepper__description')).toBeNull()
  })
})

describe('stepper arithmetic', () => {
  it('counts the errors in Dutch', () => {
    expect(errorText(1)).toBe('1 fout')
    expect(errorText(3)).toBe('3 fouten')
  })

  it('places the current step for the phone line and the bar', () => {
    expect(position(STEPS)).toEqual({ place: 2, total: 3, percent: 67 })
  })

  it('stands the steps up when the row overflows, and lays them down when it fits again', () => {
    expect(chooseLayout('row', 600, 500, 500)).toBe('row')
    expect(chooseLayout('row', 400, 500, 500)).toBe('column')
    expect(chooseLayout('column', 450, 300, 500)).toBe('column')
    expect(chooseLayout('column', 520, 300, 500)).toBe('row')
  })
})
