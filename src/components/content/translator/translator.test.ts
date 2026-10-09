/** The translator: the two halves and their slots, the plain source field, clearing and swapping. */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import './translator'
import type { LintjeTranslator } from './translator'
import type { LintjeTextarea } from '../../inputs/textarea/textarea'

beforeAll(() => {
  globalThis.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof matchMedia
})

async function mount(props: Partial<LintjeTranslator> = {}): Promise<LintjeTranslator> {
  const element = Object.assign(document.createElement('lintje-translator'), props)
  document.body.append(element)
  await element.updateComplete
  return element
}

const field = (element: LintjeTranslator): LintjeTextarea =>
  element.shadowRoot!.querySelector('lintje-textarea')!

afterEach(() => document.body.replaceChildren())

describe('lintje-translator', () => {
  it('draws two named halves with the host’s slots', async () => {
    const element = await mount({ targetLabel: 'Vertaling in het Engels' })
    const root = element.shadowRoot!
    const halves = [...root.querySelectorAll('[role="group"]')]
    expect(halves.map((half) => half.getAttribute('aria-label'))).toEqual([
      'Tekst om te vertalen',
      'Vertaling in het Engels',
    ])
    const slots = [...root.querySelectorAll('slot')].map((slot) => slot.getAttribute('name'))
    expect(slots).toEqual([
      'source-language',
      'source-actions',
      'target-language',
      'target',
      'target-note',
      'target-actions',
    ])
  })

  it('writes the source in a plain text field that carries the value and the limit', async () => {
    const element = await mount({ value: 'Goedemorgen', maxlength: 5000 })
    const source = field(element)
    await source.updateComplete
    expect(source.getAttribute('variant')).toBe('plain')
    expect(source.value).toBe('Goedemorgen')
    expect(source.maxlength).toBe(5000)
    expect(source.label).toBe('Tekst om te vertalen')
    expect(source.rows).toBe(10)
  })

  it('sends a typed text as lintje-text-change and keeps the field’s own change inside', async () => {
    const element = await mount()
    const heard: string[] = []
    element.addEventListener('lintje-text-change', (event) =>
      heard.push((event as CustomEvent<string>).detail),
    )
    let leaked = false
    document.body.addEventListener('lintje-change', () => (leaked = true))
    field(element).dispatchEvent(
      new CustomEvent('lintje-change', { detail: 'Hallo', bubbles: true }),
    )
    expect(heard).toEqual(['Hallo'])
    expect(element.value).toBe('Hallo')
    expect(leaked).toBe(false)
  })

  it('shows the clear button only with a text, and clearing sends an empty text', async () => {
    const empty = await mount()
    expect(empty.shadowRoot!.querySelector('.lintje-translator__clear')).toBeNull()

    const element = await mount({ value: 'Hallo' })
    const heard: string[] = []
    element.addEventListener('lintje-text-change', (event) =>
      heard.push((event as CustomEvent<string>).detail),
    )
    const clear = element.shadowRoot!.querySelector<HTMLElement>('.lintje-translator__clear')!
    expect(clear.getAttribute('label')).toBe('Tekst wissen')
    clear.click()
    await element.updateComplete
    expect(heard).toEqual([''])
    expect(element.value).toBe('')
    expect(element.shadowRoot!.querySelector('.lintje-translator__clear')).toBeNull()
  })

  it('asks for the languages to swap', async () => {
    const element = await mount()
    let asked = 0
    element.addEventListener('lintje-languages-swap', () => asked++)
    const swap = element.shadowRoot!.querySelector<HTMLElement>(
      '.lintje-translator__swap lintje-icon-button',
    )!
    expect(swap.getAttribute('label')).toBe('Talen omwisselen')
    swap.click()
    expect(asked).toBe(1)
  })

  it('says the swap, with the languages the host’s choices then show', async () => {
    vi.useFakeTimers()
    try {
      const element = await mount()
      const from = Object.assign(document.createElement('select'), { slot: 'source-language' })
      from.innerHTML =
        '<option value="nl" selected>Nederlands</option><option value="en">Engels</option>'
      const to = Object.assign(document.createElement('div'), {
        slot: 'target-language',
        options: [
          { value: 'nl', label: 'Nederlands' },
          { value: 'en', label: 'Engels' },
        ],
        value: 'en',
      })
      element.append(from, to)
      element.addEventListener('lintje-languages-swap', () => {
        ;[from.value, to.value] = [to.value, from.value]
      })
      const region = element.shadowRoot!.querySelector('[role="status"]')!
      const swap = element.shadowRoot!.querySelector<HTMLElement>(
        '.lintje-translator__swap lintje-icon-button',
      )!
      swap.click()
      await vi.runAllTimersAsync()
      await element.updateComplete
      expect(region.textContent).toBe('Talen omgewisseld: Engels naar Nederlands')

      swap.click()
      await element.updateComplete
      // Emptied first, so the same words again are heard as a change.
      expect(region.textContent).toBe('')
      await vi.runAllTimersAsync()
      await element.updateComplete
      expect(region.textContent).toBe('Talen omgewisseld: Nederlands naar Engels')
    } finally {
      vi.useRealTimers()
    }
  })

  it('says the swap without languages when the choices show none', async () => {
    vi.useFakeTimers()
    try {
      const element = await mount({ variant: 'documents' })
      element
        .shadowRoot!.querySelector<HTMLElement>('.lintje-translator__swap lintje-icon-button')!
        .click()
      await vi.runAllTimersAsync()
      await element.updateComplete
      expect(element.shadowRoot!.querySelector('[role="status"]')!.textContent).toBe(
        'Talen omgewisseld',
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the languages and the swap over the default slot in the documents variant', async () => {
    const element = await mount({ variant: 'documents' })
    const root = element.shadowRoot!
    expect(element.getAttribute('variant')).toBe('documents')
    expect(root.querySelector('lintje-textarea')).toBeNull()
    const slots = [...root.querySelectorAll('slot')].map((slot) => slot.getAttribute('name'))
    expect(slots).toEqual(['source-language', 'target-language', null])
    let asked = 0
    element.addEventListener('lintje-languages-swap', () => asked++)
    root.querySelector<HTMLElement>('.lintje-translator__swap lintje-icon-button')!.click()
    expect(asked).toBe(1)
  })
})
