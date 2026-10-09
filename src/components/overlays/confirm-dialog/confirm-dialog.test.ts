/**
 * The confirm dialog: an alertdialog named by its question, the focus on the safe button, and
 * every way out a request to the owner — none of them while busy.
 */
import { afterEach, describe, expect, it } from 'vitest'
import './confirm-dialog'
import type { LintjeConfirmDialog } from './confirm-dialog'
import type { LintjeButton } from '../../../primitives/button/button'

async function mount(props: Partial<LintjeConfirmDialog> = {}): Promise<LintjeConfirmDialog> {
  const element = Object.assign(document.createElement('lintje-confirm-dialog'), {
    open: true,
    heading: 'Melding verwijderen?',
    confirmLabel: 'Verwijderen',
    ...props,
  })
  element.textContent = '“Onbeheerde tas” en de 2 bijlagen worden verwijderd.'
  document.body.append(element)
  await element.updateComplete
  return element
}

function part<T extends HTMLElement = HTMLElement>(
  element: LintjeConfirmDialog,
  selector: string,
): T {
  return element.shadowRoot!.querySelector<T>(selector)!
}

function closes(element: LintjeConfirmDialog): string[] {
  const reasons: string[] = []
  element.addEventListener('lintje-close', (event) =>
    reasons.push((event as CustomEvent<{ reason: string }>).detail.reason),
  )
  return reasons
}

describe('lintje-confirm-dialog', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('draws nothing while closed', async () => {
    const element = await mount({ open: false })
    expect(element.shadowRoot!.querySelector('[role="alertdialog"]')).toBeNull()
  })

  it('is a modal alertdialog, labelled by the question and described by the text', async () => {
    const element = await mount()
    const dialog = part(element, '[role="alertdialog"]')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    const label = part(element, `#${dialog.getAttribute('aria-labelledby')}`)
    expect(label.textContent!.trim()).toBe('Melding verwijderen?')
    const text = part(element, `#${dialog.getAttribute('aria-describedby')}`)
    expect(text.querySelector('slot')).not.toBeNull()
  })

  it('confirms with the danger button, or a primary one by tone', async () => {
    const element = await mount()
    expect(part(element, '.lintje-confirm-dialog__confirm').getAttribute('variant')).toBe('danger')
    let confirms = 0
    element.addEventListener('lintje-confirm', () => confirms++)
    part(element, '.lintje-confirm-dialog__confirm').click()
    expect(confirms).toBe(1)

    const primary = await mount({ tone: 'primary' })
    expect(part(primary, '.lintje-confirm-dialog__confirm').getAttribute('variant')).toBe('primary')
  })

  it('puts the focus on the safe button', async () => {
    const element = await mount()
    await new Promise((resolve) => setTimeout(resolve))
    const cancel = part<LintjeButton>(element, '.lintje-confirm-dialog__cancel')
    expect(cancel.shadowRoot!.activeElement).toBe(cancel.shadowRoot!.querySelector('button'))
  })

  it('asks to close on Escape, the scrim and the cancel button, and stays open itself', async () => {
    const element = await mount()
    const reasons = closes(element)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    part(element, '.lintje-confirm-dialog__scrim').click()
    part(element, '.lintje-confirm-dialog').click()
    part(element, '.lintje-confirm-dialog__cancel').click()
    expect(reasons).toEqual(['escape', 'scrim', 'cancel'])
    expect(element.open).toBe(true)
  })

  it('while busy: the confirm turns busy, the rest disabled, and nothing closes', async () => {
    const element = await mount({ busy: true, actionLabel: 'Weggooien' })
    const reasons = closes(element)
    expect(part<LintjeButton>(element, '.lintje-confirm-dialog__confirm').busy).toBe(true)
    expect(part<LintjeButton>(element, '.lintje-confirm-dialog__cancel').disabled).toBe(true)
    expect(part<LintjeButton>(element, '.lintje-confirm-dialog__action').disabled).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    part(element, '.lintje-confirm-dialog__scrim').click()
    expect(reasons).toEqual([])
  })

  it('while busy, the focus stays on the buttons and Tab goes round them', async () => {
    const element = await mount()
    await new Promise((resolve) => setTimeout(resolve))
    const confirm = part<LintjeButton>(element, '.lintje-confirm-dialog__confirm')
    const cancel = part<LintjeButton>(element, '.lintje-confirm-dialog__cancel')
    confirm.shadowRoot!.querySelector('button')!.focus()
    element.busy = true
    await element.updateComplete
    await confirm.updateComplete
    // `busy` and `disabled` are `aria-disabled`: the pressed button keeps the focus.
    const inner = confirm.shadowRoot!.querySelector('button')!
    expect(inner.getAttribute('aria-disabled')).toBe('true')
    expect(confirm.shadowRoot!.activeElement).toBe(inner)
    const tab = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      composed: true,
      cancelable: true,
    })
    inner.dispatchEvent(tab)
    expect(tab.defaultPrevented).toBe(true)
    expect(cancel.shadowRoot!.activeElement).toBe(cancel.shadowRoot!.querySelector('button'))
  })

  it('gives the focus back to its opener when it closes', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const element = await mount()
    await new Promise((resolve) => setTimeout(resolve))
    element.open = false
    await element.updateComplete
    expect(document.activeElement).toBe(opener)
    expect(document.body.style.overflow).toBe('')
  })

  it('the third button sends lintje-action', async () => {
    const element = await mount({ tone: 'primary', actionLabel: 'Weggooien' })
    let actions = 0
    element.addEventListener('lintje-action', () => actions++)
    part(element, '.lintje-confirm-dialog__action').click()
    expect(actions).toBe(1)
  })
})
