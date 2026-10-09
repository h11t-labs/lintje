/**
 * The combobox: the filter and the bold match (arithmetic), the keyboard that moves a
 * highlight while the focus stays in the field, the remote search, and the states every
 * input shares. Where the list stands is the popover's (`primitives/popover/`).
 */
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import './combobox'
import { filterOptions, resultsText, splitMatch, type LintjeCombobox } from './combobox'
import type { FilterOption } from '../../../types'

const LOCATIES: FilterOption[] = [
  { value: 'v1', label: 'Vergaderzaal 1' },
  { value: 'v2', label: 'Vergaderzaal 2' },
  { value: 'a1', label: 'Ontvangsthal 1' },
]

async function mount(props: Partial<LintjeCombobox> = {}): Promise<LintjeCombobox> {
  const element = document.createElement('lintje-combobox')
  element.label = 'Locatie'
  element.options = LOCATIES
  Object.assign(element, props)
  document.body.append(element)
  await element.updateComplete
  return element
}

const field = (element: LintjeCombobox): HTMLInputElement =>
  element.renderRoot.querySelector('input')!

const rows = (element: LintjeCombobox): string[] =>
  [...element.renderRoot.querySelectorAll('[role="option"]')].map(
    (row) => row.textContent?.replace(/\s+/g, ' ').trim() ?? '',
  )

async function type(element: LintjeCombobox, text: string): Promise<void> {
  field(element).value = text
  field(element).dispatchEvent(new Event('input', { bubbles: true }))
  await element.updateComplete
}

async function press(element: LintjeCombobox, key: string): Promise<void> {
  field(element).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  await element.updateComplete
}

function listen(element: LintjeCombobox, name = 'lintje-values-change'): unknown[] {
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
  it('keeps the options whose label contains the text, case-insensitive', () => {
    expect(filterOptions(LOCATIES, 'AL 1').map((option) => option.value)).toEqual(['v1', 'a1'])
    expect(filterOptions(LOCATIES, '  ')).toBe(LOCATIES)
  })

  it('cuts a label around its match', () => {
    expect(splitMatch('Vergaderzaal 2', 'vergader')).toEqual(['', 'Vergader', 'zaal 2'])
    expect(splitMatch('Ontvangsthal 1', 'hal')).toEqual(['Ontvangst', 'hal', ' 1'])
    expect(splitMatch('Perron', 'hal')).toEqual(['Perron', '', ''])
  })

  it('counts the results in Dutch', () => {
    expect(resultsText(1)).toBe('1 resultaat')
    expect(resultsText(3)).toBe('3 resultaten')
  })
})

