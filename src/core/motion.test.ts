/** `easing`: a timing-function token as a function of progress, for motion drawn per frame. */
import { afterEach, describe, expect, it } from 'vitest'
import { easing } from './motion'

function curve(value: string): (t: number) => number {
  const element = document.createElement('div')
  element.setAttribute('style', `--curve: ${value}`)
  document.body.append(element)
  return easing(element, '--curve')
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('easing', () => {
  it('follows a cubic Bézier: the incoming curve is past halfway at half the time', () => {
    const ease = curve('cubic-bezier(0.2, 0, 0, 1)')
    expect(ease(0)).toBe(0)
    expect(ease(1)).toBe(1)
    expect(ease(0.5)).toBeGreaterThan(0.75)
  })

  it('reads the diagonal Bézier as linear', () => {
    expect(curve('cubic-bezier(0, 0, 1, 1)')(0.3)).toBeCloseTo(0.3, 4)
  })

  it('runs linear for `linear`, an unknown value or none', () => {
    for (const value of ['linear', 'ease', '']) expect(curve(value)(0.3)).toBe(0.3)
  })
})
