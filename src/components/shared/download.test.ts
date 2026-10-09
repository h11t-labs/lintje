/** The PNG's surface: the token where the chart stands, else the document's, never a literal. */
import { afterEach, describe, expect, it } from 'vitest'
import { surfaceColour } from './download'

afterEach(() => {
  document.documentElement.style.removeProperty('--color-bg-surface')
  document.body.innerHTML = ''
})

function chart(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  document.body.append(svg)
  return svg
}

describe('surfaceColour', () => {
  it('takes the surface token where the chart stands', () => {
    const svg = chart()
    svg.style.setProperty('--color-bg-surface', 'rgb(29, 29, 29)')
    expect(surfaceColour(svg)).toBe('rgb(29, 29, 29)')
  })

  it('falls back to the document’s own token', () => {
    document.documentElement.style.setProperty('--color-bg-surface', 'rgb(255, 255, 255)')
    expect(surfaceColour(chart())).toBe('rgb(255, 255, 255)')
  })

  it('names no colour of its own when neither has one', () => {
    expect(surfaceColour(chart())).toBe('')
  })
})