describe('lintje-combobox', () => {
  it('is a combobox that controls a listbox once it opens', async () => {
    const element = await mount()
    const input = field(element)
    expect(input.getAttribute('role')).toBe('combobox')
    expect(input.getAttribute('aria-expanded')).toBe('false')
    expect(input.getAttribute('aria-autocomplete')).toBe('list')
    await type(element, 'vergader')
    expect(input.getAttribute('aria-expanded')).toBe('true')
    expect(input.getAttribute('aria-controls')).toBe('lintje-combobox-list')
    expect(rows(element)).toEqual(['Vergaderzaal 1', 'Vergaderzaal 2'])
    expect(element.renderRoot.querySelector('.lintje-combobox__match')?.textContent).toBe(
      'Vergader',
    )
    expect(element.renderRoot.querySelector('[role="status"]')?.textContent).toBe('2 resultaten')
  })

  it('moves the highlight with the arrows and chooses with Enter', async () => {
    const element = await mount({ name: 'p.locatie' })
    const seen = listen(element)
    await press(element, 'ArrowDown')
    expect(element.open).toBe(true)
    expect(field(element).getAttribute('aria-activedescendant')).toBe('lintje-combobox-option-0')
    await press(element, 'ArrowDown')
    await press(element, 'End')
    expect(field(element).getAttribute('aria-activedescendant')).toBe('lintje-combobox-option-2')
    await press(element, 'Home')
    await press(element, 'ArrowDown')
    await press(element, 'Enter')
    expect(seen).toEqual([{ 'p.locatie': 'v2' }])
    expect(element.value).toBe('v2')
    expect(element.open).toBe(false)
    expect(field(element).value).toBe('Vergaderzaal 2')
  })

  it('marks the chosen option as selected', async () => {
    const element = await mount({ value: 'a1' })
    await press(element, 'ArrowDown')
    const selected = element.renderRoot.querySelector('[aria-selected="true"]')!
    expect(selected.textContent?.trim()).toBe('Ontvangsthal 1')
    expect(field(element).getAttribute('aria-activedescendant')).toBe(selected.id)
  })

  it('puts the previous value back when the popover asks to close', async () => {
    const element = await mount({ value: 'v1', name: 'p.locatie' })
    const seen = listen(element)
    await type(element, 'ontv')
    element.renderRoot
      .querySelector('lintje-popover')!
      .dispatchEvent(new CustomEvent('lintje-close', { detail: { reason: 'escape' } }))
    await element.updateComplete
    expect(element.open).toBe(false)
    expect(field(element).value).toBe('Vergaderzaal 1')
    expect(seen).toEqual([])
  })

  it('says so when nothing matches, instead of an empty list', async () => {
    const element = await mount({ emptyLabel: 'Geen locatie gevonden voor' })
    await type(element, 'perron')
    expect(rows(element)).toEqual([])
    expect(element.renderRoot.querySelector('.lintje-combobox__empty')?.textContent).toBe(
      'Geen locatie gevonden voor “perron”',
    )
  })

  it('commits null when the field is emptied and left', async () => {
    const element = await mount({ value: 'v1', name: 'p.locatie' })
    const seen = listen(element)
    await type(element, '')
    field(element).dispatchEvent(new Event('blur'))
    await element.updateComplete
    expect(seen).toEqual([{ 'p.locatie': null }])
    expect(element.value).toBeNull()
  })

  it('with remote asks the host 300 ms after the last keystroke, and waits for its answer', async () => {
    vi.useFakeTimers()
    const element = await mount({ remote: true, options: [], loadingLabel: 'Locaties ophalen' })
    const searches = listen(element, 'lintje-search')
    await type(element, 'ver')
    await type(element, 'vert')
    vi.advanceTimersByTime(299)
    expect(searches).toEqual([])
    vi.advanceTimersByTime(1)
    expect(searches).toEqual([{ query: 'vert' }])
    expect(element.renderRoot.querySelector('lintje-spinner')?.getAttribute('label')).toBe(
      'Locaties ophalen',
    )
    element.options = [{ value: 'x', label: 'Iets anders' }]
    await element.updateComplete
    expect(element.renderRoot.querySelector('lintje-spinner')).toBeNull()
    // The host's answer is the list: the element does not filter it again.
    expect(rows(element)).toEqual(['Iets anders'])
  })

  it('draws the error with its glyph and points at it', async () => {
    const element = await mount({ error: 'Kies een locatie', hint: 'Waar het gebeurde' })
    const message = element.renderRoot.querySelector('.lintje-field__error')!
    expect(message.querySelector('svg')).not.toBeNull()
    expect(field(element).getAttribute('aria-describedby')).toBe(message.id)
    expect(field(element).getAttribute('aria-invalid')).toBe('true')
  })

  it('leaves the tab order and stays closed when disabled', async () => {
    const element = await mount({ disabled: true, name: 'p.locatie' })
    const seen = listen(element)
    expect(field(element).disabled).toBe(true)
    element.open = true
    await element.updateComplete
    expect(element.open).toBe(false)
    ;(element as unknown as { commit(value: unknown): void }).commit('v1')
    expect(seen).toEqual([])
  })

  it('says nothing to the host without a name', async () => {
    const element = await mount()
    const seen = listen(element)
    const heard = listen(element, 'lintje-change')
    await press(element, 'ArrowDown')
    await press(element, 'Enter')
    expect(seen).toEqual([])
    expect(heard).toEqual(['v1'])
  })
})

describe('the option the keys stand on', () => {
  it('draws the focus ring inside the row, beside the fill of a hover', () => {
    // Read from disk: vitest does not run the CSS pipeline, so an `?inline` import is empty.
    const css = readFileSync('src/components/inputs/combobox/combobox.css', 'utf8')
    expect(css).toMatch(
      /__option\.is-active \{\s*outline: var\(--focus-width\) solid var\(--color-focus\);\s*outline-offset: calc\(var\(--focus-width\) \* -1\);/,
    )
  })
})
