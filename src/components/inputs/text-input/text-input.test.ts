/**
 * The text field's four types and its two commit rhythms. The shared states — error,
 * disabled, the `name` gate — are `../shared/input.test.ts`; this file is what `type` and
 * `commit` add.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import './text-input'
import type { LintjeTextInput } from './text-input'

async function mount(props: Partial<LintjeTextInput> = {}): Promise<LintjeTextInput> {
  const element = document.createElement('lintje-text-input')
  element.label = 'Zoeken'
  Object.assign(element, props)
  document.body.append(element)
  await element.updateComplete
  return element
}

const control = (element: LintjeTextInput): HTMLInputElement =>
  element.renderRoot.querySelector('.lintje-text-input__control')!

/** Every value the field told the host, in order. */
function listen(element: LintjeTextInput): unknown[] {
  const seen: unknown[] = []
  element.addEventListener('lintje-values-change', (event) =>
    seen.push((event as CustomEvent).detail),
  )
  return seen
}

function type(element: LintjeTextInput, text: string): void {
  const input = control(element)
  input.value = text
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

beforeEach(() => {
  document.body.innerHTML = ''
})

afterEach(() => {
  vi.useRealTimers()
})

describe('lintje-text-input commit', () => {
  it('commits on change by default, not on a keystroke', async () => {
    const element = await mount({ name: 'p.zoek' })
    const seen = listen(element)
    type(element, 'rooster')
    expect(seen).toEqual([])
    control(element).dispatchEvent(new Event('change'))
    expect(seen).toEqual([{ 'p.zoek': 'rooster' }])
  })

  it('with commit="input" bundles the keystrokes for 300 ms', async () => {
    vi.useFakeTimers()
    const element = await mount({ name: 'p.zoek', commitOn: 'input' })
    const seen = listen(element)
    type(element, 'r')
    vi.advanceTimersByTime(200)
    type(element, 'ro')
    vi.advanceTimersByTime(299)
    expect(seen).toEqual([])
    vi.advanceTimersByTime(1)
    expect(seen).toEqual([{ 'p.zoek': 'ro' }])
    // Leaving the field afterwards sends nothing twice.
    control(element).dispatchEvent(new Event('change'))
    expect(seen).toHaveLength(1)
  })

  it('commits at once on Enter', async () => {
    vi.useFakeTimers()
    const element = await mount({ name: 'p.zoek', commitOn: 'input' })
    const seen = listen(element)
    type(element, 'rooster')
    control(element).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(seen).toEqual([{ 'p.zoek': 'rooster' }])
    vi.advanceTimersByTime(500)
    expect(seen).toHaveLength(1)
  })

  it('commits once on Enter and the native change that follows it', async () => {
    const element = await mount({ name: 'p.zoek' })
    const seen = listen(element)
    type(element, 'rooster')
    control(element).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    control(element).dispatchEvent(new Event('change'))
    expect(seen).toEqual([{ 'p.zoek': 'rooster' }])
  })

  it('commits nothing while readonly, with commit="input" too', async () => {
    vi.useFakeTimers()
    const element = await mount({ name: 'p.zoek', commitOn: 'input', readonly: true })
    const seen = listen(element)
    type(element, 'rooster')
    vi.advanceTimersByTime(500)
    control(element).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    control(element).dispatchEvent(new Event('change'))
    expect(seen).toEqual([])
  })

  it('keeps the focus in the field on the clear button, and commits only the empty value', async () => {
    const element = await mount({ name: 'p.zoek', clearable: true, value: 'oud' })
    const seen = listen(element)
    type(element, 'rooster')
    await element.updateComplete
    const clear = element.renderRoot.querySelector<HTMLButtonElement>('.lintje-text-input__clear')!
    // No blur, so no `change` commits the half-typed text first.
    const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    clear.dispatchEvent(press)
    expect(press.defaultPrevented).toBe(true)
    clear.click()
    await element.updateComplete
    expect(element.value).toBe('')
    expect(seen).toEqual([{ 'p.zoek': '' }])
  })

  it('clears typed text that was never committed without committing anything', async () => {
    const element = await mount({ name: 'p.zoek', clearable: true })
    const seen = listen(element)
    type(element, 'rooster')
    await element.updateComplete
    element.renderRoot.querySelector<HTMLButtonElement>('.lintje-text-input__clear')!.click()
    await element.updateComplete
    expect(element.value).toBe('')
    expect(seen).toEqual([])
  })

  it('reads the attribute `commit`', async () => {
    document.body.innerHTML = '<lintje-text-input commit="input"></lintje-text-input>'
    const element = document.querySelector('lintje-text-input')!
    await element.updateComplete
    expect(element.commitOn).toBe('input')
  })
})

describe('lintje-text-input type="search"', () => {
  it('is a searchbox with the magnifier and a live hint line', async () => {
    const element = await mount({ type: 'search', hint: '3 resultaten' })
    const input = control(element)
    expect(input.type).toBe('search')
    expect(input.getAttribute('role')).toBe('searchbox')
    expect(input.getAttribute('enterkeyhint')).toBe('search')
    expect(element.renderRoot.querySelector('.lintje-text-input__search')).not.toBeNull()
    const hint = element.renderRoot.querySelector('.lintje-field__hint')!
    expect(hint.getAttribute('aria-live')).toBe('polite')
    expect(hint.textContent).toBe('3 resultaten')
  })

  it('keeps the live line in the tree before there is a count', async () => {
    const element = await mount({ type: 'search' })
    const hint = element.renderRoot.querySelector('.lintje-field__hint')!
    expect(hint.hasAttribute('hidden')).toBe(true)
    expect(control(element).hasAttribute('aria-describedby')).toBe(false)
  })

  it('shows the cross as soon as there is text, and Escape clears', async () => {
    const element = await mount({ type: 'search', name: 'p.zoek' })
    const seen = listen(element)
    expect(element.renderRoot.querySelector('.lintje-text-input__clear')).toBeNull()
    type(element, 'rooster')
    control(element).dispatchEvent(new Event('change'))
    await element.updateComplete
    expect(element.renderRoot.querySelector('.lintje-text-input__clear')).not.toBeNull()
    control(element).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await element.updateComplete
    expect(element.value).toBe('')
    expect(seen).toEqual([{ 'p.zoek': 'rooster' }, { 'p.zoek': '' }])
  })
})

describe('lintje-text-input type="password"', () => {
  it('hides the text until "Tonen" is pressed', async () => {
    const element = await mount({ type: 'password' })
    expect(control(element).type).toBe('password')
    const button = element.renderRoot.querySelector('lintje-button')!
    expect(button.textContent?.trim()).toBe('Tonen')
    button.click()
    await element.updateComplete
    expect(control(element).type).toBe('text')
    expect(button.textContent?.trim()).toBe('Verbergen')
  })

  it('passes autocomplete on and draws no clear button', async () => {
    const element = await mount({
      type: 'password',
      clearable: true,
      value: 'geheim',
      autocomplete: 'current-password',
    })
    expect(control(element).getAttribute('autocomplete')).toBe('current-password')
    expect(element.renderRoot.querySelector('.lintje-text-input__clear')).toBeNull()
  })
})

describe('lintje-text-input type="email"', () => {
  it('asks for the e-mail keyboard', async () => {
    const element = await mount({ type: 'email' })
    expect(control(element).type).toBe('email')
    expect(control(element).getAttribute('inputmode')).toBe('email')
  })

  it('lets the message replace the hint', async () => {
    const element = await mount({
      type: 'email',
      hint: 'Je werkadres',
      error: 'Vul een volledig e-mailadres in',
    })
    expect(element.renderRoot.querySelector('.lintje-field__hint')).toBeNull()
    expect(element.renderRoot.querySelector('.lintje-field__error')?.textContent).toContain(
      'Vul een volledig e-mailadres in',
    )
    expect(control(element).getAttribute('aria-describedby')).toBe('lintje-input-error')
  })
})
