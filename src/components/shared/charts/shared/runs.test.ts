import { describe, expect, it } from 'vitest'
import { knownRuns } from './runs'

describe('knownRuns', () => {
  const index = (_: number, i: number) => i

  it('ends a run at every missing value', () => {
    expect(knownRuns([40, 42, null, 45, 47, null, 50], index)).toEqual([[0, 1], [3, 4], [6]])
  })

  it('has no run for missing values only, at the ends or in a row', () => {
    expect(knownRuns([null, null], index)).toEqual([])
    expect(knownRuns([null, 1, undefined, null, 2, null], index)).toEqual([[1], [4]])
  })
})
