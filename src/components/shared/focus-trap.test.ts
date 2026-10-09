/**
 * The focus trap: what it counts, and how two of them stack.
 *
 * happy-dom moves no focus on Tab, so a Tab is a dispatched `keydown`: where the
 * trap wraps, it prevents the default and moves the focus itself.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FocusTrap, deepActiveElement, tabbables } from './focus-trap'
import { holdOverflow } from '../../core/host-config'
import '../layout/expander/expander'
import '../overlays/modal/modal'
import '../overlays/drawer/drawer'
import '../overlays/confirm-dialog/confirm-dialog'
import type { LintjeModal } from '../overlays/modal/modal'
import type { LintjeDrawer } from '../overlays/drawer/drawer'
import type { LintjeConfirmDialog } from '../overlays/confirm-dialog/confirm-dialog'

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

/** A box with buttons, as a dialog holds them. */
function box(...ids: string[]): HTMLElement {
  const element = document.createElement('div')
  element.tabIndex = -1
  element.innerHTML = ids.map((id) => `<button id="${id}">${id}</button>`).join('')
  document.body.append(element)
  return element
}

const escape = (): boolean =>
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('what the trap counts', () => {
  /**
   * happy-dom adopts no stylesheet and its `checkVisibility` walks the light-DOM
   * parents only, so it cannot see the closed expander's `visibility: hidden`.
   * The stub answers as Chrome does: hidden only when asked about the
   * `visibility` property, for content slotted into a closed expander.
   */
  function stubVisibility(): void {
    vi.spyOn(Element.prototype, 'checkVisibility').mockImplementation(function (
      this: Element,
      options?: CheckVisibilityOptions,
    ) {
      if (!options?.visibilityProperty) return true
      const expander = this.closest('lintje-expander') as (Element & { open: boolean }) | null
      return !expander || expander.open
    })
  }

  it('passes over the controls of a closed expander, so Tab wraps on the real last one', async () => {
    stubVisibility()
    const container = box('first', 'last')
    const expander = document.createElement('lintje-expander') as HTMLElement & {
      heading: string
      updateComplete: Promise<unknown>
    }
    expander.heading = 'Toelichting'
    expander.innerHTML = '<a href="#meer" id="hidden-link">Meer</a>'
    container.append(expander)
    await expander.updateComplete
    const header = expander.shadowRoot!.querySelector('button')!
    expect(tabbables(container)).toEqual([
      container.querySelector('#first'),
      container.querySelector('#last'),
      header,
    ])
    const trap = new FocusTrap()
    trap.activate(container)
    header.focus()
    expect(tab().defaultPrevented).toBe(true)
    expect(deepActiveElement()?.id).toBe('first')
    expect(tab(true).defaultPrevented).toBe(true)
    expect(deepActiveElement()).toBe(header)
    trap.deactivate(false)
  })
})

describe('a trap activated again', () => {
  it('keeps the opener it had, and gives the focus back to it', () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const dialog = box('a', 'b')
    const trap = new FocusTrap()
    trap.activate(dialog)
    ;(dialog.querySelector('#b') as HTMLElement).focus()
    // The dialog redraws its region and activates once more, with the focus inside it.
    trap.activate(dialog, { focus: false })
    expect(trap.isTopmost()).toBe(true)
    trap.deactivate()
    expect(deepActiveElement()).toBe(opener)
  })
})

describe('two traps', () => {
  it('lets only the top one act on Tab and on focus, and hands back when it stops', () => {
    const lower = box('lower-a', 'lower-b')
    const upper = box('upper-a', 'upper-b')
    const below = new FocusTrap()
    const above = new FocusTrap()
    below.activate(lower)
    ;(lower.querySelector('#lower-b') as HTMLElement).focus()
    above.activate(upper)
    expect(below.isTopmost()).toBe(false)
    expect(above.isTopmost()).toBe(true)
    // The focus is in the upper dialog and stays there: the lower trap pulls nothing back.
    expect(deepActiveElement()).toBe(upper)
    ;(upper.querySelector('#upper-b') as HTMLElement).focus()
    expect(tab().defaultPrevented).toBe(true)
    expect(deepActiveElement()?.id).toBe('upper-a')
    expect(tab(true).defaultPrevented).toBe(true)
    expect(deepActiveElement()?.id).toBe('upper-b')
    // Closing the upper one gives the focus back to its opener, in the lower one.
    above.deactivate()
    expect(below.isTopmost()).toBe(true)
    expect(deepActiveElement()?.id).toBe('lower-b')
    expect(tab().defaultPrevented).toBe(true)
    expect(deepActiveElement()?.id).toBe('lower-a')
    below.deactivate(false)
  })

  it('may stop the lower one first; the top one keeps the keyboard', () => {
    const lower = box('lower-a')
    const upper = box('upper-a', 'upper-b')
    const below = new FocusTrap()
    const above = new FocusTrap()
    below.activate(lower)
    above.activate(upper)
    below.deactivate(false)
    expect(above.isTopmost()).toBe(true)
    ;(upper.querySelector('#upper-b') as HTMLElement).focus()
    expect(tab().defaultPrevented).toBe(true)
    expect(deepActiveElement()?.id).toBe('upper-a')
    above.deactivate(false)
    expect(above.isTopmost()).toBe(false)
  })
})

