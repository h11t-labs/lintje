import { describe, expect, it } from 'vitest'
import { resultsText, splitMatch } from './search-text'

describe('splitMatch', () => {
  it('cuts a label around the first occurrence of the term, without case', () => {
    expect(splitMatch('Teamoverleg 2 oktober', 'teamoverleg')).toEqual([
      '',
      'Teamoverleg',
      ' 2 oktober',
    ])
    expect(splitMatch('Vergaderzaal 2', 'vergader')).toEqual(['', 'Vergader', 'zaal 2'])
    expect(splitMatch('Ontvangsthal 1', ' hal ')).toEqual(['Ontvangst', 'hal', ' 1'])
  })

  it('has nothing to mark without the term or without a term', () => {
    expect(splitMatch('Perron', 'hal')).toBeNull()
    expect(splitMatch('Nieuwe opname', 'xyz')).toBeNull()
    expect(splitMatch('Nieuwe opname', '  ')).toBeNull()
  })
})

describe('resultsText', () => {
  it('counts the results in Dutch', () => {
    expect(resultsText(1)).toBe('1 resultaat')
    expect(resultsText(3)).toBe('3 resultaten')
  })
})
