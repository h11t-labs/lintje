/**
 * The term arithmetic: cutting a text at its ranges, finding the vocabulary's
 * terms in what a reader types, and what the word being typed could become.
 */
import { describe, expect, it } from 'vitest'
import { completions, recogniseTerms, termParts, wordBefore } from './chat-terms'
import type { ChatTermData } from '../../../types'

const VOCABULARY: ChatTermData[] = [
  { label: 'wachttijd', kind: 'Definitie', source: 'requests', aliases: ['wachttijden'] },
  { label: 'bezetting', kind: 'Definitie', source: 'staffing' },
  { label: 'Amsterdam', kind: 'Loket', ambiguous: true },
  { label: 'Loket Amsterdam Centrum', kind: 'Loket' },
  { label: 'vorige week', kind: 'Periode' },
]

describe('termParts', () => {
  it('cuts the text at its ranges', () => {
    expect(termParts('abc def ghi', [{ start: 4, end: 7, kind: 'x' }])).toEqual([
      { text: 'abc ' },
      { text: 'def', term: { start: 4, end: 7, kind: 'x' } },
      { text: ' ghi' },
    ])
  })

  it('drops a range that overlaps, is empty or runs past the text', () => {
    const parts = termParts('abc def', [
      { start: 0, end: 3 },
      { start: 2, end: 5 },
      { start: 5, end: 5 },
      { start: 4, end: 40 },
    ])
    expect(parts.map((part) => part.text)).toEqual(['abc', ' def'])
  })
})

describe('recogniseTerms', () => {
  const words = (text: string, sources?: string[]) =>
    recogniseTerms(text, VOCABULARY, sources).map((term) => [
      text.slice(term.start, term.end),
      term.kind,
      term.certain,
    ])

  it('finds whole words, whatever their case, and an alias', () => {
    expect(words('De Wachttijd en de wachttijden van vorige week')).toEqual([
      ['Wachttijd', 'Definitie', true],
      ['wachttijden', 'Definitie', true],
      ['vorige week', 'Periode', true],
    ])
  })

  it('leaves a word alone that only contains a term', () => {
    expect(words('wachttijdnorm en onderbezetting')).toEqual([])
  })

  it('takes the longest spelling and never marks the same letters twice', () => {
    expect(words('bij Loket Amsterdam Centrum en in Amsterdam')).toEqual([
      ['Loket Amsterdam Centrum', 'Loket', true],
      ['Amsterdam', 'Loket', false],
    ])
  })

  it('marks a term of a source that is off as not certain', () => {
    expect(words('wachttijd en bezetting', ['requests'])).toEqual([
      ['wachttijd', 'Definitie', true],
      ['bezetting', 'Definitie', false],
    ])
    // Without a list of sources nothing is switched off.
    expect(words('bezetting')).toEqual([['bezetting', 'Definitie', true]])
  })
})

describe('completions', () => {
  it('reads the word before the caret', () => {
    expect(wordBefore('Hoe was de wach')).toBe('wach')
    expect(wordBefore('Hoe was de wach en', 15)).toBe('wach')
    expect(wordBefore('Hoe was de ')).toBe('')
  })

  it('offers the terms a word of which starts with what was typed', () => {
    expect(completions('ams', VOCABULARY).map((term) => term.label)).toEqual([
      'Amsterdam',
      'Loket Amsterdam Centrum',
    ])
    expect(completions('', VOCABULARY)).toEqual([])
  })

  it('offers nothing for a word that already is the term', () => {
    expect(completions('bezetting', VOCABULARY)).toEqual([])
  })
})
