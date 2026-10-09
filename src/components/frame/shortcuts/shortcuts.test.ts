/**
 * The shortcut overview: it registers `?` and asks to be opened, lists the register in a `<dl>`
 * with one `<kbd>` per key, and asks to be closed rather than closing itself.
 */
import { afterEach, describe, expect, it } from 'vitest'
import './shortcuts'
import {
  characterKeys,
  registerShortcut,
  setCharacterKeys,
  shortcuts,
} from '../../../core/shortcuts'
import type { LintjeShortcuts } from './shortcuts'

const cleanups: (() => void)[] = []

afterEach(() => {
  while (cleanups.length) cleanups.pop()!()
  document.body.innerHTML = ''
})

async function mount(open = false): Promise<LintjeShortcuts> {
  const element = document.createElement('lintje-shortcuts')
  element.open = open
  document.body.append(element)
  await element.updateComplete
  return element
}

describe('lintje-shortcuts', () => {
  it('registers ? while it stands on the page and asks to be opened', async () => {
    const element = await mount()
    expect(shortcuts().map((item) => item.keys)).toEqual(['?'])
    let opened = 0
    element.addEventListener('lintje-open', () => opened++)
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: '?', shiftKey: true, bubbles: true }),
    )
    expect(opened).toBe(1)
    expect(element.open).toBe(false)

    element.remove()
    expect(shortcuts()).toEqual([])
  })

  it('lists the register in a dl inside a dialog, one kbd per key', async () => {
    cleanups.push(registerShortcut({ keys: 'Ctrl+S', description: 'Opslaan', handler: () => {} }))
    const element = await mount(true)
    const dialog = element.shadowRoot!.querySelector('[role="dialog"]')!
    expect(dialog.getAttribute('aria-labelledby')).toBe('lintje-shortcuts-heading')
    expect(dialog.querySelector('h2')!.textContent).toBe('Sneltoetsen')
    const terms = [...dialog.querySelectorAll('dt')].map((dt) => dt.textContent)
    expect(terms).toEqual(['Opslaan', 'Dit overzicht'])
    const keys = [...dialog.querySelectorAll('dd')].map((dd) =>
      [...dd.querySelectorAll('kbd')].map((kbd) => kbd.textContent),
    )
    expect(keys).toEqual([['Ctrl', 'S'], ['?']])
  })

  it('asks to be closed on Escape and on Sluiten, and stays open itself', async () => {
    const element = await mount(true)
    const reasons: string[] = []
    element.addEventListener('lintje-close', (event) =>
      reasons.push((event as CustomEvent<{ reason: string }>).detail.reason),
    )
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    element.shadowRoot!.querySelector('lintje-button')!.click()
    expect(reasons).toEqual(['escape', 'button'])
    expect(element.open).toBe(true)
  })

  it('takes the focus, keeps Tab inside and gives the focus back on close', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const element = await mount(true)
    const frame = element.shadowRoot!.querySelector('.lintje-shortcuts')
    expect(element.shadowRoot!.activeElement).toBe(frame)
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    document.dispatchEvent(tab)
    expect(tab.defaultPrevented).toBe(true)
    expect(document.body.style.overflow).toBe('hidden')
    element.open = false
    await element.updateComplete
    expect(document.activeElement).toBe(opener)
    expect(document.body.style.overflow).toBe('')
  })

  it('does not ask to be opened again while it is open', async () => {
    const element = await mount(true)
    let opened = 0
    element.addEventListener('lintje-open', () => opened++)
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }))
    expect(opened).toBe(0)
  })

  it('switches the one-character keys off and on from under the list', async () => {
    const element = await mount(true)
    const toggle = element.shadowRoot!.querySelector('lintje-toggle')!
    expect(toggle.label).toBe('Sneltoetsen van één teken')
    expect(toggle.checked).toBe(true)
    await toggle.updateComplete
    const input = toggle.shadowRoot!.querySelector('input')!
    input.click()
    expect(characterKeys()).toBe(false)

    element.open = false
    await element.updateComplete
    let opened = 0
    element.addEventListener('lintje-open', () => opened++)
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }))
    expect(opened).toBe(0)

    element.open = true
    await element.updateComplete
    const again = element.shadowRoot!.querySelector('lintje-toggle')!
    expect(again.checked).toBe(false)
    setCharacterKeys(true)
  })
})
