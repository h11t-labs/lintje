/**
 * The drawer: closed it draws nothing; open it is a modal dialog that asks to be closed,
 * blocks that while busy, moves the focus in and gives it back. How Tab wraps and how two
 * dialogs stack is the focus trap's (`shared/focus-trap.test.ts`). happy-dom has no layout
 * or motion.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import './drawer'
import type { LintjeDrawer } from './drawer'
import { deepActiveElement } from '../../shared/focus-trap'
import '../../inputs/multiselect/multiselect'
import '../../inputs/date-range/date-range'
import '../toggletip/toggletip'
import '../../feedback/toast/toast'

async function mount(props: Partial<LintjeDrawer> = {}, body = ''): Promise<LintjeDrawer> {
  const element = Object.assign(document.createElement('lintje-drawer'), {
    heading: 'Betrokkene',
    ...props,
  })
  element.innerHTML = body
  document.body.append(element)
  await element.updateComplete
  return element
}

function listen(element: LintjeDrawer): string[] {
  const reasons: string[] = []
  element.addEventListener('lintje-close', (event) =>
    reasons.push((event as CustomEvent<{ reason: string }>).detail.reason),
  )
  return reasons
}

describe('lintje-drawer', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    document.body.style.overflow = ''
  })

  it('names the dialog "Zijpaneel" without a heading, and warns', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const element = await mount({ heading: '', open: true })
    const dialog = element.shadowRoot!.querySelector('[role="dialog"]')!
    expect(dialog.getAttribute('aria-label')).toBe('Zijpaneel')
    expect(dialog.hasAttribute('aria-labelledby')).toBe(false)
    expect(dialog.querySelector('h2')).toBeNull()
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()

    const named = await mount({ open: true })
    const titled = named.shadowRoot!.querySelector('[role="dialog"]')!
    expect(titled.getAttribute('aria-labelledby')).toBe('lintje-drawer-title')
    expect(titled.hasAttribute('aria-label')).toBe(false)
  })

  it('draws nothing while closed and a labelled modal dialog while open', async () => {
    const closed = await mount()
    expect(closed.shadowRoot!.querySelector('[role="dialog"]')).toBeNull()

    const open = await mount({ open: true })
    const dialog = open.shadowRoot!.querySelector('[role="dialog"]')!
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    const title = open.shadowRoot!.getElementById(dialog.getAttribute('aria-labelledby')!)!
    expect(title.textContent).toBe('Betrokkene')
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('asks to be closed on Escape, the close button and the scrim', async () => {
    const element = await mount({ open: true })
    const reasons = listen(element)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    element.shadowRoot!.querySelector<HTMLElement>('.lintje-drawer__close')!.click()
    element.shadowRoot!.querySelector<HTMLElement>('.lintje-drawer__scrim')!.click()
    expect(reasons).toEqual(['escape', 'button', 'scrim'])
    expect(element.open).toBe(true)
  })

  it('does not ask while busy, and disables its close button', async () => {
    const element = await mount({ open: true, busy: true })
    const reasons = listen(element)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    element.shadowRoot!.querySelector<HTMLElement>('.lintje-drawer__scrim')!.click()
    element.shadowRoot!.querySelector<HTMLElement>('.lintje-drawer__close')!.click()
    expect(reasons).toEqual([])
    const close = element.shadowRoot!.querySelector('.lintje-drawer__close')!
    expect(close.getAttribute('aria-disabled')).toBe('true')
    expect(close.hasAttribute('disabled')).toBe(false)
    expect(element.shadowRoot!.querySelector('[role="dialog"]')!.getAttribute('aria-busy')).toBe(
      'true',
    )
  })

  it('shows the subtitle under the title only when there is one', async () => {
    const without = await mount({ open: true })
    expect(without.shadowRoot!.querySelector('.lintje-drawer__subtitle')).toBeNull()
    const withLine = await mount({ open: true, subtitle: 'Melding 2026-0412' })
    expect(withLine.shadowRoot!.querySelector('.lintje-drawer__subtitle')!.textContent).toBe(
      'Melding 2026-0412',
    )
  })

  it('hides the footer until something is slotted into it', async () => {
    const empty = await mount({ open: true })
    expect(empty.shadowRoot!.querySelector<HTMLElement>('.lintje-drawer__footer')!.hidden).toBe(
      true,
    )
    const full = await mount({ open: true }, '<button slot="footer">Opslaan</button>')
    await new Promise((resolve) => setTimeout(resolve))
    await full.updateComplete
    expect(full.shadowRoot!.querySelector<HTMLElement>('.lintje-drawer__footer')!.hidden).toBe(
      false,
    )
  })

  it('unlocks the page when it closes', async () => {
    const element = await mount({ open: true })
    element.open = false
    await element.updateComplete
    expect(document.body.style.overflow).toBe('')
  })
})

describe('focus', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve))

  it('moves to the first field, and back to the opener on close', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const element = await mount(
      { open: true },
      '<p>Gegevens</p><button id="help">Uitleg</button><input id="naam"><select id="rol"></select>',
    )
    await settle()
    expect(deepActiveElement()?.id).toBe('naam')
    element.open = false
    await element.updateComplete
    expect(deepActiveElement()).toBe(opener)
  })

  it('moves to the close button when the body holds no field', async () => {
    const element = await mount({ open: true }, '<p>Alleen tekst</p>')
    await settle()
    expect(deepActiveElement()).toBe(element.shadowRoot!.querySelector('.lintje-drawer__close'))
  })

  it('keeps Tab inside the panel, the slotted footer included', async () => {
    const element = await mount(
      { open: true },
      '<input id="naam"><button slot="footer" id="opslaan">Opslaan</button>',
    )
    await settle()
    ;(element.querySelector('#opslaan') as HTMLElement).focus()
    const tab = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      composed: true,
      cancelable: true,
    })
    deepActiveElement()!.dispatchEvent(tab)
    expect(tab.defaultPrevented).toBe(true)
    expect(deepActiveElement()).toBe(element.shadowRoot!.querySelector('.lintje-drawer__close'))
  })
})

/**
 * Escape in a popup that stands in the drawer closes the popup only; the next Escape is the drawer's. Something outside the drawer — a
 * toast — does not answer an Escape the drawer holds.
 */
