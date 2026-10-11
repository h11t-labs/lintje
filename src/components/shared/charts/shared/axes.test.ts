import { describe, expect, it } from 'vitest'
import { thinLabels } from './axes'

// Without a canvas a character measures 6.5 px, so "wo 2 sep" is 52 px.
const days = ['wo 2 sep', 'do 3 sep', 'vr 4 sep', 'za 5 sep', 'zo 6 sep', 'ma 7 sep', 'di 8 sep']
const at = (slot: number) => days.map((label, i) => ({ label, x: 40 + i * slot }))

describe('thinLabels', () => {
  it('keeps every label when the widest fits its slot', () => {
    expect(thinLabels(at(80))).toHaveLength(7)
  })

  it('keeps every second label, from the first on, when neighbours would touch', () => {
    expect(thinLabels(at(38)).map((label) => label.label)).toEqual([
      'wo 2 sep',
      'vr 4 sep',
      'zo 6 sep',
      'di 8 sep',
    ])
  })

  it('keeps a long name beside a short one when the pair has room', () => {
    // 19 characters ≈ 118 px: wider than the 93 px slot, but not into its 9-character neighbour.
    const names = [
      'Loket Utrecht A',
      'Loket Utrecht B',
      'Loket Utrecht C',
      'Eindhoven',
      'Rotterdam The Hague',
    ]
    expect(thinLabels(names.map((label, i) => ({ label, x: 60 + i * 110 })))).toHaveLength(5)
  })

  it('leaves a single label alone', () => {
    expect(thinLabels(at(10).slice(0, 1))).toHaveLength(1)
  })

  it('measures a label where its anchor puts it', () => {
    // "0" is 6.5 px and "30.000" 39 px: centred they clear each other, but a last label that
    // ends at its tick reaches back into the first.
    const ticks = (anchor?: 'end') => [
      { label: '0', x: 0 },
      { label: '30.000', x: 40, anchor },
    ]
    expect(thinLabels(ticks())).toHaveLength(2)
    expect(thinLabels(ticks('end'))).toHaveLength(1)
  })
})
