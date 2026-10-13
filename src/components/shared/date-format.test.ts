/** The date input's arithmetic: reading, writing and moving a day. */
import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  clampDay,
  dayLabel,
  daysInMonth,
  endOfWeek,
  expandYear,
  formatDate,
  isIso,
  monthLabel,
  monthWeeks,
  parseDate,
  startOfWeek,
  todayIso,
  weekdayOf,
} from './date-format'

describe('parseDate()', () => {
  it('reads dd-mm-jjjj and the short forms, with three separators', () => {
    for (const text of [
      '03-10-2026',
      '3-10-2026',
      '3-10-26',
      '03.10.2026',
      '3/10/26',
      ' 3-10-2026 ',
    ]) {
      expect(parseDate(text, 2026)).toEqual({ kind: 'ok', iso: '2026-10-03' })
    }
  })

  it('takes an ISO day as it stands', () => {
    expect(parseDate('2026-10-03')).toEqual({ kind: 'ok', iso: '2026-10-03' })
  })

  it('is empty for nothing and invalid for a day that does not exist', () => {
    expect(parseDate('   ')).toEqual({ kind: 'empty' })
    const day = { kind: 'invalid', reason: 'day' }
    const format = { kind: 'invalid', reason: 'format' }
    expect(parseDate('31-02-2026')).toEqual(day)
    expect(parseDate('29-02-2026')).toEqual(day)
    expect(parseDate('00-10-2026')).toEqual(day)
    expect(parseDate('3-13-2026')).toEqual(day)
    expect(parseDate('morgen')).toEqual(format)
    expect(parseDate('3-10-202')).toEqual(format)
    expect(parseDate('3-10/2026 12:00')).toEqual(format)
    expect(parseDate('2026-02-30')).toEqual(format)
  })

  it('knows a leap day', () => {
    expect(parseDate('29-02-2028')).toEqual({ kind: 'ok', iso: '2028-02-29' })
    expect(parseDate('29-02-2000')).toEqual({ kind: 'ok', iso: '2000-02-29' })
    expect(parseDate('29-02-1900')).toEqual({ kind: 'invalid', reason: 'day' })
  })
})

describe('expandYear()', () => {
  it('puts a two-digit year at most ten years ahead of the reference', () => {
    expect(expandYear(26, 2026)).toBe(2026)
    expect(expandYear(36, 2026)).toBe(2036)
    expect(expandYear(37, 2026)).toBe(1937)
    expect(expandYear(0, 2026)).toBe(2000)
    expect(expandYear(5, 2095)).toBe(2105)
  })
})

describe('formatDate()', () => {
  it('writes dd-mm-jjjj, and nothing for what is not a day', () => {
    expect(formatDate('2026-10-03')).toBe('03-10-2026')
    expect(formatDate(null)).toBe('')
    expect(formatDate('2026-02-31')).toBe('')
    expect(isIso('2026-10-03')).toBe(true)
    expect(isIso('03-10-2026')).toBe(false)
  })
})

describe('moving a day', () => {
  it('adds days across months, years and the clock change', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30')
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26')
  })

  it('adds months, held to the end of a shorter month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29')
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15')
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15')
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28')
  })

  it('starts the week on Monday', () => {
    expect(weekdayOf('2026-10-05')).toBe(0)
    expect(weekdayOf('2026-10-04')).toBe(6)
    expect(startOfWeek('2026-10-03')).toBe('2026-09-28')
    expect(endOfWeek('2026-10-03')).toBe('2026-10-04')
  })

  it('holds a day between its bounds', () => {
    expect(clampDay('2026-10-03', '2026-10-05')).toBe('2026-10-05')
    expect(clampDay('2026-10-03', null, '2026-10-01')).toBe('2026-10-01')
    expect(clampDay('2026-10-03')).toBe('2026-10-03')
  })
})

describe('the month grid', () => {
  it('draws whole weeks from Monday to Sunday around the month', () => {
    const weeks = monthWeeks('2026-10-17')
    expect(weeks).toHaveLength(5)
    expect(weeks[0][0]).toBe('2026-09-28')
    expect(weeks[0][3]).toBe('2026-10-01')
    expect(weeks[4][6]).toBe('2026-11-01')
    for (const week of weeks) expect(week).toHaveLength(7)
  })

  it('has four rows for a February that starts on a Monday', () => {
    expect(daysInMonth(2027, 2)).toBe(28)
    expect(monthWeeks('2027-02-10')).toHaveLength(4)
  })

  it('has six rows when the month needs them', () => {
    // August 2026 starts on a Saturday and has 31 days.
    expect(monthWeeks('2026-08-01')).toHaveLength(6)
  })
})

describe('labels', () => {
  it('names the month and the day in Dutch', () => {
    expect(monthLabel('2026-10-03')).toBe('oktober 2026')
    expect(dayLabel('2026-10-03')).toBe('zaterdag 3 oktober 2026')
    expect(todayIso(new Date(2026, 9, 4, 23, 30))).toBe('2026-10-04')
  })
})
