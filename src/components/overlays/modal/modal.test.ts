/**
 * The modal keeps the keyboard inside while it is open and gives the focus back.
 *
 * happy-dom moves no focus on Tab, so a Tab is a dispatched `keydown`: where the
 * trap wraps, it prevents the default and moves the focus itself; in the middle
 * it leaves the step to the browser.
 */
import { afterEach, describe, expect, it } from 'vitest'
import './modal'
import type { LintjeModal } from './modal'
import { deepActiveElement, tabbables } from '../../shared/focus-trap'

let opener: HTMLButtonElement
let modal: LintjeModal

async function open(): Promise<LintjeModal> {
  opener = document.createElement('button')
  opener.textContent = 'Vergroot'
  document.body.append(opener)
  opener.focus()
  modal = document.createElement('lintje-modal') as LintjeModal
  modal.heading = 'Aanvragen per uur'
  modal.innerHTML = '<button id="inside">In de inhoud</button>'
  modal.addEventListener('lintje-close', () => {
    modal.open = false
  })
  document.body.append(modal)
  modal.open = true
  await modal.updateComplete
  // The footer buttons render their own shadow roots.
  await Promise.all(
    Array.from(
      modal.shadowRoot!.querySelectorAll<HTMLElement & { updateComplete: Promise<unknown> }>(
        'lintje-button',
      ),
      (button) => button.updateComplete,
    ),
  )
  return modal
}

afterEach(() => {
  modal.remove()
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
  modal.shadowRoot!.querySelector('.lintje-modal__close') as HTMLElement
const lastButton = (): HTMLElement => {
  const buttons = modal.shadowRoot!.querySelectorAll('lintje-button')
  return buttons[buttons.length - 1]!.shadowRoot!.querySelector('button') as HTMLElement
}

describe('lintje-modal focus', () => {
  it('moves the focus in when it opens', async () => {
    await open()
    expect(deepActiveElement()).toBe(modal.shadowRoot!.querySelector('.lintje-modal'))
  })

  it('counts the slotted content and the buttons inside shadow roots, in reading order', async () => {
    await open()
    const order = tabbables(modal.shadowRoot!.querySelector('.lintje-modal')!)
    expect(order).toEqual([
      closeButton(),
      modal.querySelector('#inside'),
      ...Array.from(modal.shadowRoot!.querySelectorAll('lintje-button'), (button) =>
        button.shadowRoot!.querySelector('button'),
      ),
    ])
    expect(order).toHaveLength(4)
  })

  it('wraps Tab from the last control to the first', async () => {
    await open()
    lastButton().focus()
    const event = tab()
    expect(event.defaultPrevented).toBe(true)
    expect(deepActiveElement()).toBe(closeButton())
  })

  it('wraps Shift+Tab from the first control to the last', async () => {
    await open()
    closeButton().focus()
    const event = tab(true)
    expect(event.defaultPrevented).toBe(true)
    expect(deepActiveElement()).toBe(lastButton())
  })

  it('leaves a step in the middle — into the slotted content — to the browser', async () => {
    await open()
    closeButton().focus()
    expect(tab().defaultPrevented).toBe(false)
  })

  it('pulls focus that lands outside back in', async () => {
    await open()
    opener.focus()
    expect(modal.shadowRoot!.contains(deepActiveElement())).toBe(true)
  })

  it('closes with Escape and gives the focus back to the opener', async () => {
    await open()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await modal.updateComplete
    expect(modal.open).toBe(false)
    expect(deepActiveElement()).toBe(opener)
  })
})
