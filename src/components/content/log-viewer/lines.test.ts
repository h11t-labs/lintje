import { describe, expect, it } from 'vitest'
import {
  asJson,
  asText,
  countHits,
  csvRows,
  fold,
  isRaw,
  lineText,
  plain,
  since,
  splitHits,
} from './lines'

describe('log lines', () => {
  it('drops terminal colour and title codes', () => {
    expect(plain('\u001b[31mFout\u001b[0m bij \u001b[1;33mimport\u001b[m')).toBe('Fout bij import')
    expect(plain('\u001b]0;titel\u0007klaar')).toBe('klaar')
  })

  it('draws lines as plain output only when none has a time, level or source', () => {
    expect(
      isRaw([
        { id: 'a', message: 'x' },
        { id: 'b', message: 'y', line: 2 },
      ]),
    ).toBe(true)
    expect(
      isRaw([
        { id: 'a', message: 'x' },
        { id: 'b', message: 'y', level: 'info' },
      ]),
    ).toBe(false)
    expect(isRaw([])).toBe(false)
  })

  it('counts and cuts the hits, ignoring case, numbered on from the first', () => {
    expect(countHits('Timeout na timeout', 'timeout')).toBe(2)
    expect(countHits('niets', '')).toBe(0)
    expect(splitHits('Een Timeout, nog een timeout', 'timeout', 3)).toEqual([
      { text: 'Een ' },
      { text: 'Timeout', hit: 3 },
      { text: ', nog een ' },
      { text: 'timeout', hit: 4 },
    ])
  })

  it('folds a message of more than five lines to four', () => {
    const trace = ['Fout', 'a', 'b', 'c', 'd', 'e', 'f'].join('\n')
    expect(fold(trace)).toEqual({ shown: 'Fout\na\nb\nc', hidden: 3 })
    expect(fold('één\ntwee')).toEqual({ shown: 'één\ntwee', hidden: 0 })
  })

  it('writes the time since the first line, or nothing when a moment is missing', () => {
    expect(since('2026-10-12T14:04:24.016', '2026-10-12T14:03:21.004')).toBe('+01:03.012')
    expect(since(undefined, '2026-10-12T14:03:21.004')).toBeNull()
  })

  it('writes the lines as text, JSON and spreadsheet rows without codes', () => {
    const entries = [
      {
        id: 'a',
        at: '2026-10-12T14:03:21.004',
        time: '14:03:21.004',
        level: 'error' as const,
        source: 'import',
        message: '\u001b[31mTimeout\u001b[0m',
      },
      { id: 'b', message: 'los' },
    ]
    expect(lineText(entries[0]!)).toBe('14:03:21.004 ERROR import Timeout')
    expect(asText(entries)).toBe('14:03:21.004 ERROR import Timeout\nlos')
    expect(JSON.parse(asJson(entries))[0].message).toBe('Timeout')
    expect(csvRows(entries)).toEqual([
      ['tijd', 'niveau', 'bron', 'bericht'],
      ['2026-10-12T14:03:21.004', 'error', 'import', 'Timeout'],
      [undefined, undefined, undefined, 'los'],
    ])
  })
})
