/**
 * The heatmap's classes: spread over the values shown, with rounded bounds.
 *
 * The rule the owner chose ("grenzen uit de data"): five equal-width classes
 * between the smallest and the largest non-null cell, the width rounded to
 * 1/2/2.5/5 × 10ⁿ, the first bound below the minimum. Nearest, not rounded up —
 * rounding up pushes the last bound past the maximum and empties the top class,
 * which is exactly the bug the fixed 60/100/140/180 bounds had on a percentage.
 */
import { describe, expect, it } from 'vitest'
import { heatmapBounds, heatmapClassFor, heatmapClasses } from './heatmap-classes'

const grid = (...values: (number | null)[]): (number | null)[][] => [values]

describe('heatmapBounds', () => {
  it('divides a percentage into five twenties', () => {
    expect(heatmapBounds(grid(0, 37, 68, 100))).toEqual([20, 40, 60, 80])
  })

  it('keeps every class reachable on a range that does not start at zero', () => {
    // 37–183: a width of 29,2 rounds to 25, so the ladder starts at 25.
    expect(heatmapBounds(grid(37, 90, 120, 183))).toEqual([50, 75, 100, 125])
  })

  it('ignores null cells', () => {
    expect(heatmapBounds(grid(null, 0, null, 100, null))).toEqual([20, 40, 60, 80])
  })

  it('gives no division for an empty set, an all-null set or a single value', () => {
    expect(heatmapBounds([])).toEqual([])
    expect(heatmapBounds(grid(null, null))).toEqual([])
    expect(heatmapBounds(grid(42, 42, 42))).toEqual([])
  })

  it('keeps whole numbers whole', () => {
    // A range of 3 would want a step of 0,5; counts get 1.
    expect(heatmapBounds(grid(0, 1, 2, 3))).toEqual([1, 2, 3])
    expect(heatmapBounds(grid(0, 3))).toEqual([1, 2, 3])
  })

  it('divides fractions without float dust', () => {
    expect(heatmapBounds(grid(0, 0.5, 1))).toEqual([0.2, 0.4, 0.6, 0.8])
  })

  it('scales to large numbers', () => {
    expect(heatmapBounds(grid(0, 148230))).toEqual([25000, 50000, 75000, 100000])
  })
})

describe('heatmapClasses', () => {
  it('writes the legend as the bounds read, with a percentage sign against the number', () => {
    expect(heatmapClasses(grid(0, 100), { unit: '%' }).map((klass) => klass.label)).toEqual([
      '< 20%',
      '20–40%',
      '40–60%',
      '60–80%',
      '≥ 80%',
    ])
  })

  it('puts a word unit after a space', () => {
    expect(heatmapClasses(grid(0, 100), { unit: 'min' })[0].label).toBe('< 20 min')
  })

  it('takes explicit bounds over the automatic ones', () => {
    const classes = heatmapClasses(grid(0, 100), { bounds: [60, 100, 140, 180], unit: 'min' })
    expect(classes.map((klass) => klass.limit)).toEqual([60, 100, 140, 180, Infinity])
    expect(classes.at(-1)!.label).toBe('≥ 180 min')
  })

  it('falls back to one class when there is nothing to divide', () => {
    const classes = heatmapClasses(grid(42, 42))
    expect(classes).toHaveLength(1)
    expect(classes[0].limit).toBe(Infinity)
    expect(heatmapClassFor(classes, 42)).toBe(0)
    // The one class takes the darkest colour, and says so: the CSS that turns
    // the text white keys on the ramp step, not on the place in the list.
    expect(classes[0].color).toBe('var(--color-chart-seq-5)')
    expect(classes[0].ramp).toBe(4)
  })

  it('numbers every class by its step of the ramp', () => {
    expect(heatmapClasses(grid(0, 100)).map((klass) => klass.ramp)).toEqual([0, 1, 2, 3, 4])
    // A range that yields four classes still ends on the darkest step.
    const four = heatmapClasses(grid(243, 315))
    expect(four.at(-1)!.ramp).toBe(four.length - 1)
  })

  it('never leaves a value without a class', () => {
    const classes = heatmapClasses(grid(0, 100))
    expect(
      classes.map((klass) => heatmapClassFor(classes, klass.limit === Infinity ? 999 : 0)),
    ).toContain(0)
    expect(heatmapClassFor(classes, 0)).toBe(0)
    expect(heatmapClassFor(classes, 20)).toBe(1)
    expect(heatmapClassFor(classes, 100)).toBe(4)
    expect(heatmapClassFor(classes, 10_000)).toBe(4)
  })

  it('gives each class its own colour, top class the darkest', () => {
    const classes = heatmapClasses(grid(0, 100))
    expect(classes.map((klass) => klass.color)).toEqual([
      'var(--color-chart-seq-1)',
      'var(--color-chart-seq-2)',
      'var(--color-chart-seq-3)',
      'var(--color-chart-seq-4)',
      'var(--color-chart-seq-5)',
    ])
  })
})
