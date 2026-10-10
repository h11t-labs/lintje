/** The time input's arithmetic: a 24-hour clock time without day or zone, written as `HH:MM`. */

export type ParsedTime = { kind: 'empty' } | { kind: 'invalid' } | { kind: 'ok'; time: string }

const MINUTES_PER_DAY = 24 * 60
const SEPARATED = /^(\d{1,2})[:.](\d{2})$/
const DIGITS = /^\d{1,4}$/
const TIME = /^(\d{2}):(\d{2})$/

const pad = (value: number): string => String(value).padStart(2, '0')

/** `HH:MM` from an hour and a minute, or `null` when that is no time on the clock. */
export function toTime(hour: number, minute: number): string | null {
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return `${pad(hour)}:${pad(minute)}`
}

/** Minutes since midnight, or `null` when the string is not `HH:MM`. */
export function toMinutes(time: string | null | undefined): number | null {
  const match = time ? TIME.exec(time) : null
  if (!match) return null
  const [hour, minute] = [Number(match[1]), Number(match[2])]
  return toTime(hour, minute) ? hour * 60 + minute : null
}

export const isTime = (value: string | null | undefined): value is string =>
  toMinutes(value) !== null

/** Minutes since midnight → `HH:MM`, round the clock: 1440 is 00:00 again. */
export function fromMinutes(minutes: number): string {
  const wrapped = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  return `${pad(Math.floor(wrapped / 60))}:${pad(wrapped % 60)}`
}

/** Reads typed text: `9` → 09:00, `930` → 09:30, `1435`, `14.35` and `14:35` → 14:35. */
export function parseTime(text: string): ParsedTime {
  const trimmed = text.trim()
  if (trimmed === '') return { kind: 'empty' }
  let hour: number
  let minute: number
  const separated = SEPARATED.exec(trimmed)
  if (separated) {
    hour = Number(separated[1])
    minute = Number(separated[2])
  } else if (DIGITS.test(trimmed)) {
    const digits = trimmed.length <= 2 ? `${trimmed}00` : trimmed
    hour = Number(digits.slice(0, -2))
    minute = Number(digits.slice(-2))
  } else {
    return { kind: 'invalid' }
  }
  const time = toTime(hour, minute)
  return time ? { kind: 'ok', time } : { kind: 'invalid' }
}

export function addMinutes(time: string, count: number): string {
  return fromMinutes((toMinutes(time) ?? 0) + count)
}

/** The time on the clock now, rounded to the nearest `step` minutes: 10:52 with 15 is 10:45. */
export function nowRounded(step: number, now: Date = new Date()): string {
  const minutes = now.getHours() * 60 + now.getMinutes()
  const size = step > 0 ? step : 1
  return fromMinutes(Math.round(minutes / size) * size)
}

export function clampTime(time: string, min?: string | null, max?: string | null): string {
  if (isTime(min) && time < min) return min
  if (isTime(max) && time > max) return max
  return time
}

/** The times from `min` (default 00:00) to `max` (default the end of the day), `step` minutes apart. */
export function timesBetween(min?: string | null, max?: string | null, step = 15): string[] {
  const size = step >= 1 ? Math.floor(step) : 1
  const from = toMinutes(min) ?? 0
  const to = toMinutes(max) ?? MINUTES_PER_DAY - 1
  const times: string[] = []
  for (let minutes = from; minutes <= to; minutes += size) times.push(fromMinutes(minutes))
  return times
}

/** The first of a sorted list at or after `time`, else its last; `''` for an empty list. */
export function timeAtOrAfter(times: string[], time: string): string {
  return times.find((entry) => entry >= time) ?? times[times.length - 1] ?? ''
}
