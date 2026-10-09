/** The time input's arithmetic: reading and moving a clock time. */
import { describe, expect, it } from 'vitest'
import { addMinutes, clampTime, fromMinutes, isTime, parseTime, toMinutes } from './time-format'

const ok = (time: string) => ({ kind: 'ok', time })

describe('parseTime()', () => {
  it('reads the four forms the design names', () => {
    expect(parseTime('1435')).toEqual(ok('14:35'))
    expect(parseTime('14.35')).toEqual(ok('14:35'))
    expect(parseTime('14:35')).toEqual(ok('14:35'))
    expect(parseTime('9')).toEqual(ok('09:00'))
  })

  it('reads the forms in between', () => {
    expect(parseTime('930')).toEqual(ok('09:30'))
    expect(parseTime('9:05')).toEqual(ok('09:05'))
    expect(parseTime('14')).toEqual(ok('14:00'))
    expect(parseTime('0')).toEqual(ok('00:00'))
    expect(parseTime(' 23:59 ')).toEqual(ok('23:59'))
  })

  it('is empty for nothing and invalid for what is no time', () => {
    expect(parseTime('  ')).toEqual({ kind: 'empty' })
    for (const text of ['24:00', '2400', '12:60', '25', '9:5', '14:35:00', 'kwart over', '12345']) {
      expect(parseTime(text)).toEqual({ kind: 'invalid' })
    }
  })
})

describe('moving a time', () => {
  it('counts minutes since midnight', () => {
    expect(toMinutes('14:35')).toBe(875)
    expect(toMinutes('24:00')).toBeNull()
    expect(isTime('07:05')).toBe(true)
    expect(isTime('7:05')).toBe(false)
    expect(fromMinutes(875)).toBe('14:35')
  })

  it('goes round the clock', () => {
    expect(addMinutes('23:59', 1)).toBe('00:00')
    expect(addMinutes('00:00', -1)).toBe('23:59')
    expect(addMinutes('14:35', 15)).toBe('14:50')
    expect(addMinutes('14:50', 15)).toBe('15:05')
  })

  it('holds a time between its bounds', () => {
    expect(clampTime('07:00', '08:00', '18:00')).toBe('08:00')
    expect(clampTime('19:00', '08:00', '18:00')).toBe('18:00')
    expect(clampTime('12:00')).toBe('12:00')
  })
})
