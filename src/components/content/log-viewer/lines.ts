/** What the log viewer works out from its lines, apart from drawing them. */
import type { LogEntry, LogLevel } from '../../../types'
import type { CsvCell } from '../../shared/download'

/** A longer message shows this many lines and a button for the rest. */
export const FOLD_AFTER = 5
export const FOLD_SHOW = 4

export const LEVEL_WORD: Record<LogLevel, string> = {
  error: 'Fout',
  warning: 'Let op',
  info: 'Info',
  debug: 'Debug',
}

const ESC = 0x1b
const BEL = 0x07

/** The text without terminal codes (CSI colour and cursor, OSC titles); colour carries no meaning here. */
export function plain(text: string): string {
  if (!text.includes('\u001b')) return text
  let out = ''
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) !== ESC) {
      out += text[i]
      continue
    }
    const kind = text[i + 1]
    if (kind === '[') {
      // Parameters and intermediates up to a final byte from @ to ~.
      i += 2
      while (i < text.length && !(text.charCodeAt(i) >= 0x40 && text.charCodeAt(i) <= 0x7e)) i += 1
    } else if (kind === ']') {
      // Up to BEL or ESC \.
      i += 2
      while (i < text.length && text.charCodeAt(i) !== BEL) {
        if (text.charCodeAt(i) === ESC && text[i + 1] === '\\') {
          i += 1
          break
        }
        i += 1
      }
    } else {
      i += 1
    }
  }
  return out
}

/** No line says when, how bad or from where: the lines are drawn as plain output. */
export function isRaw(entries: readonly LogEntry[]): boolean {
  return entries.length > 0 && !entries.some((entry) => entry.time || entry.level || entry.source)
}

/** How often `term` stands in `text`, ignoring case; `term` is lower case. */
export function countHits(text: string, term: string): number {
  if (!term) return 0
  let count = 0
  const lower = text.toLowerCase()
  for (let at = lower.indexOf(term); at !== -1; at = lower.indexOf(term, at + term.length)) {
    count += 1
  }
  return count
}

export interface Part {
  text: string
  /** The hit's number in the whole log, from 1; absent for the text between hits. */
  hit?: number
}

/** The text cut at each hit; `first` is the number the first hit in it gets. */
export function splitHits(text: string, term: string, first: number): Part[] {
  if (!term) return [{ text }]
  const parts: Part[] = []
  const lower = text.toLowerCase()
  let from = 0
  let hit = first
  for (let at = lower.indexOf(term); at !== -1; at = lower.indexOf(term, from)) {
    if (at > from) parts.push({ text: text.slice(from, at) })
    parts.push({ text: text.slice(at, at + term.length), hit })
    hit += 1
    from = at + term.length
  }
  if (from < text.length) parts.push({ text: text.slice(from) })
  return parts
}

/** The lines a folded message shows, and how many it hides; `hidden` is 0 for a short one. */
export function fold(text: string): { shown: string; hidden: number } {
  const lines = text.split('\n')
  if (lines.length <= FOLD_AFTER) return { shown: text, hidden: 0 }
  return { shown: lines.slice(0, FOLD_SHOW).join('\n'), hidden: lines.length - FOLD_SHOW }
}

const pad = (n: number, width: number): string => String(n).padStart(width, '0')

/** The time since `start` as `+mm:ss.mmm`; `null` when either moment does not parse. */
export function since(at: string | undefined, start: string | undefined): string | null {
  const moment = at ? Date.parse(at) : NaN
  const origin = start ? Date.parse(start) : NaN
  if (Number.isNaN(moment) || Number.isNaN(origin)) return null
  const ms = Math.max(0, moment - origin)
  const minutes = Math.floor(ms / 60_000)
  return `+${pad(minutes, 2)}:${pad(Math.floor(ms / 1000) % 60, 2)}.${pad(ms % 1000, 3)}`
}

/** One line as text, as a terminal would show it. */
export function lineText(entry: LogEntry): string {
  const level = entry.level ? entry.level.toUpperCase() : ''
  const head = [entry.time, level, entry.source].filter(Boolean).join(' ')
  return head ? `${head} ${plain(entry.message)}` : plain(entry.message)
}

export const asText = (entries: readonly LogEntry[]): string => entries.map(lineText).join('\n')

export const asJson = (entries: readonly LogEntry[]): string =>
  JSON.stringify(
    entries.map((entry) => ({ ...entry, message: plain(entry.message) })),
    null,
    2,
  )

/** The rows of a spreadsheet: one column per field, the message without terminal codes. */
export const csvRows = (entries: readonly LogEntry[]): CsvCell[][] => [
  ['tijd', 'niveau', 'bron', 'bericht'],
  ...entries.map((entry) => [
    entry.at ?? entry.time,
    entry.level,
    entry.source,
    plain(entry.message),
  ]),
]
