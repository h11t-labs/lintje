/**
 * The small dialog: named by its heading, every way out a request to the owner, the focus on
 * what the host chose or on the safe place, and its buttons waiting while it is busy.
 */
import { afterEach, describe, expect, it } from 'vitest'
import './dialog'
import '../../actions/button/button'
import '../../inputs/text-input/text-input'
import type { LintjeDialog } from './dialog'
import type { LintjeButton } from '../../actions/button/button'
import { deepActiveElement } from '../../shared/focus-trap'

const QUESTION = `
  “Onbeheerde tas” en de 2 bijlagen worden verwijderd.
  <lintje-button slot="actions" variant="secondary" autofocus>Annuleren</lintje-button>
  <lintje-button slot="actions" variant="danger">Verwijderen</lintje-button>`

async function mount(props: Partial<LintjeDialog> = {}, content = QUESTION): Promise<LintjeDialog> {
  const element = Object.assign(document.createElement('lintje-dialog'), {
    open: true,
    heading: 'Melding verwijderen?',
    ...props,
  })
  element.innerHTML = content
  document.body.append(element)
  await element.updateComplete
  await new Promise((resolve) => setTimeout(resolve))
  return element
}

const part = <T extends HTMLElement = HTMLElement>(element: LintjeDialog, selector: string): T =>
  element.shadowRoot!.querySelector<T>(selector)!

const button = (element: LintjeDialog, label: string): LintjeButton =>
  Array.from(element.querySelectorAll<LintjeButton>('lintje-button')).find(
    (candidate) => candidate.textContent!.trim() === label,
  )!

function closes(element: LintjeDialog): string[] {
  const reasons: string[] = []
  element.addEventListener('lintje-close', (event) =>
    reasons.push((event as CustomEvent<{ reason: string }>).detail.reason),
  )
  return reasons
}

const escape = (): boolean =>
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

describe('lintje-dialog', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('draws nothing while closed', async () => {
    const element = await mount({ open: false })
    expect(element.shadowRoot!.querySelector('.lintje-dialog')).toBeNull()
  })

  it('is a modal dialog named by its heading, with a close button', async () => {
    const element = await mount()
    const dialog = part(element, '[role="dialog"]')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    const label = part(element, `#${dialog.getAttribute('aria-labelledby')}`)
    expect(label.textContent!.trim()).toBe('Melding verwijderen?')
    expect(dialog.hasAttribute('aria-describedby')).toBe(false)
    expect(part(element, '.lintje-dialog__close')).not.toBeNull()
  })

  it('as an alert: an alertdialog described by its text, without a close button', async () => {
    const element = await mount({ alert: true })
    const dialog = part(element, '[role="alertdialog"]')
    const text = part(element, `#${dialog.getAttribute('aria-describedby')}`)
    expect(text.querySelector('slot:not([name])')).not.toBeNull()
    expect(element.shadowRoot!.querySelector('.lintje-dialog__close')).toBeNull()
  })

  it('puts the focus on the element with autofocus', async () => {
    const element = await mount({ alert: true })
    const cancel = button(element, 'Annuleren')
    expect(deepActiveElement()).toBe(cancel.shadowRoot!.querySelector('button'))
  })

  it('without autofocus: an alert takes the focus itself, a dialog gives it to the first field', async () => {
    const alert = await mount({ alert: true }, 'Doorgaan?')
    expect(deepActiveElement()).toBe(part(alert, '.lintje-dialog'))
    alert.remove()

    const form = await mount({ heading: 'Naam wijzigen', wide: true }, '<input id="naam">')
    expect(deepActiveElement()).toBe(form.querySelector('#naam'))
  })

  it('asks to close on Escape, the scrim and the close button, and stays open itself', async () => {
    const element = await mount()
    const reasons = closes(element)
    escape()
    part(element, '.lintje-dialog__scrim').click()
    part(element, '.lintje-dialog').click()
    part(element, '.lintje-dialog__close').click()
    expect(reasons).toEqual(['escape', 'scrim', 'button'])
    expect(element.open).toBe(true)
  })

  it('persistent: Escape and the scrim ask nothing', async () => {
    const element = await mount({ alert: true, persistent: true })
    const reasons = closes(element)
    escape()
    part(element, '.lintje-dialog__scrim').click()
    expect(reasons).toEqual([])
  })

  it('while busy: the answer turns busy, the rest disabled, nothing closes, and all comes back', async () => {
    const element = await mount({ busy: true })
    const reasons = closes(element)
    expect(button(element, 'Verwijderen').busy).toBe(true)
    expect(button(element, 'Annuleren').disabled).toBe(true)
    expect(part(element, '.lintje-dialog__close').getAttribute('aria-disabled')).toBe('true')
    escape()
    part(element, '.lintje-dialog__scrim').click()
    part(element, '.lintje-dialog__close').click()
    expect(reasons).toEqual([])

    element.busy = false
    await element.updateComplete
    expect(button(element, 'Verwijderen').busy).toBe(false)
    expect(button(element, 'Annuleren').disabled).toBe(false)
  })

  it('shows the footer only with a sentence or buttons', async () => {
    const bare = await mount({}, 'Alleen tekst.')
    expect(part(bare, '.lintje-dialog__footer').hidden).toBe(true)
    bare.remove()
    const element = await mount()
    expect(part(element, '.lintje-dialog__footer').hidden).toBe(false)
  })

  it('gives the focus back to its opener and the page its scroll when it closes', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const element = await mount()
    expect(document.body.style.overflow).toBe('hidden')
    element.open = false
    await element.updateComplete
    expect(document.activeElement).toBe(opener)
    expect(document.body.style.overflow).toBe('')
  })
})
