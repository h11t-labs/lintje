/**
 * The keyword field: how text becomes chips (arithmetic), the keyboard that walks and
 * removes them, the suggestions, and the states every input shares.
 */
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import './tag-input'
import { addWords, splitWords, type LintjeTagInput } from './tag-input'

async function mount(props: Partial<LintjeTagInput> = {}): Promise<LintjeTagInput> {
  const element = document.createElement('lintje-tag-input')
  element.label = 'Trefwoorden'
  Object.assign(element, props)
  document.body.append(element)
  await element.updateComplete
  return element
}

const field = (element: LintjeTagInput): HTMLInputElement =>
  element.renderRoot.querySelector('.lintje-tag-input__input')!

const chips = (element: LintjeTagInput): string[] =>
  [...element.renderRoot.querySelectorAll('.lintje-tag-input__chip')].map(
    (chip) => chip.textContent?.trim() ?? '',
  )

async function type(element: LintjeTagInput, text: string): Promise<void> {
  field(element).value = text
  field(element).dispatchEvent(new Event('input', { bubbles: true }))
  await element.updateComplete
}

async function press(target: Element, key: string): Promise<void> {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  await Promise.resolve()
}

function listen(element: LintjeTagInput, name = 'lintje-values-change'): unknown[] {
  const seen: unknown[] = []
  element.addEventListener(name, (event) => seen.push((event as CustomEvent).detail))
  return seen
}

beforeEach(() => {
  document.body.innerHTML = ''
})

afterEach(() => {
  vi.useRealTimers()
})

describe('the arithmetic', () => {
  it('splits on commas and new lines and drops the space around a word', () => {
    expect(splitWords(' toegang, vergaderzaal ,,\nafzet ')).toEqual([
      'toegang',
      'vergaderzaal',
      'afzet',
    ])
  })

  it('adds no word twice, whatever its case, and names the duplicate', () => {
    expect(addWords(['toegang'], ['Toegang', 'afzet'])).toEqual({
      next: ['toegang', 'afzet'],
      added: ['afzet'],
      duplicate: 'toegang',
    })
  })
})

