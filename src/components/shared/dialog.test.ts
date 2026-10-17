/** `DialogHold`: where it puts the focus, what it locks, and which of two held windows hears Escape. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DialogHold } from './dialog'
import { deepActiveElement } from './focus-trap'

/** A box with buttons, as a window holds them. */
function box(...ids: string[]): HTMLElement {
  const element = document.createElement('div')
  element.tabIndex = -1
  element.innerHTML = ids.map((id) => `<button id="${id}">${id}</button>`).join('')
  document.body.append(element)
  return element
}

const escape = (): boolean =>
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

const holds: DialogHold[] = []
function hold(onEscape: () => void = () => {}): DialogHold {
  const created = new DialogHold(onEscape)
  holds.push(created)
  return created
}

afterEach(() => {
  for (const each of holds.splice(0)) each.release()
  document.body.innerHTML = ''
})

describe('DialogHold focus', () => {
  it('leaves the focus where it is without the option', () => {
    const opener = box('opener').querySelector<HTMLElement>('#opener')!
    opener.focus()
    hold().hold(box('inside'))
    expect(deepActiveElement()).toBe(opener)
  })

  it('moves the focus to the element it is given', () => {
    const container = box('first', 'field')
    const field = container.querySelector<HTMLElement>('#field')!
    hold().hold(container, { focus: field })
    expect(deepActiveElement()).toBe(field)
  })

  it('gives the focus back to the opener on release', () => {
    const opener = box('opener').querySelector<HTMLElement>('#opener')!
    opener.focus()
    const held = hold()
    held.hold(box('inside'), { focus: true })
    held.release()
    expect(deepActiveElement()).toBe(opener)
  })
})

describe('DialogHold scroll lock', () => {
  it('locks the page without a scroller', () => {
    const held = hold()
    held.hold(box('inside'))
    expect(document.body.style.overflow).toBe('hidden')
    held.release()
    expect(document.body.style.overflow).toBe('')
  })

  it('locks the scroller it is given and leaves the page alone', () => {
    const scroller = document.createElement('div')
    scroller.style.overflow = 'auto'
    document.body.append(scroller)
    const held = hold()
    held.hold(box('inside'), { scroller })
    expect(scroller.style.overflow).toBe('hidden')
    expect(document.body.style.overflow).toBe('')
    held.release()
    expect(scroller.style.overflow).toBe('auto')
  })
})

describe('DialogHold Escape', () => {
  it('answers only for the window on top', () => {
    const below = vi.fn()
    const above = vi.fn()
    hold(below).hold(box('a'))
    const top = hold(above)
    top.hold(box('b'))
    escape()
    expect(above).toHaveBeenCalledOnce()
    expect(below).not.toHaveBeenCalled()
    top.release()
    escape()
    expect(below).toHaveBeenCalledOnce()
  })

  it('stops listening on release', () => {
    const onEscape = vi.fn()
    const held = hold(onEscape)
    held.hold(box('a'))
    held.release()
    escape()
    expect(onEscape).not.toHaveBeenCalled()
  })
})
