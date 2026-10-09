/**
 * The popover: closed it draws nothing, open it draws the panel, and it asks to be closed
 * rather than closing itself. happy-dom has no layout, so the place is checked on the
 * arithmetic (`place()`), not on a rectangle.
 */
import { describe, expect, it } from 'vitest'
import './popover'
import { place } from '../shared/place'
import type { LintjePopover } from './popover'

async function mount(open: boolean): Promise<LintjePopover> {
  const anchor = document.createElement('button')
  const popover = document.createElement('lintje-popover')
  popover.open = open
  popover.label = 'Kolommen kiezen'
  popover.panelRole = 'dialog'
  popover.innerHTML = '<p>Inhoud</p>'
  document.body.append(anchor, popover)
  await popover.updateComplete
  return popover
}

const panel = (popover: LintjePopover): HTMLElement | null =>
  popover.shadowRoot!.querySelector('.lintje-popover')

describe('lintje-popover', () => {
  it('draws nothing while closed and the named panel while open', async () => {
    const closed = await mount(false)
    expect(panel(closed)).toBeNull()

    const open = await mount(true)
    expect(panel(open)!.getAttribute('role')).toBe('dialog')
    expect(panel(open)!.getAttribute('aria-label')).toBe('Kolommen kiezen')
  })

  it('asks to be closed on Escape and on a press outside, and stays open itself', async () => {
    const popover = await mount(true)
    const reasons: string[] = []
    popover.addEventListener('lintje-close', (event) =>
      reasons.push((event as CustomEvent<{ reason: string }>).detail.reason),
    )

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }))

    expect(reasons).toEqual(['escape', 'outside'])
    expect(popover.open).toBe(true)
  })

  it('leaves Escape to a modal dialog opened over it', async () => {
    document.body.innerHTML = ''
    const popover = await mount(true)
    let closes = 0
    popover.addEventListener('lintje-close', () => closes++)
    const dialog = document.createElement('div')
    dialog.setAttribute('aria-modal', 'true')
    dialog.innerHTML = '<button>Sluiten</button>'
    document.body.append(dialog)
    dialog.querySelector('button')!.focus()

    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    dialog.querySelector('button')!.dispatchEvent(escape)
    expect(closes).toBe(0)
    dialog.remove()
  })

  it('answers Escape inside the modal dialog it stands in', async () => {
    document.body.innerHTML = ''
    const dialog = document.createElement('div')
    dialog.setAttribute('aria-modal', 'true')
    const field = document.createElement('input')
    dialog.append(field)
    document.body.append(dialog)
    const popover = document.createElement('lintje-popover')
    popover.anchor = field
    popover.open = true
    dialog.append(popover)
    await popover.updateComplete
    let closes = 0
    popover.addEventListener('lintje-close', () => closes++)
    field.focus()
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(closes).toBe(1)
    dialog.remove()
  })

  it('leaves Escape to a control inside the panel first, and closes once on what it leaves', async () => {
    document.body.innerHTML = ''
    const popover = await mount(true)
    popover.innerHTML = '<button>Greep</button>'
    const grip = popover.querySelector('button')!
    let closes = 0
    popover.addEventListener('lintje-close', () => closes++)
    grip.focus()

    const held = (event: KeyboardEvent): void => event.preventDefault()
    grip.addEventListener('keydown', held)
    grip.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    )
    expect(closes).toBe(0)

    grip.removeEventListener('keydown', held)
    grip.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    )
    expect(closes).toBe(1)
  })

  it('leaves a press on its anchor to the anchor', async () => {
    const popover = await mount(true)
    let closes = 0
    popover.addEventListener('lintje-close', () => closes++)
    popover.previousElementSibling!.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, composed: true }),
    )
    expect(closes).toBe(0)
  })
})

describe('place()', () => {
  const view = { width: 1000, height: 800 }
  const box = { width: 240, height: 200 }

  it('stands 6 px under the anchor, left edges aligned', () => {
    const anchor = { top: 100, bottom: 140, left: 50, right: 250, width: 200 }
    expect(place(anchor, box, view)).toEqual({ top: 146, bottom: null, left: 50, space: 646 })
  })

  it('flips above when there is no room below and more above', () => {
    const anchor = { top: 700, bottom: 740, left: 50, right: 250, width: 200 }
    const spot = place(anchor, box, view)
    expect(spot.top).toBeNull()
    expect(spot.bottom).toBe(106)
  })

  it('stays 8 px from the viewport edge', () => {
    const anchor = { top: 100, bottom: 140, left: 900, right: 990, width: 90 }
    expect(place(anchor, box, view).left).toBe(752)
    expect(place(anchor, box, view, 'bottom-end').left).toBe(750)
  })

  it('stands above with right edges aligned on top-end, and flips below without room above', () => {
    const high = { top: 400, bottom: 440, left: 300, right: 500, width: 200 }
    expect(place(high, box, view, 'top-end')).toEqual({
      top: null,
      bottom: 406,
      left: 260,
      space: 386,
    })
    const low = { top: 20, bottom: 60, left: 300, right: 500, width: 200 }
    expect(place(low, box, view, 'top-end').top).toBe(66)
  })
})
