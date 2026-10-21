/**
 * The number field for a screen reader: the unit as part of what the field says, the stepper's
 * names, and a step at a bound that keeps the focus.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import './number-input'
import type { LintjeNumberInput } from './number-input'

async function mount(props: Partial<LintjeNumberInput> = {}): Promise<LintjeNumberInput> {
  const element = Object.assign(document.createElement('lintje-number-input'), {
    label: 'Drempel',
    ...props,
  })
  document.body.append(element)
  await element.updateComplete
  return element
}

const control = (element: LintjeNumberInput): HTMLInputElement =>
  element.shadowRoot!.querySelector('.lintje-number-input__control')!
const steps = (element: LintjeNumberInput): HTMLButtonElement[] => [
  ...element.shadowRoot!.querySelectorAll<HTMLButtonElement>('.lintje-number-input__step'),
]

const region = (element: LintjeNumberInput): string =>
  element.shadowRoot!.querySelector('[role="status"]')!.textContent ?? ''
const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()))

/** What the status region says, after its fill frame. */
async function said(element: LintjeNumberInput): Promise<string> {
  await element.updateComplete
  await frame()
  await element.updateComplete
  return region(element)
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('lintje-number-input', () => {
  it('describes the field by its unit, before the hint', async () => {
    const element = await mount({ unit: 'min', stepper: false, hint: 'Hele minuten', value: 5 })
    const unit = element.shadowRoot!.querySelector('.lintje-field__addon--suffix')!
    const hint = element.shadowRoot!.querySelector('.lintje-field__hint')!
    expect(unit.textContent).toBe('min')
    expect(control(element).getAttribute('aria-describedby')).toBe(`${unit.id} ${hint.id}`)
  })

  it('passes autocomplete to the native field, and none without it', async () => {
    expect(control(await mount()).hasAttribute('autocomplete')).toBe(false)
    const year = await mount({ label: 'Geboortejaar', autocomplete: 'bday-year' })
    expect(control(year).getAttribute('autocomplete')).toBe('bday-year')
  })

  it('describes the field by its prefix, then its unit', async () => {
    const element = await mount({ prefix: '€', unit: 'per uur', stepper: false })
    const prefix = element.shadowRoot!.querySelector('.lintje-field__addon--prefix')!
    const unit = element.shadowRoot!.querySelector('.lintje-field__addon--suffix')!
    expect(prefix.textContent).toBe('€')
    expect(control(element).getAttribute('aria-describedby')).toBe(`${prefix.id} ${unit.id}`)
  })

  it('draws no prefix or unit with the stepper', async () => {
    const element = await mount({ prefix: '€', unit: 'min', value: 5 })
    expect(element.shadowRoot!.querySelector('.lintje-field__addon')).toBeNull()
    expect(control(element).hasAttribute('aria-describedby')).toBe(false)
  })

  it('names the steps by what they do, whatever the step', async () => {
    const element = await mount({ value: 5, step: 5 })
    expect(steps(element).map((step) => step.getAttribute('aria-label'))).toEqual([
      'Verlagen',
      'Verhogen',
    ])
  })

  it('keeps a step at a bound focusable, marks it and lets a press do nothing', async () => {
    const element = await mount({ value: 0, min: 0, max: 20, name: 'p.drempel' })
    const seen: unknown[] = []
    element.addEventListener('lintje-change', (event) => seen.push((event as CustomEvent).detail))
    const [down, up] = steps(element)
    expect(down.disabled).toBe(false)
    expect(down.getAttribute('aria-disabled')).toBe('true')
    expect(down.classList.contains('is-limit')).toBe(true)
    expect(up.hasAttribute('aria-disabled')).toBe(false)
    down.focus()
    down.click()
    await element.updateComplete
    expect(seen).toEqual([])
    expect(element.shadowRoot!.activeElement).toBe(down)
    up.click()
    await element.updateComplete
    expect(seen).toEqual([1])
    expect(down.hasAttribute('aria-disabled')).toBe(false)
  })

  it('disables both steps natively when the whole field is disabled', async () => {
    const element = await mount({ value: 5, disabled: true })
    expect(steps(element).map((step) => step.disabled)).toEqual([true, true])
  })

  it('says the new value after a press on a step, and nothing after a value of the host', async () => {
    const element = await mount({ value: 3 })
    steps(element)[1]!.click()
    expect(await said(element)).toBe('4')

    const quiet = await mount({ value: 3 })
    quiet.value = 7
    expect(await said(quiet)).toBe('')
  })

  it('says nothing for a press at a bound', async () => {
    const element = await mount({ value: 0, min: 0 })
    steps(element)[0]!.click()
    expect(await said(element)).toBe('')
  })
})
