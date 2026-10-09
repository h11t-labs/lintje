import { afterEach, describe, expect, it } from 'vitest'
import { lengthPx } from './length'

function withToken(value: string): HTMLElement {
  const element = document.createElement('div')
  element.style.setProperty('--h-test', value)
  document.body.append(element)
  return element
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('lengthPx', () => {
  it('resolves a rem token against the root font size, not to its bare number', () => {
    expect(lengthPx(withToken('3.5rem'), '--h-test', 0)).toBe(56)
  })

  it('passes a px token through', () => {
    expect(lengthPx(withToken('48px'), '--h-test', 0)).toBe(48)
  })

  it('gives the fallback for a token that is not set', () => {
    expect(lengthPx(withToken(''), '--h-missing', 56)).toBe(56)
  })
})
