/**
 * Terms in a question: where they stand in a text, and which a reader is typing.
 * Shared by `lintje-chat-message` and `lintje-chat-composer`; the words come from the host.
 */
import type { ChatTermData, ChatTermRange } from '../../../types'

export interface ChatTextPart {
  text: string
  term?: ChatTermRange
}

/** Cuts a text at its term ranges; an empty, out-of-text or overlapping range is dropped. */
export function termParts(text: string, terms: ChatTermRange[] = []): ChatTextPart[] {
  const parts: ChatTextPart[] = []
  let at = 0
  for (const term of [...terms].sort((a, b) => a.start - b.start)) {
    if (term.start < at || term.end <= term.start || term.end > text.length) continue
    if (term.start > at) parts.push({ text: text.slice(at, term.start) })
    parts.push({ text: text.slice(term.start, term.end), term })
    at = term.end
  }
  if (at < text.length) parts.push({ text: text.slice(at) })
  return parts
}

const WORD = /[\p{L}\p{N}]/u

/**
 * Finds the vocabulary's terms: whole words, case-insensitive, longest spelling first, never
 * overlapping. A term is certain unless `ambiguous` or from a source not in `sources`.
 */
export function recogniseTerms(
  text: string,
  vocabulary: ChatTermData[] = [],
  sources?: string[],
): ChatTermRange[] {
  const lower = text.toLowerCase()
  const spellings = vocabulary
    .flatMap((term) => [term.label, ...(term.aliases ?? [])].map((word) => ({ word, term })))
    .filter(({ word }) => word.trim() !== '')
    .sort((a, b) => b.word.length - a.word.length)
  const found: ChatTermRange[] = []
  for (const { word, term } of spellings) {
    const needle = word.toLowerCase()
    for (let at = lower.indexOf(needle); at !== -1; at = lower.indexOf(needle, at + 1)) {
      const end = at + needle.length
      const inWord =
        (at > 0 && WORD.test(text[at - 1])) || (end < text.length && WORD.test(text[end]))
      if (inWord || found.some((range) => at < range.end && end > range.start)) continue
      const off =
        term.source !== undefined && sources !== undefined && !sources.includes(term.source)
      found.push({ start: at, end, kind: term.kind, certain: !(term.ambiguous || off) })
    }
  }
  return found.sort((a, b) => a.start - b.start)
}

export function wordBefore(text: string, caret: number = text.length): string {
  return /\S*$/.exec(text.slice(0, caret))?.[0] ?? ''
}

/** Terms with a word starting with the typed word: at most five, none for an exact match. */
export function completions(word: string, vocabulary: ChatTermData[] = []): ChatTermData[] {
  const typed = word.toLowerCase()
  if (!typed) return []
  return vocabulary
    .filter((term) => {
      const label = term.label.toLowerCase()
      return label !== typed && label.split(/\s+/).some((part) => part.startsWith(typed))
    })
    .slice(0, 5)
}
