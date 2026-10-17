/** Handing the focus on: before a control goes, the focus goes to a place that stays. */
import { afterEach, describe, expect, it } from 'vitest'
import { deepActiveElement, passFocus } from './focus'

function button(label: string): HTMLButtonElement {
  const element = document.createElement('button')
  element.textContent = label
  return element
}

afterEach(() => document.body.replaceChildren())

describe('passFocus()', () => {
  it('does nothing while the focus is elsewhere', () => {
    const going = button('Weg')
    const elsewhere = button('Elders')
    const place = button('Buur')
    document.body.append(elsewhere, going, place)
    elsewhere.focus()
    expect(passFocus(going, [place])).toBe(false)
    expect(deepActiveElement()).toBe(elsewhere)
  })

  it('puts the focus on the first place that is on the page and takes it', () => {
    const going = button('Weg')
    const gone = button('Al weg')
    const disabled = Object.assign(button('Uit'), { disabled: true })
    const place = button('Buur')
    document.body.append(going, disabled, place)
    going.focus()
    expect(passFocus(going, [null, gone, disabled, place])).toBe(true)
    expect(deepActiveElement()).toBe(place)
  })

  it('reaches into a shadow root for the first stop of a place that is no stop itself', () => {
    const going = button('Weg')
    const host = document.createElement('div')
    const inner = button('Binnen')
    host.attachShadow({ mode: 'open' }).append(inner)
    document.body.append(going, host)
    going.focus()
    expect(passFocus(going, [host])).toBe(true)
    expect(deepActiveElement()).toBe(inner)
  })

  it('also hands on the focus from inside the element that goes', () => {
    const going = document.createElement('div')
    const inside = button('Binnen')
    going.append(inside)
    const place = button('Buur')
    document.body.append(going, place)
    inside.focus()
    expect(passFocus(going, [place])).toBe(true)
    expect(deepActiveElement()).toBe(place)
  })

  it('without a place, goes to the next Tab stop after the element, never to body', () => {
    const before = button('Voor')
    const going = document.createElement('div')
    const inside = button('Binnen')
    going.append(inside, button('Ook binnen'))
    const after = button('Na')
    document.body.append(before, going, after)
    inside.focus()
    expect(passFocus(going, [button('Niet op de pagina')])).toBe(true)
    expect(deepActiveElement()).toBe(after)
    expect(deepActiveElement()).not.toBe(document.body)
  })

  it('for the last stop of the page, goes to the stop before it', () => {
    const before = button('Voor')
    const going = button('Weg')
    document.body.append(before, going)
    going.focus()
    expect(passFocus(going)).toBe(true)
    expect(deepActiveElement()).toBe(before)
  })

  it('never picks a place inside the element that goes', () => {
    const going = document.createElement('div')
    const inside = button('Binnen')
    const alsoInside = button('Ook binnen')
    going.append(inside, alsoInside)
    const after = button('Na')
    document.body.append(going, after)
    inside.focus()
    expect(passFocus(going, [alsoInside])).toBe(true)
    expect(deepActiveElement()).toBe(after)
  })
})
