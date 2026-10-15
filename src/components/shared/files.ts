/**
 * Files as the host keeps them, and what the upload field, the chat's question box and the
 * attachment chip all say about them: the size, the accepted types, a refusal and the news.
 */
import { holdsFocus } from '../../core/focus'

/** One file, as the host keeps it: chosen, sent along with a question or given back in an answer. */
export interface UploadFile {
  id: string
  name: string
  /** In bytes. Without it and without `detail`, only the name stands. */
  size?: number
  state: 'busy' | 'done' | 'error'
  /** 0–100 while busy; left out, the line is indeterminate. */
  progress?: number
  /** Why it failed or was refused, in Dutch. */
  message?: string
  /** The MIME type; it picks the icon. Without it the extension does. */
  type?: string
  /** Stands in for the size: "blz. 4" beside a source. */
  detail?: string
  /** A small picture the host made; an image without one gets the blank sheet. */
  thumbnail?: string
  /** The chip is a link to it. */
  href?: string
  /** With `href`: the link hands over the file, and the browser keeps the click. */
  download?: boolean
  /** With `state: 'error'`: the upload can be tried again. */
  retry?: boolean
}

const DECIMAL = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 1 })

export function formatSize(bytes: number): string {
  const units: [number, string][] = [
    [1024 ** 3, 'GB'],
    [1024 ** 2, 'MB'],
    [1024, 'kB'],
  ]
  for (const [size, unit] of units) {
    if (bytes >= size) {
      const value = bytes / size
      return `${unit === 'kB' ? Math.round(value) : DECIMAL.format(value)} ${unit}`
    }
  }
  return `${bytes} B`
}

const KINDS: Record<string, string> = {
  image: 'afbeeldingen',
  audio: 'geluid',
  video: 'video',
  text: 'tekst',
}

export function typesText(accept: string): string {
  const names = accept
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      if (token.startsWith('.')) return token.slice(1).toUpperCase()
      const [kind, sub] = token.split('/')
      if (sub === '*') return KINDS[kind] ?? kind
      return (sub ?? kind).toUpperCase()
    })
  if (names.length < 2) return names.join('')
  return `${names.slice(0, -1).join(', ')} of ${names[names.length - 1]}`
}

/** The types and the largest size, as the line under a drop zone: "PDF of JPG · hoogstens 10 MB". */
export function limitsText(accept: string, maxSize: number | undefined): string {
  const parts = [accept ? typesText(accept) : '', maxSize ? `hoogstens ${formatSize(maxSize)}` : '']
  return parts.filter(Boolean).join(' · ')
}

export function accepts(file: { name: string; type: string }, accept: string): boolean {
  const tokens = accept
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
  if (!tokens.length) return true
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()
  return tokens.some((token) => {
    if (token.startsWith('.')) return name.endsWith(token)
    if (token.endsWith('/*')) return type.startsWith(token.slice(0, -1))
    return type === token
  })
}

export function refusal(
  file: { name: string; type: string; size: number },
  accept: string,
  maxSize: number | undefined,
): string {
  if (!accepts(file, accept)) return 'Dit bestandstype kan niet'
  if (maxSize && file.size > maxSize) return `Groter dan ${formatSize(maxSize)}`
  return ''
}

/** A file's state in words: the icon and the line beside the name are drawing only. */
export const STATE_TEXT = {
  busy: 'bezig',
  done: 'klaar',
  /** An error of the host's: the upload failed. */
  error: 'mislukt',
  /** An error of the element's own: it never let the file through. */
  refused: 'geweigerd',
} as const

/** What changed between two lists, for a status region. `refused`: the errors are the element's own. */
export function rowNews(before: UploadFile[], after: UploadFile[], refused = false): string {
  const known = new Map(before.map((row) => [row.id, row.state]))
  const news: string[] = []
  for (const row of after) {
    const was = known.get(row.id)
    if (was === row.state) continue
    if (row.state === 'error') {
      const word = refused ? STATE_TEXT.refused : STATE_TEXT.error
      news.push(row.message ? `${row.name} ${word}: ${row.message}` : `${row.name} ${word}`)
    } else if (row.state === 'done') news.push(`${row.name} ${STATE_TEXT.done}`)
    else if (was === undefined) news.push(`${row.name} toegevoegd`)
  }
  return news.join('. ')
}

/** What a drop zone says while files hang over it; `count` is 0 when the browser does not say. */
export function dropText(count: number): string {
  if (!count) return 'Laat los om de bestanden toe te voegen'
  return `Laat los om ${count} ${count === 1 ? 'bestand' : 'bestanden'} toe te voegen`
}

/** Whether a drag carries files, and not only text or a link. */
export const carriesFiles = (event: DragEvent): boolean =>
  [...(event.dataTransfer?.types ?? [])].includes('Files')

/** The files on the clipboard, only when it carries no text: pasted text stays text. */
export function pastedFiles(event: ClipboardEvent): File[] {
  const data = event.clipboardData
  if (!data || data.getData('text/plain')) return []
  return [...(data.files ?? [])]
}

/**
 * The focus of a list of files whose rows can leave: held before the rows change, and handed to
 * the row now in its place (else the one before, else `fallback`) once its row has left.
 * A row is an element with `data-id` that takes the focus through its own `focus()`.
 */
export class RowFocus {
  #held: { id: string; index: number } | null = null

  hold(rows: HTMLElement[]): void {
    const index = rows.findIndex((row) => holdsFocus(row))
    this.#held = index < 0 ? null : { id: rows[index].dataset.id ?? '', index }
  }

  restore(rows: HTMLElement[], fallback: () => void): void {
    const was = this.#held
    this.#held = null
    if (!was || rows.some((row) => row.dataset.id === was.id)) return
    const next = rows[Math.min(was.index, rows.length - 1)]
    if (next) next.focus()
    else fallback()
  }
}
