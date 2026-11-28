/**
 * The number field for a screen reader: the unit as part of what the field says, the stepper's
 * names, and a step at a bound that keeps the focus.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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

// A refusal is drawn after a pointer press ends: end one that another test file left down.
beforeEach(() => {
  window.dispatchEvent(new Event('pointerup'))
})

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

describe('a typed number outside the bounds', () => {
  async function type(element: LintjeNumberInput, text: string): Promise<void> {
    control(element).value = text
    control(element).dispatchEvent(new Event('change'))
    await element.updateComplete
  }
  const error = (element: LintjeNumberInput): Element | null =>
    element.shadowRoot!.querySelector('.lintje-field__error')

  it('is refused with a message in place of the hint, as the date field does', async () => {
    const element = await mount({ value: 5, min: 2, max: 12, hint: 'Hele dagen', name: 'p.d' })
    const seen: unknown[] = []
    element.addEventListener('lintje-change', (event) => seen.push((event as CustomEvent).detail))
    await type(element, '30')
    expect(seen).toEqual([])
    expect(element.value).toBe(5)
    expect(error(element)?.textContent).toContain('Vul een getal in van 12 of minder')
    expect(element.shadowRoot!.querySelector('.lintje-field__hint')).toBeNull()
    expect(control(element).getAttribute('aria-invalid')).toBe('true')
    expect(control(element).getAttribute('aria-describedby')).toBe(error(element)!.id)
    await type(element, '1')
    expect(error(element)?.textContent).toContain('Vul een getal in van 2 of meer')
  })

  it('writes a bound with a decimal comma', async () => {
    const element = await mount({ min: 0.5, step: 0.5 })
    await type(element, '0.25')
    expect(error(element)?.textContent).toContain('0,5 of meer')
  })

  it('loses its message on a number inside, the old value too, and on a value of the host', async () => {
    const element = await mount({ value: 5, max: 12 })
    await type(element, '30')
    await type(element, '5')
    expect(error(element)).toBeNull()
    await type(element, '30')
    element.value = 7
    await element.updateComplete
    expect(error(element)).toBeNull()
  })

  it('loses its refusal on a form reset and on the same value from the host', async () => {
    const element = await mount({ value: 5, max: 12 })
    await type(element, '30')
    ;(element as unknown as { formResetCallback(): void }).formResetCallback()
    await element.updateComplete
    expect(error(element)).toBeNull()
    expect(control(element).hasAttribute('aria-invalid')).toBe(false)
    expect(control(element).value).toBe('5')

    await type(element, '30')
    element.value = 5
    await element.updateComplete
    expect(error(element)).toBeNull()
    expect(control(element).value).toBe('5')
  })

  it('keeps its message after a step that changes nothing at the bound', async () => {
    const element = await mount({ value: 12, max: 12 })
    await type(element, '30')
    steps(element)[1]!.click()
    await element.updateComplete
    expect(element.value).toBe(12)
    expect(error(element)?.textContent).toContain('12 of minder')
  })

  it('lets the host error win over its own message', async () => {
    const element = await mount({ value: 5, max: 12, error: 'Te hoog voor dit loket' })
    await type(element, '30')
    expect(error(element)?.textContent).toContain('Te hoog voor dit loket')
  })
})

describe('Enter on a refused number', () => {
  const prototype = HTMLElement.prototype as unknown as { attachInternals?: () => unknown }
  const original = prototype.attachInternals

  afterEach(() => {
    prototype.attachInternals = original
  })

  it('submits nothing: the form would post the old value under the message', async () => {
    let submits = 0
    prototype.attachInternals = () => ({
      form: { requestSubmit: () => submits++ },
      setFormValue: () => {},
      setValidity: () => {},
    })
    const element = await mount({ value: 5, max: 12 })
    const enter = async (text: string): Promise<void> => {
      control(element).value = text
      control(element).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      await element.updateComplete
      await new Promise((resolve) => setTimeout(resolve))
    }
    await enter('30')
    expect(submits).toBe(0)
    await enter('8')
    expect(submits).toBe(1)
  })
})
