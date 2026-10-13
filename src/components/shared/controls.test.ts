/** What a control posts in a native form: the wire shape of each kind of value. */
import { describe, expect, it } from 'vitest'
import { formEntries } from './controls'

describe('formEntries', () => {
  it('posts a text or a number under the name, and an empty string for nothing chosen', () => {
    expect(formEntries('naam', 'Jan')).toEqual([['naam', 'Jan']])
    expect(formEntries('aantal', 3)).toEqual([['aantal', '3']])
    expect(formEntries('datum', null)).toEqual([['datum', '']])
  })

  it('posts a checked box as `on` and an unchecked one not at all, like a native checkbox', () => {
    expect(formEntries('akkoord', true)).toEqual([['akkoord', 'on']])
    expect(formEntries('akkoord', false)).toEqual([])
  })

  it('repeats the name for a list, and posts nothing for an empty one', () => {
    expect(formEntries('tags', ['a', 'c'])).toEqual([
      ['tags', 'a'],
      ['tags', 'c'],
    ])
    expect(formEntries('tags', [])).toEqual([])
  })

  it('posts a pair as name-from and name-to, an open end as an empty string', () => {
    expect(formEntries('periode', { from: '2026-10-01', to: null })).toEqual([
      ['periode-from', '2026-10-01'],
      ['periode-to', ''],
    ])
  })
})
