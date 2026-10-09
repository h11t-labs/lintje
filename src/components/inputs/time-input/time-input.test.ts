/** The time input: what it shows, sends and refuses, and its keys. The arithmetic is `time-format.test.ts`. */
import { describe, expect, it, vi } from 'vitest'
import './time-input'
import type { LintjeTimeInput } from './time-input'

async function mount(props: Partial<LintjeTimeInput> = {}): Promise<LintjeTimeInput> {
  const element = Object.assign(document.createElement('lintje-time-input'), {
    label: 'Tijdstip',
    ...props,
  })
  document.body.append(element)
  await element.updateComplete
  return element
}

const control = (element: LintjeTimeInput): HTMLInputElement =>
  element.shadowRoot!.querySelector('.lintje-time-input__control')!

async function type(element: LintjeTimeInput, text: string): Promise<void> {
  control(element).value = text
  control(element).dispatchEvent(new Event('change'))
  await element.updateComplete
}

async function press(element: LintjeTimeInput, key: string): Promise<void> {
  control(element).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  await element.updateComplete
}

function listen(element: LintjeTimeInput): { local: unknown[]; values: unknown[] } {
  const seen = { local: [] as unknown[], values: [] as unknown[] }
  element.addEventListener('lintje-change', (event) =>
    seen.local.push((event as CustomEvent).detail),
  )
  element.addEventListener('lintje-values-change', (event) =>
    seen.values.push((event as CustomEvent).detail),
  )
  return seen
}

describe('lintje-time-input', () => {
  it('is a numeric text field named by its label, with the hint tied to it', async () => {
    const element = await mount({ value: '14:35' })
    expect(control(element).value).toBe('14:35')
    expect(control(element).getAttribute('inputmode')).toBe('numeric')
    const label = element.shadowRoot!.querySelector('.lintje-label')!
    expect(control(element).getAttribute('aria-labelledby')).toBe(label.id)
    const hint = element.shadowRoot!.querySelector('.lintje-field__hint')!
    expect(hint.textContent).toBe('uu:mm')
    expect(control(element).getAttribute('aria-describedby')).toBe(hint.id)
  })

  it('reads 1435 as 14:35, writes it back and sends it; to the host only with a name', async () => {
    const element = await mount({ name: 'p.tijd' })
    const seen = listen(element)
    await type(element, '1435')
    expect(control(element).value).toBe('14:35')
    expect(seen.local).toEqual(['14:35'])
    expect(seen.values).toEqual([{ 'p.tijd': '14:35' }])

    const loose = await mount()
    const looseSeen = listen(loose)
    await type(loose, '9')
    expect(control(loose).value).toBe('09:00')
    expect(looseSeen.values).toEqual([])
  })

  it('refuses what is no time: the message replaces the hint, nothing is sent', async () => {
    const element = await mount({ value: '14:35' })
    const seen = listen(element)
    await type(element, '25:00')
    const error = element.shadowRoot!.querySelector('.lintje-field__error')!
    expect(error.textContent).toContain('Vul een tijd in als uu:mm')
    expect(element.shadowRoot!.querySelector('.lintje-field__hint')).toBeNull()
    expect(control(element).getAttribute('aria-invalid')).toBe('true')
    expect(control(element).value).toBe('25:00')
    expect(element.value).toBe('14:35')
    expect(seen.local).toEqual([])
  })

  it('names the bound a time falls outside of', async () => {
    const element = await mount({ min: '08:00', max: '18:00' })
    await type(element, '0730')
    expect(element.shadowRoot!.textContent).toContain('Kies een tijd op of na 08:00')
    await type(element, '1830')
    expect(element.shadowRoot!.textContent).toContain('Kies een tijd op of voor 18:00')
  })

  it('moves one minute with the arrows and a step with PageUp and PageDown', async () => {
    const element = await mount({ value: '14:35', step: 15 })
    const seen = listen(element)
    await press(element, 'ArrowUp')
    await press(element, 'PageUp')
    await press(element, 'PageDown')
    await press(element, 'ArrowDown')
    expect(seen.local).toEqual(['14:36', '14:51', '14:36', '14:35'])
  })

  it('picks the time it is now, rounded to the step, with the first arrow in an empty field', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 4, 10, 52))
    try {
      const element = await mount({ step: 15 })
      const seen = listen(element)
      await press(element, 'ArrowUp')
      expect(seen.local).toEqual(['10:45'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows the modified state on the label', async () => {
    const element = await mount({ value: '14:35', modified: true })
    expect(element.shadowRoot!.querySelector('.lintje-label.is-modified')).not.toBeNull()
    expect(element.shadowRoot!.querySelector('.lintje-label__dot')).not.toBeNull()
  })

  it('commits nothing while disabled', async () => {
    const element = await mount({ disabled: true })
    const seen = listen(element)
    expect(control(element).disabled).toBe(true)
    await type(element, '1435')
    expect(seen.local).toEqual([])
  })
})