describe('lintje-tag-input', () => {
  it('is a group with its chips in a list, each cross a named button', async () => {
    const element = await mount({ value: ['toegang', 'vergaderzaal'] })
    const group = element.renderRoot.querySelector('[role="group"]')!
    expect(group.getAttribute('aria-labelledby')).toBe('lintje-input-label')
    expect(group.querySelectorAll('ul > li')).toHaveLength(2)
    expect(element.renderRoot.querySelector('button')?.getAttribute('aria-label')).toBe(
      'toegang verwijderen',
    )
  })

  it('makes a chip on Enter and on a comma, and commits the list', async () => {
    const element = await mount({ name: 'p.trefwoorden', value: ['toegang'] })
    const seen = listen(element)
    await type(element, ' vergaderzaal ')
    await press(field(element), 'Enter')
    await element.updateComplete
    await type(element, 'afzet')
    await press(field(element), ',')
    await element.updateComplete
    expect(chips(element)).toEqual(['toegang', 'vergaderzaal', 'afzet'])
    expect(seen).toEqual([
      { 'p.trefwoorden': ['toegang', 'vergaderzaal'] },
      { 'p.trefwoorden': ['toegang', 'vergaderzaal', 'afzet'] },
    ])
    expect(field(element).value).toBe('')
    expect(element.renderRoot.querySelector('[role="status"]')?.textContent).toBe(
      'afzet toegevoegd',
    )
  })

  it('makes a chip of what was typed when the field is left, not when a chip takes the focus', async () => {
    const element = await mount({ name: 'p.trefwoorden', value: ['toegang'] })
    const seen = listen(element)
    await type(element, 'vergaderzaal')
    const chip = element.renderRoot.querySelector('.lintje-tag-input__chip')!
    field(element).dispatchEvent(new FocusEvent('blur', { relatedTarget: chip }))
    await element.updateComplete
    expect(chips(element)).toEqual(['toegang'])

    field(element).dispatchEvent(new FocusEvent('blur', { relatedTarget: null }))
    await element.updateComplete
    expect(chips(element)).toEqual(['toegang', 'vergaderzaal'])
    expect(seen).toEqual([{ 'p.trefwoorden': ['toegang', 'vergaderzaal'] }])
    expect(field(element).value).toBe('')
  })

  it('lights the existing chip for a second instead of adding a duplicate', async () => {
    vi.useFakeTimers()
    const element = await mount({ value: ['toegang'] })
    const seen = listen(element, 'lintje-change')
    await type(element, 'Toegang')
    await press(field(element), 'Enter')
    await element.updateComplete
    expect(seen).toEqual([])
    expect(element.renderRoot.querySelector('.is-flash')?.textContent?.trim()).toBe('toegang')
    expect(element.renderRoot.querySelector('[role="status"]')?.textContent).toBe(
      'toegang staat er al',
    )
    vi.advanceTimersByTime(1000)
    await element.updateComplete
    expect(element.renderRoot.querySelector('.is-flash')).toBeNull()
  })

  it('says what it added and which word was there already, in one sentence', async () => {
    const element = await mount({ value: ['toegang'] })
    await type(element, 'afzet, Toegang')
    await press(field(element), 'Enter')
    await element.updateComplete
    expect(element.renderRoot.querySelector('[role="status"]')?.textContent).toBe(
      'afzet toegevoegd. toegang staat er al',
    )
  })

  it('walks the crosses, each a named button, and tells the field how the keys work', async () => {
    const element = await mount({ value: ['toegang'] })
    await press(field(element), 'ArrowLeft')
    const focused = element.shadowRoot!.activeElement!
    expect(focused.localName).toBe('button')
    expect(focused.getAttribute('aria-label')).toBe('toegang verwijderen')
    expect(
      element.renderRoot.querySelector('.lintje-tag-input__chip')?.hasAttribute('tabindex'),
    ).toBe(false)
    const keys = element.shadowRoot!.getElementById(
      field(element).getAttribute('aria-describedby')!.split(' ').at(-1)!,
    )
    expect(keys?.textContent).toContain('Backspace of Delete')
  })

  it('turns a paste with commas into chips', async () => {
    const element = await mount()
    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', {
      value: { getData: () => 'toegang, vergaderzaal, afzet' },
    })
    field(element).dispatchEvent(event)
    await element.updateComplete
    expect(event.defaultPrevented).toBe(true)
    expect(chips(element)).toEqual(['toegang', 'vergaderzaal', 'afzet'])
  })

  it('selects the last chip with Backspace, and removes it with a second one', async () => {
    const element = await mount({ value: ['toegang', 'vergaderzaal'], name: 'p.t' })
    const seen = listen(element)
    await press(field(element), 'Backspace')
    const last = element.renderRoot.querySelector<HTMLElement>('[data-index="1"]')!
    expect(element.shadowRoot!.activeElement).toBe(last)
    await press(last, 'Backspace')
    await element.updateComplete
    expect(chips(element)).toEqual(['toegang'])
    expect(seen).toEqual([{ 'p.t': ['toegang'] }])
  })

  it('walks the chips with the arrows and removes one with Delete', async () => {
    const element = await mount({ value: ['toegang', 'vergaderzaal', 'afzet'] })
    await press(field(element), 'ArrowLeft')
    await press(element.shadowRoot!.activeElement!, 'ArrowLeft')
    const middle = element.shadowRoot!.activeElement as HTMLElement
    expect(middle.dataset.index).toBe('1')
    await press(middle, 'Delete')
    await element.updateComplete
    await element.updateComplete
    expect(chips(element)).toEqual(['toegang', 'afzet'])
  })

  it('suggests the options that contain the text and keeps an option by its value', async () => {
    const element = await mount({
      options: [
        { value: 'toe', label: 'Toegang' },
        { value: 'vz', label: 'Vergaderzaal' },
      ],
    })
    await type(element, 'ver')
    const options = element.renderRoot.querySelectorAll('[role="option"]')
    expect([...options].map((option) => option.textContent?.trim())).toEqual(['Vergaderzaal'])
    expect(field(element).getAttribute('aria-expanded')).toBe('true')
    await press(field(element), 'Enter')
    await element.updateComplete
    expect(element.value).toEqual(['vz'])
    expect(chips(element)).toEqual(['Vergaderzaal'])
    // A word that is no option is still taken.
    await type(element, 'afzetting')
    await press(field(element), 'Enter')
    await element.updateComplete
    expect(element.value).toEqual(['vz', 'afzetting'])
  })

  it('draws the error with its glyph and points at it', async () => {
    const element = await mount({ error: 'Hoogstens 10 trefwoorden' })
    const message = element.renderRoot.querySelector('.lintje-field__error')!
    expect(message.querySelector('svg')).not.toBeNull()
    expect(field(element).getAttribute('aria-describedby')?.split(' ')[0]).toBe(message.id)
    expect(field(element).getAttribute('aria-invalid')).toBe('true')
  })

  it('draws the chips without a cross and commits nothing when disabled', async () => {
    const element = await mount({ value: ['toegang'], disabled: true, name: 'p.t' })
    const seen = listen(element)
    expect(field(element).disabled).toBe(true)
    expect(element.renderRoot.querySelector('button')).toBeNull()
    ;(element as unknown as { commit(value: unknown): void }).commit('iets')
    expect(seen).toEqual([])
  })

  it('says nothing to the host without a name', async () => {
    const element = await mount()
    const seen = listen(element)
    const heard = listen(element, 'lintje-change')
    await type(element, 'toegang')
    await press(field(element), 'Enter')
    expect(seen).toEqual([])
    expect(heard).toEqual([['toegang']])
  })
})

describe('the option the keys stand on', () => {
  it('draws the focus ring inside the row, beside the fill of a hover', () => {
    // Read from disk: vitest does not run the CSS pipeline, so an `?inline` import is empty.
    const css = readFileSync('src/components/inputs/tag-input/tag-input.css', 'utf8')
    expect(css).toMatch(
      /__option\.is-active \{\s*outline: var\(--focus-width\) solid var\(--color-focus\);\s*outline-offset: calc\(var\(--focus-width\) \* -1\);/,
    )
  })
})
