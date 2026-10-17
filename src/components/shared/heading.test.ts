import { render } from 'lit'
import { describe, expect, it } from 'vitest'
import { renderHeading, type HeadingLevel } from './heading'

function drawn(level: HeadingLevel | undefined, id?: string): HTMLElement {
  const box = document.createElement('div')
  render(renderHeading(level, 'lintje-test__heading', 'Overzicht', id), box)
  return box.firstElementChild as HTMLElement
}

describe('renderHeading', () => {
  it('draws the tag of each level, with its class and its text', () => {
    for (const level of [2, 3, 4, 5, 6] as const) {
      const heading = drawn(level, `kop-${level}`)
      expect(heading.tagName).toBe(`H${level}`)
      expect(heading.className).toBe('lintje-test__heading')
      expect(heading.id).toBe(`kop-${level}`)
      expect(heading.textContent).toBe('Overzicht')
    }
  })

  it('is an h3 without a level, and has no id without one', () => {
    const heading = drawn(undefined)
    expect(heading.tagName).toBe('H3')
    expect(heading.hasAttribute('id')).toBe(false)
  })
})
