import { describe, expect, it } from 'vitest'
import { foldStack, isOtherPart } from './fold'

const parts = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ label: `Deel ${i + 1}`, values: [i + 1, i + 2] }))

describe('foldStack', () => {
  it('leaves five parts as they are', () => {
    expect(foldStack(parts(5), () => true)).toEqual(parts(5))
  })

  it('keeps the four largest in their order and folds the rest into "Overig" on top', () => {
    const folded = foldStack(parts(7), () => true)
    expect(folded.map((row) => row.label)).toEqual([
      'Deel 4',
      'Deel 5',
      'Deel 6',
      'Deel 7',
      'Overig',
    ])
    const other = folded[4]
    expect(isOtherPart(other) && other.folded.map((row) => row.label)).toEqual([
      'Deel 1',
      'Deel 2',
      'Deel 3',
    ])
    expect(other.values).toEqual([6, 9])
  })

  it('counts only the parts that take a rung, and leaves a part with its own colour', () => {
    const rows = [{ label: 'Eigen', values: [1], color: 'red' }, ...parts(5)]
    expect(foldStack(rows, (row) => !('color' in row))).toEqual(rows)
  })

  it('leaves "Overig" missing where a folded part is missing, never the sum of the rest', () => {
    const rows = parts(6).map((row, i) => (i === 0 ? { ...row, values: [null, 2] } : row))
    expect(foldStack(rows, () => true).at(-1)!.values).toEqual([null, 2 + 3])
  })
})
