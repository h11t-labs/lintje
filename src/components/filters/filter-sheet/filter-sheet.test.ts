/**
 * The filter sheet keeps the keyboard inside while it is open, closes with
 * Escape and gives the focus back to the control that opened it.
 *
 * happy-dom moves no focus on Tab, so a Tab is a dispatched `keydown`: where the
 * trap wraps, it prevents the default and moves the focus itself.
 */
import { afterEach, describe, expect, it } from 'vitest'
import './filter-sheet'
import type { LintjeFilterSheet } from './filter-sheet'
import { deepActiveElement } from '../../shared/focus-trap'
import { lockScroll } from '../../../core/host-config'

let opener: HTMLButtonElement
let sheet: LintjeFilterSheet

async function open(): Promise<LintjeFilterSheet> {
  opener = document.createElement('button')
  opener.textContent = 'Filters'
  document.body.append(opener)
  opener.focus()
  sheet = document.createElement('lintje-filter-sheet') as LintjeFilterSheet
  sheet.innerHTML = '<input id="control" aria-label="Regio" />'
  sheet.addEventListener('lintje-sheet-close', () => {
    sheet.open = false
  })
  document.body.append(sheet)
  sheet.open = true
  await sheet.updateComplete
  await Promise.all(
    Array.from(
      sheet.shadowRoot!.querySelectorAll<HTMLElement & { updateComplete: Promise<unknown> }>(
        'lintje-button',
      ),
      (button) => button.updateComplete,
    ),
  )
  return sheet
}

afterEach(() => {
  sheet.remove()
  opener.remove()
})

function tab(shiftKey = false): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: 'Tab',
    shiftKey,
    bubbles: true,
    composed: true,
    cancelable: true,
  })
  ;(deepActiveElement() ?? document.body).dispatchEvent(event)
  return event
}

const closeButton = (): HTMLElement =>
  sheet.shadowRoot!.querySelector('.lintje-filter-sheet__close') as HTMLElement
/** "Toepassen", the last of the footer's two buttons. */
const applyButton = (): HTMLElement => {
  const buttons = sheet.shadowRoot!.querySelectorAll('lintje-button')
  return buttons[buttons.length - 1]!.shadowRoot!.querySelector('button') as HTMLElement
}

describe('lintje-filter-sheet focus', () => {
  it('moves the focus in when it opens', async () => {
    await open()
    expect(deepActiveElement()).toBe(sheet.shadowRoot!.querySelector('.lintje-filter-sheet'))
  })

  it('wraps Tab from "Toepassen" to the close button', async () => {
    await open()
    applyButton().focus()
    const event = tab()
    expect(event.defaultPrevented).toBe(true)
    expect(deepActiveElement()).toBe(closeButton())
  })

  it('wraps Shift+Tab from the close button to "Toepassen"', async () => {
    await open()
    closeButton().focus()
    const event = tab(true)
    expect(event.defaultPrevented).toBe(true)
    expect(deepActiveElement()).toBe(applyButton())
  })

  it('leaves the step from a slotted control to the browser', async () => {
    await open()
    sheet.querySelector<HTMLElement>('#control')!.focus()
    expect(tab().defaultPrevented).toBe(false)
  })

  it('closes with Escape and gives the focus back to the opener', async () => {
    await open()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await sheet.updateComplete
    expect(sheet.open).toBe(false)
    expect(deepActiveElement()).toBe(opener)
  })

  it('leaves no listener behind: a Tab after closing is the browser’s', async () => {
    await open()
    sheet.open = false
    await sheet.updateComplete
    opener.focus()
    expect(tab().defaultPrevented).toBe(false)
    expect(deepActiveElement()).toBe(opener)
  })
})

describe('lintje-filter-sheet scroll lock', () => {
  it('locks the body, as every other overlay does, and shares its counter', async () => {
    await open()
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.documentElement.style.overflow).toBe('')
    // A modal over the sheet takes the same lock; the sheet closing first keeps it.
    const release = lockScroll()
    sheet.open = false
    await sheet.updateComplete
    expect(document.body.style.overflow).toBe('hidden')
    release()
    expect(document.body.style.overflow).toBe('')
  })
})
