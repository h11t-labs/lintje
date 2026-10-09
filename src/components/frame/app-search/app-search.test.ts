/**
 * The app search: `/` asks to be opened, the combobox and its listbox, the 200 ms search, the
 * chosen row under the arrows, what a choice sends, the bold match, and the busy and empty rows.
 */
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import './app-search'
import { resultsMessage, splitMatch, type LintjeAppSearch, type SearchGroup } from './app-search'

const GROUPS: SearchGroup[] = [
  {
    label: 'Opnames',
    items: [
      { id: 'o-481', label: 'Teamoverleg 2 oktober', meta: '47:12', href: '/opnames/481' },
      { id: 'o-470', label: 'Teamoverleg 30 september', meta: '39:05', href: '/opnames/470' },
    ],
  },
  { label: 'Acties', items: [{ id: 'upload', label: 'Nieuwe opname uploaden' }] },
]

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

async function mount(props: Partial<LintjeAppSearch> = {}): Promise<LintjeAppSearch> {
  const element = Object.assign(document.createElement('lintje-app-search'), props)
  document.body.append(element)
  await element.updateComplete
  return element
}

const input = (element: LintjeAppSearch): HTMLInputElement =>
  element.shadowRoot!.querySelector('input')!
const options = (element: LintjeAppSearch): HTMLElement[] => [
  ...element.shadowRoot!.querySelectorAll<HTMLElement>('[role="option"]'),
]
const key = (element: LintjeAppSearch, name: string): void => {
  input(element).dispatchEvent(
    new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }),
  )
}

describe('helpers', () => {
  it('splits a label around the term, without case', () => {
    expect(splitMatch('Teamoverleg 2 oktober', 'teamoverleg')).toEqual([
      '',
      'Teamoverleg',
      ' 2 oktober',
    ])
    expect(splitMatch('Nieuwe opname', 'xyz')).toBeNull()
    expect(splitMatch('Nieuwe opname', '  ')).toBeNull()
    expect(resultsMessage(3, 'team', false)).toBe('3 resultaten')
    expect(resultsMessage(0, 'teamoverlg', false)).toBe('Geen resultaten voor “teamoverlg”')
  })
})

