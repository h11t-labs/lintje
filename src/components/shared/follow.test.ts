import { describe, expect, it } from 'vitest'
import { AT_END, atEndAfterScroll } from './follow'

describe('atEndAfterScroll', () => {
  it('leaves the end only by scrolling up', () => {
    expect(atEndAfterScroll(true, 500, 600, 100)).toBe(false)
    // Lines that arrive below push the end away without a scroll of the reader's.
    expect(atEndAfterScroll(true, 600, 600, 300)).toBe(true)
    expect(atEndAfterScroll(true, 599.5, 600, 300)).toBe(true)
  })

  it('returns to the end only by arriving at it', () => {
    expect(atEndAfterScroll(false, 700, 600, 200)).toBe(false)
    expect(atEndAfterScroll(false, 900, 600, AT_END)).toBe(true)
  })
})
