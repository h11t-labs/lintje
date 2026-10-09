/**
 * The tint spread for the parts of one variable: for n parts the steps of the ladder from
 * 100 % down, wide enough that neighbours tell apart and never lighter than the count needs.
 */
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DATA_COLORS } from '../../../../tokens/colors'
import { tintsFor } from './tints'

// Read from disk: vitest does not run the CSS pipeline. Comments out, so prose is no match.
const css = readFileSync(resolvePath('src/tokens/tokens.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
)

const TINT = (n: number) => `var(--color-chart-tint-${n})`

describe('tintsFor', () => {
  it('gives each part count its own spread, darkest first', () => {
    expect(tintsFor(1)).toEqual([TINT(1)])
    expect(tintsFor(2)).toEqual([TINT(1), TINT(4)])
    expect(tintsFor(3)).toEqual([TINT(1), TINT(2), TINT(4)])
    expect(tintsFor(4)).toEqual([TINT(1), TINT(2), TINT(3), TINT(4)])
    expect(tintsFor(5)).toEqual([TINT(1), TINT(2), TINT(3), TINT(4), TINT(5)])
  })

  it('draws nothing without parts', () => {
    expect(tintsFor(0)).toEqual([])
    expect(tintsFor(-3)).toEqual([])
  })

  it('clamps beyond the ladder', () => {
    expect(tintsFor(7)).toEqual(tintsFor(5))
  })

  it('hands out copies, so a caller cannot change the spread', () => {
    const tints = tintsFor(2)
    tints.push(TINT(5))
    expect(tintsFor(2)).toHaveLength(2)
  })

  it('takes the ladder of the colour a figure brings, with the same spread', () => {
    const GREEN = (step: number) =>
      step === 1 ? 'var(--color-chart-green)' : `var(--color-chart-green-tint-${step})`
    expect(tintsFor(1, 'green')).toEqual([GREEN(1)])
    expect(tintsFor(2, 'green')).toEqual([GREEN(1), GREEN(4)])
    expect(tintsFor(5, 'green')).toEqual([GREEN(1), GREEN(2), GREEN(3), GREEN(4), GREEN(5)])
    expect(tintsFor(2, 'moss-green')).toEqual([
      'var(--color-chart-moss-green)',
      'var(--color-chart-moss-green-tint-4)',
    ])
  })

  it('falls back to the default ladder for a colour that is not a variable', () => {
    expect(tintsFor(3, 'other')).toEqual([TINT(1), TINT(2), TINT(4)])
    expect(tintsFor(3, '#ff0000')).toEqual([TINT(1), TINT(2), TINT(4)])
  })
})

describe('the stylesheet', () => {
  // A token that is not defined paints the part black, so every name tintsFor can return
  // stands in tokens.css.
  it.each(DATA_COLORS)('carries %s with its ladder', (color) => {
    for (const token of tintsFor(5, color)) {
      expect(css).toContain(`${token.slice('var('.length, -1)}:`)
    }
  })

  it('carries the default ladder', () => {
    for (const token of tintsFor(5)) expect(css).toContain(`${token.slice('var('.length, -1)}:`)
  })
})