describe('Escape inside the drawer', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    document.body.style.overflow = ''
  })

  const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve))

  function escape(): void {
    ;(deepActiveElement() ?? document.body).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
    )
  }

  async function popupIn(tag: string): Promise<{
    drawer: LintjeDrawer
    popup: HTMLElement & { open: boolean; updateComplete: Promise<unknown> }
    reasons: string[]
  }> {
    const drawer = await mount({ open: true }, `<${tag} label="Veld"></${tag}>`)
    const reasons = listen(drawer)
    await settle()
    const popup = drawer.querySelector(tag) as HTMLElement & {
      open: boolean
      updateComplete: Promise<unknown>
    }
    // A click on the field focuses it and opens the popup; the focus then stands in the popup.
    popup.shadowRoot!.querySelector<HTMLElement>('button')!.focus()
    popup.open = true
    await popup.updateComplete
    const inside = popup.shadowRoot!.querySelector<HTMLElement>(
      '.lintje-multiselect__search-input, .lintje-date-range-picker__nav',
    )!
    inside.focus()
    return { drawer, popup, reasons }
  }

  for (const tag of ['lintje-multiselect', 'lintje-date-range']) {
    it(`closes an open ${tag} first, and the drawer on the next Escape`, async () => {
      const { popup, reasons } = await popupIn(tag)
      escape()
      await popup.updateComplete
      expect(popup.open).toBe(false)
      expect(reasons).toEqual([])
      escape()
      expect(reasons).toEqual(['escape'])
    })
  }

  it('closes an open toggletip in it, and leaves the drawer open', async () => {
    const drawer = await mount({ open: true }, '<lintje-toggletip>Uitleg</lintje-toggletip>')
    const reasons = listen(drawer)
    await settle()
    const tip = drawer.querySelector('lintje-toggletip')!
    const trigger = tip.shadowRoot!.querySelector<HTMLButtonElement>('.lintje-toggletip__trigger')!
    trigger.focus()
    trigger.click()
    await tip.updateComplete
    expect(tip.open).toBe(true)
    escape()
    await tip.updateComplete
    expect(tip.open).toBe(false)
    expect(reasons).toEqual([])
  })

  it('is not a toast’s to answer while the focus stands in the drawer', async () => {
    const toast = document.createElement('lintje-toast')
    let closed = 0
    toast.addEventListener('lintje-close', () => closed++)
    document.body.append(toast)
    const drawer = await mount({ open: true }, '<input id="naam">')
    const reasons = listen(drawer)
    await settle()
    escape()
    expect(reasons).toEqual(['escape'])
    expect(closed).toBe(0)
    drawer.open = false
    await drawer.updateComplete
    escape()
    expect(closed).toBe(1)
  })
})
