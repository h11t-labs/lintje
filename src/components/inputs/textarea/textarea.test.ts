/**
 * The textarea: the counter's arithmetic, the limit that warns instead of blocking, the two
 * commit rhythms, and the states every input shares (error, disabled, the `name` gate).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import './textarea'
import { counterSpeaks, counterText, limitMessage, type LintjeTextarea } from './textarea'

async function mount(props: Partial<LintjeTextarea> = {}): Promise<LintjeTextarea> {
  const element = document.createElement('lintje-textarea')
  element.label = 'Omschrijving'
  Object.assign(element, props)
  document.body.append(element)
  await element.updateComplete
  return element
}

const control = (element: LintjeTextarea): HTMLTextAreaElement =>
  element.renderRoot.querySelector('textarea')!

function listen(element: LintjeTextarea): unknown[] {
  const seen: unknown[] = []
  element.addEventListener('lintje-values-change', (event) =>
    seen.push((event as CustomEvent).detail),
  )
  return seen
}

function type(element: LintjeTextarea, text: string): void {
  control(element).value = text
  control(element).dispatchEvent(new Event('input', { bubbles: true }))
}

beforeEach(() => {
  document.body.innerHTML = ''
})

afterEach(() => {
  vi.useRealTimers()
})

describe('the counter', () => {
  it('counts in Dutch digits', () => {
    expect(counterText(36, 2000)).toBe('36 / 2.000 tekens')
  })

  it('says how many characters too many, and nothing at the limit', () => {
    expect(limitMessage(2000, 2000)).toBe('')
    expect(limitMessage(2012, 2000)).toBe('Maak de tekst 12 tekens korter')
    expect(limitMessage(11, 10)).toBe('Maak de tekst 1 teken korter')
    expect(limitMessage(5000, undefined)).toBe('')
  })

  it('is read out from 90 % of the limit', () => {
    expect(counterSpeaks(89, 100)).toBe(false)
    expect(counterSpeaks(90, 100)).toBe(true)
  })
})

describe('lintje-textarea', () => {
  it('is a real textarea of three rows, tied to its label', async () => {
    const element = await mount()
    expect(control(element).getAttribute('rows')).toBe('3')
    expect(control(element).getAttribute('aria-labelledby')).toBe('lintje-input-label')
  })

  it('draws the counter only with maxlength, and does not block the typing', async () => {
    expect((await mount()).renderRoot.querySelector('.lintje-textarea__counter')).toBeNull()
    const element = await mount({ maxlength: 2000, value: 'Tas zonder eigenaar bij de balie.' })
    const counter = element.renderRoot.querySelector('.lintje-textarea__counter')!
    expect(counter.textContent).toBe('33 / 2.000 tekens')
    expect(counter.getAttribute('aria-live')).toBe('off')
    expect(control(element).hasAttribute('maxlength')).toBe(false)
    expect(control(element).getAttribute('aria-describedby')).toContain(counter.id)
  })

  it('goes into its error state over the limit', async () => {
    const element = await mount({ maxlength: 10, hint: 'Kort en feitelijk' })
    type(element, 'Een tekst die te lang is')
    await element.updateComplete
    const counter = element.renderRoot.querySelector('.lintje-textarea__counter')!
    expect(counter.classList.contains('is-over')).toBe(true)
    expect(counter.getAttribute('aria-live')).toBe('polite')
    expect(control(element).getAttribute('aria-invalid')).toBe('true')
    expect(element.renderRoot.querySelector('.lintje-field__error')?.textContent).toContain(
      'Maak de tekst 14 tekens korter',
    )
    // The message replaces the hint.
    expect(element.renderRoot.querySelector('.lintje-field__hint')).toBeNull()
  })

  it('alerts the limit once as it is crossed, then leaves the speaking to the counter', async () => {
    const element = await mount({ maxlength: 10 })
    const message = (): Element | null => element.renderRoot.querySelector('.lintje-field__error')
    type(element, 'Elf tekens.')
    await element.updateComplete
    expect(message()?.getAttribute('role')).toBe('alert')
    type(element, 'Twaalf teken')
    await element.updateComplete
    expect(message()?.textContent).toContain('Maak de tekst 2 tekens korter')
    expect(message()?.hasAttribute('role')).toBe(false)
    // Back under the limit and over it again: a new crossing, alerted again.
    type(element, 'Kort')
    await element.updateComplete
    expect(message()).toBeNull()
    type(element, 'Weer te lang')
    await element.updateComplete
    expect(message()?.getAttribute('role')).toBe('alert')
    // The host's own error stays an alert.
    element.error = 'Omschrijving klopt niet'
    await element.updateComplete
    expect(message()?.getAttribute('role')).toBe('alert')
  })

  it("draws the host's error with its glyph and points at it", async () => {
    const element = await mount({ error: 'Omschrijving is verplicht' })
    const message = element.renderRoot.querySelector('.lintje-field__error')!
    expect(message.querySelector('svg')).not.toBeNull()
    expect(control(element).getAttribute('aria-describedby')).toBe(message.id)
    expect(control(element).getAttribute('aria-invalid')).toBe('true')
  })

  it('drops the counter and the tab stop when disabled, and commits nothing', async () => {
    const element = await mount({ disabled: true, maxlength: 100, name: 'p.tekst' })
    const seen = listen(element)
    expect(control(element).disabled).toBe(true)
    expect(element.renderRoot.querySelector('.lintje-textarea__counter')).toBeNull()
    ;(element as unknown as { commit(value: unknown): void }).commit('iets')
    expect(seen).toEqual([])
  })

  it('commits on change, and only with a name to the host', async () => {
    const named = await mount({ name: 'p.tekst' })
    const seen = listen(named)
    type(named, 'Regel een')
    expect(seen).toEqual([])
    control(named).dispatchEvent(new Event('change'))
    expect(seen).toEqual([{ 'p.tekst': 'Regel een' }])

    const loose = await mount()
    const heard: unknown[] = []
    loose.addEventListener('lintje-change', (event) => heard.push((event as CustomEvent).detail))
    const silent = listen(loose)
    type(loose, 'iets')
    control(loose).dispatchEvent(new Event('change'))
    expect(heard).toEqual(['iets'])
    expect(silent).toEqual([])
  })

  it('commits once on Ctrl+Enter and the native change that follows it', async () => {
    const element = await mount({ name: 'p.tekst' })
    const seen = listen(element)
    type(element, 'Regel een')
    control(element).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }))
    control(element).dispatchEvent(new Event('change'))
    expect(seen).toEqual([{ 'p.tekst': 'Regel een' }])
  })

  it('with commit="input" commits 300 ms after the last keystroke, and Ctrl+Enter at once', async () => {
    vi.useFakeTimers()
    const element = await mount({ name: 'p.tekst', commitOn: 'input' })
    const seen = listen(element)
    type(element, 'Eerste')
    vi.advanceTimersByTime(300)
    expect(seen).toEqual([{ 'p.tekst': 'Eerste' }])
    type(element, 'Eerste regel')
    control(element).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }))
    expect(seen).toEqual([{ 'p.tekst': 'Eerste' }, { 'p.tekst': 'Eerste regel' }])
    vi.advanceTimersByTime(300)
    expect(seen).toHaveLength(2)
  })
})

describe('lintje-textarea rows and variant', () => {
  it('shows three lines by default, and as many as rows asks', async () => {
    const plain = await mount()
    expect(control(plain).getAttribute('rows')).toBe('3')
    const tall = await mount({ rows: 8 })
    expect(control(tall).getAttribute('rows')).toBe('8')
    expect(control(tall).style.getPropertyValue('--lintje-rows')).toBe('8')
  })

  it('drops the field’s box in the plain variant, and keeps it by default', async () => {
    const field = await mount()
    expect(control(field).classList.contains('lintje-textarea__control--plain')).toBe(false)
    const plain = await mount({ variant: 'plain' })
    expect(plain.getAttribute('variant')).toBe('plain')
    expect(control(plain).classList.contains('lintje-textarea__control--plain')).toBe(true)
  })
})
