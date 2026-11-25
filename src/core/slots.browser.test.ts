import { afterEach, describe, expect, it } from 'vitest'
import { fromSlotted } from './slots'

describe('fromSlotted', () => {
  afterEach(() => document.body.replaceChildren())

  function setup(): { host: HTMLElement; root: ShadowRoot; fallback: HTMLElement } {
    const host = document.createElement('div')
    const root = host.attachShadow({ mode: 'open' })
    root.innerHTML =
      '<div class="row"><slot name="a"><b>fallback</b></slot><slot name="b"></slot></div>'
    document.body.append(host)
    return { host, root, fallback: root.querySelector('b')! }
  }

  it('is true for a click on the host element in a slot of the root', () => {
    const { host, root } = setup()
    const own = document.createElement('button')
    own.slot = 'b'
    host.append(own)
    let seen: boolean | undefined
    root
      .querySelector('.row')!
      .addEventListener('click', (event) => (seen = fromSlotted(event, root)))
    own.click()
    expect(seen).toBe(true)
  })

  it("is false for a click on a slot's fallback", () => {
    const { root, fallback } = setup()
    let seen: boolean | undefined
    root
      .querySelector('.row')!
      .addEventListener('click', (event) => (seen = fromSlotted(event, root)))
    fallback.click()
    expect(seen).toBe(false)
  })
})
