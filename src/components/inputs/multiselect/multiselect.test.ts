/**
 * What the multi-select's popover shows: a row per option, a row per option that
 * carries no label of its own, and the message that says the search found
 * nothing. Where the popover stands is geometry and is checked in headless
 * Chrome, but *that* it draws its rows is arithmetic
 * and belongs here.
 */
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import './multiselect'
import type { LintjeMultiselect } from './multiselect'
import type { FilterOption } from '../../../types'

const options: FilterOption[] = [
  { value: 'laag', label: 'laag' },
  { value: 'gemiddeld', label: 'gemiddeld' },
  { value: 'hoog', label: 'hoog' },
]

async function mount(given: FilterOption[] = options): Promise<LintjeMultiselect> {
  const element = document.createElement('lintje-multiselect') as LintjeMultiselect
  element.label = 'Ernst'
  element.options = given
  document.body.append(element)
  await element.updateComplete
  element.open = true
  await element.updateComplete
  return element
}

const rows = (element: LintjeMultiselect): string[] =>
  [...element.renderRoot.querySelectorAll('lintje-checkbox')].map(
    (row) => row.getAttribute('label') ?? '',
  )

beforeEach(() => {
  document.body.innerHTML = ''
})

// Read from disk, not imported: vitest does not run the CSS pipeline, so an
// `?inline` import comes back empty.
const multiselectCss = readFileSync(
  resolvePath('src/components/inputs/multiselect/multiselect.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '')

describe('lintje-multiselect popover', () => {
  it('names its option rows by a class, not by their tag (rule 24)', async () => {
    const element = await mount()
    const checkboxes = [...element.renderRoot.querySelectorAll('lintje-checkbox')]
    expect(checkboxes.length).toBeGreaterThan(0)
    for (const row of checkboxes) {
      expect(row.classList.contains('lintje-multiselect__option')).toBe(true)
    }
    expect(multiselectCss).not.toContain('lintje-checkbox')
    expect(multiselectCss).toMatch(
      /\.lintje-multiselect__option\s*\{\s*--h-target: var\(--h-option\)/,
    )
  })

  it('pads a chip on the spacing scale', () => {
    expect(multiselectCss).toMatch(
      /\.lintje-multiselect__chip\s*\{[^}]*padding: 0 0 0 var\(--space-2\);/,
    )
  })

  it('draws a row for every option, under the select-all row', async () => {
    const element = await mount()
    expect(rows(element)).toEqual(['Alles selecteren (3)', 'laag', 'gemiddeld', 'hoog'])
    expect(element.renderRoot.querySelector('.lintje-multiselect__no-results')).toBeNull()
  })

  it('falls back to the value where an option carries no label', async () => {
    const element = await mount([{ value: 'laag' } as FilterOption])
    expect(rows(element)).toEqual(['Alles selecteren (1)', 'laag'])
  })

  it('keeps the rows the query matches', async () => {
    const element = await mount()
    element.query = 'ho'
    await element.updateComplete
    expect(rows(element)).toEqual(['Alles selecteren (3)', 'hoog'])
  })

  it('says so when the query matches nothing', async () => {
    const element = await mount()
    element.query = 'asdf'
    await element.updateComplete
    expect(rows(element)).toEqual(['Alles selecteren (3)'])
    const message = element.renderRoot.querySelector('.lintje-multiselect__no-results')
    expect(message?.textContent).toContain('asdf')
  })

  it('anchors the popover to the field instead of leaving it in the flow', async () => {
    const element = await mount()
    const popover = element.renderRoot.querySelector<HTMLElement>('.lintje-multiselect__popover')
    expect(popover).not.toBeNull()
    expect(popover?.style.left).toMatch(/px$/)
    expect(popover?.style.width).toMatch(/px$/)
    expect(popover?.style.getPropertyValue('--lintje-multiselect-space')).toMatch(/px$/)
  })

  it('reads the CSS variable the popover is given for its height', () => {
    expect(multiselectCss).toContain('max-height: var(--lintje-multiselect-space, none)')
  })
})

const trigger = (element: LintjeMultiselect): HTMLButtonElement =>
  element.renderRoot.querySelector<HTMLButtonElement>('.lintje-multiselect__field')!
const search = (element: LintjeMultiselect): HTMLInputElement =>
  element.renderRoot.querySelector<HTMLInputElement>('.lintje-multiselect__search-input')!
const status = (element: LintjeMultiselect): string =>
  element.renderRoot.querySelector('[role="status"]')?.textContent?.trim() ?? ''

describe('lintje-multiselect for a screen reader', () => {
  it('opens a named dialog, since the popover holds a search and buttons besides the rows', async () => {
    const element = await mount()
    expect(trigger(element).getAttribute('aria-haspopup')).toBe('dialog')
    const popover = element.renderRoot.querySelector('.lintje-multiselect__popover')!
    expect(popover.getAttribute('role')).toBe('dialog')
    expect(popover.getAttribute('aria-label')).toBe('Ernst')
    expect(popover.hasAttribute('aria-multiselectable')).toBe(false)
  })

  it('names the field by its label, what it shows and the whole selection', async () => {
    const element = await mount()
    const [label, shown, value] = trigger(element).getAttribute('aria-labelledby')!.split(' ')
    expect(element.shadowRoot!.getElementById(label)?.textContent).toContain('Ernst')
    expect(element.shadowRoot!.getElementById(shown)?.closest('button')).toBe(trigger(element))
    expect(element.shadowRoot!.getElementById(value)?.textContent).toBe('niets geselecteerd')
    element.selected = ['laag', 'gemiddeld', 'hoog']
    await element.updateComplete
    expect(element.shadowRoot!.getElementById(value)?.textContent).toBe(
      '3 geselecteerd: laag, gemiddeld, hoog',
    )
  })

  it('says the number of results, or that there is none, and the count after a choice', async () => {
    const element = await mount()
    expect(status(element)).toBe('')
    search(element).value = 'ho'
    search(element).dispatchEvent(new Event('input'))
    await element.updateComplete
    expect(status(element)).toBe('1 resultaat')
    search(element).value = 'asdf'
    search(element).dispatchEvent(new Event('input'))
    await element.updateComplete
    expect(status(element)).toBe('Geen waarde met “asdf”')
    const row = element.renderRoot.querySelector('lintje-checkbox')!
    row.dispatchEvent(new CustomEvent('lintje-change', { detail: true }))
    await element.updateComplete
    expect(status(element)).toBe('3 geselecteerd')
  })
})

describe('lintje-multiselect and the focus', () => {
  it('gives the focus back to the field on Escape', async () => {
    const element = await mount()
    search(element).focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await element.updateComplete
    await element.updateComplete
    expect(element.open).toBe(false)
    expect(element.shadowRoot!.activeElement).toBe(trigger(element))
  })

  it('closes when the focus leaves the element, not when it moves inside, to nothing or around it', async () => {
    const element = await mount()
    const outside = document.createElement('button')
    document.body.append(outside)
    const leave = (to: Node | null): void => {
      search(element).dispatchEvent(
        new FocusEvent('focusout', { relatedTarget: to, bubbles: true, composed: true }),
      )
    }
    leave(element.renderRoot.querySelector('lintje-checkbox'))
    leave(null)
    // A press on an option's text, inside a focusable box such as the shell's main region.
    leave(document.body)
    await element.updateComplete
    expect(element.open).toBe(true)
    leave(outside)
    await element.updateComplete
    expect(element.open).toBe(false)
  })
})
