/**
 * The style guide's overview draws every element as a sketch (`examples/styleguide/sketches.js`),
 * and the chart chooser every kind: a new one without a recipe would stand as an empty box.
 */
import { describe, expect, it } from 'vitest'
import { CATEGORIES } from '../categories'
import { CHART_KINDS } from '../components/shared/charts/kinds'

interface Sketches {
  SKETCHES: Record<string, unknown>
  KIND_SKETCHES: Record<string, string>
}

const [sketches] = Object.values(
  import.meta.glob<Sketches>('../../examples/styleguide/sketches.js', { eager: true }),
) as Sketches[]

describe('the style guide sketches', () => {
  it('have a recipe for every element of every category', () => {
    const missing = CATEGORIES.flatMap((category) => category.elements).filter(
      (name) => !sketches!.SKETCHES[name],
    )
    expect(missing).toEqual([])
  })

  it('draw every chart kind', () => {
    expect(Object.keys(sketches!.KIND_SKETCHES).sort()).toEqual(Object.keys(CHART_KINDS).sort())
  })
})
