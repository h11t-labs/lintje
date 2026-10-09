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

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('lintje-number-input', () => {
  it('describes the field by its unit, before the hint', async () => {
    const element = await mount({ unit: 'min', stepper: false, hint: 'Hele minuten', value: 5 })
    const unit = element.shadowRoot!.querySelector('.lintje-number-input__unit')!
    const hint = element.shadowRoot!.querySelector('.lintje-field__hint')!
    expect(control(element).getAttribute('aria-describedby')).toBe(`${unit.id} ${hint.id}`)
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
})
