import { describe, expect, it } from 'vitest'
import { overflowCount, type OverflowItem } from './overflow'

const GAP = 12
const MENU = 90

/** Four buttons of 100 px, the last the primary. */
const four = (): OverflowItem[] => [
  { width: 100, fixed: false },
  { width: 100, fixed: false },
  { width: 100, fixed: false },
  { width: 100, fixed: true },
]

describe('overflowCount', () => {
  it('hides nothing while every action fits on one line', () => {
    // 4 × 100 + 3 × 12 = 436.
    expect(overflowCount(four(), MENU, GAP, 436)).toBe(0)
    expect(overflowCount(four(), MENU, GAP, 1000)).toBe(0)
  })

  it('hides the first actions until the rest and the menu fit', () => {
    // Two hidden: 2 × 100 + 90 + 2 × 12 = 314; three hidden: 100 + 90 + 12 = 202.
    expect(overflowCount(four(), MENU, GAP, 314)).toBe(2)
    expect(overflowCount(four(), MENU, GAP, 250)).toBe(3)
  })

  it('never leaves one row in the menu: when one would do, two go', () => {
    // One hidden would fit: 3 × 100 + 90 + 3 × 12 = 426.
    expect(overflowCount(four(), MENU, GAP, 430)).toBe(2)
  })

  it('keeps a lone collapsible action in place, to stack as before', () => {
    const two: OverflowItem[] = [
      { width: 100, fixed: false },
      { width: 100, fixed: true },
    ]
    expect(overflowCount(two, MENU, GAP, 150)).toBe(0)
  })

  it('never hides the last action, even when nothing fits', () => {
    expect(overflowCount(four(), MENU, GAP, 10)).toBe(3)
  })

  it('counts what is not a button toward the room but never hides it', () => {
    const items: OverflowItem[] = [
      { width: 100, fixed: false },
      { width: 100, fixed: false },
      { width: 60, fixed: true },
      { width: 100, fixed: true },
    ]
    // Both hidden: 60 + 100 + 90 + 2 × 12 = 274.
    expect(overflowCount(items, MENU, GAP, 274)).toBe(2)
  })
})
