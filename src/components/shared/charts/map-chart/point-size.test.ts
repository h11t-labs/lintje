/** The radius of a point: the default band, a host's band, and no size at all. */
import { describe, expect, it } from 'vitest'
import { pointRadius } from './marks'

describe('the radius of a point', () => {
  it('grows from 3 to 18 px with the square root of the share', () => {
    expect(pointRadius(21, 21)).toBe(18)
    expect(pointRadius(0, 21)).toBe(3)
    expect(pointRadius(21 / 4, 21)).toBeCloseTo(3 + 0.5 * 15)
  })

  it('takes the band the host sets', () => {
    expect(pointRadius(21, 21, { min: 4, max: 10 })).toBe(10)
    expect(pointRadius(0, 21, { min: 4, max: 10 })).toBe(4)
    expect(pointRadius(21, 21, { max: 12 })).toBe(12)
  })

  it('is the smallest for every point when the figure is no size', () => {
    expect(pointRadius(21, 21, { by: 'none' })).toBe(3)
    expect(pointRadius(1, 21, { by: 'none', min: 5 })).toBe(5)
  })
})