describe('the initial focus', () => {
  it('goes to the element named, or to the first stop in its shadow root', () => {
    const container = box('first', 'second')
    const host = document.createElement('div')
    host.attachShadow({ mode: 'open' }).innerHTML =
      '<span>Tekst</span><button id="inner">In</button>'
    container.append(host)
    const trap = new FocusTrap()
    trap.activate(container, { focus: container.querySelector('#second') as HTMLElement })
    expect(deepActiveElement()?.id).toBe('second')
    trap.deactivate(false)
    trap.activate(container, { focus: host })
    expect(deepActiveElement()?.id).toBe('inner')
    trap.deactivate(false)
  })
})

describe('a modal opened from a drawer', () => {
  async function both(): Promise<{
    drawer: LintjeDrawer
    modal: LintjeModal
    closed: EventTarget[]
  }> {
    const closed: EventTarget[] = []
    const drawer = document.createElement('lintje-drawer') as LintjeDrawer
    drawer.innerHTML = '<button id="in-drawer">Vergroot</button>'
    const modal = document.createElement('lintje-modal') as LintjeModal
    modal.csv = false
    modal.png = false
    for (const dialog of [drawer, modal]) {
      dialog.addEventListener('lintje-close', (event) => {
        // `lintje-close` is composed: take only the dialog's own.
        if (event.target !== dialog) return
        closed.push(dialog)
        dialog.open = false
      })
    }
    document.body.append(drawer, modal)
    drawer.open = true
    await drawer.updateComplete
    await new Promise((resolve) => setTimeout(resolve))
    ;(drawer.querySelector('#in-drawer') as HTMLElement).focus()
    modal.open = true
    await modal.updateComplete
    return { drawer, modal, closed }
  }

  it('closes one dialog per Escape, the top one first', async () => {
    const { drawer, modal, closed } = await both()
    escape()
    await modal.updateComplete
    await drawer.updateComplete
    expect(closed).toEqual([modal])
    expect(drawer.open).toBe(true)
    expect(deepActiveElement()?.id).toBe('in-drawer')
    escape()
    await drawer.updateComplete
    expect(closed).toEqual([modal, drawer])
  })

  it('keeps the page locked until the last of them closes, in either order', async () => {
    const { drawer, modal } = await both()
    expect(document.body.style.overflow).toBe('hidden')
    drawer.open = false
    await drawer.updateComplete
    expect(document.body.style.overflow).toBe('hidden')
    modal.open = false
    await modal.updateComplete
    expect(document.body.style.overflow).toBe('')
  })
})

// examples/meldingen: closing a drawer with unsaved input asks first, in a confirm dialog.
describe('a confirm dialog over a drawer', () => {
  it('closes alone on Escape, and its answer can close the drawer too', async () => {
    const asked: string[] = []
    const drawer = document.createElement('lintje-drawer') as LintjeDrawer
    drawer.heading = 'Melding'
    drawer.innerHTML = '<input id="titel">'
    const confirm = document.createElement('lintje-confirm-dialog') as LintjeConfirmDialog
    confirm.heading = 'Wijzigingen weggooien?'
    drawer.addEventListener('lintje-close', () => {
      asked.push('drawer')
      confirm.open = true
    })
    confirm.addEventListener('lintje-close', () => {
      asked.push('confirm')
      confirm.open = false
    })
    confirm.addEventListener('lintje-confirm', () => {
      confirm.open = false
      drawer.open = false
    })
    document.body.append(drawer, confirm)
    drawer.open = true
    await drawer.updateComplete
    await new Promise((resolve) => setTimeout(resolve))
    expect(deepActiveElement()?.id).toBe('titel')

    escape()
    await confirm.updateComplete
    await new Promise((resolve) => setTimeout(resolve))
    expect(asked).toEqual(['drawer'])
    // The safe button has the focus, in the confirm dialog on top.
    const cancel = confirm.shadowRoot!.querySelector('.lintje-confirm-dialog__cancel')
    expect((deepActiveElement()!.getRootNode() as ShadowRoot).host).toBe(cancel)

    escape()
    await confirm.updateComplete
    expect(asked).toEqual(['drawer', 'confirm'])
    expect(drawer.open).toBe(true)
    expect(deepActiveElement()?.id).toBe('titel')

    escape()
    await confirm.updateComplete
    confirm.shadowRoot!.querySelector<HTMLElement>('.lintje-confirm-dialog__confirm')!.click()
    await confirm.updateComplete
    await drawer.updateComplete
    expect(drawer.open).toBe(false)
    expect(document.body.style.overflow).toBe('')
  })
})

describe('the counted scroll lock', () => {
  it('restores the first overflow after the last release, whatever the order', () => {
    const element = document.createElement('div')
    element.style.overflow = 'auto'
    const first = holdOverflow(element)
    const second = holdOverflow(element)
    first()
    expect(element.style.overflow).toBe('hidden')
    first()
    expect(element.style.overflow).toBe('hidden')
    second()
    expect(element.style.overflow).toBe('auto')
  })
})
