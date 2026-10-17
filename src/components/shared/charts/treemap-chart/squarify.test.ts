/** The treemap's layout: areas in proportion, the box filled, the largest top left, stable. */
import { describe, expect, it } from 'vitest'
import { squarify, type TreemapRect } from './squarify'

const BOX: TreemapRect = { x: 0, y: 0, width: 600, height: 260 }
const area = (rect: TreemapRect) => rect.width * rect.height
const VALUES = [110.7, 98.4, 48.6, 38.2, 22.3, 16.9, 12.5, 10.3, 5.4, 3.9]

describe('squarify', () => {
  it('gives each value an area in proportion to it', () => {
    const rects = squarify(VALUES, BOX)
    const total = VALUES.reduce((sum, value) => sum + value, 0)
    for (const [i, rect] of rects.entries()) {
      expect(area(rect) / area(BOX)).toBeCloseTo(VALUES[i] / total, 6)
    }
  })

  it('fills the box together, without overlap', () => {
    const rects = squarify(VALUES, BOX)
    const sum = rects.reduce((total, rect) => total + area(rect), 0)
    expect(sum).toBeCloseTo(area(BOX), 6)
    for (const rect of rects) {
      expect(rect.x).toBeGreaterThanOrEqual(-1e-9)
      expect(rect.y).toBeGreaterThanOrEqual(-1e-9)
      expect(rect.x + rect.width).toBeLessThanOrEqual(BOX.width + 1e-9)
      expect(rect.y + rect.height).toBeLessThanOrEqual(BOX.height + 1e-9)
    }
    for (const [i, a] of rects.entries()) {
      for (const b of rects.slice(i + 1)) {
        const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
        const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
        expect(Math.min(overlapX, overlapY)).toBeLessThan(1e-6)
      }
    }
  })

  it('puts the first, largest value top left', () => {
    const [first] = squarify(VALUES, BOX)
    expect(first.x).toBe(0)
    expect(first.y).toBe(0)
  })

  it('lays its rows along the short side, so the areas stay near square', () => {
    const rects = squarify(VALUES, BOX)
    // A wide box: the first row is a column along the height, at the left.
    expect(rects[0].width).toBeLessThan(BOX.width / 2)
    const ratios = rects.map((rect) => Math.max(rect.width / rect.height, rect.height / rect.width))
    expect(Math.max(...ratios.slice(0, 4))).toBeLessThan(3)
  })

  it('gives the same rectangles for the same data', () => {
    expect(squarify(VALUES, BOX)).toEqual(squarify([...VALUES], { ...BOX }))
  })

  it('gives a value that is not positive no area', () => {
    const rects = squarify([5, 0, -2, 5], BOX)
    expect(area(rects[1])).toBe(0)
    expect(area(rects[2])).toBe(0)
    expect(area(rects[0]) + area(rects[3])).toBeCloseTo(area(BOX), 6)
  })

  it('draws nothing in an empty box or without values', () => {
    expect(squarify([], BOX)).toEqual([])
    expect(squarify([3], { ...BOX, width: 0 }).map(area)).toEqual([0])
  })
})