describe('lintje-app-search', () => {
  it('asks to be opened on / outside a field, and draws nothing while closed', async () => {
    const element = await mount()
    expect(element.shadowRoot!.querySelector('[role="dialog"]')).toBeNull()
    let opened = 0
    element.addEventListener('lintje-open', () => opened++)
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }))
    expect(opened).toBe(1)
  })

  it('is a dialog with a combobox that controls the listbox and points at the chosen row', async () => {
    const element = await mount({ open: true, label: 'Zoeken in Transcriptie', groups: GROUPS })
    const dialog = element.shadowRoot!.querySelector('[role="dialog"]')!
    expect(dialog.getAttribute('aria-label')).toBe('Zoeken')
    const field = input(element)
    expect(field.getAttribute('role')).toBe('combobox')
    expect(field.getAttribute('aria-label')).toBe('Zoeken in Transcriptie')
    const list = element.shadowRoot!.querySelector('[role="listbox"]')!
    expect(field.getAttribute('aria-controls')).toBe(list.id)
    expect(field.getAttribute('aria-activedescendant')).toBe(options(element)[0].id)
    expect(element.shadowRoot!.activeElement).toBe(field)

    key(element, 'ArrowDown')
    key(element, 'ArrowDown')
    await element.updateComplete
    expect(field.getAttribute('aria-activedescendant')).toBe(options(element)[2].id)
    expect(options(element)[2].getAttribute('aria-selected')).toBe('true')
    key(element, 'ArrowDown')
    await element.updateComplete
    expect(options(element)[0].classList.contains('is-active')).toBe(true)
  })

  it('sends the term 200 ms after the last keystroke', async () => {
    const element = await mount({ open: true })
    const terms: unknown[] = []
    element.addEventListener('lintje-search', (event) => terms.push((event as CustomEvent).detail))
    const field = input(element)
    field.value = 'team'
    field.dispatchEvent(new Event('input'))
    vi.advanceTimersByTime(150)
    field.value = 'teamo'
    field.dispatchEvent(new Event('input'))
    vi.advanceTimersByTime(199)
    expect(terms).toEqual([])
    vi.advanceTimersByTime(1)
    expect(terms).toEqual(['teamo'])
  })

  it('opens a page with lintje-navigate, an action with lintje-action, and then asks to close', async () => {
    const element = await mount({ open: true, groups: GROUPS })
    const sent: [string, unknown][] = []
    for (const name of ['lintje-navigate', 'lintje-action', 'lintje-close'])
      element.addEventListener(name, (event) => sent.push([name, (event as CustomEvent).detail]))

    key(element, 'Enter')
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    options(element)[2].dispatchEvent(click)
    expect(sent).toEqual([
      ['lintje-navigate', { href: '/opnames/481' }],
      ['lintje-close', { reason: 'choice' }],
      ['lintje-action', 'upload'],
      ['lintje-close', { reason: 'choice' }],
    ])
  })

  it('bolds the typed part, and shows the busy and the empty row', async () => {
    const element = await mount({ open: true, query: 'teamoverleg', groups: GROUPS })
    expect(options(element)[0].querySelector('strong')!.textContent).toBe('Teamoverleg')

    element.loading = true
    await element.updateComplete
    expect(element.shadowRoot!.querySelector('lintje-spinner')!.getAttribute('label')).toBe(
      'Zoeken',
    )
    expect(input(element).getAttribute('aria-expanded')).toBe('false')

    element.loading = false
    element.groups = []
    element.query = 'teamoverlg'
    await element.updateComplete
    expect(element.shadowRoot!.querySelector('.lintje-app-search__empty')!.textContent).toBe(
      'Geen resultaten voor “teamoverlg”',
    )
    expect(element.shadowRoot!.querySelector('[aria-live]')!.textContent!.trim()).toBe(
      'Geen resultaten voor “teamoverlg”',
    )
  })

  it('asks to be closed on Escape and on the scrim', async () => {
    const element = await mount({ open: true })
    const reasons: string[] = []
    element.addEventListener('lintje-close', (event) =>
      reasons.push((event as CustomEvent<{ reason: string }>).detail.reason),
    )
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    element.shadowRoot!.querySelector<HTMLElement>('.lintje-app-search__scrim')!.click()
    expect(reasons).toEqual(['escape', 'scrim'])
    expect(element.open).toBe(true)
  })

  it('keeps Tab in the dialog and gives the focus back to its opener on close', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const element = await mount({ open: true, groups: GROUPS })
    expect(element.shadowRoot!.activeElement).toBe(input(element))
    const tab = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      composed: true,
      cancelable: true,
    })
    input(element).dispatchEvent(tab)
    // The field is the one stop on a wide screen: Tab stays on it.
    expect(tab.defaultPrevented).toBe(true)
    expect(element.shadowRoot!.activeElement).toBe(input(element))
    expect(document.body.style.overflow).toBe('hidden')
    element.open = false
    await element.updateComplete
    expect(document.activeElement).toBe(opener)
    expect(document.body.style.overflow).toBe('')
  })

  it('draws the shared close button below 768 px, and no line of keys', async () => {
    const viewport = (width: number): void =>
      (
        window as unknown as { happyDOM: { setViewport(size: { width: number }): void } }
      ).happyDOM.setViewport({ width })
    try {
      const element = await mount({ open: true })
      viewport(390)
      await element.updateComplete
      const close = element.shadowRoot!.querySelector('.lintje-app-search__close')!
      expect(close.classList.contains('lintje-dialog-close')).toBe(true)
      expect(element.shadowRoot!.querySelector('.lintje-app-search__keys')).toBeNull()
      viewport(1024)
      await element.updateComplete
      expect(element.shadowRoot!.querySelector('.lintje-app-search__keys')).not.toBeNull()
    } finally {
      viewport(1024)
    }
  })
})

describe('the chosen row', () => {
  it('draws the focus ring inside, beside its fill', () => {
    // From disk: vitest does not run the CSS pipeline, so an `?inline` import is empty.
    const appSearchCss = readFileSync(
      resolvePath('src/components/frame/app-search/app-search.css'),
      'utf8',
    )
    const rule = /\.lintje-app-search__option\.is-active \{([^}]*)\}/.exec(appSearchCss)![1]
    expect(rule).toContain('outline: var(--focus-width) solid var(--color-focus)')
    expect(rule).toContain('outline-offset: calc(var(--focus-width) * -1)')
  })
})
