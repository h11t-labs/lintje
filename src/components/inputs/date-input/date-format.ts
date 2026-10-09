/**
 * The date input's arithmetic. Typed `3-10-26` / `03.10.2026` (day, month, year), shown
 * `03-10-2026`, sent as ISO `2026-10-03`. `Date` objects are made at noon UTC so no time zone
 * or daylight-saving shift can move a day.
 */

export type ParsedDate =
  | { kind: 'empty' }
  /** `format`: not a date; `day`: a day that does not exist, such as 31-02. */
  | { kind: 'invalid'; reason: 'format' | 'day' }
  | { kind: 'ok'; iso: string }

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/
const TYPED = /^(\d{1,2})[-./](\d{1,2})[-./](\d{2}|\d{4})$/

const pad = (value: number, length: number = 2): string => String(value).padStart(length, '0')

/** The number of days in a month; `month` is 1–12. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** An ISO day from its parts, or `null` when that day does not exist. */
export function toIso(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || year < 1 || year > 9999) return null
  if (month < 1 || month > 12) return null
  if (day < 1 || day > daysInMonth(year, month)) return null
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`
}

export function partsOf(iso: string | null | undefined): [number, number, number] | null {
  const match = iso ? ISO.exec(iso) : null
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  return toIso(year, month, day) ? [year, month, day] : null
}

export const isIso = (value: string | null | undefined): value is string => partsOf(value) !== null

/** A two-digit year, in the century ending ten years after the reference: `37` → 1937 in 2026. */
export function expandYear(short: number, referenceYear: number): number {
  const century = Math.floor(referenceYear / 100) * 100
  const candidate = century + short
  if (candidate > referenceYear + 10) return candidate - 100
  if (candidate <= referenceYear - 90) return candidate + 100
  return candidate
}

/** Reads typed text; an ISO string is accepted too. */
export function parseDate(
  text: string,
  referenceYear: number = new Date().getFullYear(),
): ParsedDate {
  const trimmed = text.trim()
  if (trimmed === '') return { kind: 'empty' }
  if (isIso(trimmed)) return { kind: 'ok', iso: trimmed }
  const match = TYPED.exec(trimmed)
  if (!match) return { kind: 'invalid', reason: 'format' }
  const day = Number(match[1])
  const month = Number(match[2])
  const year =
    match[3].length === 2 ? expandYear(Number(match[3]), referenceYear) : Number(match[3])
  const iso = toIso(year, month, day)
  return iso ? { kind: 'ok', iso } : { kind: 'invalid', reason: 'day' }
}

/** ISO → `dd-mm-jjjj`; anything else → `''`. */
export function formatDate(iso: string | null | undefined): string {
  const parts = partsOf(iso)
  if (!parts) return ''
  const [year, month, day] = parts
  return `${pad(day)}-${pad(month)}-${pad(year, 4)}`
}

const noon = (iso: string): Date => {
  const [year, month, day] = partsOf(iso)!
  return new Date(Date.UTC(year, month - 1, day, 12))
}

const fromNoon = (date: Date): string =>
  `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`

export function addDays(iso: string, count: number): string {
  const date = noon(iso)
  date.setUTCDate(date.getUTCDate() + count)
  return fromNoon(date)
}

/** `count` months later, held to the last day of a shorter month: 31-01 + 1 is 28-02. */
export function addMonths(iso: string, count: number): string {
  const [year, month, day] = partsOf(iso)!
  const index = year * 12 + (month - 1) + count
  const nextYear = Math.floor(index / 12)
  const nextMonth = (index % 12) + 1
  return toIso(nextYear, nextMonth, Math.min(day, daysInMonth(nextYear, nextMonth)))!
}

/** 0 for Monday … 6 for Sunday. */
export function weekdayOf(iso: string): number {
  return (noon(iso).getUTCDay() + 6) % 7
}

export const startOfWeek = (iso: string): string => addDays(iso, -weekdayOf(iso))
export const endOfWeek = (iso: string): string => addDays(iso, 6 - weekdayOf(iso))

/** What a key does to the focused day of a month grid. */
export const DAY_MOVES: Record<string, (day: string) => string> = {
  ArrowLeft: (day) => addDays(day, -1),
  ArrowRight: (day) => addDays(day, 1),
  ArrowUp: (day) => addDays(day, -7),
  ArrowDown: (day) => addDays(day, 7),
  PageUp: (day) => addMonths(day, -1),
  PageDown: (day) => addMonths(day, 1),
  Home: startOfWeek,
  End: endOfWeek,
}

export function startOfMonth(iso: string): string {
  const [year, month] = partsOf(iso)!
  return toIso(year, month, 1)!
}

/** The month's weeks, Monday on or before the first to Sunday on or after the last. */
export function monthWeeks(iso: string): string[][] {
  const first = startOfMonth(iso)
  const [year, month] = partsOf(first)!
  const last = toIso(year, month, daysInMonth(year, month))!
  const weeks: string[][] = []
  for (let day = startOfWeek(first); day <= last; day = addDays(day, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, offset) => addDays(day, offset)))
  }
  return weeks
}

export function clampDay(iso: string, min?: string | null, max?: string | null): string {
  if (isIso(min) && iso < min) return min
  if (isIso(max) && iso > max) return max
  return iso
}

export function todayIso(now: Date = new Date()): string {
  return toIso(now.getFullYear(), now.getMonth() + 1, now.getDate())!
}

const MONTHS = [
  'januari',
  'februari',
  'maart',
  'april',
  'mei',
  'juni',
  'juli',
  'augustus',
  'september',
  'oktober',
  'november',
  'december',
]

export function monthLabel(iso: string): string {
  const [year, month] = partsOf(iso)!
  return `${MONTHS[month - 1]} ${year}`
}

export function dayLabel(iso: string): string {
  const [year, month, day] = partsOf(iso)!
  const weekday = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag']
  return `${weekday[weekdayOf(iso)]} ${day} ${MONTHS[month - 1]} ${year}`
}
